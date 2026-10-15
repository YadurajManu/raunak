"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { LoaderCircle, MessageCircle, X } from "lucide-react";
import type { integrationStatus } from "@/server/whatsapp/integration";

type Status = Awaited<ReturnType<typeof integrationStatus>>;
export function WhatsAppIntegration({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [open, setOpen] = useState(false), [pairing, setPairing] = useState(false), [phone, setPhone] = useState(""), [code, setCode] = useState(""), [consent, setConsent] = useState(false), [sampleTicket, setSampleTicket] = useState(false), [qr, setQr] = useState({ source: "", url: "" });
  const dialog = useRef<HTMLDialogElement>(null), endpoint = `/api/orgs/${orgId}/whatsapp`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try { const response = await fetch(endpoint, { cache: "no-store", signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load the connection."); setStatus(data); setError(""); }
    catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Could not load WhatsApp."); }
  }, [endpoint]);
  useEffect(() => { const controller = new AbortController(); const initial = setTimeout(() => { void refresh(controller.signal); }, 0); const timer = setInterval(() => { if (!document.hidden) void refresh(controller.signal); }, open ? 2000 : 15000); return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); }; }, [refresh, open]);
  useEffect(() => { let alive = true; const value = status?.connection?.qr; if (value) void QRCode.toDataURL(value, { width: 264, margin: 3 }).then(data => { if (alive) setQr({ source: value, url: data }); }); return () => { alive = false; }; }, [status?.connection?.qr]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Please try again."); if (data.code) setCode(data.code); setNotice(payload.action === "test" ? "Test message sent." : payload.action === "mode" ? "Delivery mode saved." : "Connection updated."); await refresh(); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); return false; } finally { setBusy(false); }
  }
  const connected = status?.connection?.status === "CONNECTED";
  return <div className="wa-integration">
    <header><p className="m-eyebrow">SETTINGS / INTEGRATIONS</p><h1>WhatsApp delivery</h1><p>Connect your event messages. Email remains the backup.</p></header>
    {error && <div role="alert" className="wa-feedback">{error} <button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!status ? !error && <p role="status"><LoaderCircle size={18} /> Loading connection…</p> : <>
      <section className="wa-panel"><label htmlFor="wa-mode">Send WhatsApp messages with</label><select id="wa-mode" disabled={busy} value={status.mode} onChange={event => void act({ action: "mode", mode: event.target.value })}><option value="DISABLED">Off · email only</option><option value="PLATFORM_NUMBER" disabled={!status.platformAvailable}>Platform number{!status.platformAvailable ? " · not connected" : ""}</option><option value="ORG_NUMBER">My own number</option>{status.officialAvailable && <option value="OFFICIAL_API">Official API</option>}</select>
      {!status.enabled && <p className="wa-muted">Unofficial delivery is switched off on the server. An administrator must configure and enable the private gateway before linking.</p>}</section>
      <section className="wa-panel"><div className="wa-heading"><MessageCircle size={22} /><h2>Your number</h2><span className={`wa-badge ${connected ? "is-connected" : ""}`}>{status.connection?.status.replaceAll("_", " ") || "Not connected"}</span></div>
        <p>{status.connection?.phone || "No linked number"}{status.connection?.pushName ? ` · ${status.connection.pushName}` : ""}</p>
        {status.connection?.lastSeenAt && <p className="wa-muted">Last connected {new Date(status.connection.lastSeenAt).toLocaleString()} · uptime {Math.floor(status.connection.uptimeSeconds / 60)} min</p>}
        <div className="wa-actions"><button disabled={busy || !status.enabled} onClick={async () => { if (await act({ action: "connect" })) setOpen(true); }}>{connected ? "Connection details" : "Connect number"}</button>{status.connection && <button disabled={busy} onClick={() => { if (confirm("Disconnect this number? You will need to link it again.")) void act({ action: "disconnect" }); }}>Disconnect</button>}</div>
        <label htmlFor="wa-usage">Today: {status.sent} / {status.cap} sends</label><progress id="wa-usage" max={status.cap} value={status.sent} /><p className="wa-muted">Warm-up day {status.day}: limit {status.cap}/day. These limits do not guarantee protection from restrictions.</p>
      </section>
      {connected && <form className="wa-panel" onSubmit={event => { event.preventDefault(); void act({ action: "test", phone, consent, sampleTicket }); }}><h2>Send a test</h2><label htmlFor="wa-test-phone">Recipient mobile number</label><input id="wa-test-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={event => setPhone(event.target.value)} required /><label className="wa-check"><input type="checkbox" checked={sampleTicket} onChange={event => setSampleTicket(event.target.checked)} /> Include a sample ticket card (not valid for entry).</label><label className="wa-check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required /> I own this number or have permission to send a test.</label><button disabled={busy || !consent || status.mode !== "ORG_NUMBER"}>Send test message</button>{status.mode !== "ORG_NUMBER" && <p className="wa-muted">Choose My own number to test this connection.</p>}</form>}
    </>}
    <aside className="wa-notice">This links a normal WhatsApp number using an unofficial method. Use a dedicated number, not your personal one. WhatsApp can restrict numbers that send unwanted messages, so only message people who bought tickets. Email delivery is always the backup.</aside>
    <dialog ref={dialog} className="wa-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}><div className="wa-heading"><h2>{connected ? "You’re connected" : "Link your number"}</h2><button aria-label="Close connection dialog" onClick={() => setOpen(false)}><X size={20} /></button></div>{connected ? <p role="status">Your number is ready. Select My own number and send a test.</p> : <><label className="wa-check"><input type="checkbox" checked={pairing} onChange={event => setPairing(event.target.checked)} /> Link with phone number instead</label>{pairing ? <form onSubmit={event => { event.preventDefault(); void act({ action: "pairing", phone }); }}><label htmlFor="wa-pair-phone">WhatsApp number</label><input id="wa-pair-phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={event => setPhone(event.target.value)} required /><button disabled={busy}>Get pairing code</button>{code && <p className="wa-pair-code" aria-live="polite">{code}</p>}</form> : qr.url && qr.source === status?.connection?.qr ? <Image unoptimized src={qr.url} width={264} height={264} alt="Scan this QR code with WhatsApp to link your dedicated event number" /> : <p role="status">Waiting for a fresh QR code…</p>}<p>WhatsApp → Settings → Linked devices → Link a device{pairing ? " → Link with phone number instead." : ". Scan the QR code above."}</p><p className="wa-muted">QR codes expire and refresh automatically. Keep this window open.</p></>}{busy && <p role="status">Updating…</p>}{error && <p role="alert">{error}</p>}</dialog>
  </div>;
}
