"use client";
import Link from "next/link";
export default function PlansError({ retry }: { retry: () => void }) {
  return (
    <main className="plans-page">
      <h1>Your plans couldn’t load.</h1>
      <p>
        We couldn’t retrieve your account right now. Your bookings haven’t
        changed.
      </p>
      <div className="plans-empty-actions">
        <button className="plans-button plans-primary" onClick={retry}>
          Try again
        </button>
        <Link className="plans-button" href="/my-tickets">
          Open My tickets
        </Link>
        <Link className="plans-button" href="/contact">
          Get help
        </Link>
      </div>
    </main>
  );
}
