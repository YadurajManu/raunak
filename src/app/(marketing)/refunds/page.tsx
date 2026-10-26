import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal";
export const metadata = { title: "Refunds and cancellations | Raunak" };
export default function RefundsPage() {
  return <LegalPage title="Refunds, clearly explained." footerPath="/refunds">
    <h2>Start with the event policy</h2>
    <p>Each organizer sets the refund policy for their event. Read it on the event page and during checkout before booking. Contact the organizer to ask whether your booking is eligible.</p>
    <h2>How a paid refund works</h2>
    <p>When a refund is approved and processed, it is returned to the original payment method through Cashfree. Your bank or payment provider may take additional time to show the credit. The booking page and confirmation messages reflect the latest status available to Raunak.</p>
    <h2>Cancelled events</h2>
    <p>If an event is cancelled, follow the organizer’s published policy and the instructions in your booking updates. You can review the booking from <Link href="/account">My plans</Link>.</p>
    <h2>What still needs confirmation</h2>
    <p>{"{{TO CONFIRM}}"} — Whether Raunak will offer a separate support escalation for refund requests that an organizer has not resolved.</p>
    <p>{"{{TO CONFIRM}}"} — Whether Cashfree or platform processing charges are refundable in any case.</p>
    <p>For booking-specific questions, contact the organizer from the event page. For general help, visit <Link href="/help">Help</Link>.</p>
  </LegalPage>;
}
