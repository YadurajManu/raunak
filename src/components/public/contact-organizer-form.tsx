"use client";
import { useState } from "react";
export function ContactOrganizerForm({ eventId, organizerName }: { eventId: string; organizerName: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement) {
    setBusy(true); setStatus("");
    const data = new FormData(form);
    try {
      const response = await fetch(`/api/public/events/${encodeURIComponent(eventId)}/organizer-contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), message: data.get("message"), website: data.get("website") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send your message.");
      form.reset(); setStatus("Message sent to the organizer.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send your message."); }
    finally { setBusy(false); }
  }
  return <div className="r-organizer-contact">
    <button type="button" className="m-text-link" aria-expanded={open} onClick={() => setOpen(!open)}>Contact organizer</button>
    {open && <form id={`organizer-contact-${eventId}`} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <p>Send a private note to {organizerName}.</p>
      <label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label>
      <label>Email for a reply<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Message<textarea name="message" required minLength={5} maxLength={2000} rows={4} /></label>
      <label className="r-contact-honeypot" aria-hidden="true">Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button type="submit" className="m-button m-button-small" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
    </form>}
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
