"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventSalesToggle({
  eventId,
  paused,
}: {
  eventId: string;
  paused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="mt-6 rounded-2xl border border-[var(--line)] p-6">
      <h2 className="text-xl font-semibold">Ticket sales</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Pausing blocks new checkouts immediately. A payment already started may
        still complete at Cashfree; the app will request a refund instead of
        issuing tickets.
      </p>
      <button
        type="button"
        disabled={busy}
        className="m-button mt-4"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch(`/api/events/${eventId}/sales`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paused: !paused }),
            });
            if (!response.ok)
              throw new Error(
                (await response.json()).error || "Could not update sales.",
              );
            router.refresh();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not update sales.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Updating…"
          : paused
            ? "Resume ticket sales"
            : "Freeze payments and ticket sales"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
