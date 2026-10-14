import Link from "next/link";
import { notFound } from "next/navigation";
import { publicEvent } from "@/server/public/events";
import { currentUser } from "@/server/auth/session";
import { CheckoutForm } from "@/components/public/checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  if (!event) notFound();
  const user = await currentUser();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link
        href={`/e/${slug}`}
        className="text-sm text-orange-700 dark:text-orange-400"
      >
        ← Back to event
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">Checkout</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{event.title}</p>
      {user ? (
        <CheckoutForm
          eventId={event.id}
          eventSlug={slug}
          buyerName={user.name || ""}
          buyerEmail={user.email}
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
            process.env.CASHFREE_ENV === "production" ? "production" : "sandbox"
          }
        />
      ) : (
        <div className="mt-8 rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
          <p>Sign in to continue with your tickets.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`}
            className="mt-5 inline-block rounded-xl bg-orange-700 px-5 py-3 text-white"
          >
            Sign in
          </Link>
        </div>
      )}
    </main>
  );
}
