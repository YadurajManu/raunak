"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  LockKeyhole,
  LoaderCircle,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { BrandMark } from "@/components/brand-mark";
import { EventImage } from "./event-image";

export type CheckoutItem = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  available?: number;
};

export type CheckoutQuote = {
  items: CheckoutItem[];
  subtotalPaise: number;
  feePaise: number;
  totalPaise: number;
};

export type CheckoutOrder = CheckoutQuote & {
  id: string;
  status: string;
  expiresAt: string;
  paymentSessionId?: string | null;
};

export type CheckoutEvent = {
  title: string;
  startsAt: string;
  timezone: string;
  venueName?: string | null;
  city?: string | null;
  mode?: string;
  poster?: unknown;
  refundPolicy?: string | null;
  supportEmail?: string | null;
};

export type CheckoutTicketType = {
  id: string;
  name: string;
  minPerOrder: number;
  maxPerOrder: number;
};

type Props = {
  eventId: string;
  eventSlug: string;
  buyerName: string;
  buyerEmail: string;
  types: CheckoutTicketType[];
  cashfreeMode: "sandbox" | "production";
  whatsappAvailable?: boolean;
  event: CheckoutEvent;
  initialCart?: Record<string, number>;
};

type CashfreeWindow = Window & {
  Cashfree?: (input: { mode: "sandbox" | "production" }) => {
    checkout(input: {
      paymentSessionId: string;
      redirectTarget: "_self";
    }): Promise<{ error?: { message?: string } } | undefined>;
  };
};

export function CheckoutForm({
  eventId,
  eventSlug,
  buyerName,
  buyerEmail,
  types,
  cashfreeMode,
  whatsappAvailable = false,
  event,
  initialCart,
}: Props) {
  const router = useRouter();
  const storage = `checkout:${eventId}`;

  const [cart, setCart] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return initialCart || {};
    try {
      const rawStored: unknown = JSON.parse(
        sessionStorage.getItem(`cart:${eventId}`) || "null",
      );
      if (
        rawStored &&
        typeof rawStored === "object" &&
        !Array.isArray(rawStored)
      ) {
        const parsed = Object.fromEntries(
          Object.entries(rawStored).filter(
            ([, value]) =>
              Number.isInteger(value) &&
              Number(value) > 0 &&
              Number(value) <= 100,
          ),
        );
        if (Object.keys(parsed).length > 0) return parsed;
      }
    } catch {}
    return initialCart || {};
  });

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);

  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return buyerName;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || "{}");
      return typeof saved.name === "string" && saved.name
        ? saved.name
        : buyerName;
    } catch {
      return buyerName;
    }
  });

  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || "{}");
      return typeof saved.phone === "string" ? saved.phone : "";
    } catch {
      return "";
    }
  });

  const [consent, setConsent] = useState(() => {
    if (typeof window === "undefined") return Boolean(whatsappAvailable);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || "{}");
      return typeof saved.consent === "boolean"
        ? saved.consent && Boolean(whatsappAvailable)
        : Boolean(whatsappAvailable);
    } catch {
      return Boolean(whatsappAvailable);
    }
  });

  const [names, setNames] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || "{}");
      return Array.isArray(saved.names) ? saved.names : [];
    } catch {
      return [];
    }
  });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const key = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selection = types.flatMap((type) =>
    cart?.[type.id] ? [{ ticketTypeId: type.id, quantity: cart[type.id] }] : [],
  );
  const selectionKey = JSON.stringify(selection);
  const current = order || quote;
  const count = current?.items.reduce((n, item) => n + item.quantity, 0) || 0;
  const digits = phone.replace(/\D/g, "");
  const parsedPhone = parsePhoneNumberFromString(digits, "IN");
  const phoneRequired = consent || Boolean(current?.totalPaise);
  const invalidPhone =
    phoneRequired && (!parsedPhone?.isValid() || parsedPhone.country !== "IN");
  const expired = Boolean(
    order &&
      (order.status === "EXPIRED" ||
        new Date(order.expiresAt).getTime() <= now),
  );
  const seconds = order
    ? Math.max(0, Math.ceil((new Date(order.expiresAt).getTime() - now) / 1000))
    : 0;
  const closed = Boolean(order && order.status !== "PENDING");

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || "{}");
      key.current = typeof saved.key === "string" ? saved.key : null;
      if (saved.orderId) {
        let active = true;
        fetch(`/api/orders/${encodeURIComponent(saved.orderId)}/checkout`)
          .then(async (response) => {
            const data = await response.json();
            if (!active) return;
            if (!response.ok)
              throw new Error(
                data.error || "Could not restore your reservation. Try again.",
              );
            setOrder(data);
            if (["PAID", "PARTIALLY_REFUNDED"].includes(data.status)) {
              router.replace(`/orders/${data.id}`);
            }
          })
          .catch((cause) => {
            if (active) setError(cause.message);
          });
        return () => {
          active = false;
        };
      }
    } catch {}
  }, [storage, router]);

  useEffect(() => {
    if (!cart || selectionKey === "[]" || order) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const response = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            items: JSON.parse(selectionKey),
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Could not check ticket availability.",
          );
        setQuote(data);
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setQuote(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not check availability.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [eventId, selectionKey, retry, order, cart]);

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [order]);

  function persist(active = order) {
    sessionStorage.setItem(
      storage,
      JSON.stringify({
        key: key.current,
        orderId: active?.id,
        name,
        phone,
        consent,
        names,
      }),
    );
  }

  function changeQuantity(id: string, value: number) {
    if (order || busy) return;
    const next = { ...cart, [id]: value };
    setQuote(null);
    setCart(next);
    key.current = null;
    sessionStorage.setItem(`cart:${eventId}`, JSON.stringify(next));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || quoting) return;
    if (name.trim().length < 2 || invalidPhone) {
      setError(
        name.trim().length < 2
          ? "Enter your full name."
          : "Enter a valid 10-digit Indian mobile number.",
      );
      formRef.current
        ?.querySelector<HTMLInputElement>(
          name.trim().length < 2 ? "#checkout-name" : "#checkout-phone",
        )
        ?.focus();
      return;
    }
    if (!current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!order) {
        key.current ||= crypto.randomUUID();
        persist();
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            idempotencyKey: key.current,
            buyerName: name.trim(),
            buyerPhone: parsedPhone?.isValid()
              ? parsedPhone.number
              : undefined,
            whatsappOptIn: consent,
            ...(names.some((n) => n.trim())
              ? {
                  attendeeNames: Array.from(
                    { length: count },
                    (_, i) => names[i]?.trim() || name.trim(),
                  ),
                }
              : {}),
            items: selection,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error ||
              "Could not reserve tickets. Your details are saved; please retry.",
          );
        setOrder(data);
        persist(data);
        if (data.status === "PAID") {
          router.push(`/orders/${data.id}`);
          return;
        }
        setNotice(
          "Your tickets are reserved. Check your total, then continue to secure payment.",
        );
        return;
      }
      if (expired || order.status !== "PENDING")
        throw new Error(
          "This reservation is no longer payable. Start again to check availability.",
        );
      const cashfree = (window as CashfreeWindow).Cashfree;
      if (!cashfree || !order.paymentSessionId)
        throw new Error(
          "Secure payment is unavailable. Your reservation is saved; retry shortly.",
        );
      const result = await cashfree({ mode: cashfreeMode }).checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_self",
      });
      if (result?.error)
        throw new Error(
          result.error.message ||
            "Payment was not completed. You can retry while your reservation is valid.",
        );
      setNotice(
        "Payment window closed. If you paid, check payment status before trying again.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not continue. Your details are saved.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (inFlight.current) return;
    if (!order) {
      router.push(`/e/${eventSlug}`);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            "Your reservation remains active until expiry. You can return to the event.",
        );
      if (data.status === "PAID") router.push(`/orders/${order.id}`);
      else {
        sessionStorage.removeItem(storage);
        router.push(`/e/${eventSlug}`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not cancel your reservation.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function switchAccount() {
    persist();
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      router.push(`/login?next=${encodeURIComponent(`/checkout/${eventSlug}`)}`);
    } catch {
      setError("Could not switch account. Please retry.");
      setBusy(false);
    }
  }

  function startAgain() {
    sessionStorage.removeItem(storage);
    key.current = null;
    setOrder(null);
    setQuote(null);
    setError("");
    setNotice("");
    setRetry((n) => n + 1);
  }

  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));

  const buttonText = busy
    ? "Please wait…"
    : !current
      ? "Checking availability…"
      : !current.totalPaise
        ? "Get tickets"
        : order
          ? `Pay ${formatMoney(current.totalPaise)}`
          : "Review & reserve tickets";

  const disabled =
    busy ||
    quoting ||
    !current ||
    expired ||
    closed ||
    Boolean(order && !ready);

  const displayLines: CheckoutItem[] =
    current?.items ||
    selection.map((item) => {
      const type = types.find((t) => t.id === item.ticketTypeId);
      return {
        ticketTypeId: item.ticketTypeId,
        name: type?.name || "Ticket",
        quantity: item.quantity,
        unitPricePaise: 0,
        lineTotalPaise: 0,
      };
    });

  return (
    <>
      <header className="co-header">
        <Link href="/" aria-label="Raunak home" className="co-brand">
          <BrandMark className="co-logo" />
          <span>Raunak</span>
        </Link>
        <span className="co-secure">
          <LockKeyhole size={15} /> Secure checkout
        </span>
        <button type="button" onClick={cancel} disabled={busy}>
          Cancel
        </button>
      </header>

      <main className="co-main">
        <Link className="co-back" href={`/e/${eventSlug}#tickets`}>
          <ArrowLeft size={15} /> Back to event
        </Link>

        <div className="co-heading">
          <h1>Checkout</h1>
          <ol aria-label="Checkout steps">
            <li aria-current={!order ? "step" : undefined}>1 Details</li>
            <li aria-current={order ? "step" : undefined}>2 Payment</li>
            <li>3 Tickets</li>
          </ol>
        </div>

        {cart && !selection.length ? (
          <section className="co-empty">
            <Ticket size={28} />
            <h2>Choose your tickets first</h2>
            <p>
              Your selection is empty. Return to the event to find your place.
            </p>
            <Link className="co-primary" href={`/e/${eventSlug}#tickets`}>
              Choose tickets
            </Link>
          </section>
        ) : (
          <div className="co-grid">
            <details className="co-summary" open>
              <summary>
                Order summary{" "}
                <span>
                  {count || "—"} tickets ·{" "}
                  {current ? formatMoney(current.totalPaise) : "Checking…"}
                </span>
                <ChevronDown size={16} />
              </summary>
              <div className="co-summary-body">
                <div className="co-event">
                  <div className="co-poster">
                    <EventImage
                      variants={event.poster}
                      alt={`${event.title} poster`}
                      size="thumb"
                    />
                  </div>
                  <div>
                    <p className="co-kicker">Your next good plan</p>
                    <h2>{event.title}</h2>
                    <p>
                      {date} ·{" "}
                      {event.timezone === "Asia/Kolkata"
                        ? "IST"
                        : event.timezone}
                    </p>
                    <p>
                      {event.mode === "ONLINE"
                        ? "Online event"
                        : [event.venueName, event.city]
                            .filter(Boolean)
                            .join(" · ") ||
                          "Venue details on the event page"}
                    </p>
                  </div>
                </div>

                <div className="co-lines" aria-busy={quoting}>
                  {displayLines.map((item) => {
                    const type = types.find(
                      (t) => t.id === item.ticketTypeId,
                    );
                    const minQty = type?.minPerOrder || 1;
                    const maxQty = Math.min(
                      type?.maxPerOrder || 100,
                      typeof item.available === "number"
                        ? item.available
                        : 100,
                    );
                    return (
                      <div className="co-line" key={item.ticketTypeId}>
                        <div>
                          <strong>
                            {item.name} × {item.quantity}
                          </strong>
                          <small>
                            {current
                              ? formatMoney(item.unitPricePaise)
                              : "Checking price"}{" "}
                            per ticket
                          </small>
                          {!order && (
                            <div className="co-stepper">
                              <button
                                type="button"
                                aria-label={`Remove one ${item.name}`}
                                disabled={busy || item.quantity <= minQty}
                                onClick={() =>
                                  changeQuantity(
                                    item.ticketTypeId,
                                    item.quantity - 1,
                                  )
                                }
                              >
                                <Minus size={14} />
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                aria-label={`Add one ${item.name}`}
                                disabled={busy || item.quantity >= maxQty}
                                onClick={() =>
                                  changeQuantity(
                                    item.ticketTypeId,
                                    item.quantity + 1,
                                  )
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <strong>
                          {current
                            ? formatMoney(item.lineTotalPaise)
                            : "—"}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                <div className="co-totals" aria-live="polite">
                  <p>
                    <span>Subtotal</span>
                    <span>
                      {current ? formatMoney(current.subtotalPaise) : "—"}
                    </span>
                  </p>
                  {Boolean(current?.feePaise) && (
                    <p>
                      <span>Booking fee</span>
                      <span>{formatMoney(current!.feePaise)}</span>
                    </p>
                  )}
                  <p className="co-total">
                    <strong>Total</strong>
                    <strong>
                      {current ? formatMoney(current.totalPaise) : "—"}
                    </strong>
                  </p>
                  <small>All applicable charges included.</small>
                </div>

                {order ? (
                  <div
                    className={`co-hold ${expired ? "is-expired" : ""}`}
                  >
                    <Clock3 size={16} />
                    <span>
                      {expired
                        ? "Reservation expired"
                        : `Tickets held for ${Math.floor(seconds / 60)
                            .toString()
                            .padStart(2, "0")}:${(seconds % 60)
                            .toString()
                            .padStart(2, "0")}`}
                    </span>
                    <span className="co-sr" role="status">
                      {expired
                        ? "Your reservation has expired."
                        : seconds <= 120
                          ? "Less than two minutes remain. Complete payment soon."
                          : "Your tickets are reserved."}
                    </span>
                  </div>
                ) : (
                  <p className="co-quiet">
                    <Clock3 size={15} /> Availability checked before reservation.
                  </p>
                )}

                <p className="co-delivery">
                  <Check size={15} />
                  <span>
                    {count || "Your"} tickets sent to{" "}
                    <strong>{buyerEmail}</strong>
                    {consent && " and your WhatsApp number"} after confirmation.
                  </span>
                </p>
                {order && (
                  <Link
                    className="co-back"
                    href={`/e/${eventSlug}#tickets`}
                  >
                    Return to event
                  </Link>
                )}
              </div>
            </details>

            <div className="co-details">
              {error && (
                <div className="co-feedback co-error" role="alert">
                  <strong>Let’s sort that out</strong>
                  <p>{error}</p>
                  {!order && (
                    <button
                      type="button"
                      onClick={() => setRetry((n) => n + 1)}
                    >
                      Check availability again
                    </button>
                  )}
                  {/sign|session|auth/i.test(error) && (
                    <Link
                      onClick={() => persist()}
                      href={`/login?next=${encodeURIComponent(`/checkout/${eventSlug}`)}`}
                    >
                      Sign in again
                    </Link>
                  )}
                </div>
              )}
              {notice && (
                <div className="co-feedback" role="status">
                  {notice}
                </div>
              )}

              {expired || closed ? (
                <section className="co-empty">
                  <Clock3 size={24} />
                  <h2>
                    {expired
                      ? "Your reservation has expired"
                      : "This reservation is no longer payable"}
                  </h2>
                  <p>
                    Your selection is saved. Check availability again to make a
                    new reservation.
                  </p>
                  <button
                    type="button"
                    className="co-primary"
                    onClick={startAgain}
                  >
                    Start again
                  </button>
                  <Link href={`/orders/${order?.id}`}>
                    Check payment status
                  </Link>
                </section>
              ) : (
                <form
                  id="checkout-details"
                  ref={formRef}
                  onSubmit={submit}
                  noValidate
                >
                  <fieldset disabled={busy || Boolean(order)}>
                    <legend>Your details</legend>
                    <p className="co-section-note">
                      A few details. Then you’re on your way.
                    </p>

                    <label htmlFor="checkout-name">Full name</label>
                    <input
                      id="checkout-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      aria-invalid={
                        error.includes("full name") || undefined
                      }
                    />

                    <label htmlFor="checkout-email">Email address</label>
                    <input
                      id="checkout-email"
                      name="email"
                      value={buyerEmail}
                      readOnly
                      autoComplete="email"
                      aria-describedby="co-email-hint"
                    />
                    <div id="co-email-hint" className="co-hint">
                      Tickets go to your account email.{" "}
                      {!order && (
                        <button type="button" onClick={switchAccount}>
                          Not you? Switch account
                        </button>
                      )}
                    </div>

                    <label htmlFor="checkout-phone">
                      Mobile number {!phoneRequired && <span>(optional)</span>}
                    </label>
                    <div className="co-phone">
                      <span aria-label="India country code">IN +91</span>
                      <input
                        id="checkout-phone"
                        name="phone"
                        type="tel"
                        value={
                          digits.length > 5
                            ? `${digits.slice(0, 5)} ${digits.slice(5)}`
                            : digits
                        }
                        onChange={(e) =>
                          setPhone(
                            e.target.value.replace(/\D/g, "").slice(0, 10),
                          )
                        }
                        autoComplete="tel-national"
                        inputMode="tel"
                        placeholder="10-digit mobile number"
                        required={phoneRequired}
                        aria-describedby="co-phone-hint"
                        aria-invalid={
                          (digits.length > 0 && invalidPhone) || undefined
                        }
                      />
                    </div>
                    <p id="co-phone-hint" className="co-hint">
                      {current?.totalPaise
                        ? "Cashfree requires a mobile number for payment."
                        : "Add your number to receive tickets on WhatsApp."}{" "}
                      {consent
                        ? "We’ll also send your tickets and event updates here."
                        : "Your tickets will still arrive by email."}
                    </p>

                    {whatsappAvailable && (
                      <label className="co-check">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          name="whatsappOptIn"
                        />
                        <span>
                          Send my ticket and updates on WhatsApp
                          <small>
                            Optional. You can still book without WhatsApp.
                          </small>
                        </span>
                      </label>
                    )}

                    {count > 1 && (
                      <details className="co-attendees">
                        <summary>
                          Add attendee names (optional)
                          <ChevronDown size={15} />
                        </summary>
                        {Array.from({ length: count }, (_, i) => (
                          <label key={i}>
                            Attendee {i + 1}
                            <input
                              value={names[i] || ""}
                              onChange={(e) =>
                                setNames((previous) => {
                                  const next = [...previous];
                                  next[i] = e.target.value;
                                  return next;
                                })
                              }
                              placeholder={name || "Ticket holder name"}
                              maxLength={100}
                            />
                          </label>
                        ))}
                        <p className="co-hint">
                          Leave blank to use the booking name.
                        </p>
                      </details>
                    )}
                  </fieldset>

                  <section className="co-payment">
                    <h2>
                      {current?.totalPaise
                        ? "A secure way to your next plan"
                        : "You’re on the guest list"}
                    </h2>
                    <p>
                      {current?.totalPaise
                        ? "After reserving, you’ll continue to Cashfree’s secure checkout. Available payment options are shown there."
                        : "No payment needed. Confirm your details to receive your tickets."}
                    </p>
                    {event.refundPolicy && (
                      <details>
                        <summary>Event refund policy</summary>
                        <p>{event.refundPolicy}</p>
                      </details>
                    )}
                    <p className="co-hint">
                      By {current?.totalPaise ? "paying" : "registering"}, you
                      agree to our{" "}
                      <Link href="/terms" target="_blank">
                        Terms
                      </Link>{" "}
                      and the event’s refund policy. Your tickets arrive after
                      the booking is confirmed.
                    </p>
                  </section>

                  <div className="co-action">
                    <div>
                      <small>Total</small>
                      <strong>
                        {current ? formatMoney(current.totalPaise) : "—"}
                      </strong>
                    </div>
                    <button
                      className="co-primary"
                      disabled={disabled}
                      type="submit"
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="co-spin" />
                      ) : current?.totalPaise ? (
                        <LockKeyhole size={16} />
                      ) : (
                        <Ticket size={17} />
                      )}
                      {buttonText}
                    </button>
                  </div>

                  {order && (
                    <Link
                      className="co-status"
                      href={`/orders/${order.id}`}
                    >
                      Already paid? Check payment status
                    </Link>
                  )}
                </form>
              )}

              <p className="co-support">
                Need a hand?{" "}
                {event.supportEmail && (
                  <>
                    <a href={`mailto:${event.supportEmail}`}>
                      Contact the organizer
                    </a>
                    <span> · </span>
                  </>
                )}
                <Link href="/contact">Raunak support</Link>
              </p>
            </div>
          </div>
        )}
      </main>

      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            "Secure payment could not load. Your details are saved. Refresh to retry.",
          )
        }
      />
    </>
  );
}
