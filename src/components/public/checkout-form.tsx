"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatInr } from "@/lib/money";

const emptyCart: Record<string, number> = {};
let lastCartKey = "";
let lastCartRaw = "";
let lastCart: Record<string, number> = emptyCart;
function cartSnapshot(eventId: string) {
  const raw = sessionStorage.getItem(`cart:${eventId}`) || "{}";
  if (eventId !== lastCartKey || raw !== lastCartRaw) {
    lastCartKey = eventId;
    lastCartRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      lastCart =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.values(parsed).every(
          (value) =>
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 10,
        )
          ? parsed
          : emptyCart;
    } catch {
      lastCart = emptyCart;
    }
  }
  return lastCart;
}

type Type = {
  id: string;
  name: string;
  pricePaise: number;
  minPerOrder: number;
  maxPerOrder: number;
};
type CashfreeWindow = Window & {
  Cashfree?: (input: { mode: "sandbox" | "production" }) => {
    checkout(input: {
      paymentSessionId: string;
      redirectTarget: "_self";
    }): Promise<unknown>;
  };
};
export function CheckoutForm({
  eventId,
  eventSlug,
  buyerName,
  buyerEmail,
  types,
  feeBps,
  feeFixedPaise,
  feeMode,
  cashfreeMode,
}: {
  eventId: string;
  eventSlug: string;
  buyerName: string;
  buyerEmail: string;
  types: Type[];
  feeBps: number;
  feeFixedPaise: number;
  feeMode: "ABSORB" | "PASS_TO_BUYER";
  cashfreeMode: "sandbox" | "production";
}) {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cart = useSyncExternalStore(
    () => () => {},
    () => cartSnapshot(eventId),
    () => emptyCart,
  );
  const items = types
    .filter((type) => cart[type.id] > 0)
    .map((type) => ({ ...type, quantity: cart[type.id] }));
  const subtotal = items.reduce(
    (sum, item) => sum + item.pricePaise * item.quantity,
    0,
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const fee = subtotal
    ? Math.round((subtotal * feeBps) / 10000) + feeFixedPaise * count
    : 0;
  const total = subtotal + (feeMode === "PASS_TO_BUYER" ? fee : 0);
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      if (!key.current) key.current = crypto.randomUUID();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          idempotencyKey: key.current,
          buyerName: String(form.get("name")),
          buyerPhone: String(form.get("phone")),
          whatsappOptIn: Boolean(form.get("whatsappOptIn")),
          items: items.map((item) => ({
            ticketTypeId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const order = await response.json();
      if (!response.ok)
        throw new Error(order.error || "Could not create order.");
      if (order.status === "PAID") {
        router.push(`/orders/${order.id}`);
        return;
      }
      if (order.status !== "PENDING") {
        key.current = null;
        throw new Error(
          "This order is no longer payable. Submit again to start a new order.",
        );
      }
      if (!order.paymentSessionId)
        throw new Error("Payment session is unavailable. Please retry.");
      const cashfree = (window as CashfreeWindow).Cashfree;
      if (!cashfree)
        throw new Error("Payment checkout is loading. Please retry.");
      await cashfree({ mode: cashfreeMode }).checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not continue checkout.",
      );
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <div className="mt-8 rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
        Your selection is empty.{" "}
        <a
          href={`/e/${eventSlug}#tickets`}
          className="text-orange-700 underline"
        >
          Choose tickets
        </a>
        .
      </div>
    );
  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            "Payment checkout could not load. Refresh this page to retry.",
          )
        }
      />
      <form action={submit} className="space-y-5">
        <label className="block text-sm font-medium">
          Full name
          <input
            name="name"
            defaultValue={buyerName}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            value={buyerEmail}
            readOnly
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm font-medium">
          Mobile number
          <input
            name="phone"
            type="tel"
            pattern="[6-9][0-9]{9}"
            inputMode="numeric"
            required
            placeholder="9876543210"
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="whatsappOptIn" className="mt-1" />
          Send my tickets and event updates to this number on WhatsApp
          (optional).
        </label>
        <button
          disabled={busy || (total > 0 && !ready)}
          className="w-full rounded-xl bg-orange-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : total
              ? `Pay ${formatInr(total)}`
              : "Confirm free tickets"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
      <aside className="h-fit rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">Order summary</h2>
        {items.map((item) => (
          <div
            key={item.id}
            className="mt-4 flex justify-between gap-4 text-sm"
          >
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatInr(item.pricePaise * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-5 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatInr(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>
              Platform fee {feeMode === "ABSORB" ? "(organizer pays)" : ""}
            </span>
            <span>{feeMode === "ABSORB" ? formatInr(0) : formatInr(fee)}</span>
          </div>
          <div className="mt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
