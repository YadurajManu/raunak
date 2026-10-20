"use client";

import { useState } from "react";
import Link from "next/link";
import { EventCard } from "./event-card";
import { CalendarDays, History, Sparkles } from "lucide-react";

type EventItem = {
  id: string;
  slug: string;
  title: string;
  timezone: string;
  startsAt: Date;
  city: string | null;
  venueName: string | null;
  category: string | null;
  mode: string;
  org: { name: string; slug: string; logoKey?: string | null };
  images: { kind: string; variants: unknown; alt: string }[];
  ticketTypes: { pricePaise: number }[];
  reviewSummary?: { average: number | null; count: number } | null;
};

type OrganizerEventsSectionProps = {
  upcomingEvents: EventItem[];
  pastEvents: EventItem[];
  savedEventIds: string[];
  organizerSlug: string;
};

export function OrganizerEventsSection({
  upcomingEvents,
  pastEvents,
  savedEventIds,
  organizerSlug,
}: OrganizerEventsSectionProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">(
    upcomingEvents.length > 0 ? "upcoming" : "past",
  );

  const events = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  return (
    <section className="org-events-section" id="events">
      <div className="org-events-toolbar">
        <div className="org-events-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "upcoming"}
            className={`org-tab-btn ${activeTab === "upcoming" ? "is-active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            <CalendarDays size={16} aria-hidden="true" />
            <span>Upcoming events</span>
            <span className="org-tab-badge">{upcomingEvents.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "past"}
            className={`org-tab-btn ${activeTab === "past" ? "is-active" : ""}`}
            onClick={() => setActiveTab("past")}
          >
            <History size={16} aria-hidden="true" />
            <span>Past events</span>
            <span className="org-tab-badge">{pastEvents.length}</span>
          </button>
        </div>

        {activeTab === "upcoming" && upcomingEvents.length > 0 && (
          <Link
            href={`/discover?organizer=${encodeURIComponent(organizerSlug)}`}
            className="org-view-all-link"
          >
            View all ↗
          </Link>
        )}
      </div>

      {events.length > 0 ? (
        <ul className="market-grid">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              saved={savedEventIds.includes(event.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="org-empty-events">
          <Sparkles size={28} className="org-empty-icon" aria-hidden="true" />
          <h3>
            {activeTab === "upcoming"
              ? "No upcoming gatherings scheduled"
              : "No past events recorded"}
          </h3>
          <p>
            {activeTab === "upcoming"
              ? "Follow this organizer to get notified as soon as new events are announced."
              : "Past gatherings and attendee reviews will appear here once events conclude."}
          </p>
        </div>
      )}
    </section>
  );
}
