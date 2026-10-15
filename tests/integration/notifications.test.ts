import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
vi.mock("@/server/tickets/delivery", () => ({ queueTicketDelivery: vi.fn() }));
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { createCheckout } from "@/server/checkout/service";
import { prepareTicketPdfs } from "@/server/tickets/pdf";
import {
  enqueueOrderNotifications,
  processNotification,
  saveMessageTemplate,
} from "@/server/notifications/service";
import { receiveWebhook, webhookSchema } from "@/server/whatsapp/webhook";
import { notificationQueue } from "../../worker/queues";
const key = randomUUID();
const org = await db.organization.create({
  data: { name: "Notify test", slug: `notify-${key}` },
});
const buyer = await db.user.create({
  data: { firebaseUid: `notify-${key}`, email: `notify-${key}@example.test` },
});
await db.organizationMember.create({
  data: { orgId: org.id, userId: buyer.id, role: "OWNER" },
});
const event = await db.event.create({
  data: {
    orgId: org.id,
    slug: `notify-${key}`,
    title: "Notify event",
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 2 * 86400000),
    endsAt: new Date(Date.now() + 3 * 86400000),
  },
});
const type = await db.ticketType.create({
  data: { eventId: event.id, name: "Guest", pricePaise: 0, quantityTotal: 10 },
});
const receiptIds: string[] = [];
afterAll(async () => {
  const logs = await db.notificationLog.findMany({
    where: { eventId: event.id },
    select: { id: true },
  });
  for (const log of logs) {
    const job = await notificationQueue.getJob(log.id);
    if (job) await job.remove();
  }
  const tickets = await db.ticket.findMany({ where: { eventId: event.id } });
  for (const t of tickets) if (t.pdfKey) await storage.delete(t.pdfKey);
  await db.webhookEvent.deleteMany({
    where: { provider: "meta-whatsapp", idempotencyKey: { in: receiptIds } },
  });
  await db.notificationLog.deleteMany({ where: { eventId: event.id } });
  await db.messageTemplate.deleteMany({ where: { eventId: event.id } });
  await db.auditLog.deleteMany({ where: { orgId: org.id } });
  await db.ticket.deleteMany({ where: { eventId: event.id } });
  await db.orderItem.deleteMany({ where: { order: { eventId: event.id } } });
  await db.order.deleteMany({ where: { eventId: event.id } });
  await db.ticketType.delete({ where: { id: type.id } });
  await db.event.delete({ where: { id: event.id } });
  await db.organizationMember.deleteMany({ where: { orgId: org.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: buyer.id } });
  vi.unstubAllEnvs();
});
it("delivers edited templates and PDF attachments once, schedules reminders, and reconciles early Meta receipts", async () => {
  vi.stubEnv(
    "TICKET_SIGNING_SECRET",
    "test-ticket-signing-secret-at-least-32-characters",
  );
  const order = await createCheckout(buyer, {
    eventId: event.id,
    items: [{ ticketTypeId: type.id, quantity: 1 }],
    buyerName: "Test buyer",
    buyerPhone: "9876543210",
    whatsappOptIn: true,
    idempotencyKey: randomUUID(),
  });
  await prepareTicketPdfs(order.id);
  expect(order.whatsappOptInAt).toBeInstanceOf(Date);
  await enqueueOrderNotifications(order.id);
  await enqueueOrderNotifications(order.id);
  expect(await db.notificationLog.count({ where: { orderId: order.id } })).toBe(
    8,
  );
  await saveMessageTemplate(buyer.id, event.id, {
    channel: "EMAIL",
    trigger: "TICKET_ISSUED",
    body: "Welcome {{attendee_name}} — {{custom_note}}",
    isEnabled: true,
    custom_note: "<script>test</script>",
  });
  await expect(
    saveMessageTemplate(randomUUID(), event.id, {
      channel: "EMAIL",
      trigger: "TICKET_ISSUED",
      body: "test",
      isEnabled: true,
    }),
  ).rejects.toThrow("Access denied");
  const email = vi.fn().mockResolvedValue(undefined);
  const log = await db.notificationLog.findFirstOrThrow({
    where: { orderId: order.id, channel: "EMAIL", trigger: "TICKET_ISSUED" },
  });
  await processNotification(log.id, {
    email: { send: email },
    whatsapp: { sendTemplate: vi.fn() },
  });
  await processNotification(log.id, {
    email: { send: email },
    whatsapp: { sendTemplate: vi.fn() },
  });
  expect(email).toHaveBeenCalledTimes(1);
  expect(
    email.mock.calls[0][0].attachments[0].content.subarray(0, 4).toString(),
  ).toBe("%PDF");
  expect(email.mock.calls[0][0].text).toContain("Welcome Test buyer");
  expect(email.mock.calls[0][0].html).not.toContain("<script>");
  expect(email.mock.calls[0][0].html).toContain("cid:ticket-qr");
  expect(email.mock.calls[0][0].attachments[1].contentId).toBe("ticket-qr");
  expect(
    email.mock.calls[0][0].attachments[1].content.subarray(1, 4).toString(),
  ).toBe("PNG");
  const waLog = await db.notificationLog.findFirstOrThrow({
    where: { orderId: order.id, channel: "WHATSAPP", trigger: "TICKET_ISSUED" },
  });
  vi.stubEnv(
    "WHATSAPP_TEMPLATE_MAP",
    JSON.stringify({
      TICKET_ISSUED: {
        name: "approved_ticket",
        language: "en",
        variables: ["event_title", "ticket_url"],
        documentHeader: true,
      },
    }),
  );
  const messageId = `wamid.${key}`;
  const sendTemplate = vi.fn().mockImplementation(async () => {
    const payload = webhookSchema.parse({
      object: "whatsapp_business_account",
      entry: [
        {
          id: key,
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  {
                    id: messageId,
                    status: "delivered",
                    timestamp: "1728900000",
                    biz_opaque_callback_data: waLog.id,
                    recipient_id: "919876543210",
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    receiptIds.push(`status:${key}:${messageId}:delivered:1728900000`);
    await receiveWebhook(payload);
    return { providerMessageId: messageId };
  });
  await processNotification(waLog.id, {
    email: { send: email },
    whatsapp: { sendTemplate },
  });
  expect(sendTemplate.mock.calls[0][0].params[0]).toBe(event.title);
  expect(
    sendTemplate.mock.calls[0][0].document.content.subarray(0, 5).toString(),
  ).toBe("%PDF-");
  expect(
    (await db.notificationLog.findUniqueOrThrow({ where: { id: waLog.id } }))
      .status,
  ).toBe("DELIVERED");
});
it("records readable failures and stops after five automatic attempts", async () => {
  const log = await db.notificationLog.findFirstOrThrow({
    where: { eventId: event.id, trigger: "ORDER_CONFIRMED", channel: "EMAIL" },
  });
  const providers = {
    email: {
      send: vi.fn().mockRejectedValue(new Error("Sender is not verified.")),
    },
    whatsapp: { sendTemplate: vi.fn() },
  };
  for (let i = 0; i < 5; i++)
    await expect(processNotification(log.id, providers)).rejects.toThrow(
      "Sender is not verified",
    );
  const failed = await db.notificationLog.findUniqueOrThrow({
    where: { id: log.id },
  });
  expect(failed.status).toBe("FAILED");
  expect(failed.attempts).toBe(5);
  await processNotification(log.id, providers);
  expect(providers.email.send).toHaveBeenCalledTimes(5);
});
