import Link from "next/link";
import type { Metadata } from "next";
import { publicEvent } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { CheckoutForm } from "@/components/public/checkout-form";
import { whatsappTemplate } from "@/server/notifications/templates";
import { resolvedTemplate } from "@/server/notifications/service";
import { resolveWhatsApp } from "@/server/whatsapp/routing";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = await publicEvent((await params).slug);
  return { title: `Checkout${event ? ` · ${event.title}` : ""} | Raunak`, robots: { index: false, follow: false } };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tickets?: string }>;
}) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : undefined;
  const event = await publicEvent(slug);
  if (!event || event.status !== "PUBLISHED" || event.endsAt <= new Date())
    return (
      <main className="co-main co-empty">
        <h1>Booking isn’t available</h1>
        <p>This event may have ended or is no longer open for booking.</p>
        <Link href="/discover" className="co-primary">
          Explore events
        </Link>
      </main>
    );

  let initialCart: Record<string, number> | undefined;
  if (search?.tickets) {
    try {
      const raw = JSON.parse(search.tickets);
      if (Array.isArray(raw)) {
        initialCart = Object.fromEntries(
          raw
            .filter(
              (item): item is { ticketTypeId: string; quantity: number } =>
                Boolean(
                  item &&
                    typeof item.ticketTypeId === "string" &&
                    typeof item.quantity === "number" &&
                    item.quantity > 0,
                ),
            )
            .map((item) => [item.ticketTypeId, item.quantity]),
        );
      } else if (raw && typeof raw === "object") {
        initialCart = Object.fromEntries(
          Object.entries(raw).filter(
            ([, q]) => typeof q === "number" && q > 0,
          ) as [string, number][],
        );
      }
    } catch {}
  }

  const user = await currentUser();
  const delivery = await Promise.all(
    (["ORDER_CONFIRMED", "TICKET_ISSUED"] as const).map(async (trigger) => {
      try {
        const route = await resolveWhatsApp(event.orgId);
        if (route.kind === "official") whatsappTemplate(trigger);
        const setting = await resolvedTemplate(
          event.orgId,
          event.id,
          trigger,
          "WHATSAPP",
        );
        return Boolean(
          (route.kind === "gateway" ||
            (process.env.WHATSAPP_CLOUD_TOKEN &&
              process.env.WHATSAPP_PHONE_NUMBER_ID)) &&
          setting?.isEnabled !== false,
        );
      } catch {
        return false;
      }
    }),
  );
  return (
    <>
      <div>
        {user ? (
          <CheckoutForm
            eventId={event.id}
            eventSlug={slug}
            buyerName={user.name || ""}
            buyerEmail={user.email}
            whatsappAvailable={delivery.some(Boolean)}
            initialCart={initialCart}
            types={event.ticketTypes
              .filter((type) => !type.isHidden)
              .map((type) => ({
                id: type.id,
                name: type.name,
                minPerOrder: type.minPerOrder,
                maxPerOrder: type.maxPerOrder,
              }))}
            event={{
              title: event.title,
              startsAt: event.startsAt.toISOString(),
              timezone: event.timezone,
              venueName: event.venueName,
              city: event.city,
              mode: event.mode,
              refundPolicy: event.refundPolicy,
              poster:
                event.images.find((image) => image.kind === "POSTER")
                  ?.variants || event.images[0]?.variants,
            }}
            cashfreeMode={
              process.env.CASHFREE_ENV === "production"
                ? "production"
                : "sandbox"
            }
          />
        ) : (
          <main className="co-main co-empty">
            <h1>Your tickets are one step away</h1>
            <p>Sign in to continue. Your ticket selection stays saved on this device.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`}
              className="co-primary"
            >
              Sign in
            </Link>
          </main>
        )}
      </div>
    </>
  );
}
