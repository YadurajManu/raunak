import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type Redis from "ioredis";
import { z } from "zod";
import {
  WaError,
  type GatewayMessage,
  type WhatsAppEngine,
} from "@raunak/wa-contracts";
import { db } from "@/server/db/client";
import type { WhatsAppSession } from "@/generated/prisma/client";
import { warmupCap } from "@/server/whatsapp/limits";

export function quietDelay(trigger: string, timezone: string, now: number) {
  if (!trigger.startsWith("REMINDER")) return 0;
  let date: Temporal.ZonedDateTime;
  try {
    date =
      Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timezone);
  } catch {
    throw new WaError("ENGINE_ERROR");
  }
  if (date.hour >= 7 && date.hour < 22) return 0;
  const next = (date.hour >= 22 ? date.add({ days: 1 }) : date).with({
    hour: 7,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return next.epochMilliseconds - now;
}
export const policyConfigSchema = z
  .object({
    WA_MAX_DAILY: z.coerce.number().int().min(1).max(10000).default(400),
    WA_PER_RECIPIENT_DAILY: z.coerce.number().int().min(1).max(100).default(6),
    WA_MIN_DELAY_MS: z.coerce.number().int().min(0).max(30000).default(4000),
    WA_MAX_DELAY_MS: z.coerce.number().int().min(0).max(30000).default(12000),
  })
  .refine(
    (value) => value.WA_MAX_DELAY_MS >= value.WA_MIN_DELAY_MS,
    "Maximum delay must be at least minimum delay",
  );
const reserve = `
for i=1,3 do if tonumber(redis.call('GET',KEYS[i]) or '0') + tonumber(ARGV[1]) > tonumber(ARGV[i+1]) then return i end end
for i=1,3 do redis.call('INCRBY',KEYS[i],ARGV[1]); redis.call('PEXPIRE',KEYS[i],ARGV[i+4]) end
return 0`;
export class PolicyEngine {
  readonly config;
  constructor(
    private redis: Redis,
    private engine: WhatsAppEngine,
    private now = () => Date.now(),
  ) {
    this.config = policyConfigSchema.parse(process.env);
  }
  async check(
    session: WhatsAppSession,
    message: Omit<GatewayMessage, "orgId"> & { orgId: string | null },
    count = 1,
    reply?: { knownSender: boolean; stopAcknowledgement: boolean },
  ) {
    const now = this.now();
    if (
      process.env.WA_UNOFFICIAL_ENABLED !== "true" ||
      (await this.redis.get("wa:kill-switch")) === "1"
    )
      throw new WaError("KILL_SWITCH");
    if (session.status === "PAUSED" || session.status === "BANNED_SUSPECTED")
      throw new WaError("SESSION_PAUSED");
    if (session.status !== "CONNECTED")
      throw new WaError("SESSION_DISCONNECTED");
    if (!message.consent) throw new WaError("NO_CONSENT");
    const phone = parsePhoneNumberFromString(message.to, "IN");
    if (!phone?.isValid() || phone.number !== message.to)
      throw new WaError("NOT_ON_WHATSAPP");
    if (message.notificationId) {
      if (!message.orgId) throw new WaError("NO_CONSENT");
      const log = await db.notificationLog.findFirst({
        where: {
          id: message.notificationId,
          orgId: message.orgId,
          channel: "WHATSAPP",
          toAddress: phone.number,
          trigger: message.trigger,
        },
        include: { order: true },
      });
      if (
        !log ||
        !log.order.whatsappOptIn ||
        parsePhoneNumberFromString(log.order.buyerPhone || "", "IN")?.number !==
          phone.number
      )
        throw new WaError("NO_CONSENT");
    }
    if (
      !reply?.stopAcknowledgement &&
      (await db.whatsAppSuppression.findFirst({
        where: {
          phoneE164: phone.number,
          OR: [{ orgId: message.orgId }, { orgId: null }],
        },
      }))
    )
      throw new WaError("SUPPRESSED");
    const quiet = quietDelay(message.trigger, message.timezone, now);
    if (quiet) throw new WaError("QUIET_HOURS", true, quiet);
    const recipient = createHash("sha256").update(phone.number).digest("hex");
    const numberKey = `wa:verified:${session.id}:${recipient}`;
    const cached = await this.redis.get(numberKey);
    if (cached !== "1" && !reply?.knownSender) {
      if (!(await this.engine.isOnWhatsApp(session.id, phone.number))) {
        await db.whatsAppSuppression.createMany({
          data: {
            orgId: message.orgId,
            phoneE164: phone.number,
            reason: "NOT_ON_WHATSAPP",
          },
          skipDuplicates: true,
        });
        throw new WaError("NOT_ON_WHATSAPP");
      }
      await this.redis.set(numberKey, "1", "EX", 7 * 86400);
    }
    const day = new Date(now).toISOString().slice(0, 10),
      dayTtl = 86400000 - (now % 86400000);
    const minute = Math.floor(now / 60000),
      minuteTtl = 60000 - (now % 60000);
    const { cap } = warmupCap(
      session.warmupStartedAt,
      this.config.WA_MAX_DAILY,
      session.dailyCapOverride,
      now,
    );
    const blocked = Number(
      await this.redis.eval(
        reserve,
        3,
        `wa:usage:${session.id}:${day}`,
        `wa:recipient:${session.id}:${recipient}:${day}`,
        `wa:minute:${session.id}:${minute}`,
        count,
        cap,
        this.config.WA_PER_RECIPIENT_DAILY,
        8,
        dayTtl,
        dayTtl,
        minuteTtl,
      ),
    );
    if (blocked)
      throw new WaError(
        "WA_CAP_REACHED",
        true,
        (blocked === 3 ? minuteTtl : dayTtl) + Math.floor(Math.random() * 2000),
      );
  }
  async pace(sessionId: string, text: string) {
    const last = Number(await this.redis.get(`wa:last-send:${sessionId}`)) || 0;
    const spacing =
      this.config.WA_MIN_DELAY_MS +
      Math.random() *
        (this.config.WA_MAX_DELAY_MS - this.config.WA_MIN_DELAY_MS);
    const delay = Math.max(0, last + spacing - this.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return Math.min(3000, Math.max(1000, text.length * 15));
  }
  async sent(sessionId: string) {
    await this.redis.set(
      `wa:last-send:${sessionId}`,
      String(this.now()),
      "EX",
      86400,
    );
    await this.redis.del(`wa:failures:${sessionId}`);
  }
  async failed(sessionId: string) {
    const count = await this.redis.incr(`wa:failures:${sessionId}`);
    await this.redis.expire(`wa:failures:${sessionId}`, 86400);
    if (count < 3) return false;
    await db.whatsAppSession.update({
      where: { id: sessionId },
      data: {
        status: "PAUSED",
        pausedUntil: new Date(this.now() + 900000),
        lastError: "CIRCUIT_BREAKER",
      },
    });
    return true;
  }
}
