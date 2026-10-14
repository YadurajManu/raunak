import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal";
export default function ContactPage() {
  return (
    <LegalPage title="Let’s find the right door.">
      <h2>Questions about an event?</h2>
      <p>
        The event organizer knows the details best. Open your event page to find
        their support email or phone number, along with the venue and refund
        policy.
      </p>
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
    </LegalPage>
  );
}
