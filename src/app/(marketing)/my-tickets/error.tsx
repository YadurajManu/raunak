"use client";
import { PageHeader } from "@/components/ui";
export default function Error({ reset }: { reset(): void }) {
  return (
    <main className="market-page">
      <PageHeader title="Your wallet could not load" description="This does not mean your bookings are missing. Please try again." />
      <button className="m-button" onClick={reset}>
        Reload wallet
      </button>
    </main>
  );
}
