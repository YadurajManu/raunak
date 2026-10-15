"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
export function SaveEvent({
  eventId,
  initial,
  labeled = false,
}: {
  eventId: string;
  initial: boolean;
  labeled?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className={`save-action${labeled ? " save-action-labeled" : ""}`}>
      <button
        type="button"
        disabled={busy}
        aria-pressed={saved}
        aria-busy={busy}
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
        {busy ? (
          <LoaderCircle size={18} aria-hidden="true" />
        ) : (
          <Heart
            size={18}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        )}
        {labeled && <span>{busy ? "Saving…" : saved ? "Saved" : "Save"}</span>}
      </button>
      <span className="sr-only" role="status">
        {saved ? "Event saved" : "Event not saved"}
      </span>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
