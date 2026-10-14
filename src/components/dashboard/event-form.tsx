"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { localEventTimeToUtc } from "@/lib/dates";
import { eventCategories } from "@/config/event-options";
import { LocationSearch } from "@/components/onboarding/location-search";

type EventValues = {
  id: string; title: string; summary: string | null; description: string | null;
  category: string | null; mode: string; visibility: string; startsAt: string;
  endsAt: string; timezone: string; venueName: string | null; address: string | null;
  mapUrl: string | null; city: string | null; onlineUrl: string | null;
  capacity: number | null; refundPolicy: string | null; lat?: number | null; lng?: number | null;
};
const formats = [
  { value: "IN_PERSON", label: "In person", description: "At a venue" },
  { value: "ONLINE", label: "Online", description: "Join from anywhere" },
  { value: "HYBRID", label: "Hybrid", description: "Venue + online" },
];

export function EventForm({ orgId, event }: { orgId?: string; event?: EventValues }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title || "");
  const [summary, setSummary] = useState(event?.summary || "");
  const [category, setCategory] = useState(event?.category || "");
  const [mode, setMode] = useState(event?.mode || "IN_PERSON");
  const [startsAt, setStartsAt] = useState(event?.startsAt || "");
  const [timezone, setTimezone] = useState(event?.timezone || "Asia/Kolkata");
  const [venue, setVenue] = useState(event?.venueName || "");
  const [address, setAddress] = useState(event?.address || "");
  const [city, setCity] = useState(event?.city || "");
  const [point, setPoint] = useState(event?.lat != null && event.lng != null ? { latitude: event.lat, longitude: event.lng } : null);
  const [pinSelected, setPinSelected] = useState(Boolean(point));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapMessage, setMapMessage] = useState("");
  const lookupId = useRef(0);
  async function pick(value: { latitude: number; longitude: number }) {
    const id = ++lookupId.current; setPoint(value); setPinSelected(true); setMapMessage("");
    try {
      const response = await fetch("/api/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "reverse", ...value }) });
      const result = await response.json(); if (id !== lookupId.current) return;
      if (response.ok && result.places?.[0]) { setAddress(result.places[0].label); setCity(result.places[0].city); setMapMessage(result.places[0].label); }
      else setMapMessage("Pin saved. Enter the street address below.");
    } catch { if (id === lookupId.current) setMapMessage("Pin saved. Enter the street address below."); }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(e.currentTarget);
      const text = (key: string) => String(form.get(key) || "");
      const timezone = text("timezone");
      const body = {
        orgId, title, summary, category, mode, description: text("description"), visibility: text("visibility"),
        startsAt: localEventTimeToUtc(startsAt, timezone), endsAt: localEventTimeToUtc(text("endsAt"), timezone), timezone,
        venueName: mode === "ONLINE" ? "" : venue, city: mode === "ONLINE" ? "" : city,
        address: mode === "ONLINE" ? "" : address,
        lat: mode !== "ONLINE" && pinSelected ? point?.latitude ?? null : null,
        lng: mode !== "ONLINE" && pinSelected ? point?.longitude ?? null : null,
        mapUrl: mode === "ONLINE" ? undefined : text("mapUrl") || undefined,
        onlineUrl: mode === "IN_PERSON" ? undefined : text("onlineUrl") || undefined,
        capacity: form.get("capacity") ? Number(form.get("capacity")) : undefined,
        refundPolicy: text("refundPolicy"),
      };
      const response = await fetch(event ? `/api/events/${event.id}` : "/api/events", { method: event ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save event.");
      if (event) { router.refresh(); setError("Saved."); setBusy(false); }
      else router.push(`/dashboard/events/${result.id}/media`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save event."); setBusy(false); }
  }
  return <form onSubmit={submit} className="r-event-form">
    <div className="r-event-form-main">
      <nav className="r-create-steps" aria-label="Event creation progress"><strong aria-current="step">1. Details</strong><span>2. Images & people</span><span>3. Tickets</span><span>4. Publish</span></nav>
      <section className="r-form-section"><div className="r-section-heading"><h2>Event basics</h2><small>What are you bringing people together for?</small></div>
        <div className="r-form-fields"><label className="r-field-wide">Event title<input name="title" required minLength={3} maxLength={150} placeholder="Give your event a memorable name" value={title} onChange={e => setTitle(e.target.value)}/></label>
        <label>Category<select name="category" value={category} onChange={e => setCategory(e.target.value)}><option value="">Choose a category</option>{category && !eventCategories.includes(category) && <option>{category}</option>}{eventCategories.map(option => <option key={option}>{option}</option>)}</select></label>
        <label>Visibility<select name="visibility" defaultValue={event?.visibility || "PUBLIC"}><option value="PUBLIC">Public · listed in discovery</option><option value="UNLISTED">Unlisted · link only</option></select></label>
        <label className="r-field-wide">Short summary<input name="summary" maxLength={300} placeholder="One line that tells guests what to expect" value={summary} onChange={e => setSummary(e.target.value)}/></label>
        <label className="r-field-wide">Description<textarea name="description" rows={3} maxLength={30000} defaultValue={event?.description || ""} placeholder="What’s happening, who it’s for, and what guests should bring."/></label></div>
      </section>
      <section className="r-form-section"><div className="r-section-heading"><h2>When & how</h2></div>
        <fieldset className="r-format-options"><legend>Format</legend>{formats.map(format => <label key={format.value}><input type="radio" name="mode" value={format.value} checked={mode === format.value} onChange={() => setMode(format.value)}/><span><strong>{format.label}</strong><small>{format.description}</small></span></label>)}</fieldset>
        <div className="r-form-fields"><label>Starts<input name="startsAt" type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)}/></label><label>Ends<input name="endsAt" type="datetime-local" required defaultValue={event?.endsAt}/></label></div>
        <details className="r-form-disclosure"><summary>Timezone · {timezone}</summary><label>Event timezone<input name="timezone" required value={timezone} onChange={e => setTimezone(e.target.value)} list="event-timezones"/></label><datalist id="event-timezones"><option value="Asia/Kolkata"/><option value="UTC"/><option value="Asia/Dubai"/><option value="Europe/London"/></datalist></details>
      </section>
      <section className="r-form-section"><div className="r-section-heading"><h2>{mode === "ONLINE" ? "Online access" : "Location"}</h2><small>{mode === "ONLINE" ? "Where guests will join." : "Start with the city. A map pin is optional."}</small></div>
        {mode !== "ONLINE" && <><LocationSearch value={city} onChange={value => { ++lookupId.current; setCity(value); setPoint(null); setPinSelected(false); }} onSelect={place => { ++lookupId.current; setCity(place.city); setPoint({ latitude: place.latitude, longitude: place.longitude }); setPinSelected(false); setMapMessage("City selected. Choose a map pin only if you want to mark the venue entrance."); }} point={point} onPick={pick}/>
        <div className="r-form-fields"><label>Venue name<input name="venueName" required maxLength={150} placeholder="e.g. The Courtyard" value={venue} onChange={e => setVenue(e.target.value)}/></label><label>Address<input name="address" maxLength={500} placeholder="Street, building, neighbourhood" value={address} onChange={e => setAddress(e.target.value)}/></label></div>
        {pinSelected && <button type="button" className="r-inline-button" onClick={() => { ++lookupId.current; setPoint(null); setPinSelected(false); }}>Remove venue pin</button>}<small role="status">{mapMessage}</small>
        <details className="r-form-disclosure"><summary>Add a map link · optional</summary><label>Map link · optional<input name="mapUrl" type="url" placeholder="https://maps.google.com/…" defaultValue={event?.mapUrl || ""}/></label></details></>}
        {mode !== "IN_PERSON" && <label className="r-online-link">Online event link<input name="onlineUrl" required type="url" placeholder="https://…" defaultValue={event?.onlineUrl || ""}/></label>}
      </section>
      <details className="r-form-section r-form-disclosure"><summary>Capacity & refund policy <small>Optional</small></summary><div className="r-form-fields"><label>Event capacity<input name="capacity" type="number" min={1} defaultValue={event?.capacity || ""} placeholder="Set later with tickets"/></label><label className="r-field-wide">Refund policy<textarea name="refundPolicy" rows={2} maxLength={5000} defaultValue={event?.refundPolicy || ""} placeholder="Let guests know your cancellation and refund terms."/></label></div></details>
      <div className="r-form-actions"><button disabled={busy} className="m-button">{busy ? "Saving…" : event ? "Save details" : "Create draft and continue"}<span aria-hidden="true">↗</span></button><small>{event ? "Updates apply to your event details." : "Next: add images, PDFs and your lineup."}</small></div>
      {error && <p role="status" className="r-form-message">{error}</p>}
    </div>
    <aside className="r-event-preview" aria-label="Live event preview"><p className="m-eyebrow">GUEST PREVIEW</p><div className="r-preview-art" aria-hidden="true">✳</div><span className="r-status-chip">{category || "YOUR EVENT"}</span><h2>{title || "Your event title"}</h2><p>{summary || "Your short summary will appear here."}</p><dl><div><dt>When</dt><dd>{startsAt ? startsAt.replace("T", " · ") : "Choose date & time"}</dd></div><div><dt>Where</dt><dd>{mode === "ONLINE" ? "Online" : [venue, city].filter(Boolean).join(", ") || "Choose a venue"}</dd></div><div><dt>Format</dt><dd>{formats.find(format => format.value === mode)?.label}</dd></div></dl><small>Draft preview · add your poster and people next.</small></aside>
  </form>;
}
