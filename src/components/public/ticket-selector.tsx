"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { ticketAvailability } from "@/lib/ticket-availability";
import { plainName } from "@/lib/plain-name";
import { EventTicketNotice } from "@/components/public/event-viewer";

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
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const visible = ticketTypes.filter((type) => !type.isHidden);
  const total = visible.reduce(
    (sum, type) =>
      sum +
      type.pricePaise *
        (ticketAvailability(type, startsAt, timezone, now).available
          ? quantities[type.id] || 0
          : 0),
    0,
  );
  const count = visible.reduce(
    (sum, type) =>
      sum +
      (ticketAvailability(type, startsAt, timezone, now).available
        ? quantities[type.id] || 0
        : 0),
    0,
  );
  return (
    <div
      id="ticket-types"
      className="sticky top-6 scroll-mt-6 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm dark:border-[var(--line)] dark:bg-[var(--paper)]"
    >
      <EventTicketNotice />
      <h2 className="text-xl font-semibold">Get tickets</h2>
      <p className="mt-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
        {recap}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Choose your tickets below.
      </p>
      {visible.length ? (
        <div className="mt-5 space-y-4">
          {visible.map((type) => {
            const {
              remaining,
              available: onSale,
              label,
            } = ticketAvailability(type, startsAt, timezone, now);
            const current = onSale ? quantities[type.id] || 0 : 0;
            return (
              <div
                key={type.id}
                className="border-t border-[var(--line)] pt-4 dark:border-[var(--line)]"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span aria-hidden="true">{type.name}</span>
                      <span className="sr-only">
                        {plainName(type.name) || "Admission"}
                      </span>
                    </p>
                    {type.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {type.description}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-semibold">
                      {formatMoney(type.pricePaise)}
                    </p>
                    {type.saleEndsAt && (
                      <p className="ticket-sale-status">
                        {(() => {
                          const end = new Date(type.saleEndsAt);
                          const daysLeft = Math.ceil(
                            (end.getTime() - now) / 86400000,
                          );
                          if (onSale && daysLeft >= 0 && daysLeft <= 7)
                            return `Ends in ${daysLeft === 0 ? "less than a day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}`;
                          return `Ends ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: timezone }).format(end)}`;
                        })()}
                      </p>
                    )}
                    {!onSale && <p className="ticket-sale-status">{label}</p>}
                  </div>
                  <div className="flex h-9 shrink-0 items-center rounded-lg border border-[var(--line)] dark:border-[var(--line)]">
                    <button
                      type="button"
                      aria-label={`Remove ${plainName(type.name) || "admission"}`}
                      disabled={!current}
                      onClick={() =>
                        setQuantities({
                          ...quantities,
                          [type.id]:
                            current <= type.minPerOrder ? 0 : current - 1,
                        })
                      }
                      className="h-9 w-9 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span
                      className="w-6 text-center text-sm"
                      aria-live="polite"
                    >
                      {current}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add ${plainName(type.name) || "admission"}`}
                      disabled={
                        !onSale ||
                        current >= Math.min(type.maxPerOrder, remaining)
                      }
                      onClick={() =>
                        setQuantities({
                          ...quantities,
                          [type.id]: current
                            ? current + 1
                            : Math.min(type.minPerOrder, remaining),
                        })
                      }
                      className="h-9 w-9 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[var(--muted)]">
          Tickets are unavailable.
        </p>
      )}
      <div className="mt-6 border-t border-[var(--line)] pt-5 dark:border-[var(--line)]">
        <div className="flex justify-between font-medium">
          <span>
            {count} {count === 1 ? "ticket" : "tickets"}
          </span>
          <span>{formatMoney(total)}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Any applicable platform fee appears before payment.
        </p>
        <button
          disabled={!count}
          onClick={() => {
            sessionStorage.setItem(
              `cart:${eventId}`,
              JSON.stringify(
                Object.fromEntries(
                  visible
                    .filter(
                      (type) =>
                        ticketAvailability(type, startsAt, timezone, now)
                          .available && quantities[type.id],
                    )
                    .map((type) => [type.id, quantities[type.id]]),
                ),
              ),
            );
            router.push(`/checkout/${eventSlug}`);
          }}
          className="mt-5 min-h-11 w-full rounded-xl border border-[var(--ink)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--on-accent)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--surface)] disabled:text-[var(--muted)]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
