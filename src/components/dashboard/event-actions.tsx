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
  async function setStatus(next: string) {
    setError("");
    const response = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) router.refresh();
    else setError((await response.json()).error || "Could not change status.");
  }
  async function duplicate() {
    const response = await fetch(`/api/events/${eventId}/duplicate`, {
      method: "POST",
    });
    const result = await response.json();
    if (response.ok) router.push(`/dashboard/events/${result.id}`);
    else setError(result.error || "Could not duplicate event.");
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <button
          onClick={() => setStatus("PUBLISHED")}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white"
        >
          Publish
        </button>
      )}
      {status === "PUBLISHED" && (
        <>
          <button
            onClick={() => setStatus("DRAFT")}
            className="rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700"
          >
            Unpublish
          </button>
          <button
            onClick={() => {
              if (confirm("Cancel this event?")) setStatus("CANCELLED");
            }}
            className="rounded-xl border border-red-300 px-4 py-2 text-red-600"
          >
            Cancel event
          </button>
        </>
      )}
      <button
        onClick={duplicate}
        className="rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700"
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
