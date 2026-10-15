"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/invites/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not accept invitation.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not accept invitation. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        onClick={accept}
        disabled={busy}
        className="m-button m-button-small"
      >
        {busy ? "Joining workspace…" : "Accept invitation ↗"}
      </button>
      {message && (
        <p role="alert" className="r-form-message">
          {message}
        </p>
      )}
    </>
  );
}
