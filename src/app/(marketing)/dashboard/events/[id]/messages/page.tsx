import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { defaultBodies } from "@/server/notifications/templates";
import { MessageEditor } from "@/components/dashboard/message-editor";
import { attachmentSettingsSchema } from "@/lib/whatsapp";
export default async function MessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  await requireEventAccessForUser(user.id, id, ["OWNER", "ADMIN", "MANAGER"]);
  const event = await db.event.findUniqueOrThrow({
    where: { id },
    include: { org: true },
  });
  const logs = await db.notificationLog.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      trigger: true,
      channel: true,
      status: true,
      error: true,
      errorCode: true,
      toAddress: true,
      attempts: true,
    },
  });
  const effective = await db.messageTemplate.findMany({ where: { orgId: event.orgId, OR: [{ eventId: id }, { eventId: null }] } });
  effective.sort((a, b) => Number(b.eventId === id) - Number(a.eventId === id));
  const templates = effective.map((t) => ({
    channel: t.channel,
    trigger: t.trigger,
    body: t.body,
    subject: t.subject,
    isEnabled: t.isEnabled,
    attachments: attachmentSettingsSchema.parse(t.attachments),
    slots: (t.slots as { custom_note?: string; custom_footer?: string }) || {},
  }));
  return (
    <main className="py-10">
      <h1 className="text-3xl font-semibold">Messages</h1>
      <p className="mb-8 mt-3">
        A thoughtful hello, a ticket, and a reminder. Make each one yours.
      </p>
      <MessageEditor
        eventId={id}
        orgId={event.orgId}
        whatsappMode={event.org.whatsappMode}
        templates={templates}
        defaults={defaultBodies}
        logs={logs}
        previewValues={{
          attendee_name: user.name || "Organizer",
          event_title: event.title,
          event_date: event.startsAt.toLocaleDateString("en-IN", {
            timeZone: event.timezone,
          }),
          event_time: event.startsAt.toLocaleTimeString("en-IN", {
            timeZone: event.timezone,
          }),
          venue: event.venueName || "Online",
          city: event.city || "",
          organizer_name: event.org.name,
          support_contact: event.org.supportEmail || "Organizer contact",
          ticket_type: "Ticket preview",
          ticket_code: "SAMPLE",
          quantity: "1",
          order_id: "PREVIEW",
          amount_paid: "Preview",
          ticket_url: `${process.env.APP_URL}/e/${event.slug}`,
        }}
      />
    </main>
  );
}
