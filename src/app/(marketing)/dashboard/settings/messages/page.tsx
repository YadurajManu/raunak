import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { MessageEditor } from "@/components/dashboard/message-editor";
import { defaultBodies } from "@/server/notifications/templates";
import { attachmentSettingsSchema } from "@/lib/whatsapp";
import { PageHeader, SettingsNavigation } from "@/components/ui";
export const metadata = {
  title: "Workspace message defaults",
  robots: { index: false, follow: false },
};
export default async function WorkspaceMessages({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser(),
    query = await searchParams;
  const memberships = await db.organizationMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: { org: true },
  });
  const selected =
    memberships.find((member) => member.orgId === query.org) ||
    (!query.org ? memberships[0] : undefined);
  if (!selected)
    return (
      <>
        <PageHeader title="Workspace messages" description="Choose a workspace you own or administer." />
        <Link href="/dashboard">Back to workspaces</Link>
      </>
    );
  const org = selected.org;
  const templates = await db.messageTemplate.findMany({
    where: { orgId: org.id, eventId: null },
  });
  const logs = await db.notificationLog.findMany({
    where: { orgId: org.id },
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
  return (
    <>
      <nav
        className="mb-6 flex flex-wrap gap-4"
        aria-label="Workspace message settings"
      >
        {memberships.map(({ org: workspace }) => (
          <Link
            key={workspace.id}
            href={`/dashboard/settings/messages?org=${workspace.id}`}
            aria-current={workspace.id === org.id ? "page" : undefined}
          >
            {workspace.name}
          </Link>
        ))}
      </nav>
      <SettingsNavigation orgId={org.id} current="messages" className="ui-settings-horizontal" />
      <PageHeader title="Workspace messages" description={`Defaults for ${org.name}. An event’s own settings take precedence.`} />
      <MessageEditor
        key={org.id}
        orgId={org.id}
        whatsappMode={org.whatsappMode}
        defaults={defaultBodies}
        templates={templates.map((template) => ({
          ...template,
          slots:
            (template.slots as {
              custom_note?: string;
              custom_footer?: string;
            }) || {},
          attachments: attachmentSettingsSchema.parse(template.attachments),
        }))}
        logs={logs}
        previewValues={{
          attendee_name: user.name || "Organizer",
          event_title: "Your event",
          event_date: "Event date",
          event_time: "Event time",
          venue: "Your venue",
          city: "Your city",
          ticket_type: "Ticket preview",
          ticket_code: "SAMPLE",
          quantity: "1",
          order_id: "PREVIEW",
          amount_paid: "Preview",
          ticket_url: `${process.env.APP_URL}/my-tickets`,
          organizer_name: org.name,
          support_contact: org.supportEmail || "Organizer contact",
          custom_note: "",
          custom_footer: "",
        }}
      />
    </>
  );
}
