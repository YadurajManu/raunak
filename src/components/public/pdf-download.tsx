"use client";
import { useState } from "react";
export function PdfDownload({ ticketId }: { ticketId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`/api/tickets/${ticketId}/pdf`);
        if (response.status === 202) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
        if (!response.ok)
          throw new Error("Your PDF is unavailable. Please try again shortly.");
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = `raunak-ticket-${ticketId}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      throw new Error(
        "Your ticket is still being prepared. Please try again in a moment.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="m-button m-button-outline"
        onClick={download}
        disabled={busy}
      >
        {busy ? "Preparing PDF…" : "Download PDF ↓"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
