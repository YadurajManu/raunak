"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { ArrowUpRight, TicketCheck } from "lucide-react";
import { EventReviews } from "@/components/public/event-reviews";

type Viewer = {
  authenticated: boolean;
  saved: boolean;
  isFollowing: boolean;
  followerCount: number;
  ticketCount: number;
  ticketHref?: string | null;
  onlineUrl?: string | null;
  teamRole: string | null;
  managementLinks?: {
    edit: string | null;
    orders: string | null;
    checkIn: string | null;
    preview: string;
  } | null;
  canReview: boolean;
  ownReview?: {
    rating: number;
    body: string | null;
    firstTimerFriendly: boolean | null;
    easyToReach: boolean | null;
  } | null;
};

const ViewerContext = createContext<Viewer | null>(null);

export function useEventViewer() {
  return useContext(ViewerContext);
}

export function EventViewerProvider({
  eventId,
  children,
}: {
  eventId: string;
  children: React.ReactNode;
}) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/events/${eventId}/viewer`, { cache: "no-store" })
      .then((response) =>
        response.ok ? (response.json() as Promise<Viewer>) : null,
      )
      .then((result) => {
        if (active && result) setViewer(result);
      })
      .catch(() => {
        /* Viewer data is optional; keep the public page available. */
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  return (
    <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
  );
}

export function EventManagementBar({
  hidden = false,
  previewMessage,
}: {
  hidden?: boolean;
  previewMessage?: string;
}) {
  const viewer = useEventViewer();
  const links = viewer?.managementLinks;
  if (hidden || !viewer?.teamRole || !links)
    return <div className="event-viewer-bar-slot" aria-hidden="true" />;
  const actions = [
    links.edit && ["Edit event", links.edit],
    links.orders && [
      viewer.teamRole === "FINANCE" ? "Orders" : "Orders & attendees",
      links.orders,
    ],
    links.checkIn && ["Check-in", links.checkIn],
    ["Preview as visitor", links.preview],
  ].filter((item): item is [string, string] => Boolean(item));
  return (
    <nav className="event-management-bar" aria-label="Event management">
      <span>{previewMessage || "Event workspace"}</span>
      <div>
        {actions.map(([label, href]) => (
          <Link key={label} href={href}>
            {label}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function EventTicketNotice() {
  const viewer = useEventViewer();
  if (!viewer?.ticketCount) return null;
  return (
    <div className="event-going-notice" role="status">
      <TicketCheck size={19} aria-hidden="true" />
      <strong>You’re going</strong>
      <span>
        {viewer.ticketCount} {viewer.ticketCount === 1 ? "ticket" : "tickets"}
      </span>
      {viewer.ticketHref && <Link href={viewer.ticketHref}>View tickets</Link>}
      {viewer.onlineUrl && (
        <a href={viewer.onlineUrl} target="_blank" rel="noopener noreferrer">
          Join online
        </a>
      )}
      <a className="event-buy-more" href="#ticket-types">
        Buy more tickets
      </a>
    </div>
  );
}

export function EventReviewsForViewer({
  eventId,
  eventUrl,
  reviewOpen,
  reviews,
  averageRating,
  reviewCount,
}: {
  eventId: string;
  eventUrl: string;
  reviewOpen: boolean;
  reviews: {
    id: string;
    name: string;
    rating: number;
    body: string | null;
    firstTimerFriendly: boolean | null;
    easyToReach: boolean | null;
    createdAt: string;
    isMine: boolean;
  }[];
  averageRating: number | null;
  reviewCount: number;
}) {
  const viewer = useEventViewer();
  if (reviewCount === 0 && reviewOpen && !viewer?.canReview) {
    return (
      <p className="mt-12 text-sm text-[var(--muted)]">
        Reviews will appear here after attendees share their experience.
      </p>
    );
  }
  return (
    <EventReviews
      eventId={eventId}
      eventUrl={eventUrl}
      signedIn={Boolean(viewer?.authenticated)}
      reviews={reviews}
      averageRating={averageRating}
      reviewCount={reviewCount}
      reviewOpen={reviewOpen}
      canReview={Boolean(viewer?.canReview)}
      ownReview={
        viewer?.ownReview
          ? { ...viewer.ownReview, body: viewer.ownReview.body || "" }
          : null
      }
    />
  );
}
