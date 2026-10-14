"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/money";
import { MediaDialog } from "./media-dialog";
export function BookingActions({
  eventId,
  orderId,
  paid,
  amount,
  canRefund,
  canResend,
  refund,
}: {
  eventId: string;
  orderId: string;
  paid: boolean;
  amount: number;
  canRefund: boolean;
  canResend: boolean;
  refund: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  async function submit(action: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${eventId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderId, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed.");
      setOpen(false);
      setReason("");
      setMessage(
        action === "RESEND"
          ? "Receipt and ticket delivery queued."
          : action === "REFUND"
            ? "Booking cancelled. Any payment refund is now tracked below."
            : "Refund status checked.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection interrupted. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ops-booking-actions">
      {paid && canResend && (
        <button
          className="r-quiet-button"
          disabled={busy}
          onClick={() => submit("RESEND")}
        >
          Resend tickets
        </button>
      )}
      {paid && canRefund && (
        <button
          className="r-quiet-button"
          disabled={busy}
          onClick={() => {
            setMessage("");
            setOpen(true);
          }}
        >
          {amount ? "Refund booking" : "Cancel booking"}
        </button>
      )}
      {refund && canRefund && (
        <button
          className="r-quiet-button"
          disabled={busy}
          onClick={() => submit("REFRESH_REFUND")}
        >
          Check refund
        </button>
      )}
      <p role="status">{message}</p>
      {open && (
        <MediaDialog
          title={amount ? "Refund this booking?" : "Cancel this booking?"}
          close={() => {
            if (!busy) setOpen(false);
          }}
          dirty={!!reason || busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                confirm(
                  `Cancel all entry tickets${amount ? ` and request a full refund of ${formatInr(amount)}` : ""}? This cannot be undone.`,
                )
              )
                void submit("REFUND");
            }}
            className="space-y-4"
          >
            <p>
              {amount
                ? `A full refund of ${formatInr(amount)} will be requested from Cashfree. Bank processing can take additional time.`
                : "This is a free booking; no money will be refunded."}{" "}
              All entry tickets will be cancelled immediately. The customer will
              receive an email update.
            </p>
            <label className="block">
              Reason
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent p-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={5}
                maxLength={200}
                readOnly={busy}
              />
            </label>
            <button className="m-button m-button-small" disabled={busy}>
              {busy
                ? "Processing…"
                : amount
                  ? "Confirm full refund"
                  : "Confirm cancellation"}
            </button>
            <p role="alert" className="m-field-error">
              {message}
            </p>
          </form>
        </MediaDialog>
      )}
    </div>
  );
}
