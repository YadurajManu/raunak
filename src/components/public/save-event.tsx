"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SaveEvent({
  eventId,
  initial,
}: {
  eventId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="save-action">
      <button
        type="button"
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Unsave event" : "Save event"}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(`/api/events/${eventId}/save`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ saved: !saved }),
            });
            if (r.status === 401) {
              router.push(
                `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
              );
              return;
            }
            if (!r.ok) throw new Error("Could not save. Try again.");
            setSaved(!saved);
            router.refresh();
          } catch {
            setError("Could not update saved event. Retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {saved ? "♥" : "♡"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
