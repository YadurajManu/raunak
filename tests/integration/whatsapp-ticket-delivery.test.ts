import "dotenv/config";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import Redis from "ioredis";
import { expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  processNotification,
  saveMessageTemplate,
} from "@/server/notifications/service";
import { whatsapp } from "@/server/providers/whatsapp/provider";
import { prepareTicketPdfs } from "@/server/tickets/pdf";
import { storage } from "@/server/providers/storage/s3";
import { GatewayRuntime } from "../../services/wa-gateway/src/runtime";
import { gatewayServer } from "../../services/wa-gateway/src/http";
import { MockEngine } from "../../services/wa-gateway/src/engines/mock";
import { checkIn } from "@/server/checkin/service";
import { decodeCard } from "../helpers/decode-qr";
import { ticketReply } from "../../services/wa-gateway/src/inbound";
import { defaultBodies } from "@/server/notifications/templates";

it("delivers two paid ticket cards through the actual notification handler and keeps email independent", async () => {
  vi.stubEnv("WA_UNOFFICIAL_ENABLED", "true");
  vi.stubEnv("WHATSAPP_PROVIDER", "mock");
  vi.stubEnv("WA_MIN_DELAY_MS", "0");
  vi.stubEnv("WA_MAX_DELAY_MS", "0");
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  const suffix = randomUUID(),
    org = await db.organization.create({
      data: {
        name: "Delivery test",
        slug: `wa-delivery-${suffix}`,
        whatsappMode: "ORG_NUMBER",
      },
    });
  const buyer = await db.user.create({
    data: {
      firebaseUid: `wa-delivery-${suffix}`,
      email: `wa-delivery-${suffix}@example.test`,
    },
  });
  await db.organizationMember.create({
    data: { orgId: org.id, userId: buyer.id, role: "OWNER" },
  });
  const event = await db.event.create({
    data: {
      orgId: org.id,
      slug: `wa-delivery-${suffix}`,
      title: "Two-ticket delivery",
      status: "PUBLISHED",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
    },
  });
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "Admission",
      pricePaise: 10000,
      quantityTotal: 20,
    },
  });
  const order = await db.order.create({
    data: {
      eventId: event.id,
      buyerId: buyer.id,
      status: "PAID",
      subtotalPaise: 20000,
      totalPaise: 20000,
      buyerName: "Test buyer",
      buyerEmail: buyer.email,
      buyerPhone: "9876543210",
      whatsappOptIn: true,
      whatsappOptInAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      idempotencyKey: suffix,
    },
  });
  const tickets = await Promise.all(
    [1, 2].map((index) =>
      db.ticket.create({
        data: {
          eventId: event.id,
          orderId: order.id,
          ticketTypeId: type.id,
          code: `${suffix}-${index}`,
          holderName: "Test buyer",
          holderEmail: buyer.email,
        },
      }),
    ),
  );
  const session = await db.whatsAppSession.create({ data: { orgId: org.id } });
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
  });
  const engine = new MockEngine(),
    runtime = new GatewayRuntime(redis, engine),
    key = "delivery-key-".repeat(4),
    server = gatewayServer(runtime, key);
  const cards: Buffer[] = [],
    originalSend = engine.sendImage.bind(engine);
  vi.spyOn(engine, "sendImage").mockImplementation(async (...args) => {
    cards.push(args[2]);
    return originalSend(...args);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  vi.stubEnv("WA_GATEWAY_URL", `http://127.0.0.1:${address.port}`);
  vi.stubEnv("WA_GATEWAY_API_KEY", key);
  const send = vi.fn();
  try {
    await runtime.connect(session.id, org.id);
    await vi.waitFor(async () =>
      expect((await runtime.status(session.id, org.id)).status).toBe(
        "QR_PENDING",
      ),
    );
    engine.emit({
      type: "status",
      sessionId: session.id,
      status: "CONNECTED",
      phoneE164: "+919876543211",
    });
    await vi.waitFor(async () =>
      expect((await runtime.status(session.id, org.id)).status).toBe(
        "CONNECTED",
      ),
    );
    await prepareTicketPdfs(order.id);
    await saveMessageTemplate(buyer.id, event.id, {
      channel: "WHATSAPP",
      trigger: "TICKET_ISSUED",
      isEnabled: true,
      body: defaultBodies.TICKET_ISSUED,
      attachments: { ticketCard: true, ticketPdf: true, poster: false },
    });
    for (const ticket of tickets)
      for (const channel of ["WHATSAPP", "EMAIL"] as const) {
        const log = await db.notificationLog.create({
          data: {
            orgId: org.id,
            eventId: event.id,
            orderId: order.id,
            ticketId: ticket.id,
            channel,
            trigger: "TICKET_ISSUED",
            toAddress: channel === "EMAIL" ? buyer.email : "+919876543210",
          },
        });
        await processNotification(log.id, { email: { send }, whatsapp });
        await processNotification(log.id, { email: { send }, whatsapp });
      }
    expect(engine.sent).toHaveLength(4);
    expect(
      engine.sent.filter((item) => item.kind === "image" && item.bytes > 1000),
    ).toHaveLength(2);
    expect(
      engine.sent.filter(
        (item) => item.kind === "document" && item.bytes > 1000,
      ),
    ).toHaveLength(2);
    expect(
      engine.sent.filter((item) => item.text.includes("Test buyer")),
    ).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(2);
    await saveMessageTemplate(buyer.id, event.id, {
      channel: "WHATSAPP",
      trigger: "ORDER_CONFIRMED",
      isEnabled: true,
      body: "Changed message for {{attendee_name}}",
    });
    const edited = await db.notificationLog.create({
      data: {
        orgId: org.id,
        eventId: event.id,
        orderId: order.id,
        channel: "WHATSAPP",
        trigger: "ORDER_CONFIRMED",
        toAddress: "+919876543210",
      },
    });
    await processNotification(edited.id, { email: { send }, whatsapp });
    expect(
      engine.sent.some((item) =>
        item.text.includes("Changed message for Test buyer"),
      ),
    ).toBe(true);
    const reply = await ticketReply(session.id, "+919876543210");
    expect(reply.match(/\/t\/v1\./g)).toHaveLength(2);
    expect(await ticketReply(session.id, "+919876543219")).not.toContain(
      "/t/v1.",
    );
    const delivered = await db.notificationLog.findFirstOrThrow({
      where: { orderId: order.id, channel: "WHATSAPP" },
    });
    engine.emit({
      type: "receipt",
      sessionId: session.id,
      messageId: delivered.providerMessageId!,
      status: "READ",
    });
    engine.emit({
      type: "receipt",
      sessionId: session.id,
      messageId: delivered.providerMessageId!,
      status: "DELIVERED",
    });
    await vi.waitFor(async () =>
      expect(
        (
          await db.notificationLog.findUniqueOrThrow({
            where: { id: delivered.id },
          })
        ).status,
      ).toBe("READ"),
    );
    const inbound = {
      type: "inbound" as const,
      sessionId: session.id,
      messageId: "stop-test",
      phoneE164: "+919876543210",
      text: "band karo",
    };
    engine.emit(inbound);
    await vi.waitFor(async () =>
      expect(
        await db.whatsAppSuppression.count({
          where: {
            orgId: org.id,
            phoneE164: inbound.phoneE164,
            reason: "STOP_REPLY",
          },
        }),
      ).toBe(1),
    );
    await vi.waitFor(
      async () =>
        expect(
          engine.sent.some((item) =>
            item.text.includes("updates are now stopped"),
          ),
        ).toBe(true),
      { timeout: 5000 },
    );
    engine.emit(inbound);
    const later = await db.notificationLog.create({
      data: {
        orgId: org.id,
        eventId: event.id,
        orderId: order.id,
        channel: "WHATSAPP",
        trigger: "ORDER_CONFIRMED",
        toAddress: inbound.phoneE164,
      },
    });
    await processNotification(later.id, { email: { send }, whatsapp });
    expect(
      await db.notificationLog.findUnique({ where: { id: later.id } }),
    ).toMatchObject({ status: "SKIPPED", errorCode: "SUPPRESSED" });
    expect(
      engine.sent.filter((item) =>
        item.text.includes("updates are now stopped"),
      ),
    ).toHaveLength(1);
    for (const card of cards)
      expect(
        (
          await checkIn(buyer.id, {
            eventId: event.id,
            token: await decodeCard(card),
          })
        ).result,
      ).toBe("VALID");
    expect(
      (
        await db.notificationLog.findMany({
          where: {
            orderId: order.id,
            channel: "WHATSAPP",
            trigger: "TICKET_ISSUED",
          },
        })
      ).every(
        (log) =>
          log.sessionId === session.id &&
          ["SENT", "DELIVERED", "READ"].includes(log.status),
      ),
    ).toBe(true);
  } finally {
    await runtime.close();
    server.close();
    server.closeAllConnections();
    const keys = await redis.keys(`wa:*${session.id}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    for (const ticket of await db.ticket.findMany({
      where: { orderId: order.id },
    }))
      if (ticket.pdfKey) await storage.delete(ticket.pdfKey);
    await db.auditLog.deleteMany({ where: { orgId: org.id } });
    await db.organizationMember.deleteMany({ where: { orgId: org.id } });
    await db.messageTemplate.deleteMany({ where: { orgId: org.id } });
    await db.webhookEvent.deleteMany({
      where: {
        provider: "baileys-inbound",
        payload: { path: ["sessionId"], equals: session.id },
      },
    });
    await db.notificationLog.deleteMany({ where: { orderId: order.id } });
    await db.ticket.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.ticketType.delete({ where: { id: type.id } });
    await db.event.delete({ where: { id: event.id } });
    await db.whatsAppSession.delete({ where: { id: session.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: buyer.id } });
    vi.unstubAllEnvs();
  }
}, 30000);
