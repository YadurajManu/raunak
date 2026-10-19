"use client";

/* eslint-disable @next/next/no-img-element -- event posters are served through Raunak's media endpoint. */
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  MapPin,
  MonitorPlay,
  RotateCcw,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { eventQuality } from "@/lib/event-quality";

export type ReviewEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  visibility: string;
  status: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  venueName: string | null;
  address: string | null;
  mapUrl: string | null;
  onlineUrl: string | null;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  org: {
    name: string;
    slug: string;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  ticketTypes: {
    id: string;
    name: string;
    description: string | null;
    pricePaise: number;
    quantityTotal: number;
  }[];
  images: {
    id: string;
    kind: string;
    alt: string;
    cardUrl: string | null;
    width: number | null;
    height: number | null;
  }[];
};

type QueueStatus = "PENDING_REVIEW" | "PUBLISHED" | "ACTION_NEEDED" | "SUSPENDED";
type ReviewAction = "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "SUSPEND" | "RESTORE";

const queues: { status: QueueStatus; label: string; shortLabel: string }[] = [
  { status: "PENDING_REVIEW", label: "Awaiting review", shortLabel: "Review" },
  { status: "ACTION_NEEDED", label: "Past decisions", shortLabel: "Reviewed" },
  { status: "PUBLISHED", label: "Published", shortLabel: "Published" },
  { status: "SUSPENDED", label: "Suspended", shortLabel: "Suspended" },
];

const reasonActions: ReviewAction[] = ["REQUEST_CHANGES", "REJECT", "SUSPEND"];

export function ReviewConsole({
  initialEvents,
  initialStatus = "PENDING_REVIEW",
  initialError = "",
}: {
  initialEvents: ReviewEvent[];
  initialStatus?: QueueStatus;
  initialError?: string;
}) {
  const [status, setStatus] = useState<QueueStatus>(initialStatus);
  const [events, setEvents] = useState(initialEvents);
  const [counts, setCounts] = useState<Partial<Record<QueueStatus, number>>>(
    { [initialStatus]: initialEvents.length },
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialEvents[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialError);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [requestedAction, setRequestedAction] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const requestId = useRef(0);

  const matching = events.filter((event) => {
    const needle = search.trim().toLocaleLowerCase();
    return !needle || [event.title, event.org.name, event.city ?? "", event.category ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
  const selected = matching.find((event) => event.id === selectedId) ?? matching[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    for (const queue of queues) {
      if (queue.status === initialStatus) continue;
      void fetch(`/api/admin/events?status=${queue.status}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          const data = (await response.json()) as { events?: ReviewEvent[] };
          return Array.isArray(data.events) ? data.events.length : null;
        })
        .then((count) => {
          if (!cancelled && count !== null) {
            setCounts((current) => ({ ...current, [queue.status]: count }));
          }
        })
        .catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [initialStatus]);

  async function selectQueue(nextStatus: QueueStatus) {
    if (nextStatus === status) return;
    const id = ++requestId.current;
    setStatus(nextStatus);
    setEvents([]);
    setSelectedId(null);
    setRequestedAction(null);
    setNote("");
    setFeedback("");
    setLoadError("");
    setPermissionDenied(false);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/events?status=${nextStatus}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (id !== requestId.current) return;
        setPermissionDenied(response.status === 401 || response.status === 403);
        throw new Error(data.error || "We couldn’t load this review queue.");
      }
      const records = Array.isArray(data.events) ? data.events as ReviewEvent[] : null;
      if (!records) throw new Error("The review queue returned an unexpected response.");
      if (id !== requestId.current) return;
      setEvents(records);
      setSelectedId(records[0]?.id ?? null);
      setCounts((current) => ({ ...current, [nextStatus]: records.length }));
    } catch (error) {
      if (id === requestId.current) setLoadError(error instanceof Error ? error.message : "We couldn’t load this review queue.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function performAction(action: ReviewAction) {
    if (!selected || busyAction) return;
    const trimmedNote = note.trim();
    if (reasonActions.includes(action) && trimmedNote.length < 5) return;
    setBusyAction(true);
    setFeedback("");
    setLoadError("");
    try {
      const response = await fetch(`/api/admin/events/${selected.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(trimmedNote ? { note: trimmedNote } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setPermissionDenied(true);
        throw new Error(data.error || "We couldn’t save this review decision.");
      }

      const sourceStatus = status;
      setEvents((current) => current.filter((event) => event.id !== selected.id));
      setSelectedId((current) => current === selected.id ? (matching.find((event) => event.id !== selected.id)?.id ?? null) : current);
      setCounts((current) => {
        const next = { ...current };
        if (typeof next[sourceStatus] === "number") next[sourceStatus] = Math.max(0, next[sourceStatus]! - 1);
        const destination: Partial<Record<ReviewAction, QueueStatus>> = {
          APPROVE: "PUBLISHED",
          REQUEST_CHANGES: "ACTION_NEEDED",
          SUSPEND: "SUSPENDED",
          RESTORE: "PUBLISHED",
        };
        const target = destination[action];
        if (target && typeof next[target] === "number") next[target] = next[target]! + 1;
        return next;
      });
      setRequestedAction(null);
      setNote("");
      setFeedback(actionFeedback(action));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We couldn’t save this review decision.");
    } finally {
      setBusyAction(false);
    }
  }

  function startAction(action: ReviewAction) {
    setFeedback("");
    setLoadError("");
    if (reasonActions.includes(action) || action === "RESTORE") {
      setRequestedAction(action);
      setNote("");
    } else {
      void performAction(action);
    }
  }

  const selectedQueue = queues.find((queue) => queue.status === status);

  return (
    <main className="admin-review" aria-labelledby="admin-review-title">
      <header className="ar-header">
        <div>
          <p className="ar-eyebrow">RAUNAK · OPERATIONS</p>
          <h1 id="admin-review-title">Event review</h1>
          <p className="ar-intro">A considered look before a good plan goes public.</p>
        </div>
        <div className="ar-summary" aria-live="polite">
          <span className="ar-summary-mark"><ShieldCheck size={19} aria-hidden="true" /></span>
          <span><strong>{counts.PENDING_REVIEW ?? initialEvents.length}</strong><small>waiting for a decision</small></span>
        </div>
      </header>

      <nav className="ar-queues" aria-label="Event review queues">
        {queues.map((queue) => (
          <button
            key={queue.status}
            type="button"
            className={`ar-queue-tab ${status === queue.status ? "is-active" : ""}`}
            aria-current={status === queue.status ? "page" : undefined}
            onClick={() => void selectQueue(queue.status)}
          >
            <span>{queue.label}</span>
            <span className="ar-count">{counts[queue.status] ?? "—"}</span>
          </button>
        ))}
      </nav>

      {loadError && (
        <div className={`ar-alert ${permissionDenied ? "is-permission" : "is-error"}`} role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{permissionDenied ? "You don’t have permission to use the admin review console." : loadError}</span>
          {!permissionDenied && <button type="button" onClick={() => void selectQueue(status)}>Try again</button>}
        </div>
      )}
      {feedback && <p className="ar-feedback" role="status"><Check size={17} aria-hidden="true" />{feedback}</p>}

      <div className="ar-workspace">
        <section className="ar-queue" aria-labelledby="ar-queue-title">
          <div className="ar-queue-heading">
            <div>
              <h2 id="ar-queue-title">{selectedQueue?.label ?? "Submissions"}</h2>
              <p>{loading ? "Refreshing queue…" : `${events.length} ${events.length === 1 ? "listing" : "listings"}`}</p>
            </div>
            <label className="ar-search">
              <span className="sr-only">Search this queue</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an event" />
            </label>
          </div>

          {loading ? (
            <div className="ar-state" role="status"><span className="ar-spinner" />Loading the queue…</div>
          ) : !loadError && matching.length === 0 ? (
            <div className="ar-state ar-empty">
              <span className="ar-empty-icon"><Check size={21} aria-hidden="true" /></span>
              <h3>{events.length ? "No listings match" : emptyQueueTitle(status)}</h3>
              <p>{events.length ? "Try another event, organizer, or city." : emptyQueueCopy(status)}</p>
              {search && <button type="button" className="ar-text-button" onClick={() => setSearch("")}>Clear search</button>}
            </div>
          ) : (
            <ul className="ar-event-list">
              {matching.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={`ar-event-row ${selected?.id === event.id ? "is-selected" : ""}`}
                    onClick={() => { setSelectedId(event.id); setRequestedAction(null); setNote(""); setFeedback(""); }}
                    aria-pressed={selected?.id === event.id}
                  >
                    <Poster event={event} compact />
                    <span className="ar-row-content">
                      <strong>{event.title || "Untitled event"}</strong>
                      <span className="ar-row-organizer">{event.org.name || "Organizer not supplied"}</span>
                      <span className="ar-row-meta">{formatEventDate(event.startsAt, event.timezone)} <i>·</i> {event.mode === "ONLINE" ? "Online" : event.city || "City missing"}</span>
                      <span className={`ar-status ar-status-${event.status.toLowerCase()}`}>{formatStatus(event.status)}</span>
                    </span>
                    <ArrowUpRight className="ar-row-arrow" size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ar-detail" aria-label="Selected event details">
          {selected ? (
            <>
              <div className="ar-detail-topline">
                <span className="ar-eyebrow">LISTING DETAILS</span>
                <span className={`ar-status ar-status-${selected.status.toLowerCase()}`}>{formatStatus(selected.status)}</span>
              </div>
              <Poster event={selected} />
              <div className="ar-detail-title-row">
                <div>
                  <p className="ar-eyebrow">{selected.category || "CATEGORY NOT SET"}</p>
                  <h2>{selected.title || "Untitled event"}</h2>
                </div>
                {selected.status === "PUBLISHED" && (
                  <a className="ar-icon-link" href={`/e/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer" aria-label={`Preview ${selected.title} in a new tab`} title="Preview event">
                    <ExternalLink size={17} aria-hidden="true" />
                  </a>
                )}
              </div>
              {selected.summary && <p className="ar-summary-text">{selected.summary}</p>}

              <ReviewCues event={selected} />

              <div className="ar-detail-grid">
                <section className="ar-info-block">
                  <h3><CalendarDays size={16} aria-hidden="true" />Schedule</h3>
                  <p>{formatLongDate(selected.startsAt, selected.timezone)}</p>
                  <small>{formatTime(selected.startsAt, selected.timezone)} – {formatTime(selected.endsAt, selected.timezone)} · {selected.timezone || "Timezone not set"}</small>
                </section>
                <section className="ar-info-block">
                  <h3>{selected.mode === "ONLINE" ? <MonitorPlay size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}Location</h3>
                  <p>{selected.mode === "ONLINE" ? "Online event" : selected.venueName || "Venue not supplied"}</p>
                  <small>{selected.mode === "ONLINE" ? (safeWebUrl(selected.onlineUrl) ? "Online link supplied" : "Online link missing") : [selected.address, selected.city].filter(Boolean).join(" · ") || "Address and city not supplied"}</small>
                  {selected.mode !== "ONLINE" && safeWebUrl(selected.mapUrl) && <a className="ar-map-link" href={safeWebUrl(selected.mapUrl)!} target="_blank" rel="noreferrer">Open map <ExternalLink size={12} aria-hidden="true" /></a>}
                </section>
              </div>

              {selected.description && (
                <section className="ar-content-section">
                  <h3>About this event</h3>
                  <p className="ar-description">{selected.description}</p>
                </section>
              )}

              <section className="ar-content-section">
                <div className="ar-section-heading"><h3>Tickets</h3><span>{selected.ticketTypes.length} {selected.ticketTypes.length === 1 ? "type" : "types"}</span></div>
                {selected.ticketTypes.length ? (
                  <ul className="ar-ticket-list">
                    {selected.ticketTypes.map((ticket) => (
                      <li key={ticket.id}>
                        <span className="ar-ticket-icon"><Ticket size={16} aria-hidden="true" /></span>
                        <span className="ar-ticket-main"><strong>{ticket.name}</strong>{ticket.description && <small>{ticket.description}</small>}</span>
                        <span className="ar-ticket-price">{formatInr(ticket.pricePaise)}</span>
                        <span className="ar-ticket-quantity">{ticket.quantityTotal} seats</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="ar-muted-copy">No ticket types have been added yet.</p>}
              </section>

              <section className="ar-organizer">
                <span className="ar-organizer-mark" aria-hidden="true">{initials(selected.org.name)}</span>
                <div><span className="ar-eyebrow">HOSTED BY</span><a className="ar-organizer-name" href={`/organizers/${encodeURIComponent(selected.org.slug)}`} target="_blank" rel="noreferrer">{selected.org.name || "Organizer not supplied"}</a></div>
                <div className="ar-organizer-contact">
                  {selected.org.supportEmail && <a href={`mailto:${selected.org.supportEmail}`}>{selected.org.supportEmail}</a>}
                  {selected.org.supportPhone && <a href={`tel:${selected.org.supportPhone}`}>{selected.org.supportPhone}</a>}
                  {!selected.org.supportEmail && !selected.org.supportPhone && <span>Contact details not supplied</span>}
                </div>
              </section>

              {selected.reviewNote && <p className="ar-previous-note"><strong>Previous review note</strong>{selected.reviewNote}</p>}

              {requestedAction ? (
                <div className="ar-action-compose" aria-labelledby="ar-action-title">
                  <div className="ar-compose-heading">
                    <div><span className="ar-eyebrow">REVIEW DECISION</span><h3 id="ar-action-title">{actionPrompt(requestedAction)}</h3></div>
                    <button type="button" className="ar-icon-link" onClick={() => setRequestedAction(null)} aria-label="Cancel decision"><X size={17} /></button>
                  </div>
                  {reasonActions.includes(requestedAction) ? (
                    <label className="ar-note-label">Reason shown to the organizer
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder={notePlaceholder(requestedAction)} aria-describedby="ar-note-hint" />
                      <small id="ar-note-hint">Be specific and kind. {note.trim().length}/1000</small>
                    </label>
                  ) : <p className="ar-restore-copy">This will make the listing public again.</p>}
                  <div className="ar-compose-actions">
                    <button type="button" className="ar-secondary-button" onClick={() => setRequestedAction(null)} disabled={busyAction}>Cancel</button>
                    <button
                      type="button"
                      className={`ar-primary-button ${requestedAction === "REJECT" || requestedAction === "SUSPEND" ? "is-danger" : ""}`}
                      onClick={() => void performAction(requestedAction)}
                      disabled={busyAction || (reasonActions.includes(requestedAction) && note.trim().length < 5)}
                    >
                      {busyAction ? "Saving…" : confirmActionLabel(requestedAction)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ar-actions" aria-label="Review actions">
                  {selected.status === "PENDING_REVIEW" ? (
                    <>
                      <button type="button" className="ar-primary-button" onClick={() => startAction("APPROVE")} disabled={busyAction}><Check size={16} aria-hidden="true" />Approve & publish</button>
                      <button type="button" className="ar-secondary-button" onClick={() => startAction("REQUEST_CHANGES")} disabled={busyAction}>Request changes</button>
                      <button type="button" className="ar-danger-button" onClick={() => startAction("REJECT")} disabled={busyAction}>Reject</button>
                    </>
                  ) : selected.status === "PUBLISHED" ? (
                    <button type="button" className="ar-danger-button" onClick={() => startAction("SUSPEND")} disabled={busyAction}><ArrowDownRight size={16} aria-hidden="true" />Suspend listing</button>
                  ) : selected.status === "SUSPENDED" ? (
                    <button type="button" className="ar-primary-button" onClick={() => startAction("RESTORE")} disabled={busyAction}><RotateCcw size={16} aria-hidden="true" />Restore listing</button>
                  ) : null}
                  <p className="ar-action-hint"><Clock3 size={14} aria-hidden="true" />Your decision is recorded for the Raunak team.</p>
                </div>
              )}
            </>
          ) : (
            <div className="ar-detail-empty">
              <span className="ar-detail-empty-mark"><ArrowLeft size={19} aria-hidden="true" /></span>
              <p className="ar-eyebrow">{loading ? "LOADING REVIEW" : "READY WHEN YOU ARE"}</p>
              <h2>{loading ? "Opening the queue." : "Select a listing to review."}</h2>
              <p>{loading ? "Event details are on their way." : "You’ll find event information, ticket setup, and clear review cues here."}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Poster({ event, compact = false }: { event: ReviewEvent; compact?: boolean }) {
  const poster = event.images.find((image) => image.kind === "POSTER" || image.kind === "COVER") ?? event.images[0];
  const cardUrl = safeWebUrl(poster?.cardUrl ?? null);
  return (
    <div className={`ar-poster ${compact ? "is-compact" : ""}`}>
      {cardUrl ? <img src={cardUrl} alt={poster?.alt || `${event.title} event poster`} loading="lazy" /> : (
        <div className="ar-poster-fallback"><span className="ar-poster-emblem" aria-hidden="true">R</span><span>{poster ? "Poster is still processing" : "No poster supplied"}</span></div>
      )}
      {!compact && <span className="ar-poster-caption">{event.city || (event.mode === "ONLINE" ? "ONLINE" : "EVENT LISTING")}</span>}
    </div>
  );
}

function ReviewCues({ event }: { event: ReviewEvent }) {
  const issues = eventQuality({
    title: event.title,
    category: event.category,
    summary: event.summary,
    description: event.description,
    visibility: event.visibility,
    mode: event.mode,
    city: event.city,
    venueName: event.venueName,
    address: event.address,
    onlineUrl: safeWebUrl(event.onlineUrl) ? event.onlineUrl : null,
    startsAt: new Date(event.startsAt),
    endsAt: new Date(event.endsAt),
    ticketTypes: event.ticketTypes,
    images: event.images.map((image) => ({
      kind: image.kind,
      width: image.width,
      height: image.height,
      variants: safeWebUrl(image.cardUrl) ? { card: true } : null,
    })),
    org: event.org,
  });
  const submitted = event.reviewSubmittedAt;
  return (
    <section className={`ar-review-cues ${issues.length ? "has-issues" : "is-ready"}`} aria-labelledby="ar-cues-heading">
      <div className="ar-cues-heading">
        <span className="ar-cues-icon">{issues.length ? <CircleAlert size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}</span>
        <div><h3 id="ar-cues-heading">{issues.length ? "Details to check" : "Listing details are complete"}</h3><p>Objective checks for a clear event listing</p></div>
      </div>
      {issues.length ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p className="ar-cues-clear">Required listing details are present. Review the content and organizer information before deciding.</p>}
      <div className="ar-submitted-at"><Clock3 size={13} aria-hidden="true" />Submitted {submitted ? formatRelative(submitted) : "time not available"}</div>
    </section>
  );
}

function actionFeedback(action: ReviewAction) {
  switch (action) {
    case "APPROVE": return "Event approved and published.";
    case "REQUEST_CHANGES": return "Changes requested. The organizer can now update this listing.";
    case "REJECT": return "Event submission rejected. The organizer will see your reason.";
    case "SUSPEND": return "Listing suspended and removed from public discovery.";
    case "RESTORE": return "Listing restored to public discovery.";
  }
}

function actionPrompt(action: ReviewAction) {
  switch (action) {
    case "REQUEST_CHANGES": return "What should the organizer update?";
    case "REJECT": return "Why are you rejecting this submission?";
    case "SUSPEND": return "Why is this listing being suspended?";
    case "RESTORE": return "Restore this event?";
    default: return "Approve and publish this event?";
  }
}

function notePlaceholder(action: ReviewAction) {
  if (action === "REQUEST_CHANGES") return "For example: Please add the venue address and update the event end time.";
  if (action === "SUSPEND") return "Describe the policy or listing issue so the organizer understands the decision.";
  return "Explain the specific reason this event cannot be approved.";
}

function confirmActionLabel(action: ReviewAction) {
  switch (action) {
    case "REQUEST_CHANGES": return "Send change request";
    case "REJECT": return "Confirm rejection";
    case "SUSPEND": return "Confirm suspension";
    case "RESTORE": return "Restore event";
    default: return "Approve & publish";
  }
}

function emptyQueueTitle(status: QueueStatus) {
  if (status === "PENDING_REVIEW") return "No events waiting for review.";
  if (status === "ACTION_NEEDED") return "No past decisions to review.";
  if (status === "PUBLISHED") return "No published events yet.";
  return "No suspended listings.";
}

function emptyQueueCopy(status: QueueStatus) {
  if (status === "PENDING_REVIEW") return "New submissions will appear here when organizers send them for review.";
  if (status === "ACTION_NEEDED") return "Events returned for changes or rejected will appear here for reference.";
  if (status === "PUBLISHED") return "Approved public listings will be available to review here.";
  return "Listings you pause will be available to restore here.";
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING_REVIEW: "Awaiting review",
    ACTION_NEEDED: "Action needed",
    NEEDS_CHANGES: "Action needed",
    PUBLISHED: "Published",
    SUSPENDED: "Suspended",
    REJECTED: "Rejected",
  };
  return labels[status] ?? status.replaceAll("_", " ").toLocaleLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEventDate(value: string, timezone: string) {
  return safeDate(value, timezone, { day: "numeric", month: "short" }) || "Date unavailable";
}

function formatLongDate(value: string, timezone: string) {
  return safeDate(value, timezone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) || "Date unavailable";
}

function formatTime(value: string, timezone: string) {
  return safeDate(value, timezone, { hour: "numeric", minute: "2-digit" }) || "Time unavailable";
}

function safeDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try { return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: timezone || "Asia/Kolkata" }).format(date); }
  catch { return new Intl.DateTimeFormat("en-IN", options).format(date); }
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "time not available";
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((Number.isFinite(paise) ? paise : 0) / 100);
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "R";
}

function safeWebUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value, "https://raunak.invalid");
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}
