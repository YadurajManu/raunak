"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function DeleteEventButton({
  eventId,
  orgId,
}: {
  eventId: string;
  orgId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function remove() {
    if (!confirm("Delete this draft event?")) return;
    const response = await fetch(`/api/events/${eventId}`, {
      method: "DELETE",
    });
    if (response.ok) router.push(`/dashboard/events?org=${orgId}`);
    else setError((await response.json()).error || "Could not delete event.");
  }
  return (
    <>
      <button
        onClick={remove}
        className="mt-5 rounded-xl bg-red-600 px-4 py-2 font-medium text-white"
      >
        Delete draft
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
