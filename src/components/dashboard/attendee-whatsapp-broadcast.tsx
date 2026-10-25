"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";

const starter =
  "Hi {{attendee_name}} — an update for {{event_title}}.\n\nDoors open at 6:30 pm. See you there!\n\n{{event_date}} · {{event_time}}\n{{venue}}, {{city}}\n{{event_url}}";

export function AttendeeWhatsAppBroadcast({
  eventId,
  orgId,
  mode,
  phone,
  connected,
  eligible,
  suppressed,
}: {
  eventId: string;
  orgId: string;
  mode: string;
  phone: string | null;
  connected: boolean;
  eligible: number;
  suppressed: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState(starter);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const isLinkedDevice = ["ORG_NUMBER", "PLATFORM_NUMBER"].includes(mode);
  const preview = body
    .replaceAll("{{attendee_name}}", "Aarav")
    .replaceAll("{{event_title}}", "Your event")
    .replaceAll("{{event_date}}", "Saturday, 24 October")
    .replaceAll("{{event_time}}", "7:00 pm IST")
    .replaceAll("{{venue}}", "Community Lawn")
    .replaceAll("{{city}}", "Greater Noida")
    .replaceAll("{{event_url}}", "raunak.yaduraj.me/e/your-event");

  async function send() {
    setBusy(true);
    setStatus("");
    const id = campaignId || crypto.randomUUID();
    setCampaignId(id);
    try {
      const response = await fetch("/api/events/" + eventId + "/whatsapp-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not queue messages.");
      setStatus(result.queued + " WhatsApp " + (result.queued === 1 ? "message is" : "messages are") + " queued. Delivery updates will appear in the log below.");
      setCampaignId(null);
      setConfirmed(false);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not queue messages.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6" aria-labelledby="attendee-whatsapp-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--paper-2)] text-[var(--accent)]"><MessageCircle size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="attendee-whatsapp-title" className="text-xl font-semibold">WhatsApp to attendees</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Send an event update separately from email. Only paid attendees who opted in are included.</p>
          </div>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium">{connected && phone ? "From " + phone : "Number not connected"}</span>
      </div>

      {!isLinkedDevice ? (
        <p className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm">Choose your linked WhatsApp number in <a className="font-medium text-[var(--accent)] underline" href={"/dashboard/settings/whatsapp?org=" + orgId}>WhatsApp settings</a> to use this sender.</p>
      ) : !connected ? (
        <p className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm">Connect the workspace number before sending. Email and automatic ticket delivery continue separately.</p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><strong>{eligible}</strong> eligible recipients</span>
              {suppressed > 0 && <span className="text-[var(--muted)]">{suppressed} suppressed</span>}
              <span className="text-[var(--muted)]">Paid bookings · WhatsApp consent · valid number</span>
            </div>
            <label className="block text-sm font-medium" htmlFor="attendee-whatsapp-body">Message</label>
            <textarea id="attendee-whatsapp-body" className="min-h-40 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm leading-6" maxLength={1200} value={body} onChange={(event) => setBody(event.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span>Variables: <code>{"{{attendee_name}}"}</code>, <code>{"{{event_title}}"}</code>, <code>{"{{event_date}}"}</code>, <code>{"{{event_time}}"}</code>, <code>{"{{venue}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{event_url}}"}</code></span>
              <span>{body.length}/1200</span>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-[var(--paper-2)] p-3 text-sm">
              <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I confirm this is a relevant update about this event. Promotional messages need separate attendee consent.</span>
            </label>
            <button type="button" disabled={busy || !confirmed || eligible === 0 || body.trim().length < 4} onClick={() => void send()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--on-accent)] disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={16} aria-hidden="true" />{busy ? "Queuing…" : "Queue WhatsApp update · " + eligible}
            </button>
            <p className="text-xs text-[var(--muted)]">Messages are paced by the linked-device sender. Recipients can reply STOP to opt out. The connected number may be restricted if people report unwanted messages.</p>
            {status && <p role="status" className="text-sm">{status}</p>}
          </div>
          <aside className="rounded-2xl bg-[#e7ded2] p-4 text-[#171613] dark:bg-[#143b30] dark:text-[#f8f3e9]" aria-label="WhatsApp message preview">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-70">Preview</p>
            <div className="ml-auto max-w-sm whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-white p-4 text-sm leading-6 text-[#171613] shadow-sm">{preview}</div>
            <p className="mt-2 text-right text-[11px] opacity-70">Reply STOP to stop updates</p>
          </aside>
        </div>
      )}
    </section>
  );
}
