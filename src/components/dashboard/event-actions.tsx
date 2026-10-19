"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EventActions({
  eventId,
  status,
  reviewNote,
}: {
  eventId: string;
  status: string;
  reviewNote?: string | null;
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
      {["DRAFT", "NEEDS_CHANGES", "REJECTED"].includes(status) && (
        <button
          disabled={busy}
          onClick={() => setStatus("PUBLISHED")}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[var(--on-accent)]"
        >
          {status === "DRAFT" ? "Submit for review" : "Resubmit for review"}
        </button>
      )}
      {status === "PENDING_REVIEW" && (
        <p className="self-center text-sm text-[var(--muted)]" role="status">
          Raunak is reviewing this event. It is not public yet.
        </p>
      )}
      {(status === "NEEDS_CHANGES" || status === "REJECTED") && reviewNote && (
        <p className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
          <strong className="mr-1 text-[var(--ink)]">Raunak review:</strong>
          {reviewNote}
        </p>
      )}
      {status === "SUSPENDED" && (
        <p className="self-center text-sm text-[var(--muted)]" role="status">
          This event is paused and hidden from public discovery.
          {reviewNote ? ` Review note: ${reviewNote}` : ""}
        </p>
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
            className="rounded-xl border border-[var(--danger)] px-4 py-2 text-[var(--danger)]"
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
        <p role="alert" className="w-full text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
