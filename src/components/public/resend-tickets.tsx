"use client";
import { useState } from "react";
export function ResendTickets({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        className="m-button m-button-outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch(`/api/orders/${orderId}/resend`, {
              method: "POST",
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setMessage(
              "Ticket delivery queued. You can also download your PDF from My tickets.",
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not resend tickets.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Queuing…" : "Resend tickets"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
