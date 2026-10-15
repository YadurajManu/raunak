import { createHash, randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { z } from "zod";
import {
  gatewayMessageSchema,
  transactionalTriggers,
  WaError,
  type EngineEvent,
  type WhatsAppEngine,
  type GatewayMessage,
  type SendResult,
} from "@raunak/wa-contracts";
import { db } from "@/server/db/client";
import { SessionQueue } from "./queue";
import { alertSession } from "./alerts";
import { PolicyEngine } from "./policy";
import { decodeMedia } from "./media";
import {
  acceptInbound,
  inboundPayload,
  replyPhone,
  ticketReply,
} from "./inbound";
import { APP_NAME } from "@/lib/constants";

const ownLock = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`;
const releaseLock = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const replaceLock = `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end`;
const resultSchema = z.object({
  providerMessageId: z.string(),
  messageIds: z.array(z.string()).optional(),
});

export class GatewayRuntime {
  private locks = new Map<
    string,
    { token: string; timer: ReturnType<typeof setInterval> }
  >();
  private queue = new SessionQueue();
  private events = new Map<string, Promise<void>>();
  private policy: PolicyEngine;
  private inboundBusy = false;
  constructor(
    readonly redis: Redis,
    readonly engine: WhatsAppEngine,
  ) {
    this.policy = new PolicyEngine(redis, engine);
    for (const type of ["status", "qr", "receipt", "inbound"] as const)
      engine.on(type, (event) => {
        const pending = (this.events.get(event.sessionId) || Promise.resolve())
          .then(() => this.handle(event))
          .catch(() => {
            console.error(
              JSON.stringify({
                event: "wa.event.failed",
                code: "ENGINE_ERROR",
              }),
            );
          });
        this.events.set(event.sessionId, pending);
        void pending.finally(() => {
          if (this.events.get(event.sessionId) === pending)
            this.events.delete(event.sessionId);
        });
      });
  }
  async assertOwned(id: string) {
    const own = this.locks.get(id);
    if (!own || (await this.redis.get(`wa:session:${id}:lock`)) !== own.token)
      throw new WaError("SESSION_DISCONNECTED");
  }
  async scoped(id: string, orgId: string | null) {
    const session = await db.whatsAppSession.findFirst({
      where: { id, orgId },
    });
    if (!session) throw new WaError("SESSION_DISCONNECTED");
    return session;
  }
  async create(orgId: string | null, userId?: string) {
    if (orgId === null) {
      await db.whatsAppSession.createMany({
        data: { orgId: null, label: "default", createdByUserId: userId },
        skipDuplicates: true,
      });
      return db.whatsAppSession.findFirstOrThrow({
        where: { orgId: null, label: "default" },
      });
    }
    if (!userId) throw new WaError("SESSION_DISCONNECTED");
    const member = await db.organizationMember.findFirst({
      where: {
        orgId,
        userId,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
    });
    if (!member) throw new WaError("SESSION_DISCONNECTED");
    return db.whatsAppSession.upsert({
      where: { orgId_label: { orgId, label: "default" } },
      update: {},
      create: { orgId, createdByUserId: userId },
    });
  }
  async connect(id: string, orgId: string | null): Promise<void> {
    if (process.env.WA_UNOFFICIAL_ENABLED !== "true")
      throw new WaError("KILL_SWITCH");
    const session = await this.scoped(id, orgId);
    if (this.locks.has(id)) {
      if (
        session.status === "PAUSED" &&
        session.lastError === "CIRCUIT_BREAKER" &&
        session.phoneE164 &&
        (await this.engine.isOnWhatsApp(id, session.phoneE164))
      ) {
        await this.redis.del(`wa:failures:${id}`);
        await db.whatsAppSession.update({
          where: { id },
          data: { status: "CONNECTED", pausedUntil: null, lastError: null },
        });
        return;
      }
      if (
        ["LOGGED_OUT", "DISCONNECTED", "BANNED_SUSPECTED"].includes(
          session.status,
        ) ||
        (session.status === "PAUSED" && session.lastError !== "CIRCUIT_BREAKER")
      ) {
        await this.stop(id);
        await db.whatsAppSession.update({
          where: { id },
          data: {
            authStateEnc: null,
            authVersion: { increment: 1 },
            status: "DISCONNECTED",
            phoneE164: null,
            pushName: null,
          },
        });
        return this.connect(id, orgId);
      }
      if (session.status === "PAUSED") throw new WaError("SESSION_PAUSED");
      return;
    }
    const token = randomUUID(),
      lockKey = `wa:session:${id}:lock`;
    if (!(await this.redis.set(lockKey, token, "PX", 30000, "NX")))
      throw new WaError("SESSION_PAUSED", true, 30000);
    const timer = setInterval(() => {
      void this.redis
        .eval(ownLock, 1, lockKey, token, 30000)
        .then(async (renewed) => {
          if (renewed !== 1) await this.stop(id);
        })
        .catch(() => {
          void this.stop(id).catch(() => {});
        });
    }, 10000);
    timer.unref();
    this.locks.set(id, { token, timer });
    try {
      await this.engine.start(session);
    } catch {
      await this.stop(id);
      throw new WaError("ENGINE_ERROR", true, 5000);
    }
  }
  async stop(id: string) {
    const own = this.locks.get(id);
    this.locks.delete(id);
    if (own) clearInterval(own.timer);
    await this.engine.stop(id);
    if (own)
      await this.redis.eval(releaseLock, 1, `wa:session:${id}:lock`, own.token);
  }
  async disconnect(id: string, orgId: string | null) {
    await this.scoped(id, orgId);
    await this.assertOwned(id);
    if (this.engine.logout) await this.engine.logout(id).catch(() => {});
    await this.stop(id);
    await this.redis.del(`wa:session:${id}:qr`);
    await db.whatsAppSession.update({
      where: { id },
      data: {
        status: "DISCONNECTED",
        authStateEnc: null,
        authVersion: { increment: 1 },
        phoneE164: null,
        pushName: null,
      },
    });
  }
  async status(id: string, orgId: string | null) {
    const session = await this.scoped(id, orgId);
    return {
      id,
      status: session.status,
      phone: session.phoneE164 ? `••••${session.phoneE164.slice(-4)}` : null,
      pushName: session.pushName,
      lastSeenAt: session.lastSeenAt,
      connectedAt: session.connectedAt,
      uptimeSeconds:
        session.status === "CONNECTED" && session.connectedAt
          ? Math.max(
              0,
              Math.floor((Date.now() - session.connectedAt.getTime()) / 1000),
            )
          : 0,
      qr:
        session.status === "QR_PENDING"
          ? await this.redis.get(`wa:session:${id}:qr`)
          : null,
      lastError: session.lastError,
    };
  }
  async pairing(id: string, orgId: string | null, phone: string) {
    await this.scoped(id, orgId);
    await this.assertOwned(id);
    return { code: await this.engine.requestPairingCode(id, phone) };
  }
  async send(id: string, input: GatewayMessage): Promise<SendResult> {
    const message = gatewayMessageSchema.parse(input);
    const media = decodeMedia(message.attachments);
    const session = await db.whatsAppSession.findUnique({ where: { id } });
    const org = await db.organization.findUnique({
      where: { id: message.orgId },
      select: { whatsappMode: true },
    });
    if (
      !session ||
      (org?.whatsappMode === "ORG_NUMBER"
        ? session.orgId !== message.orgId
        : org?.whatsappMode !== "PLATFORM_NUMBER" || session.orgId !== null)
    )
      throw new WaError("SESSION_DISCONNECTED");
    const identity = createHash("sha256")
      .update(`${id}:${message.orgId}:${message.clientMessageId}`)
      .digest("hex");
    const key = `wa:message:${identity}`,
      original = await this.redis.get(key);
    if (original && original !== "pending")
      return resultSchema.parse(JSON.parse(original));
    if (original) throw new WaError("ENGINE_ERROR", true, 60000);
    return this.queue.enqueue(
      id,
      transactionalTriggers.indexOf(message.trigger),
      async () => {
        const cached = await this.redis.get(key);
        if (cached && cached !== "pending")
          return resultSchema.parse(JSON.parse(cached));
        if (cached) throw new WaError("ENGINE_ERROR", true, 60000);
        await this.assertOwned(id);
        if (
          process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
          (await this.redis.get("wa:kill-switch")) === "1"
        )
          throw new WaError("KILL_SWITCH");
        if (!message.consent) throw new WaError("NO_CONSENT");
        const current = await this.scoped(id, session.orgId);
        if (current.status !== "CONNECTED")
          throw new WaError(
            current.status === "PAUSED" || current.status === "BANNED_SUSPECTED"
              ? "SESSION_PAUSED"
              : "SESSION_DISCONNECTED",
          );
        await this.policy.check(current, message, Math.max(1, media.length));
        if (!(await this.redis.set(key, "pending", "EX", 86400, "NX"))) {
          const saved = await this.redis.get(key);
          if (saved && saved !== "pending")
            return resultSchema.parse(JSON.parse(saved));
          throw new WaError("ENGINE_ERROR", true, 60000);
        }
        // A crash after network acceptance is ambiguous: leave pending, never blindly resend.
        let result: SendResult;
        let partial = false;
        try {
          const typing = await this.policy.pace(id, message.text);
          await this.assertOwned(id);
          if (
            process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
            (await this.redis.get("wa:kill-switch")) === "1"
          )
            throw new WaError("KILL_SWITCH");
          await this.engine.presence(id, message.to, "composing");
          await new Promise((resolve) => setTimeout(resolve, typing));
          await this.assertOwned(id);
          if (
            process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
            (await this.redis.get("wa:kill-switch")) === "1"
          )
            throw new WaError("KILL_SWITCH");
          if (
            await db.whatsAppSuppression.findFirst({
              where: {
                phoneE164: message.to,
                OR: [{ orgId: message.orgId }, { orgId: null }],
              },
            })
          )
            throw new WaError("SUPPRESSED");
          if (!media.length)
            result = await this.engine.sendText(id, message.to, message.text);
          else {
            const messageIds: string[] = [];
            for (let i = 0; i < media.length; i++) {
              if (i)
                await new Promise((resolve) =>
                  setTimeout(resolve, 3000 + Math.random() * 1000),
                );
              await this.assertOwned(id);
              if (
                process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
                (await this.redis.get("wa:kill-switch")) === "1"
              )
                throw new WaError("KILL_SWITCH");
              if (
                await db.whatsAppSuppression.findFirst({
                  where: {
                    phoneE164: message.to,
                    OR: [{ orgId: message.orgId }, { orgId: null }],
                  },
                })
              )
                throw new WaError("SUPPRESSED");
              const item = media[i],
                caption = i === 0 ? message.text : "";
              const sent =
                item.kind === "image"
                  ? await this.engine.sendImage(
                      id,
                      message.to,
                      item.buffer,
                      caption,
                    )
                  : await this.engine.sendDocument(
                      id,
                      message.to,
                      item.buffer,
                      item.filename || "ticket.pdf",
                      item.mimetype,
                      caption,
                    );
              messageIds.push(sent.providerMessageId);
              partial = true;
              if (message.notificationId) {
                await db.notificationLog.updateMany({
                  where: {
                    id: message.notificationId,
                    orgId: message.orgId,
                    channel: "WHATSAPP",
                  },
                  data: {
                    sessionId: id,
                    providerMessageId: messageIds[0],
                    ...(i === 0 ? { sentAt: new Date() } : {}),
                    attachmentsSent: {
                      items: media
                        .slice(0, i + 1)
                        .map(({ kind, filename, mimetype }) => ({
                          kind,
                          filename: filename || null,
                          mimetype,
                        })),
                      messageIds,
                    },
                  },
                });
                await this.reconcile(id, sent.providerMessageId);
              }
            }
            result = { providerMessageId: messageIds[0], messageIds };
          }
          await this.policy.sent(id);
        } catch (error) {
          if (partial && message.notificationId)
            await db.notificationLog.updateMany({
              where: { id: message.notificationId, orgId: message.orgId },
              data: {
                errorCode: "ENGINE_ERROR",
                error:
                  "Some attachments were accepted before delivery stopped. Check the delivery history; email is the backup.",
              },
            });
          if (!(error instanceof WaError) || error.code === "ENGINE_ERROR") {
            if (await this.policy.failed(id))
              await alertSession(id, "CIRCUIT_BREAKER").catch(() => {});
          }
          throw error instanceof WaError
            ? error
            : new WaError("ENGINE_ERROR", true, 5000);
        } finally {
          await this.engine.presence(id, message.to, "paused").catch(() => {});
        }
        await this.redis.eval(
          replaceLock,
          1,
          key,
          "pending",
          JSON.stringify(result),
          86400,
        );
        if (message.notificationId) {
          await db.notificationLog.updateMany({
            where: {
              id: message.notificationId,
              orgId: message.orgId,
              channel: "WHATSAPP",
            },
            data: {
              sessionId: id,
              providerMessageId: result.providerMessageId,
              ...(!media.length ? { sentAt: new Date() } : {}),
              attachmentsSent: {
                items: media.map(({ kind, filename, mimetype }) => ({
                  kind,
                  filename: filename || null,
                  mimetype,
                })),
                messageIds: result.messageIds || [result.providerMessageId],
              },
            },
          });
          await this.reconcile(id, result.providerMessageId);
        }
        return result;
      },
    );
  }
  private async reconcile(sessionId: string, messageId: string) {
    const value = await this.redis.get(`wa:receipt:${sessionId}:${messageId}`);
    if (!value) return;
    const status = z.enum(["SENT", "DELIVERED", "READ"]).parse(value);
    const predecessors =
      status === "READ"
        ? (["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED"] as const)
        : status === "DELIVERED"
          ? (["QUEUED", "SENDING", "SENT", "FAILED"] as const)
          : (["QUEUED", "SENDING", "FAILED"] as const);
    await db.notificationLog.updateMany({
      where: {
        sessionId,
        OR: [
          { providerMessageId: messageId },
          {
            attachmentsSent: {
              path: ["messageIds"],
              array_contains: [messageId],
            },
          },
        ],
        status: { in: [...predecessors] },
      },
      data: { status, error: null },
    });
  }
  private async handle(event: EngineEvent) {
    await this.assertOwned(event.sessionId);
    if (event.type === "qr") {
      await this.redis.set(
        `wa:session:${event.sessionId}:qr`,
        event.qr,
        "EX",
        60,
      );
      await db.whatsAppSession.update({
        where: { id: event.sessionId },
        data: { status: "QR_PENDING" },
      });
    } else if (event.type === "status") {
      const now = new Date(),
        session = await db.whatsAppSession.findUniqueOrThrow({
          where: { id: event.sessionId },
        });
      await db.whatsAppSession.update({
        where: { id: event.sessionId },
        data: {
          status: event.status,
          lastError: event.reason || null,
          ...(event.status === "CONNECTED"
            ? {
                phoneE164: event.phoneE164,
                pushName: event.pushName,
                lastSeenAt: now,
                connectedAt: now,
                warmupStartedAt:
                  event.phoneE164 && event.phoneE164 !== session.phoneE164
                    ? now
                    : session.warmupStartedAt || now,
              }
            : {}),
          ...(event.status === "LOGGED_OUT" || event.reason === "BAD_SESSION"
            ? { authStateEnc: null, authVersion: { increment: 1 } }
            : {}),
        },
      });
      if (event.status === "CONNECTED")
        await this.redis.del(`wa:session:${event.sessionId}:qr`);
      if (
        ["LOGGED_OUT", "BANNED_SUSPECTED", "PAUSED"].includes(event.status) &&
        session.status !== event.status
      ) {
        await alertSession(event.sessionId, event.reason || event.status);
      }
    } else if (event.type === "receipt") {
      const key = `wa:receipt:${event.sessionId}:${event.messageId}`;
      await this.redis.eval(
        `local old = redis.call('GET',KEYS[1]); local rank={SENT=1,DELIVERED=2,READ=3}; if not old or rank[ARGV[1]]>rank[old] then redis.call('SET',KEYS[1],ARGV[1],'EX',86400) end; return 1`,
        1,
        key,
        event.status,
      );
      await this.reconcile(event.sessionId, event.messageId);
    } else if (event.type === "inbound") {
      await acceptInbound(event);
      void this.drainInbound().catch(() =>
        console.error(
          JSON.stringify({ event: "wa.inbound.failed", code: "ENGINE_ERROR" }),
        ),
      );
    }
  }
  async drainInbound() {
    if (this.inboundBusy || !this.locks.size) return;
    this.inboundBusy = true;
    try {
      const rows = await db.webhookEvent.findMany({
        where: {
          provider: "baileys-inbound",
          status: "RECEIVED",
          AND: [
            {
              OR: [...this.locks.keys()].map((id) => ({
                payload: { path: ["sessionId"], equals: id },
              })),
            },
            { payload: { path: ["retryAt"], lte: Date.now() } },
          ],
        },
        take: 20,
        orderBy: { createdAt: "asc" },
      });
      for (const row of rows) {
        const payload = inboundPayload.parse(row.payload);
        try {
          const phone = replyPhone(payload),
            session = await db.whatsAppSession.findUniqueOrThrow({
              where: { id: payload.sessionId },
            });
          const text =
            payload.command === "STOP"
              ? `${APP_NAME}: WhatsApp updates are now stopped. Your ticket emails will continue.`
              : await ticketReply(session.id, phone);
          await this.queue.enqueue(session.id, 0, async () => {
            await this.assertOwned(session.id);
            const key = `wa:reply:${row.id}`,
              previous = await this.redis.get(key);
            if (previous && previous !== "pending") return;
            if (previous) throw new WaError("ENGINE_ERROR");
            await this.policy.check(
              session,
              {
                orgId: session.orgId,
                clientMessageId: row.id,
                to: phone,
                trigger: "ORDER_CONFIRMED",
                timezone: "Asia/Kolkata",
                text,
                consent: true,
                attachments: [],
              },
              1,
              {
                knownSender: true,
                stopAcknowledgement: payload.command === "STOP",
              },
            );
            const delay = await this.policy.pace(session.id, text);
            await this.engine.presence(session.id, phone, "composing");
            try {
              await new Promise((resolve) => setTimeout(resolve, delay));
              await this.assertOwned(session.id);
              if (
                process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
                (await this.redis.get("wa:kill-switch")) === "1"
              )
                throw new WaError("KILL_SWITCH");
              if (
                payload.command !== "STOP" &&
                (await db.whatsAppSuppression.findFirst({
                  where: {
                    phoneE164: phone,
                    OR: [{ orgId: session.orgId }, { orgId: null }],
                  },
                }))
              )
                throw new WaError("SUPPRESSED");
              if (!(await this.redis.set(key, "pending", "EX", 86400, "NX")))
                throw new WaError("ENGINE_ERROR");
              let result: SendResult;
              try {
                result = await this.engine.sendText(session.id, phone, text);
              } catch {
                if (await this.policy.failed(session.id))
                  await alertSession(session.id, "CIRCUIT_BREAKER").catch(
                    () => {},
                  );
                throw new WaError("ENGINE_ERROR");
              }
              await this.redis.set(key, JSON.stringify(result), "EX", 86400);
              await this.policy.sent(session.id);
            } finally {
              await this.engine
                .presence(session.id, phone, "paused")
                .catch(() => {});
            }
          });
          await db.webhookEvent.update({
            where: { id: row.id },
            data: { status: "PROCESSED", processedAt: new Date() },
          });
        } catch (error) {
          const retry =
            error instanceof WaError &&
            error.retryable &&
            (payload.attempts < 5 ||
              ["WA_CAP_REACHED", "QUIET_HOURS"].includes(error.code));
          await db.webhookEvent.update({
            where: { id: row.id },
            data: {
              status: retry ? "RECEIVED" : "FAILED",
              payload: {
                ...payload,
                attempts: payload.attempts + 1,
                retryAt:
                  Date.now() +
                  (error instanceof WaError
                    ? Math.max(5000, error.retryAfterMs)
                    : 60000),
              },
            },
          });
        }
      }
    } finally {
      this.inboundBusy = false;
    }
  }
  async boot() {
    if (process.env.WA_UNOFFICIAL_ENABLED !== "true") return;
    const sessions = await db.whatsAppSession.findMany({
      where: { status: { in: ["CONNECTED", "CONNECTING", "QR_PENDING"] } },
    });
    for (const session of sessions) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));
      await this.connect(session.id, session.orgId).catch(() => {});
    }
  }
  async health() {
    await this.redis.ping();
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  }
  async close() {
    await Promise.all([...this.locks.keys()].map((id) => this.stop(id)));
  }
}
