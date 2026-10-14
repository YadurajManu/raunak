"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function TestEventToggle({
  eventId,
  isTest,
}: {
  eventId: string;
  isTest: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="mt-6">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isTest}
          disabled={busy}
          onChange={async (e) => {
            const value = e.target.checked;
            setBusy(true);
            setError("");
            try {
              const r = await fetch(`/api/events/${eventId}/test`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isTest: value }),
              });
              if (!r.ok) throw new Error();
              router.refresh();
            } catch {
              setError(
                "Could not update. Events with active bookings cannot be marked as tests.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        Test event · hidden from public discovery and booking
      </label>
      {error && (
        <p role="alert" className="m-field-error">
          {error}
        </p>
      )}
    </section>
  );
}
