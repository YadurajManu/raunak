import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal";
import { APP_NAME } from "@/lib/constants";
export const metadata: Metadata = {
  title: `Privacy | ${APP_NAME}`,
  alternates: { canonical: "/privacy" },
};
export default function PrivacyPage() {
  return (
    <LegalPage title="Your privacy matters.">
      <h2>What we collect</h2>
      <p>
        We use your name, email address and account identifier to provide your
        account. When you book tickets, we also process your mobile number,
        order details, ticket details and check-in status. Organizers may upload
        event images and team information.
      </p>
      <h2>Why we use it</h2>
      <p>
        We use this information to manage events, process bookings, deliver
        tickets and event updates, prevent duplicate entry, and support your
        account. We do not sell your personal information.
      </p>
      <h2>Your optional profile details</h2>
      <p>
        You may choose to share your gender and city. Selecting a map pin uses
        Geoapify address lookup and OpenStreetMap tiles. Browser location is
        requested only after you choose to share it. We store only your city and
        region unless you separately choose to save the exact pin. You can
        remove these details in your profile. If you select event interests, we
        store those categories in your account so you can revisit them across
        devices. You can change or clear them in your profile.
      </p>
      <h2>Who helps provide the service</h2>
      <p>
        Firebase handles authentication. Cashfree handles payments; we do not
        store your card credentials. Our hosting, storage, email and WhatsApp
        providers process information needed to operate the service. Your event
        organizer can access attendee details needed to run the event. Access is
        limited by workspace and role.
      </p>
      <h2>Cookies and preferences</h2>
      <p>
        We use an essential session cookie to keep you signed in. Your browser
        may also store your theme preference and ticket selection. These support
        the service and are not advertising cookies. Optional email and WhatsApp
        reminder preferences are saved in your account.
      </p>
      <h2>Retention and security</h2>
      <p>
        We keep information for service delivery, transaction records and
        applicable legal obligations. We use access controls and encrypted
        connections. No online service can guarantee absolute security.
      </p>
      <h2>Your choices</h2>
      <p>
        When signed in, open <Link href="/account/profile?section=privacy">Privacy
        &amp; security</Link> to download your account and booking summary as JSON
        or request account deletion. Deletion requests are reviewed manually;
        submitting a request does not immediately delete your account. Booking
        and transaction records may be retained for transaction records and
        applicable legal obligations. For event-specific questions, contact the
        organizer shown on the event page.
      </p>
    </LegalPage>
  );
}
