"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { LoaderCircle, MessageCircle, X, QrCode, ShieldAlert } from "lucide-react";
import { waErrorMessages } from "@/lib/whatsapp";
import type { integrationStatus } from "@/server/whatsapp/integration";

type Status = Awaited<ReturnType<typeof integrationStatus>>;
export function WhatsAppIntegration({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [pairing, setPairing] = useState(false),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [consent, setConsent] = useState(false),
    [sampleTicket, setSampleTicket] = useState(false),
    [qr, setQr] = useState({ source: "", url: "" });
  const dialog = useRef<HTMLDialogElement>(null),
    endpoint = `/api/orgs/${orgId}/whatsapp`;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load the connection.");
        setStatus(data);
        setLoadError("");
      } catch (failure) {
        if (!signal?.aborted)
          setLoadError(
            failure instanceof Error
              ? failure.message
              : "Could not load WhatsApp.",
          );
      }
    },
    [endpoint],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => {
      void refresh(controller.signal);
    }, 0);
    const timer = setInterval(
      () => {
        if (!document.hidden) void refresh(controller.signal);
      },
      open ? 2000 : 15000,
    );
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh, open]);
  useEffect(() => {
    let alive = true;
    const value = status?.connection?.qr;
    if (value)
      void QRCode.toDataURL(value, { width: 264, margin: 3 }).then((data) => {
        if (alive) setQr({ source: value, url: data });
      });
    return () => {
      alive = false;
    };
  }, [status?.connection?.qr]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      if (data.code) setCode(data.code);
      setNotice(
        payload.action === "test"
          ? "Test message sent."
          : payload.action === "mode"
            ? "Delivery mode saved."
            : "Connection updated.",
      );
      await refresh();
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const connected = status?.connection?.status === "CONNECTED";
  return (
    <div className="wa-integration">
      <header>
        <p className="m-eyebrow">SETTINGS / INTEGRATIONS</p>
        <h1>WhatsApp delivery</h1>
        <p>Connect your event messages. Email remains the backup.</p>
      </header>
      {(error || loadError) && (
        <div role="alert" className="wa-feedback">
          {error || loadError}{" "}
          <button type="button" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!status ? (
        !error && (
          <p role="status">
            <LoaderCircle size={18} /> Loading connection…
          </p>
        )
      ) : (
        <>
          <section className="wa-panel">
            <label htmlFor="wa-mode">Send WhatsApp messages with</label>
            <select
              id="wa-mode"
              disabled={busy}
              value={status.mode}
              onChange={(event) =>
                void act({ action: "mode", mode: event.target.value })
              }
            >
              <option value="DISABLED">Off · email only</option>
              <option
                value="PLATFORM_NUMBER"
                disabled={!status.platformAvailable}
              >
                Platform number
                {!status.platformAvailable ? " · not connected" : ""}
              </option>
              <option value="ORG_NUMBER">My own number</option>
              {status.officialAvailable && (
                <option value="OFFICIAL_API">Official API</option>
              )}
            </select>
            {!status.enabled && (
              <p className="wa-muted">
                Unofficial delivery is switched off on the server. An
                administrator must configure and enable the private gateway
                before linking.
              </p>
            )}
          </section>
          <section className="wa-panel">
            <div className="wa-heading">
              <MessageCircle size={22} aria-hidden="true" />
              <h2>Your number</h2>
              <span className={`wa-badge ${connected ? "is-connected" : ""}`}>
                <span className={`wa-dot ${connected ? "is-connected" : ""}`} aria-hidden="true" />
                {connected
                  ? "Connected"
                  : status.connection?.status.replaceAll("_", " ") || "Not connected"}
              </span>
            </div>
            <p>
              {status.connection?.phone || "No linked number"}
              {status.connection?.pushName
                ? ` · ${status.connection.pushName}`
                : ""}
            </p>
            {status.connection?.lastError && (
              <p className="wa-muted" role="status">
                {waErrorMessages[status.connection.lastError] ||
                  "Check the connection before sending."}
              </p>
            )}
            {status.connection?.lastSeenAt && (
              <p className="wa-muted">
                Last connected{" "}
                {new Date(status.connection.lastSeenAt).toLocaleString()} ·
                uptime {Math.floor(status.connection.uptimeSeconds / 60)} min
              </p>
            )}
            <div className="wa-actions">
              <button
                type="button"
                className="wa-connect-btn"
                disabled={busy || !status.enabled}
                onClick={async () => {
                  if (await act({ action: "connect" })) setOpen(true);
                }}
              >
                <QrCode size={16} aria-hidden="true" />
                <span>{connected ? "Connection details" : "Connect number with QR code"}</span>
              </button>
              {status.connection && (
                <button
                  type="button"
                  className="wa-disconnect-btn"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Disconnect this number? You will need to link it again.",
                      )
                    )
                      void act({ action: "disconnect" });
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            <div className="wa-progress-section">
              <div className="wa-progress-label">
                <span>Today: <strong>{status.sent}</strong> / {status.cap} sends</span>
                <span className="wa-progress-day">Warm-up day {status.day} (limit {status.cap}/day)</span>
              </div>
              <div
                className="wa-progress-track"
                role="progressbar"
                aria-valuenow={status.sent}
                aria-valuemin={0}
                aria-valuemax={status.cap}
                aria-label={`WhatsApp sends today: ${status.sent} of ${status.cap}`}
              >
                <div
                  className="wa-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.round((status.sent / Math.max(1, status.cap)) * 100))}%`,
                  }}
                />
              </div>
              <p className="wa-muted">
                Warm-up limits protect your number from delivery restrictions as traffic scales.
              </p>
            </div>
          </section>
          {connected && (
            <form
              className="wa-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void act({ action: "test", phone, consent, sampleTicket });
              }}
            >
              <h2>Send a test</h2>
              <label htmlFor="wa-test-phone">Recipient mobile number</label>
              <input
                id="wa-test-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <label className="wa-check">
                <input
                  type="checkbox"
                  checked={sampleTicket}
                  onChange={(event) => setSampleTicket(event.target.checked)}
                />{" "}
                Include a sample ticket card (not valid for entry).
              </label>
              <label className="wa-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                />{" "}
                I own this number or have permission to send a test.
              </label>
              <button
                disabled={busy || !consent || status.mode !== "ORG_NUMBER"}
              >
                Send test message
              </button>
              {status.mode !== "ORG_NUMBER" && (
                <p className="wa-muted">
                  Choose My own number to test this connection.
                </p>
              )}
            </form>
          )}
        </>
      )}
      <aside className="wa-advisory">
        <div className="wa-advisory-icon">
          <ShieldAlert size={20} aria-hidden="true" />
        </div>
        <div className="wa-advisory-content">
          <strong>Best practices for dedicated event numbers</strong>
          <ul>
            <li>
              <strong>Use a dedicated SIM:</strong> Keep your personal daily WhatsApp separate from automated ticket broadcast messages.
            </li>
            <li>
              <strong>Dual-channel guarantee:</strong> Ticket confirmation emails are always delivered automatically as an instant backup.
            </li>
          </ul>
        </div>
      </aside>
      <dialog
        ref={dialog}
        className="wa-dialog"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="wa-heading">
          <h2>{connected ? "You’re connected" : "Link your number"}</h2>
          <button
            aria-label="Close connection dialog"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        {connected ? (
          <p role="status">
            Your number is ready. Select My own number and send a test.
          </p>
        ) : (
          <>
            <label className="wa-check">
              <input
                type="checkbox"
                checked={pairing}
                onChange={(event) => setPairing(event.target.checked)}
              />{" "}
              Link with phone number instead
            </label>
            {pairing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void act({ action: "pairing", phone });
                }}
              >
                <label htmlFor="wa-pair-phone">WhatsApp number</label>
                <input
                  id="wa-pair-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
                <button disabled={busy}>Get pairing code</button>
                {code && (
                  <p className="wa-pair-code" aria-live="polite">
                    {code}
                  </p>
                )}
              </form>
            ) : qr.url && qr.source === status?.connection?.qr ? (
              <Image
                unoptimized
                src={qr.url}
                width={264}
                height={264}
                alt="Scan this QR code with WhatsApp to link your dedicated event number"
              />
            ) : (
              <p role="status">Waiting for a fresh QR code…</p>
            )}
            <p>
              WhatsApp → Settings → Linked devices → Link a device
              {pairing
                ? " → Link with phone number instead."
                : ". Scan the QR code above."}
            </p>
            <p className="wa-muted">
              QR codes expire and refresh automatically. Keep this window open.
            </p>
          </>
        )}
        {busy && <p role="status">Updating…</p>}
        {error && <p role="alert">{error}</p>}
      </dialog>
    </div>
  );
}
