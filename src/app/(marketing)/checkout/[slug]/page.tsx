import { PublicHeader } from "@/components/public/public-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicEvent } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { CheckoutForm } from "@/components/public/checkout-form";
import { whatsappTemplate } from "@/server/notifications/templates";
import { resolvedTemplate } from "@/server/notifications/service";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  if (!event) notFound();
  const user = await currentUser();
  const delivery = await Promise.all((["ORDER_CONFIRMED", "TICKET_ISSUED"] as const).map(async trigger => {
    try {
      whatsappTemplate(trigger);
      const setting = await resolvedTemplate(event.orgId, event.id, trigger, "WHATSAPP");
      return Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && setting?.isEnabled !== false);
    } catch { return false; }
  }));
  return (
    <>
      <PublicHeader />
      <main className="r-checkout mx-auto min-h-screen max-w-3xl px-6 py-10">
        <Link
          href={`/e/${slug}`}
          className="text-sm text-[var(--accent)] dark:text-[var(--accent)]"
        >
          ← Back to event
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Checkout</h1>
        <p className="mt-2 text-[var(--muted)] dark:text-[var(--muted)]">
          {event.title}
        </p>
        {user ? (
          <CheckoutForm
            eventId={event.id}
            eventSlug={slug}
            buyerName={user.name || ""}
            buyerEmail={user.email}
          whatsappAvailable={delivery.some(Boolean)}
            types={event.ticketTypes.map((type) => ({
              id: type.id,
              name: type.name,
              pricePaise: type.pricePaise,
              minPerOrder: type.minPerOrder,
              maxPerOrder: type.maxPerOrder,
            }))}
            feeBps={event.org.platformFeeBps}
            feeFixedPaise={event.org.platformFeeFixedPaise}
            feeMode={event.org.feeMode}
            cashfreeMode={
              process.env.CASHFREE_ENV === "production"
                ? "production"
                : "sandbox"
            }
          />
        ) : (
          <div className="mt-8 rounded-2xl border border-[var(--line)] p-8 dark:border-[var(--line)]">
            <p>Sign in to continue with your tickets.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`}
              className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-5 py-3 text-[#14120f]"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
