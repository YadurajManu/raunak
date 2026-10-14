"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/money";
import { ticketAvailability } from "@/lib/ticket-availability";

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
}: {
  eventId: string;
  eventSlug: string;
  startsAt: string;
  timezone: string;
  ticketTypes: Type[];
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
    <div className="sticky top-6 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm dark:border-[var(--line)] dark:bg-[var(--paper)]">
      <h2 className="text-xl font-semibold">Get tickets</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
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
                    <p className="font-medium">{type.name}</p>
                    {type.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {type.description}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-semibold">
                      {formatInr(type.pricePaise)}
                    </p>
                    {!onSale && (
                      <p className="mt-1 text-xs text-amber-600">{label}</p>
                    )}
                  </div>
                  <div className="flex h-9 shrink-0 items-center rounded-lg border border-[var(--line)] dark:border-[var(--line)]">
                    <button
                      type="button"
                      aria-label={`Remove ${type.name}`}
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
                      aria-label={`Add ${type.name}`}
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
          <span>{formatInr(total)}</span>
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
          className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
