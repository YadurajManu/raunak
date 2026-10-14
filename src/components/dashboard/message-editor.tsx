"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Setting = {
  channel: string;
  trigger: string;
  body: string;
  subject: string | null;
  isEnabled: boolean;
  slots: { custom_note?: string; custom_footer?: string };
};
export function MessageEditor({
  eventId,
  templates,
  defaults,
  previewValues,
  logs,
}: {
  eventId: string;
  templates: Setting[];
  defaults: Record<string, string>;
  previewValues: Record<string, string>;
  logs: {
    id: string;
    trigger: string;
    channel: string;
    status: string;
    error: string | null;
    toAddress: string;
    attempts: number;
  }[];
}) {
  const router = useRouter();
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
  function select(t: string, c: string) {
    const setting = templates.find((x) => x.trigger === t && x.channel === c);
    setTrigger(t);
    setChannel(c);
    setBody(setting?.body || defaults[t]);
    setSubject(setting?.subject || "");
    setEnabled(setting?.isEnabled ?? true);
    setNote(setting?.slots.custom_note || "");
    setFooter(setting?.slots.custom_footer || "");
    setMessage("");
  }
  async function act(action: string, payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/events/${eventId}/messages`, {
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
          className="space-y-4 rounded-2xl border border-zinc-300 p-6"
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
          <label className="block">
            Channel
            <select
              className="mt-2 w-full rounded-lg border p-3 bg-transparent"
              value={channel}
              onChange={(e) => select(trigger, e.target.value)}
            >
              <option>EMAIL</option>
              <option>WHATSAPP</option>
            </select>
          </label>
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
              readOnly={channel === "WHATSAPP"}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {channel === "WHATSAPP" && (
            <p className="text-sm">
              WhatsApp uses approved message templates. Personalize the note and
              footer slots below.
            </p>
          )}
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
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className="rounded-xl bg-orange-700 px-5 py-3 text-white"
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
        <aside className="rounded-2xl border border-zinc-300 p-6">
          <p className="text-sm uppercase tracking-wider">
            Preview · does not grant entry
          </p>
          <p className="mt-6 whitespace-pre-wrap leading-8">{preview}</p>
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
                    <td className="p-3">{log.toAddress}</td>
                    <td className="p-3">{log.channel}</td>
                    <td className="p-3">
                      {log.status}
                      {log.error && (
                        <p className="mt-1 max-w-xs text-red-700">
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className="p-3">{log.attempts}</td>
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
