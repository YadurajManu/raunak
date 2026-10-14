import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type ProviderPayment = {
  id: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED";
  amountPaise: number;
  method?: string;
  paidAt?: string;
  raw: unknown;
};
export interface PaymentProvider {
  createOrder(input: {
    orderId: string;
    amountPaise: number;
    customerId: string;
    name: string;
    email: string;
    phone: string;
    returnUrl: string;
    notifyUrl: string;
    expiresAt: Date;
  }): Promise<{ paymentSessionId: string }>;
  getPayments(orderId: string): Promise<ProviderPayment[]>;
  getRefund(
    orderId: string,
    refundId: string,
  ): Promise<{ providerRefundId: string; status: string }>;
  refund(input: {
    orderId: string;
    refundId: string;
    amountPaise: number;
    reason: string;
  }): Promise<{ providerRefundId: string; status: string }>;
}

function config() {
  const parsed = z
    .object({
      CASHFREE_ENV: z.enum(["sandbox", "production"]),
      CASHFREE_APP_ID: z.string().min(1),
      CASHFREE_SECRET_KEY: z.string().min(1),
      CASHFREE_API_VERSION: z.iso.date(),
    })
    .safeParse(process.env);
  if (!parsed.success)
    throw new Error("Cashfree credentials or API version are not configured.");
  return parsed.data;
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const env = config();
  const base =
    env.CASHFREE_ENV === "production"
      ? "https://api.cashfree.com"
      : "https://sandbox.cashfree.com";
  const response = await fetch(`${base}/pg${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-version": env.CASHFREE_API_VERSION,
      "x-client-id": env.CASHFREE_APP_ID,
      "x-client-secret": env.CASHFREE_SECRET_KEY,
      ...(options.idempotencyKey
        ? { "x-idempotency-key": options.idempotencyKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Cashfree request failed (${response.status}).`);
  return result;
}

export const cashfree: PaymentProvider = {
  async createOrder(input) {
    const result = await request("/orders", {
      method: "POST",
      idempotencyKey: input.orderId,
      body: {
        order_id: input.orderId,
        order_amount: input.amountPaise / 100,
        order_currency: "INR",
        customer_details: {
          customer_id: input.customerId,
          customer_name: input.name,
          customer_email: input.email,
          customer_phone: input.phone,
        },
        order_meta: {
          return_url: input.returnUrl,
          notify_url: input.notifyUrl,
        },
        order_expiry_time: input.expiresAt.toISOString(),
      },
    });
    return {
      paymentSessionId: z
        .object({ payment_session_id: z.string().min(1) })
        .parse(result).payment_session_id,
    };
  },
  async getPayments(orderId) {
    const result = await request(
      `/orders/${encodeURIComponent(orderId)}/payments`,
    );
    return z
      .array(
        z
          .object({
            cf_payment_id: z.union([z.string(), z.number()]),
            payment_status: z.string(),
            payment_amount: z.number(),
            payment_group: z.string().optional(),
            payment_time: z.string().optional(),
          })
          .passthrough(),
      )
      .parse(result)
      .map((payment) => ({
        id: String(payment.cf_payment_id),
        status: (["SUCCESS", "FAILED", "USER_DROPPED"].includes(
          payment.payment_status,
        )
          ? payment.payment_status
          : "PENDING") as ProviderPayment["status"],
        amountPaise: Math.round(payment.payment_amount * 100),
        method: payment.payment_group,
        paidAt: payment.payment_time,
        raw: payment,
      }));
  },
  async getRefund(orderId, refundId) {
    const result = await request(
      `/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
    );
    const refund = z
      .object({
        cf_refund_id: z.union([z.string(), z.number()]),
        refund_status: z.string(),
      })
      .parse(result);
    return {
      providerRefundId: String(refund.cf_refund_id),
      status: refund.refund_status,
    };
  },
  async refund(input) {
    const result = await request(
      `/orders/${encodeURIComponent(input.orderId)}/refunds`,
      {
        method: "POST",
        idempotencyKey: input.refundId,
        body: {
          refund_id: input.refundId,
          refund_amount: input.amountPaise / 100,
          refund_note: input.reason,
        },
      },
    );
    const refund = z
      .object({
        cf_refund_id: z.union([z.string(), z.number()]),
        refund_status: z.string(),
      })
      .parse(result);
    return {
      providerRefundId: String(refund.cf_refund_id),
      status: refund.refund_status,
    };
  },
};

export function verifyCashfreeSignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  secret = process.env.CASHFREE_SECRET_KEY || "",
) {
  if (!timestamp || !signature || !secret || !/^\d+$/.test(timestamp))
    return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + raw)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
