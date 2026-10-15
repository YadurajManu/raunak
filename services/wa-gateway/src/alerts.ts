import { db } from "@/server/db/client";
import { sendEmail } from "@/server/providers/email/provider";
import { APP_NAME } from "@/lib/constants";

export async function alertSession(id: string, reason: string) {
  const session = await db.whatsAppSession.findUniqueOrThrow({ where: { id } });
  const owners = session.orgId ? await db.organizationMember.findMany({ where: { orgId: session.orgId, role: "OWNER", status: "ACTIVE" }, select: { user: { select: { email: true } } } }) : [];
  const addresses = new Set(owners.map(owner => owner.user.email));
  if (process.env.WA_ADMIN_EMAIL) addresses.add(process.env.WA_ADMIN_EMAIL);
  for (const to of addresses) await sendEmail({ to, subject: `${APP_NAME}: WhatsApp connection needs attention`, text: `WhatsApp delivery is paused (${reason}). Email ticket delivery remains available. Open your workspace WhatsApp integration to check the connection and re-link when appropriate.`, idempotencyKey: `wa-alert:${id}:${reason}:${Math.floor(Date.now() / 900000)}` });
}
