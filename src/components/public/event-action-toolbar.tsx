"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Share2,
} from "lucide-react";
import { SaveEvent } from "./save-event";
import { whatsappEventUrl } from "@/lib/event-share";

export function EventActionToolbar({
  eventId,
  title,
  url,
  organizer,
  saved,
  saveAvailable,
  calendar,
}: {
  eventId: string;
  title: string;
  url: string;
  organizer: { name: string; slug: string };
  saved: boolean;
  saveAvailable: boolean;
  calendar: { google: string; outlook: string } | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      root.current?.querySelectorAll("details[open]").forEach((menu) => {
        if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const closeMenus = () =>
    root.current
      ?.querySelectorAll("details[open]")
      .forEach((menu) => menu.removeAttribute("open"));
  const name = organizer.name.trim() || "Event organizer";
  return (
    <div
      className="event-action-toolbar"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const menu = (event.target as HTMLElement).closest("details");
          closeMenus();
          menu?.querySelector("summary")?.focus();
        }
      }}
    >
      <Link className="eat-organizer" href={`/organizers/${organizer.slug}`}>
        <span className="eat-avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <small>Hosted by</small>
          <strong>{name}</strong>
        </span>
      </Link>
      <div className="eat-actions" role="group" aria-label="Event actions">
        {saveAvailable && (
          <SaveEvent eventId={eventId} initial={saved} labeled />
        )}
        {calendar ? (
          <details className="eat-menu" name={`event-actions-${eventId}`}>
            <summary aria-label="Add event to calendar">
              <CalendarDays size={18} aria-hidden="true" />
              <span>Calendar</span>
              <ChevronDown size={12} aria-hidden="true" />
            </summary>
            <div
              className="eat-popover"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) closeMenus();
              }}
            >
              <a
                href={calendar.google}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Calendar <ExternalLink size={15} aria-hidden="true" />
              </a>
              <a
                href={calendar.outlook}
                target="_blank"
                rel="noopener noreferrer"
              >
                Outlook <ExternalLink size={15} aria-hidden="true" />
              </a>
              <a href={`/api/events/${eventId}/calendar`}>
                Download ICS <Download size={15} aria-hidden="true" />
              </a>
            </div>
          </details>
        ) : (
          <button
            type="button"
            disabled
            title="Calendar unavailable until the event dates are confirmed"
          >
            <CalendarDays size={18} aria-hidden="true" />
            Calendar unavailable
          </button>
        )}
        <details className="eat-menu" name={`event-actions-${eventId}`}>
          <summary
            aria-label="Share event"
            onClick={() => setCanShare(typeof navigator.share === "function")}
          >
            <Share2 size={18} aria-hidden="true" />
            <span>Share</span>
            <ChevronDown size={12} aria-hidden="true" />
          </summary>
          <div className="eat-popover">
            <a
              href={whatsappEventUrl(title, url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenus}
            >
              <MessageCircle size={17} aria-hidden="true" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setFeedback("Link copied");
                } catch {
                  setFeedback(
                    "Could not copy. Select the link below to copy it.",
                  );
                }
              }}
            >
              {feedback === "Link copied" ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Copy size={17} aria-hidden="true" />
              )}
              {feedback === "Link copied" ? "Copied" : "Copy link"}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share({ title, url });
                    closeMenus();
                    setFeedback("Shared");
                  } catch (error) {
                    if (!(
                      error instanceof Error && error.name === "AbortError"
                    ))
                      setFeedback(
                        "Sharing unavailable. Try WhatsApp or copy the link.",
                      );
                  }
                }}
              >
                <Share2 size={17} aria-hidden="true" />
                More sharing options
              </button>
            )}
            {feedback.startsWith("Could not copy") && (
              <input
                aria-label="Event link to copy"
                readOnly
                value={url}
                onFocus={(event) => event.target.select()}
              />
            )}
          </div>
        </details>
      </div>
      <span className="eat-feedback" role="status">
        {feedback}
      </span>
    </div>
  );
}
