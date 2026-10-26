"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
import { useEventViewer } from "@/components/public/event-viewer";
export function SaveEvent({
  eventId,
  initial,
  labeled = false,
  undoable = false,
}: {
  eventId: string;
  initial: boolean;
  labeled?: boolean;
  undoable?: boolean;
}) {
  const router = useRouter();
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);
  const viewer = useEventViewer();
  const saved = savedOverride ?? (viewer?.authenticated ? viewer.saved : initial);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  async function update(next: boolean) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const previous = saved;
    const previousRemoved = removed;
    setBusy(true);
    setError("");
    setSavedOverride(next);
    setRemoved(undoable && !next);
    try {
      const r = await fetch(`/api/events/${eventId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: next }),
      });
      if (r.status === 401) {
        setSavedOverride(previous);
        setRemoved(previousRemoved);
        router.push(
          `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
        );
        return;
      }
      if (!r.ok) throw new Error();
      // Give the attendee eight seconds to undo before refreshing the collection.
      if (undoable && !next)
        refreshTimer.current = setTimeout(() => router.refresh(), 8000);
      else if (!undoable) router.refresh();
    } catch {
      setSavedOverride(previous);
      setRemoved(previousRemoved);
      setError("Could not update saved event. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className={`save-action${labeled ? " save-action-labeled" : ""}`}>
      <button
        type="button"
        disabled={busy}
        aria-pressed={saved}
        aria-busy={busy}
        aria-label={
          saved
            ? undoable
              ? "Remove from saved"
              : "Unsave event"
            : "Save event"
        }
        onClick={() => update(!saved)}
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
      {removed && (
        <span className="saved-undo" role="status">
          Removed from saved{" "}
          <button type="button" disabled={busy} onClick={() => update(true)}>
            Undo
          </button>
        </span>
      )}
    </span>
  );
}
