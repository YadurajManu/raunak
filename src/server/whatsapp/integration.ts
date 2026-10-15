import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { gatewayRequest, BaileysGatewayProvider } from "@/server/providers/whatsapp/gateway";
import { producerConnection } from "../../../worker/queues";
import { APP_NAME } from "@/lib/constants";
import { WaError } from "@raunak/wa-contracts";
import { renderTicketCard } from "@/server/tickets/card";
import { warmupCap } from "./limits";
export { warmupCap } from "./limits";

export const connectionSchema = z.object({ id: z.uuid(), status: z.string(), phone: z.string().nullable(), pushName: z.string().nullable(), lastSeenAt: z.string().nullable(), connectedAt: z.string().nullable(), uptimeSeconds: z.number(), qr: z.string().nullable(), lastError: z.string().nullable() });
export function officialConfigured() { return !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID); }
export async function integrationStatus(userId: string, orgId: string) {
  await requireOrgRoleForUser(userId, orgId, ["OWNER", "ADMIN"]);
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const session = await db.whatsAppSession.findFirst({ where: { orgId, label: "default" } });
  const platform = await db.whatsAppSession.findFirst({ where: { orgId: null, label: "default", status: "CONNECTED" }, select: { id: true } });
  const { day, cap } = warmupCap(session?.warmupStartedAt || null, Number(process.env.WA_MAX_DAILY) || 400, session?.dailyCapOverride);
  const today = new Date().toISOString().slice(0, 10);
  const sent = session ? Number(await producerConnection.get(`wa:usage:${session.id}:${today}`)) || 0 : 0;
  let gatewayAvailable = true;
  const connection = session ? await gatewayRequest(`/v1/sessions/${session.id}?orgId=${orgId}`).then(value => connectionSchema.parse(value)).catch(() => {
    gatewayAvailable = false;
    return { id: session.id, status: "UNREACHABLE", phone: session.phoneE164 ? `••••${session.phoneE164.slice(-4)}` : null, pushName: session.pushName, lastSeenAt: session.lastSeenAt?.toISOString() || null, connectedAt: session.connectedAt?.toISOString() || null, uptimeSeconds: 0, qr: null, lastError: "GATEWAY_UNREACHABLE" };
  }) : null;
  return { mode: org.whatsappMode, connection, day, cap, sent, gatewayAvailable, enabled: process.env.WA_UNOFFICIAL_ENABLED === "true", officialAvailable: officialConfigured(), platformAvailable: !!platform };
}
export const integrationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect") }), z.object({ action: z.literal("disconnect") }),
  z.object({ action: z.literal("pairing"), phone: z.string().max(25) }),
  z.object({ action: z.literal("test"), phone: z.string().max(25), consent: z.literal(true), sampleTicket: z.boolean().default(false) }),
  z.object({ action: z.literal("mode"), mode: z.enum(["DISABLED", "PLATFORM_NUMBER", "ORG_NUMBER", "OFFICIAL_API"]) }),
]);
export async function integrationAction(userId: string, orgId: string, input: unknown) {
  await requireOrgRoleForUser(userId, orgId, ["OWNER", "ADMIN"]);
  const data = integrationActionSchema.parse(input);
  const count = await producerConnection.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`, 1, `wa:dashboard:${orgId}:${userId}:${data.action}`);
  if (Number(count) > (data.action === "test" ? 3 : 6)) throw new WaError("RATE_LIMITED", true, 60000);
  if (data.action === "mode") {
    if (data.mode === "OFFICIAL_API" && !officialConfigured()) throw new Error("Official API is not configured.");
    if (data.mode === "PLATFORM_NUMBER" && !await db.whatsAppSession.findFirst({ where: { orgId: null, label: "default", status: "CONNECTED" } })) throw new WaError("SESSION_DISCONNECTED");
    await db.$transaction([
      db.organization.update({ where: { id: orgId }, data: { whatsappMode: data.mode } }),
      db.auditLog.create({ data: { orgId, actorId: userId, action: "whatsapp.mode", entityType: "Organization", entityId: orgId, meta: { mode: data.mode } } }),
    ]);
    return { ok: true };
  }
  let session = await db.whatsAppSession.findFirst({ where: { orgId, label: "default" } });
  if (!session && data.action === "connect") {
    const created = z.object({ id: z.uuid() }).parse(await gatewayRequest("/v1/sessions", { orgId, userId }));
    session = await db.whatsAppSession.findUniqueOrThrow({ where: { id: created.id } });
  }
  if (!session) throw new WaError("SESSION_DISCONNECTED");
  await db.auditLog.create({ data: { orgId, actorId: userId, action: `whatsapp.${data.action}.requested`, entityType: "WhatsAppSession", entityId: session.id } });
  if (data.action === "test") {
    const phone = parsePhoneNumberFromString(data.phone, "IN");
    if (!phone?.isValid()) throw new Error("Enter a valid mobile number with country code.");
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (org.whatsappMode !== "ORG_NUMBER") throw new Error("Select My own number before sending a test.");
    const message = { orgId, clientMessageId: `test:${crypto.randomUUID()}`, trigger: "ORDER_CONFIRMED" as const, consent: true, to: phone.number, timezone: "Asia/Kolkata", text: `${APP_NAME}: your WhatsApp connection is working. This is a test message requested by your workspace administrator.`, attachments: [] };
    const provider = new BaileysGatewayProvider();
    if (data.sampleTicket) {
      const sample = await renderTicketCard({ title: "Your next great event", date: "Sample connection test", venue: org.name, holder: "Test recipient", type: "Sample ticket · no admission", code: "SAMPLE", url: z.url().parse(process.env.APP_URL), sample: true });
      await provider.sendImage(session.id, message, sample);
    } else await provider.send(session.id, message);
    return { ok: true };
  }
  return gatewayRequest(`/v1/sessions/${session.id}/${data.action === "pairing" ? "pairing-code" : data.action}`, {
    orgId, ...(data.action === "pairing" ? { phone: (() => { const phone = parsePhoneNumberFromString(data.phone, "IN"); if (!phone?.isValid()) throw new Error("Enter a valid phone number."); return phone.number; })() } : {}),
  });
}
