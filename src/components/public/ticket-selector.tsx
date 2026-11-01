"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  LoaderCircle,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { ticketAvailability } from "@/lib/ticket-availability";
import { plainName } from "@/lib/plain-name";
import { EventTicketNotice } from "@/components/public/event-viewer";
import styles from "./ticket-selector.module.css";

type Type = {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  quantityTotal: number;
  quantitySold: number;
  quantityHeld: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  minPerOrder: number;
  maxPerOrder: number;
  isHidden: boolean;
};

export function formatTotal(count: number, totalPaise: number): string {
  if (count === 0) return "—";
  if (totalPaise === 0) return "Free";
  return formatMoney(totalPaise);
}

export function formatEventTime(startsAt: string, timezone: string): string {
  const start = new Date(startsAt);
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(start);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  })
    .format(start)
    .replace(/\s/g, " ")
    .toLowerCase();
  const zone = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(start)
    .find((part) => part.type === "timeZoneName")?.value;
  return `${date} · ${time}${zone ? ` ${zone}` : ""}`;
}

function saleEndingLabel(value: string, timezone: string, now: number) {
  const end = new Date(value);
  const remaining = end.getTime() - now;
  if (remaining <= 0) return "Sales ended";
  const hours = Math.ceil(remaining / 3_600_000);
  const localDateOrdinal = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).formatToParts(date);
    const part = (type: string) =>
      Number(parts.find((item) => item.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
  };
  const daysAway = localDateOrdinal(end) - localDateOrdinal(new Date(now));
  if (daysAway === 0) return hours <= 6 ? `Ends in ${hours} h` : "Ends today";
  if (hours < 24) return `Ends in ${hours} h`;
  if (daysAway === 1) return "Ends tomorrow";
  const days = Math.max(1, daysAway);
  if (days <= 7) return `Ends in ${days} days`;
  return `Ends ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: timezone }).format(end)}`;
}

export function TicketSelector({
  eventId,
  eventSlug,
  startsAt,
  timezone,
  ticketTypes,
  recap,
}: {
  eventId: string;
  eventSlug: string;
  startsAt: string;
  timezone: string;
  ticketTypes: Type[];
  recap: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [selectionHint, setSelectionHint] = useState(false);
  const [shakeStepper, setShakeStepper] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const desktopTrigger = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = sheetRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const items = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (sheetOpen) {
      sheetWasOpen.current = true;
      return;
    }
    if (!sheetWasOpen.current) return;
    sheetWasOpen.current = false;
    const trigger = window.matchMedia("(max-width: 1023px)").matches
      ? mobileTrigger.current
      : desktopTrigger.current;
    trigger?.focus();
  }, [sheetOpen]);

  const visible = ticketTypes.filter((type) => !type.isHidden);
  const total = visible.reduce((sum, type) => {
    const available = ticketAvailability(
      type,
      startsAt,
      timezone,
      now,
    ).available;
    return sum + type.pricePaise * (available ? quantities[type.id] || 0 : 0);
  }, 0);
  const count = visible.reduce((sum, type) => {
    const available = ticketAvailability(
      type,
      startsAt,
      timezone,
      now,
    ).available;
    return sum + (available ? quantities[type.id] || 0 : 0);
  }, 0);

  function continueToCheckout() {
    if (reserving) return;
    if (!count) {
      setSelectionHint(true);
      setShakeStepper(true);
      window.setTimeout(() => setShakeStepper(false), 220);
      return;
    }
    setReserving(true);
    sessionStorage.setItem(
      `cart:${eventId}`,
      JSON.stringify(
        Object.fromEntries(
          visible
            .filter(
              (type) =>
                ticketAvailability(type, startsAt, timezone, now).available &&
                quantities[type.id],
            )
            .map((type) => [type.id, quantities[type.id]]),
        ),
      ),
    );
    router.push(`/checkout/${eventSlug}`);
  }

  const card = (inSheet = false) => (
    <div
      id={inSheet ? undefined : "ticket-types"}
      className={`${styles.card} ${inSheet ? styles.sheetCard : ""}`}
    >
      {inSheet && (
        <div className={styles.sheetHeading}>
          <span className={styles.dragHandle} aria-hidden="true" />
          <h2>Choose tickets</h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close ticket selection"
            onClick={() => setSheetOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <EventTicketNotice />
      <header className={styles.header}>
        <h2>Get tickets</h2>
        <p className={styles.eventMeta}>
          <CalendarDays size={16} aria-hidden="true" />
          <span>{recap || formatEventTime(startsAt, timezone)}</span>
        </p>
      </header>

      {visible.length ? (
        <div className={styles.ticketList}>
          {visible.map((type) => {
            const { remaining, available, label } = ticketAvailability(
              type,
              startsAt,
              timezone,
              now,
            );
            const current = available ? quantities[type.id] || 0 : 0;
            const limit = Math.min(type.maxPerOrder, remaining);
            const status =
              type.saleEndsAt && available
                ? saleEndingLabel(type.saleEndsAt, timezone, now)
                : !available
                  ? label === "Sales closed"
                    ? "Sales ended"
                    : label
                  : "";
            return (
              <article key={type.id} className={styles.ticket}>
                <div className={styles.ticketTop}>
                  <h3 title={plainName(type.name) || "Admission"}>
                    <span aria-hidden="true">{type.name}</span>
                    <span className="sr-only">
                      {plainName(type.name) || "Admission"}
                    </span>
                  </h3>
                  <div
                    className={`${styles.stepper} ${shakeStepper ? styles.shake : ""}`}
                    role="group"
                    aria-label={`Quantity for ${plainName(type.name) || "admission"}`}
                  >
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={!current}
                      onClick={() =>
                        setQuantities((old) => ({
                          ...old,
                          [type.id]:
                            current <= type.minPerOrder ? 0 : current - 1,
                        }))
                      }
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span aria-live="polite" aria-atomic="true">
                      {current}
                    </span>
                    <button
                      type="button"
                      aria-label={
                        current >= limit
                          ? `Maximum ${limit} per order`
                          : "Increase quantity"
                      }
                      title={
                        current >= limit ? `Max ${limit} per order` : undefined
                      }
                      disabled={!available || current >= limit}
                      onClick={() =>
                        setQuantities((old) => ({
                          ...old,
                          [type.id]: current
                            ? current + 1
                            : Math.min(type.minPerOrder, remaining),
                        }))
                      }
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className={styles.priceLine}>
                  <strong>{formatMoney(type.pricePaise)}</strong>
                  {status && (
                    <span
                      className={`${styles.status} ${available ? styles.endsSoon : ""}`}
                    >
                      {available && <Clock3 size={13} aria-hidden="true" />}
                      {status}
                    </span>
                  )}
                </div>
                {type.description && (
                  <div className={styles.descriptionWrap}>
                    <p
                      className={`${styles.description} ${expanded[type.id] ? styles.descriptionExpanded : ""}`}
                    >
                      {type.description}
                    </p>
                    {type.description.length > 150 && (
                      <button
                        type="button"
                        className={styles.moreButton}
                        aria-expanded={Boolean(expanded[type.id])}
                        onClick={() =>
                          setExpanded((old) => ({
                            ...old,
                            [type.id]: !old[type.id],
                          }))
                        }
                      >
                        {expanded[type.id] ? "Less" : "More"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className={styles.unavailable}>Tickets are unavailable.</p>
      )}

      <div className={styles.summary}>
        <div className={styles.totalLine}>
          <span>
            {count ? `${count} ${count === 1 ? "ticket" : "tickets"}` : "—"}
          </span>
          <strong>{formatTotal(count, total)}</strong>
        </div>
        <p>Platform fee, if any, is shown before payment.</p>
        {selectionHint &&
          count === 0 &&
          visible.some(
            (type) =>
              ticketAvailability(type, startsAt, timezone, now).available,
          ) && (
            <p className={styles.selectionHint} role="status">
              Pick at least 1 ticket
            </p>
          )}
      </div>
      <button
        ref={inSheet ? undefined : desktopTrigger}
        type="button"
        disabled={reserving}
        aria-disabled={!count || reserving}
        onClick={continueToCheckout}
        className={styles.continueButton}
      >
        {reserving ? (
          <>
            <LoaderCircle
              className={styles.spinner}
              size={18}
              aria-hidden="true"
            />{" "}
            Reserving…
          </>
        ) : count ? (
          `Continue${total ? ` · ${formatMoney(total)}` : ""}`
        ) : (
          "Select tickets"
        )}
      </button>
    </div>
  );

  return (
    <>
      <div className={styles.desktopCard}>{card()}</div>
      <div className={styles.mobileBar}>
        <div>
          <strong>
            {count
              ? `${formatMoney(total)} · ${count} ${count === 1 ? "ticket" : "tickets"}`
              : visible.length
                ? `From ${formatMoney(Math.min(...visible.map((type) => type.pricePaise)))}`
                : "Tickets unavailable"}
          </strong>
          {count === 0 && <span>Choose a ticket to continue</span>}
        </div>
        <button
          ref={mobileTrigger}
          type="button"
          disabled={!visible.length}
          onClick={() => setSheetOpen(true)}
          className={styles.mobileBarButton}
        >
          Get tickets
        </button>
      </div>
      {sheetOpen && (
        <div
          className={styles.backdrop}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSheetOpen(false);
          }}
        >
          <section
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Choose event tickets"
          >
            {card(true)}
          </section>
        </div>
      )}
    </>
  );
}
