"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { defaultAttachments, waErrorMessages } from "@/lib/whatsapp";
import { FileText } from "lucide-react";
type Setting = {
  channel: string;
  trigger: string;
  body: string;
  subject: string | null;
  isEnabled: boolean;
  slots: { custom_note?: string; custom_footer?: string };
  attachments?: typeof defaultAttachments;
};
export function MessageEditor({
  eventId,
  orgId,
  whatsappMode = "OFFICIAL_API",
  templates,
  defaults,
  previewValues,
  logs,
}: {
  eventId?: string;
  orgId?: string;
  whatsappMode?: string;
  templates: Setting[];
  defaults: Record<string, string>;
  previewValues: Record<string, string>;
  logs: {
    id: string;
    trigger: string;
    channel: string;
    status: string;
    error: string | null;
    errorCode?: string | null;
    toAddress: string;
    attempts: number;
  }[];
}) {
  const router = useRouter();
  const endpoint = eventId
    ? `/api/events/${eventId}/messages`
    : `/api/orgs/${orgId}/messages`;
  const unofficial = ["ORG_NUMBER", "PLATFORM_NUMBER"].includes(whatsappMode);
  const [trigger, setTrigger] = useState("TICKET_ISSUED");
  const [channel, setChannel] = useState("EMAIL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("ALL");
  const initial = templates.find(
    (x) => x.trigger === "TICKET_ISSUED" && x.channel === "EMAIL",
  );
  const [body, setBody] = useState(initial?.body || defaults.TICKET_ISSUED);
  const [subject, setSubject] = useState(initial?.subject || "");
  const [enabled, setEnabled] = useState(initial?.isEnabled ?? true);
  const [note, setNote] = useState(initial?.slots.custom_note || "");
  const [footer, setFooter] = useState(initial?.slots.custom_footer || "");
  const [attachments, setAttachments] = useState(
    initial?.attachments || defaultAttachments,
  );
  const [previewFailed, setPreviewFailed] = useState(false);
  function select(t: string, c: string) {
    const setting = templates.find((x) => x.trigger === t && x.channel === c);
    setTrigger(t);
    setChannel(c);
    setBody(setting?.body || defaults[t]);
    setSubject(setting?.subject || "");
    setEnabled(setting?.isEnabled ?? true);
    setNote(setting?.slots.custom_note || "");
    setFooter(setting?.slots.custom_footer || "");
    setAttachments(setting?.attachments || defaultAttachments);
    setMessage("");
  }
  async function act(action: string, payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage(
        action === "test"
          ? "Test sent to your account contact."
          : action === "retry"
            ? "Delivery queued for retry."
            : "Saved.",
      );
      router.refresh();
      if (action === "reset") {
        setBody(defaults[trigger]);
        setSubject("");
        setNote("");
        setFooter("");
        setEnabled(true);
        setAttachments(defaultAttachments);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const preview = body.replace(/{{\s*([a-z_]+)\s*}}/g, (_match, key: string) =>
    key === "custom_note"
      ? note
      : key === "custom_footer"
        ? footer
        : previewValues[key] || `[${key}]`,
  );
  return (
    <section className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-2xl border border-[var(--line)] p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void act("save", {
              channel,
              trigger,
              isEnabled: enabled,
              body,
              subject,
              custom_note: note,
              custom_footer: footer,
              attachments,
            });
          }}
        >
          <h2 className="text-xl font-semibold">Message settings</h2>
          <label className="block">
            When
            <select
              className="mt-2 w-full rounded-lg border p-3 bg-transparent"
              value={trigger}
              onChange={(e) => select(e.target.value, channel)}
            >
              {Object.keys(defaults).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Delivery channel</legend>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Choose a delivery channel"
            >
              {(["EMAIL", "WHATSAPP"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={channel === value}
                  onClick={() => select(trigger, value)}
                  className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${channel === value ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] bg-transparent text-[var(--muted)] hover:bg-[var(--paper-2)]"}`}
                >
                  {value === "EMAIL" ? "Email" : "WhatsApp"}
                </button>
              ))}
            </div>
          </fieldset>
          {channel === "WHATSAPP" && (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm">
              <p>
                Save an enabled <strong>Ticket issued</strong> message to send
                each buyer their ticket on WhatsApp after it is prepared. Buyers
                need to provide a mobile number and opt in at checkout. Email
                remains a separate channel.
              </p>
              {eventId && (
                <p>
                  To resend an existing paid booking, open{" "}
                  <Link
                    href={`/dashboard/events/${eventId}/attendees`}
                    className="font-medium text-[var(--accent)] underline"
                  >
                    attendee bookings
                  </Link>{" "}
                  and choose <strong>Resend tickets</strong>. WhatsApp is sent
                  when that buyer opted in.
                </p>
              )}
            </div>
          )}
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable this message
          </label>
          {channel === "EMAIL" && (
            <label className="block">
              Subject
              <input
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Use the default subject"
                className="mt-2 w-full rounded-lg border p-3 bg-transparent"
              />
            </label>
          )}
          <label className="block">
            Message
            <textarea
              className="mt-2 w-full rounded-lg border p-3 bg-transparent"
              rows={7}
              maxLength={10000}
              value={body}
              readOnly={channel === "WHATSAPP" && !unofficial}
              required
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {channel === "WHATSAPP" && !unofficial && (
            <p className="text-sm">
              {whatsappMode === "DISABLED"
                ? "WhatsApp is off. Select a delivery mode in integration settings. "
                : "Official API uses approved message templates. "}
              Personalize the note and footer slots below.
              {orgId && (
                <Link href={`/dashboard/settings/whatsapp?org=${orgId}`}>
                  {" "}
                  Connection settings
                </Link>
              )}
            </p>
          )}
          {(channel === "EMAIL" || unofficial) && (
            <label className="block text-sm">
              Insert a variable
              <select
                className="mt-2 w-full rounded-lg border p-3 bg-transparent"
                value=""
                onChange={(event) => {
                  if (event.target.value)
                    setBody((current) => `${current}{{${event.target.value}}}`);
                }}
              >
                <option value="">Choose a variable…</option>
                {Object.keys(previewValues).map((variable) => (
                  <option key={variable} value={variable}>
                    {variable.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {channel === "WHATSAPP" && unofficial && (
            <fieldset className="space-y-3 rounded-lg border border-[var(--line)] p-4">
              <legend className="px-2 text-sm">Attachments</legend>
              {(trigger === "TICKET_ISSUED"
                ? (["ticketCard", "ticketPdf"] as const)
                : (["poster"] as const)
              ).map((kind) => (
                <label key={kind} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={attachments[kind]}
                    onChange={(event) =>
                      setAttachments((current) => ({
                        ...current,
                        [kind]: event.target.checked,
                      }))
                    }
                  />
                  {kind === "ticketCard"
                    ? "Ticket card with entry QR"
                    : kind === "ticketPdf"
                      ? "Ticket PDF"
                      : "Event poster"}
                </label>
              ))}
              <p className="text-xs text-[var(--muted)]">
                A ticket page link is always included. Preview tests use sample
                cards; real PDFs require a paid booking.
              </p>
            </fieldset>
          )}
          <details
            open={channel === "WHATSAPP" && !unofficial}
            className="space-y-3"
          >
            <summary className="min-h-11 cursor-pointer py-2 text-sm">
              Note and footer (optional)
            </summary>
            <label className="block">
              Custom note
              <textarea
                className="mt-2 w-full rounded-lg border p-3 bg-transparent"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="block">
              Custom footer
              <input
                className="mt-2 w-full rounded-lg border p-3 bg-transparent"
                value={footer}
                maxLength={200}
                onChange={(e) => setFooter(e.target.value)}
              />
            </label>
          </details>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className="rounded-xl bg-[var(--accent)] px-5 py-3 text-[var(--on-accent)]"
            >
              Save settings
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("reset", { channel, trigger })}
              className="rounded-xl border px-5 py-3"
            >
              Reset to default
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("test", { channel, trigger })}
              className="rounded-xl border px-5 py-3"
            >
              Send saved test to me
            </button>
          </div>
          <p role="status">{message}</p>
        </form>
        <aside className="self-start rounded-2xl border border-[var(--line)] p-6">
          <p className="text-sm uppercase tracking-wider">
            Preview · does not grant entry
          </p>
          <div
            className={
              channel === "WHATSAPP"
                ? "mt-6 rounded-2xl rounded-tr-sm bg-[var(--paper-2)] p-4"
                : "mt-6"
            }
          >
            {channel === "WHATSAPP" &&
              unofficial &&
              trigger === "TICKET_ISSUED" &&
              attachments.ticketCard &&
              (previewFailed ? (
                <p className="text-sm">
                  A sample card will be available after an event is created.
                </p>
              ) : (
                <Image
                  unoptimized
                  src={`${endpoint}/preview`}
                  alt="Sample ticket card, not valid for entry"
                  width={216}
                  height={270}
                  className="mb-4 h-auto max-w-full rounded-lg"
                  onError={() => setPreviewFailed(true)}
                />
              ))}
            <p className="whitespace-pre-wrap break-words leading-7">
              {preview}
            </p>
            {channel === "WHATSAPP" &&
              unofficial &&
              attachments.ticketPdf &&
              trigger === "TICKET_ISSUED" && (
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <FileText size={16} aria-hidden="true" /> Ticket PDF
                  attachment
                </p>
              )}
          </div>
          <p className="mt-8 text-sm">
            Save before sending a test. Tests are sent only to your account’s
            email or phone.
          </p>
        </aside>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Delivery log</h2>
        <label>
          Show{" "}
          <select
            className="rounded-lg border p-2 bg-transparent"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "ALL",
              "QUEUED",
              "SENDING",
              "SENT",
              "DELIVERED",
              "READ",
              "FAILED",
              "SKIPPED",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {logs.filter((x) => filter === "ALL" || x.status === filter).length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Message",
                  "Recipient",
                  "Channel",
                  "Status",
                  "Attempts",
                  "Delivery details",
                  "Action",
                ].map((x) => (
                  <th className="p-3" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs
                .filter((x) => filter === "ALL" || x.status === filter)
                .map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-3">{log.trigger}</td>
                    <td className="p-3">
                      {log.channel === "WHATSAPP"
                        ? `••••${log.toAddress.slice(-4)}`
                        : log.toAddress}
                    </td>
                    <td className="p-3">{log.channel}</td>
                    <td className="p-3">
                      {log.status}
                      {log.error && !log.errorCode && (
                        <p className="mt-1 max-w-xs text-[var(--danger)]">
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className="p-3">{log.attempts}</td>
                    <td className="p-3">
                      {log.errorCode && (
                        <>
                          <code className="text-xs">{log.errorCode}</code>
                          <p className="mt-1 max-w-xs text-[var(--muted)]">
                            {waErrorMessages[log.errorCode] ||
                              "Check the connection and retry when appropriate."}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      {log.status === "FAILED" && (
                        <button
                          disabled={busy}
                          className="underline"
                          onClick={() => act("retry", { id: log.id })}
                        >
                          Retry delivery
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border p-6">
          No messages match this filter. Deliveries will appear after a booking.
        </p>
      )}
    </section>
  );
}
