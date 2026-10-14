"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    const response = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
    const result = await response.json();
    if (response.ok) { router.push("/dashboard"); router.refresh(); } else { setMessage(result.error || "Could not accept invitation."); setBusy(false); }
  }
  return <><button onClick={accept} disabled={busy} className="mt-8 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white disabled:opacity-50">Accept invitation</button>{message && <p role="alert" className="mt-4 text-red-600">{message}</p>}</>;
}
