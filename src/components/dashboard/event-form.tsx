"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { localEventTimeToUtc, updateLocalEventTimePart } from "@/lib/dates";
import { eventCategories } from "@/config/event-options";
import { LocationSearch } from "@/components/onboarding/location-search";

type EventValues = {
  id: string; title: string; summary: string | null; description: string | null;
  category: string | null; mode: string; visibility: string; startsAt: string;
  endsAt: string; timezone: string; venueName: string | null; address: string | null;
  venueNotes?: string | null;
  mapUrl: string | null; city: string | null; onlineUrl: string | null;
  capacity: number | null; refundPolicy: string | null; lat?: number | null; lng?: number | null;
  transitStationName?: string | null;
  transitLineName?: string | null;
  transitLineColor?: string | null;
  transitDistanceM?: number | null;
  transitWalkMin?: number | null;
  transitSource?: "auto" | "manual" | null;
  parkingType?: "free" | "paid" | "street" | "none" | "unknown" | null;
  parkingNote?: string | null;
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
  const [endsAt, setEndsAt] = useState(event?.endsAt || "");
  const [timezone, setTimezone] = useState(event?.timezone || "Asia/Kolkata");
  const [venue, setVenue] = useState(event?.venueName || "");
  const [address, setAddress] = useState(event?.address || "");
  const [city, setCity] = useState(event?.city || "");
  const [point, setPoint] = useState(event?.lat != null && event.lng != null ? { latitude: event.lat, longitude: event.lng } : null);
  const [pinSelected, setPinSelected] = useState(Boolean(point));
  const [transitStationName, setTransitStationName] = useState(event?.transitStationName || "");
  const [transitLineName, setTransitLineName] = useState(event?.transitLineName || "");
  const [transitLineColor, setTransitLineColor] = useState(event?.transitLineColor || "");
  const [transitDistanceM, setTransitDistanceM] = useState<number | null>(event?.transitDistanceM ?? null);
  const [transitWalkMin, setTransitWalkMin] = useState<number | null>(event?.transitWalkMin ?? null);
  const [transitSource, setTransitSource] = useState<"auto" | "manual" | null>(event?.transitSource || null);
  const [parkingType, setParkingType] = useState<"free" | "paid" | "street" | "none" | "unknown">(event?.parkingType || "unknown");
  const [parkingNote, setParkingNote] = useState(event?.parkingNote || "");
  const [detectingTransit, setDetectingTransit] = useState(false);
  const [detectedStations, setDetectedStations] = useState<Array<{
    name: string;
    lineName: string;
    lineColor: string;
    distanceMeters: number;
    walkMinutes: number;
  }>>([]);
  const [transitMessage, setTransitMessage] = useState("");
  const [manualTransit, setManualTransit] = useState(Boolean(event?.transitSource === "manual"));
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

  async function detectNearestMetro() {
    if (!point?.latitude || !point?.longitude) {
      setTransitMessage("Choose a venue pin on the map above first.");
      return;
    }
    setDetectingTransit(true);
    setTransitMessage("");
    try {
      const res = await fetch(`/api/transit/nearest?lat=${point.latitude}&lng=${point.longitude}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not detect metro stations.");
      }
      if (!data.stations || data.stations.length === 0) {
        setTransitMessage("No metro station found within 2.5 km. You can enter one manually.");
        setDetectedStations([]);
      } else {
        setDetectedStations(data.stations);
        if (!transitStationName) {
          const first = data.stations[0];
          setTransitStationName(first.name);
          setTransitLineName(first.lineName);
          setTransitLineColor(first.lineColor);
          setTransitDistanceM(first.distanceMeters);
          setTransitWalkMin(first.walkMinutes);
          setTransitSource("auto");
        }
      }
    } catch (err: unknown) {
      setTransitMessage(err instanceof Error ? err.message : "Failed to auto-detect metro.");
    } finally {
      setDetectingTransit(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setError("Choose an end date and time after the start.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const text = (key: string) => String(form.get(key) || "");
      const timezone = text("timezone");
      const body = {
        orgId, title, summary, category, mode, description: text("description"), visibility: text("visibility"),
        startsAt: localEventTimeToUtc(startsAt, timezone), endsAt: localEventTimeToUtc(endsAt, timezone), timezone,
        venueName: mode === "ONLINE" ? "" : venue, city: mode === "ONLINE" ? "" : city,
        address: mode === "ONLINE" ? "" : address,
        venueNotes: mode === "ONLINE" ? "" : text("venueNotes"),
        lat: mode !== "ONLINE" && pinSelected ? point?.latitude ?? null : null,
        lng: mode !== "ONLINE" && pinSelected ? point?.longitude ?? null : null,
        mapUrl: mode === "ONLINE" ? undefined : text("mapUrl") || undefined,
        onlineUrl: mode === "IN_PERSON" ? undefined : text("onlineUrl") || undefined,
        capacity: form.get("capacity") ? Number(form.get("capacity")) : undefined,
        refundPolicy: text("refundPolicy"),
        transitStationName: mode === "ONLINE" ? null : transitStationName.trim() || null,
        transitLineName: mode === "ONLINE" ? null : transitLineName.trim() || null,
        transitLineColor: mode === "ONLINE" ? null : transitLineColor.trim() || null,
        transitDistanceM: mode === "ONLINE" ? null : transitDistanceM,
        transitWalkMin: mode === "ONLINE" ? null : transitWalkMin,
        transitSource: mode === "ONLINE" ? null : transitSource,
        parkingType: mode === "ONLINE" ? "unknown" : parkingType,
        parkingNote: mode === "ONLINE" ? null : parkingNote.trim() || null,
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
        <div className="r-form-fields r-event-datetime-fields">
          {[{ label: "Starts", value: startsAt, setValue: setStartsAt }, { label: "Ends", value: endsAt, setValue: setEndsAt }].map(({ label, value, setValue }) => {
            const [date = "", time = ""] = value.split("T");
            return <fieldset className="r-event-datetime" key={label}>
              <legend>{label}</legend>
              <div className="r-event-datetime-inputs">
                <label>Date<input aria-label={`${label} date`} name={`${label.toLowerCase()}Date`} type="date" required min={label === "Ends" && startsAt ? startsAt.slice(0, 10) : undefined} value={date} onChange={e => setValue(updateLocalEventTimePart(value, "date", e.target.value))}/></label>
                <label>Time<input aria-label={`${label} time`} name={`${label.toLowerCase()}Time`} type="time" required min={label === "Ends" && startsAt && date === startsAt.slice(0, 10) ? startsAt.slice(11, 16) : undefined} step={900} value={time} onChange={e => setValue(updateLocalEventTimePart(value, "time", e.target.value))}/></label>
              </div>
            </fieldset>;
          })}
        </div>
        <p className="r-event-timezone-hint">Times use <strong>{timezone}</strong>. End time must be after start time.</p>
        <details className="r-form-disclosure"><summary>Timezone · {timezone}</summary><label>Event timezone<input name="timezone" required value={timezone} onChange={e => setTimezone(e.target.value)} list="event-timezones"/></label><datalist id="event-timezones"><option value="Asia/Kolkata"/><option value="UTC"/><option value="Asia/Dubai"/><option value="Europe/London"/></datalist></details>
      </section>
      <section className="r-form-section"><div className="r-section-heading"><h2>{mode === "ONLINE" ? "Online access" : "Location"}</h2><small>{mode === "ONLINE" ? "Where guests will join." : "Start with the city. A map pin is optional."}</small></div>
        {mode !== "ONLINE" && <><LocationSearch value={city} onChange={value => { ++lookupId.current; setCity(value); setPoint(null); setPinSelected(false); }} onSelect={place => { ++lookupId.current; setCity(place.city); setPoint({ latitude: place.latitude, longitude: place.longitude }); setPinSelected(false); setMapMessage("City selected. Choose a map pin only if you want to mark the venue entrance."); }} point={point} onPick={pick}/>
        <div className="r-form-fields"><label>Venue name<input name="venueName" required maxLength={150} placeholder="e.g. The Courtyard" value={venue} onChange={e => setVenue(e.target.value)}/></label><label>Address<input name="address" maxLength={500} placeholder="Street, building, neighbourhood" value={address} onChange={e => setAddress(e.target.value)}/></label><label className="r-field-wide">How to reach · optional<textarea name="venueNotes" rows={3} maxLength={500} defaultValue={event?.venueNotes || ""} placeholder="Nearest station, parking, entry gate or landmark"/></label></div>
        {pinSelected && <button type="button" className="r-inline-button" onClick={() => { ++lookupId.current; setPoint(null); setPinSelected(false); }}>Remove venue pin</button>}<small role="status">{mapMessage}</small>
        <details className="r-form-disclosure"><summary>Add a map link · optional</summary><label>Map link · optional<input name="mapUrl" type="url" placeholder="https://maps.google.com/…" defaultValue={event?.mapUrl || ""}/></label></details></>}
        {mode !== "IN_PERSON" && <label className="r-online-link">Online event link<input name="onlineUrl" required type="url" placeholder="https://…" defaultValue={event?.onlineUrl || ""}/></label>}
      </section>
      {mode !== "ONLINE" && (
        <section className="r-form-section">
          <div className="r-section-heading">
            <h2>Getting there & Parking</h2>
            <small>Help guests reach easily with metro connections and parking guidance.</small>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Nearest metro station</h3>
                <p className="text-xs text-[var(--muted)]">Detect automatically from map pin or enter details manually.</p>
              </div>
              <button
                type="button"
                disabled={detectingTransit || !pinSelected}
                onClick={detectNearestMetro}
                className="r-inline-button inline-flex items-center gap-1.5"
              >
                {detectingTransit ? "Detecting…" : "Auto-detect nearest metro"}
              </button>
            </div>

            {transitMessage && (
              <p role="status" className="text-xs text-[var(--muted)]">{transitMessage}</p>
            )}

            {detectedStations.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {detectedStations.map((st) => {
                  const isSelected = transitStationName === st.name && transitSource === "auto";
                  return (
                    <label
                      key={st.name}
                      className={`relative flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedTransitStation"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => {
                          setTransitStationName(st.name);
                          setTransitLineName(st.lineName);
                          setTransitLineColor(st.lineColor);
                          setTransitDistanceM(st.distanceMeters);
                          setTransitWalkMin(st.walkMinutes);
                          setTransitSource("auto");
                          setManualTransit(false);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: st.lineColor }}
                          aria-hidden="true"
                        />
                        <strong className="text-sm font-medium leading-snug">{st.name}</strong>
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        <div>{st.lineName}</div>
                        <div className="font-semibold text-[var(--ink)]">
                          ~{st.distanceMeters < 1000 ? `${st.distanceMeters} m` : `${(st.distanceMeters / 1000).toFixed(1)} km`} · ~{st.walkMinutes} min walk
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              {transitStationName ? (
                <span className="flex items-center gap-2">
                  Selected: <strong>{transitStationName}</strong>
                  {transitLineName && <span>({transitLineName})</span>}
                  {transitDistanceM != null && <span>~{transitDistanceM < 1000 ? `${transitDistanceM} m` : `${(transitDistanceM / 1000).toFixed(1)} km`}</span>}
                  <button
                    type="button"
                    className="text-[var(--accent)] underline ml-2"
                    onClick={() => {
                      setTransitStationName("");
                      setTransitLineName("");
                      setTransitLineColor("");
                      setTransitDistanceM(null);
                      setTransitWalkMin(null);
                      setTransitSource(null);
                    }}
                  >
                    Clear
                  </button>
                </span>
              ) : (
                <span className="text-[var(--muted)]">No metro station selected yet.</span>
              )}
              <button
                type="button"
                className="text-[var(--accent)] underline"
                onClick={() => setManualTransit((prev) => !prev)}
              >
                {manualTransit ? "Hide manual fields" : "Enter manually"}
              </button>
            </div>

            {manualTransit && (
              <div className="r-form-fields rounded-xl border border-[var(--border)] p-3">
                <label>
                  Station name
                  <input
                    placeholder="e.g. Saket"
                    value={transitStationName}
                    onChange={(e) => {
                      setTransitStationName(e.target.value);
                      setTransitSource("manual");
                    }}
                  />
                </label>
                <label>
                  Line name
                  <input
                    placeholder="e.g. Yellow Line"
                    value={transitLineName}
                    onChange={(e) => {
                      setTransitLineName(e.target.value);
                      setTransitSource("manual");
                    }}
                  />
                </label>
                <label>
                  Distance (approx. meters)
                  <input
                    type="number"
                    placeholder="e.g. 400"
                    value={transitDistanceM ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      setTransitDistanceM(val);
                      if (val != null) {
                        setTransitWalkMin(Math.max(1, Math.round(val / 80)));
                      }
                      setTransitSource("manual");
                    }}
                  />
                </label>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border)]">
              <label className="text-sm font-semibold block mb-1.5">Parking availability</label>
              <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] p-1 gap-1 bg-[var(--paper-2)]">
                {(
                  [
                    { value: "free", label: "Free" },
                    { value: "paid", label: "Paid" },
                    { value: "street", label: "Street only" },
                    { value: "none", label: "None" },
                    { value: "unknown", label: "Unknown" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      parkingType === opt.value
                        ? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm font-semibold"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                    onClick={() => setParkingType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <label className="block mt-2 text-xs">
                Parking note · optional
                <input
                  placeholder="e.g. Valet at Gate 2, or limited mall parking"
                  maxLength={300}
                  value={parkingNote}
                  onChange={(e) => setParkingNote(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>
      )}
      <details className="r-form-section r-form-disclosure"><summary>Capacity & refund policy <small>Optional</small></summary><div className="r-form-fields"><label>Event capacity<input name="capacity" type="number" min={1} defaultValue={event?.capacity || ""} placeholder="Set later with tickets"/></label><label className="r-field-wide">Refund policy<textarea name="refundPolicy" rows={2} maxLength={5000} defaultValue={event?.refundPolicy || ""} placeholder="Let guests know your cancellation and refund terms."/></label></div></details>
      <div className="r-form-actions"><button disabled={busy} className="m-button">{busy ? "Saving…" : event ? "Save details" : "Create draft and continue"}<span aria-hidden="true">↗</span></button><small>{event ? "Updates apply to your event details." : "Next: add images, PDFs and your lineup."}</small></div>
      {error && <p role="status" className="r-form-message">{error}</p>}
    </div>
    <aside className="r-event-preview" aria-label="Live event preview"><p className="m-eyebrow">GUEST PREVIEW</p><div className="r-preview-art" aria-hidden="true">✳</div><span className="r-status-chip">{category || "YOUR EVENT"}</span><h2>{title || "Your event title"}</h2><p>{summary || "Your short summary will appear here."}</p><dl><div><dt>When</dt><dd>{startsAt ? startsAt.replace("T", " · ") : "Choose date & time"}</dd></div><div><dt>Where</dt><dd>{mode === "ONLINE" ? "Online" : [venue, city].filter(Boolean).join(", ") || "Choose a venue"}</dd></div><div><dt>Format</dt><dd>{formats.find(format => format.value === mode)?.label}</dd></div></dl><small>Draft preview · add your poster and people next.</small></aside>
  </form>;
}
