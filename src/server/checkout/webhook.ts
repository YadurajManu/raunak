import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { applyPayment } from "./service";
import {
  cashfree,
  type PaymentProvider,
  verifyCashfreeSignature,
} from "@/server/providers/payments/cashfree";

const schema = z
  .object({
    type: z.enum([
      "PAYMENT_SUCCESS_WEBHOOK",
      "PAYMENT_FAILED_WEBHOOK",
      "PAYMENT_USER_DROPPED_WEBHOOK",
    ]),
    data: z.object({
      order: z.object({
        order_id: z.string().min(1),
        order_currency: z.literal("INR"),
      }),
      payment: z
        .object({
          cf_payment_id: z.union([z.string(), z.number()]),
          payment_status: z.enum(["SUCCESS", "FAILED", "USER_DROPPED"]),
          payment_amount: z.number().nonnegative(),
          payment_currency: z.literal("INR"),
          payment_time: z.string().optional(),
          payment_group: z.string().optional(),
        })
        .passthrough(),
    }),
  })
  .passthrough();
export async function processCashfreeWebhook(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  provider: PaymentProvider = cashfree,
  secret?: string,
) {
  if (!verifyCashfreeSignature(raw, timestamp, signature, secret))
    throw new Error("Invalid webhook signature.");
  const payload = schema.parse(JSON.parse(raw));
  const expectedStatus = {
    PAYMENT_SUCCESS_WEBHOOK: "SUCCESS",
    PAYMENT_FAILED_WEBHOOK: "FAILED",
    PAYMENT_USER_DROPPED_WEBHOOK: "USER_DROPPED",
  }[payload.type];
  if (payload.data.payment.payment_status !== expectedStatus)
    throw new Error("Payment event mismatch.");
  const id = `${payload.data.payment.cf_payment_id}:${payload.data.payment.payment_status}`;
  const order = await db.order.findUnique({
    where: { cashfreeOrderId: payload.data.order.order_id },
  });
  // A merchant account can notify several apps; unrelated orders need no retry.
  if (!order) return null;
  const existing = await db.webhookEvent.findUnique({
    where: {
      provider_idempotencyKey: { provider: "cashfree", idempotencyKey: id },
    },
  });
  if (existing?.status === "PROCESSED") return order;
  if (!existing) {
    try {
      await db.webhookEvent.create({
        data: {
          provider: "cashfree",
          idempotencyKey: id,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ))
        throw error;
    }
  }
  try {
    const payment = payload.data.payment;
    const result =
      payment.payment_status === "SUCCESS"
        ? await applyPayment(
            order.id,
            {
              id: String(payment.cf_payment_id),
              status: "SUCCESS",
              amountPaise: Math.round(payment.payment_amount * 100),
              method: payment.payment_group,
              paidAt: payment.payment_time,
              raw: payload,
            },
            provider,
          )
        // Failed attempts can be retried in the same Cashfree checkout session.
        : order;
    await db.webhookEvent.update({
      where: {
        provider_idempotencyKey: { provider: "cashfree", idempotencyKey: id },
      },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return result;
  } catch (error) {
    await db.webhookEvent.update({
      where: {
        provider_idempotencyKey: { provider: "cashfree", idempotencyKey: id },
      },
      data: { status: "FAILED" },
    });
    throw error;
  }
}
