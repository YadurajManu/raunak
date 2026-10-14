import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { reconcileOrder } from "@/server/checkout/service";
import { formatInr } from "@/lib/money";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = (await params).id;
  const found = await db.order.findFirst({
    where: { id, buyerId: user.id },
    include: {
      event: true,
      items: { include: { ticketType: true } },
      tickets: true,
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
        className="text-sm text-orange-700 dark:text-orange-400"
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
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
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
          {found.items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              {item.quantity} × {item.ticketType.name}
            </div>
          ))}
          <Link
            href="/my-tickets"
            className="inline-block rounded-xl bg-orange-700 px-5 py-3 font-medium text-white"
          >
            View tickets
          </Link>
        </div>
      )}
    </main>
  );
}
