import { db } from "@/server/db/client";
import {
  sendEmail,
  type EmailProvider,
} from "@/server/providers/email/provider";
import { APP_NAME } from "@/lib/constants";
import { createHash } from "node:crypto";
import { z } from "zod";

export async function alertSession(
  id: string,
  reason: string,
  provider: EmailProvider = { send: sendEmail },
) {
  const key = `${id}:${reason}:${Math.floor(Date.now() / 900000)}`;
  const row = await db.webhookEvent.upsert({
    where: {
      provider_idempotencyKey: {
        provider: "baileys-alert",
        idempotencyKey: key,
      },
    },
    update: {},
    create: {
      provider: "baileys-alert",
      idempotencyKey: key,
      payload: { sessionId: id, reason },
    },
  });
  if (row.status === "PROCESSED") return;
  await deliverAlert(row.id, row.payload, provider);
}
async function deliverAlert(
  id: string,
  payload: unknown,
  provider: EmailProvider,
) {
  const data = z
    .object({ sessionId: z.uuid(), reason: z.string().max(80) })
    .parse(payload);
  try {
    const session = await db.whatsAppSession.findUnique({
      where: { id: data.sessionId },
    });
    if (!session) {
      await db.webhookEvent.update({
        where: { id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return;
    }
    const owners = session.orgId
      ? await db.organizationMember.findMany({
          where: { orgId: session.orgId, role: "OWNER", status: "ACTIVE" },
          select: { user: { select: { email: true } } },
        })
      : [];
    const addresses = new Set(owners.map((owner) => owner.user.email));
    if (process.env.WA_ADMIN_EMAIL) addresses.add(process.env.WA_ADMIN_EMAIL);
    for (const to of addresses)
      await provider.send({
        to,
        subject: `${APP_NAME}: WhatsApp connection needs attention`,
        text: `WhatsApp delivery is paused (${data.reason}). Email ticket delivery remains available. Open your workspace WhatsApp integration to check the connection and re-link when appropriate.`,
        idempotencyKey: `wa-alert:${id}:${createHash("sha256").update(to).digest("hex").slice(0, 20)}`,
      });
    await db.webhookEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error) {
    await db.webhookEvent.update({ where: { id }, data: { status: "FAILED" } });
    throw error;
  }
}
export async function deliverAlerts(
  provider: EmailProvider = { send: sendEmail },
) {
  const pending = await db.webhookEvent.findMany({
    where: {
      provider: "baileys-alert",
      status: { in: ["RECEIVED", "FAILED"] },
    },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  for (const row of pending)
    await deliverAlert(row.id, row.payload, provider).catch(() => {});
}
