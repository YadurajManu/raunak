import Link from "next/link";
import { ResendTickets } from "@/components/public/resend-tickets";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { reconcileOrder } from "@/server/checkout/service";
import { formatInr } from "@/lib/money";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  const found = await db.order.findFirst({
    where: { id, buyerId: user.id },
    include: {
      event: true,
      items: { include: { ticketType: true } },
      tickets: true,
      notificationLogs:{where:{channel:"EMAIL",trigger:{in:["ORDER_CONFIRMED","TICKET_ISSUED"]}},select:{status:true}},
    },
  });
  if (!found) notFound();
  const order =
    found.status === "PENDING" && found.cashfreeOrderId
      ? await reconcileOrder(found.id)
      : found;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <Link
        href="/my-tickets"
        className="text-sm text-[var(--accent)] dark:text-[var(--accent)]"
      >
        My tickets
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">
        {order.status === "PAID"
          ? "Order confirmed"
          : order.status === "PENDING"
            ? "Payment pending"
            : "Order not completed"}
      </h1>
      <p className="mt-3 text-[var(--muted)] dark:text-[var(--muted)]">
        {found.event.title} · {formatInr(found.totalPaise)}
      </p>
      <p className="mt-2 text-sm text-zinc-500">Order {found.id}</p>
      {order.status === "PENDING" && (
        <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Payment is being confirmed. Refresh this page in a moment.
        </p>
      )}
      {order.status === "PAID" && (
        <div className="mt-8 space-y-3">
          <section className="r-booking-delivery"><h2>Receipt & tickets</h2><p>{found.notificationLogs.some(log=>log.status === "FAILED") ? "Email delivery needs another try. You can resend below or download your tickets." : found.notificationLogs.length && found.notificationLogs.every(log=>["SENT","DELIVERED","READ"].includes(log.status)) ? "Your confirmation and tickets have been sent." : "Your confirmation and QR tickets are being prepared for email."}</p><small>Delivery address: {found.buyerEmail}. Your tickets are also available in My tickets.</small></section>
          {found.items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="rounded-xl border border-[var(--line)] p-4 dark:border-[var(--line)]"
            >
              {item.quantity} × {item.ticketType.name}
            </div>
          ))}
          <Link
            href="/my-tickets"
            className="inline-block rounded-xl bg-[var(--accent)] px-5 py-3 font-medium text-[#14120f]"
          >
            View tickets
          </Link>
          <ResendTickets orderId={found.id} />
        </div>
      )}
    </main>
  );
}
