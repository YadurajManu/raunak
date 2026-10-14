"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EventActions({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function setStatus(next: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
    const response = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) router.refresh();
    else setError((await response.json()).error || "Could not change status.");
    } catch { setError("Connection interrupted. Please try again."); }
    finally { setBusy(false); }
  }
  async function duplicate() {
    if (busy) return;
    setBusy(true); setError("");
    try {
    const response = await fetch(`/api/events/${eventId}/duplicate`, {
      method: "POST",
    });
    const result = await response.json();
    if (response.ok) router.push(`/dashboard/events/${result.id}`);
    else setError(result.error || "Could not duplicate event.");
    } catch { setError("Connection interrupted. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <button
          disabled={busy}
          onClick={() => setStatus("PUBLISHED")}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-white"
        >
          Publish
        </button>
      )}
      {status === "PUBLISHED" && (
        <>
          <button
            disabled={busy}
            onClick={() => setStatus("DRAFT")}
            className="rounded-xl border border-[var(--line)] px-4 py-2 dark:border-[var(--line)]"
          >
            Unpublish
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("Cancel this event? Sales and check-in will stop, and customers will be notified. Review bookings below to issue refunds according to your policy. This cannot be undone.")) setStatus("CANCELLED");
            }}
            className="rounded-xl border border-red-300 px-4 py-2 text-red-600"
          >
            Cancel event
          </button>
        </>
      )}
      <button
        disabled={busy}
        onClick={duplicate}
        className="rounded-xl border border-[var(--line)] px-4 py-2 dark:border-[var(--line)]"
      >
        Duplicate
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
