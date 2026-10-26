import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal";
import { site } from "@/config/site";
export default function ContactPage() {
  return (
    <LegalPage title="Let’s find the right door." footerPath="/contact">
      <h2>Questions about an event?</h2>
      <p>The event organizer knows the event best. Open its page and use “Contact organizer” to send a private message.</p>
      <Link href="/discover" className="m-text-link">
        Find your event ↗
      </Link>
      <h2>Managing an event?</h2>
      <p>
        Sign in to your workspace to manage the event, team and attendee
        information.
      </p>
      <Link href="/login" className="m-text-link">
        Open your workspace ↗
      </Link>
      <h2>Raunak support</h2>
      {site.supportEmail ? <p><a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p> : <p>For event and booking help, visit <Link href="/help">Help</Link>. A direct support address is not configured yet.</p>}
    </LegalPage>
  );
}
