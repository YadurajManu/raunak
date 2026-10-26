import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal";
import { marketing } from "@/config/marketing";
export const metadata = { title: "Help | Raunak", description: "Help with Raunak tickets, events and hosting." };
export default function HelpPage() {
  return <LegalPage title="A hand with your plans?" footerPath="/help">
    <h2 id="attendees">For attendees</h2>
    {marketing.faq.filter((item) => /ticket|app|refund|pay/i.test(item.question)).map((item) => <section key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></section>)}
    <h2 id="ticket-not-received">Ticket not received?</h2>
    <ol><li>Check the email address used at checkout and your spam folder.</li><li>Sign in to the same account and open <Link href="/account">My plans</Link>.</li><li>Open the booking to resend the ticket or download it.</li></ol>
    <h2>For organizers</h2>
    <p>Manage event details, tickets, team access and attendee messages from your organizer dashboard.</p>
    <Link href="/dashboard">Open organizer workspace →</Link>
    <h2>Still need help?</h2><p>For event-specific questions, use Contact organizer on the event page. For Raunak support, see <Link href="/contact">contact options</Link>.</p>
  </LegalPage>;
}
