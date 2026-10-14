import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { Prisma } from "@/generated/prisma/client";

export function validSignature(
  body: Buffer,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature.slice(7), "hex"),
  );
}

export function validVerifyToken(actual: string, expected: string) {
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

const message = z.object({ id: z.string().min(1).max(300) }).passthrough();
const status = message.extend({
  status: z.string().max(50),
  timestamp: z.string().max(30).optional(),
});
export const webhookSchema = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z
      .array(
        z
          .object({
            id: z.string().max(100),
            changes: z
              .array(
                z
                  .object({
                    field: z.string().max(100),
                    value: z
                      .object({
                        metadata: z
                          .object({ phone_number_id: z.string().max(100) })
                          .passthrough()
                          .optional(),
                        messages: z.array(message).max(1000).optional(),
                        statuses: z.array(status).max(1000).optional(),
                      })
                      .passthrough(),
                  })
                  .passthrough(),
              )
              .max(1000),
          })
          .passthrough(),
      )
      .max(1000),
  })
  .passthrough();

const priorStatuses = {
  sent: ["QUEUED", "SENDING"],
  delivered: ["QUEUED", "SENDING", "SENT", "FAILED"],
  read: ["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED"],
  failed: ["QUEUED", "SENDING", "SENT"],
} as const;
const nextStatuses = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

export async function receiveWebhook(payload: z.infer<typeof webhookSchema>) {
  await db.$transaction(async (tx) => {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const phone = change.value.metadata?.phone_number_id || entry.id;
        const items: {
          key: string;
          value: Record<string, unknown>;
          delivery: boolean;
        }[] = [
          ...(change.value.messages || []).map((value) => ({
            key: `message:${phone}:${value.id}`,
            value,
            delivery: false,
          })),
          ...(change.value.statuses || []).map((value) => ({
            key: `status:${phone}:${value.id}:${value.status}:${value.timestamp || ""}`,
            value,
            delivery: true,
          })),
        ];
        if (!items.length)
          items.push({
            key: `change:${createHash("sha256")
              .update(JSON.stringify({ entryId: entry.id, change }))
              .digest("hex")}`,
            value: change.value,
            delivery: false,
          });
        for (const item of items) {
          const receipt = await tx.webhookEvent.createMany({
            data: [
              {
                provider: "meta-whatsapp",
                idempotencyKey: item.key,
                payload: {
                  accountId: entry.id,
                  field: change.field,
                  metadata: change.value.metadata || {},
                  event: item.value,
                } as Prisma.InputJsonValue,
                status: "PROCESSED",
                processedAt: new Date(),
              },
            ],
            skipDuplicates: true,
          });
          if (!receipt.count || !item.delivery) continue;
          const delivery = item.value as z.infer<typeof status>;
          if (!Object.hasOwn(nextStatuses, delivery.status)) continue;
          const state = delivery.status as keyof typeof nextStatuses;
          await tx.notificationLog.updateMany({
            where: {
              channel: "WHATSAPP",
              OR: [
                { providerMessageId: delivery.id },
                ...(z.uuid().safeParse(delivery.biz_opaque_callback_data)
                  .success
                  ? [
                      {
                        id: String(delivery.biz_opaque_callback_data),
                        ...(typeof delivery.recipient_id === "string"
                          ? { toAddress: `+${delivery.recipient_id}` }
                          : {}),
                      },
                    ]
                  : []),
              ],
              status: { in: [...priorStatuses[state]] },
            },
            data: {
              status: nextStatuses[state],
              providerMessageId: delivery.id,
              ...(state === "failed"
                ? {
                    error:
                      "WhatsApp reported delivery failure. See the signed webhook receipt for provider details.",
                  }
                : { error: null }),
            },
          });
        }
      }
    }
  });
}
