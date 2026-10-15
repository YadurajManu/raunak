import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { saveMessageTemplate, resolvedTemplate } from "@/server/notifications/service";
import { resetMessageTemplate } from "@/server/notifications/editor";
import { defaultBodies } from "@/server/notifications/templates";
const suffix = randomUUID();
const owner = await db.user.create({ data: { firebaseUid: `wa-template-${suffix}`, email: `wa-template-${suffix}@example.test` } });
const org = await db.organization.create({ data: { name: "Template test", slug: `wa-template-${suffix}`, whatsappMode: "ORG_NUMBER", members: { create: { userId: owner.id, role: "OWNER" } } } });
const event = await db.event.create({ data: { orgId: org.id, title: "Template test", slug: `wa-template-${suffix}`, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) } });
afterAll(async () => {
  await db.messageTemplate.deleteMany({ where: { orgId: org.id } }); await db.auditLog.deleteMany({ where: { orgId: org.id } }); await db.event.delete({ where: { id: event.id } }); await db.organizationMember.deleteMany({ where: { orgId: org.id } }); await db.organization.delete({ where: { id: org.id } }); await db.user.delete({ where: { id: owner.id } });
});
it("persists full-body and attachment defaults with event overrides, while preserving official slots", async () => {
  const input = { channel: "WHATSAPP", trigger: "TICKET_ISSUED", isEnabled: true, body: "Welcome {{attendee_name}} · {{ticket_code}}", attachments: { ticketCard: true, ticketPdf: true, poster: false } };
  await expect(saveMessageTemplate(randomUUID(), null, input, org.id)).rejects.toThrow("Access denied");
  await saveMessageTemplate(owner.id, null, input, org.id);
  expect(await resolvedTemplate(org.id, event.id, "TICKET_ISSUED", "WHATSAPP")).toMatchObject({ body: input.body, attachments: input.attachments, eventId: null });
  await saveMessageTemplate(owner.id, event.id, { ...input, body: "Event override {{ticket_url}}" });
  expect((await resolvedTemplate(org.id, event.id, "TICKET_ISSUED", "WHATSAPP"))?.body).toBe("Event override {{ticket_url}}");
  await resetMessageTemplate(owner.id, event.id, input);
  expect((await resolvedTemplate(org.id, event.id, "TICKET_ISSUED", "WHATSAPP"))?.body).toBe(input.body);
  await db.organization.update({ where: { id: org.id }, data: { whatsappMode: "OFFICIAL_API" } });
  await saveMessageTemplate(owner.id, event.id, { ...input, custom_note: "Approved slot" });
  expect(await resolvedTemplate(org.id, event.id, "TICKET_ISSUED", "WHATSAPP")).toMatchObject({ body: defaultBodies.TICKET_ISSUED, slots: { custom_note: "Approved slot" } });
  await expect(saveMessageTemplate(owner.id, event.id, { ...input, body: "{{unknown_variable}}" })).rejects.toThrow("Unsupported variable");
});
