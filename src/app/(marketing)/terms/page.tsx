import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal";
import { APP_NAME } from "@/lib/constants";
import { firstEventLabel, standardFeeLabel } from "@/config/pricing";
export const metadata: Metadata = {
  title: `Terms | ${APP_NAME}`,
  alternates: { canonical: "/terms" },
};
export default function TermsPage() {
  return (
    <LegalPage title="A few ground rules.">
      <h2>Using the service</h2>
      <p>
        {APP_NAME} provides tools for event publishing, ticket booking,
        communication and check-in. Keep account details accurate and secure. Do
        not use the service for unlawful events, fraud, spam, infringement or
        interference with other users.
      </p>
      <h2>Organizer responsibilities</h2>
      <p>
        Organizers are responsible for event accuracy, permissions, venue
        safety, delivery of the event, and their refund policy. Upload only
        content you have permission to use. Obtain any required consent before
        sending communications.
      </p>
      <h2>Tickets and entry</h2>
      <p>
        Tickets are subject to the event terms and capacity. A valid QR code
        permits one check-in. Sharing a ticket may result in someone else using
        it first. Event timing, venue and entry requirements are set by the
        organizer.
      </p>
      <h2>Fees and payments</h2>
      <p>
        {firstEventLabel()}. Standard pricing after the first event is{" "}
        {standardFeeLabel()}. Free tickets remain free. Payment gateway
        processing charges apply to paid tickets. The final amount is shown
        before payment. Commercial pricing and first-event eligibility must be
        confirmed before launch.
      </p>
      <h2>Cancellations and refunds</h2>
      <p>
        Each organizer sets and displays their event refund policy. Contact the
        organizer for cancellation or refund requests. Payment processing and
        bank timelines may affect when an approved refund reaches you.
      </p>
      <h2>Availability and changes</h2>
      <p>
        We aim to provide a reliable service, but availability can be affected
        by maintenance, network problems and third-party providers. We may
        suspend misuse or accounts that compromise the service. Material changes
        to these terms will be communicated before they take effect where
        required.
      </p>
      <h2>Before public launch</h2>
      <p>
        The contracting entity, support contact, liability terms, governing law
        and dispute process will be finalized following legal review. These
        draft terms do not replace mandatory consumer rights.
      </p>
    </LegalPage>
  );
}
