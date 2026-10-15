import { notFound } from "next/navigation";
import { WhatsAppIntegration } from "@/components/dashboard/whatsapp-integration";
import { MessageEditor } from "@/components/dashboard/message-editor";
import { AccountShell } from "@/components/onboarding/account-shell";
import { defaultBodies } from "@/server/notifications/templates";
import "../../dashboard/settings/whatsapp/whatsapp.css";
export default function WhatsAppPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AccountShell organizer>
      <div className="r-organizer">
        <WhatsAppIntegration orgId="11111111-1111-4111-8111-111111111111" />
        <h2 className="mb-6 mt-10 text-2xl">Message editor preview</h2>
        <MessageEditor
          orgId="11111111-1111-4111-8111-111111111111"
          whatsappMode="ORG_NUMBER"
          templates={[]}
          defaults={defaultBodies}
          logs={[]}
          previewValues={{
            attendee_name: "Sample attendee",
            event_title: "Sample event",
            event_date: "24 Oct 2026",
            event_time: "6 pm IST",
            venue: "Sample venue",
            city: "Pune",
            ticket_type: "Admission",
            ticket_code: "SAMPLE",
            quantity: "1",
            order_id: "SAMPLE",
            amount_paid: "Preview",
            ticket_url: "https://example.test/event",
            organizer_name: "Sample organizer",
            support_contact: "Sample support",
            custom_note: "",
            custom_footer: "",
          }}
        />
      </div>
    </AccountShell>
  );
}
