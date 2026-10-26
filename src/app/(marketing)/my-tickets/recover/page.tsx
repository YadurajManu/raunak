import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { RouteFooter } from "@/components/marketing/footer";
export const metadata = {
  title: "Find your booking | Raunak",
  robots: { index: false },
};
export default async function RecoverBooking() {
  const user = await currentUser();
  return (
    <>
      <main className="market-page recovery-page">
        <p className="m-eyebrow">LET’S FIND YOUR PLAN</p>
        <h1>Find a booking</h1>
        <p>
          Raunak bookings are connected to the account used at checkout. Sign in
          using that same email or Google account to retrieve them securely.
        </p>
        {user && (
          <p>
            You are signed in as <strong>{user.email}</strong>. If you booked
            using another account, switch accounts from your profile menu and
            return here.
          </p>
        )}
        <div className="wallet-actions">
          <Link
            href={user ? "/my-tickets" : "/login?next=/my-tickets"}
            className="m-button"
          >
            {user ? "Open my wallet ↗" : "Sign in to find tickets ↗"}
          </Link>
          <Link href="/contact" className="r-quiet-button">
            Contact support
          </Link>
        </div>
        <h2>Payment made, tickets missing?</h2>
        <p>
          Open the signed booking link from your confirmation email. Payment may
          still be confirming. A booking reference alone cannot unlock tickets;
          support will verify ownership before helping.
        </p>
        <p>
          No guest checkout is currently offered. We never link another person’s
          booking using an unverified email, phone number or booking reference.
        </p>
      </main>
      <RouteFooter pathname="/my-tickets/recover" />
    </>
  );
}
