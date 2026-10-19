import Link from "next/link";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { redirect } from "next/navigation";
import { formatInr } from "@/lib/money";
import { EventActions } from "@/components/dashboard/event-actions";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { eventQuality } from "@/lib/event-quality";

export default async function EventOverview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let access;
  try {
    access = await requireEventAccessForUser(user.id, id, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "FINANCE",
    ]);
  } catch {
    redirect("/dashboard");
  }
  const member = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId: user.id } },
  });
  const canRefund = ["OWNER", "ADMIN", "FINANCE"].includes(member.role);
  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(member.role);
  const query = await searchParams;
  const q = (query.q || "").trim().slice(0, 100);
  const status = [
    "PAID",
    "PENDING",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
    "REFUNDED",
  ].includes(query.status || "")
    ? (query.status as
        "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED")
    : undefined;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.page || "1") || 1),
  );
  const where = {
    eventId: id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { buyerName: { contains: q, mode: "insensitive" as const } },
            { buyerEmail: { contains: q, mode: "insensitive" as const } },
            { buyerPhone: { contains: q } },
          ],
        }
      : {}),
  };
  const [event, collected, refunds, checkedIn, totalOrders, orders] =
    await Promise.all([
      db.event.findUniqueOrThrow({
        where: { id },
        include: {
          ticketTypes: true,
          images: true,
          org: {
            select: { name: true, supportEmail: true, supportPhone: true },
          },
        },
      }),
      db.payment.aggregate({
        where: { status: "SUCCESS", order: { eventId: id } },
        _sum: { amountPaise: true },
      }),
      db.refund.groupBy({
        by: ["status"],
        where: { payment: { order: { eventId: id } } },
        _sum: { amountPaise: true },
        _count: true,
      }),
      db.ticket.count({ where: { eventId: id, checkedInAt: { not: null } } }),
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 25,
        skip: (page - 1) * 25,
        include: {
          items: { include: { ticketType: { select: { name: true } } } },
          payments: { include: { refunds: true } },
          notificationLogs: {
            where: { channel: "EMAIL" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);
  const sold = event.ticketTypes.reduce(
    (sum, type) => sum + type.quantitySold,
    0,
  );
  const held = event.ticketTypes.reduce(
    (sum, type) => sum + type.quantityHeld,
    0,
  );
  const inventory = event.ticketTypes.reduce(
    (sum, type) => sum + type.quantityTotal,
    0,
  );
  const remaining = Math.max(
    0,
    Math.min(inventory, event.capacity ?? inventory) - sold - held,
  );
  const gross = collected._sum.amountPaise || 0;
  const refunded =
    refunds.find((row) => row.status === "SUCCESS")?._sum.amountPaise || 0;
  const processing = refunds
    .filter((row) => row.status !== "SUCCESS")
    .reduce((sum, row) => sum + (row._sum.amountPaise || 0), 0);
  const href = (next: number) =>
    `?q=${encodeURIComponent(q)}&status=${status || ""}&page=${next}#bookings`;
  return (
    <main className="ops-page">
      <header className="ops-heading">
        <div>
          <p className="m-eyebrow">{event.status}</p>
          <h1>{event.title}</h1>
          <p>
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: event.timezone,
            }).format(event.startsAt)}{" "}
            · {event.venueName || event.city || "Venue to be announced"}
          </p>
        </div>
        {canManage && (
          <EventActions
            eventId={id}
            status={event.status}
            reviewNote={event.reviewNote}
          />
        )}
      </header>
      <div className="ops-metrics">
        {[
          ["Payments received", formatInr(gross)],
          ["Completed refunds", formatInr(refunded)],
          ["Net collected", formatInr(gross - refunded)],
          ["Tickets confirmed", String(sold)],
          ["Available", String(remaining)],
          ["Checked in", String(checkedIn)],
        ].map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className="ops-note">
        {held} tickets reserved during checkout · {formatInr(processing)} in
        pending or failed refunds. Financial totals include fees, before gateway
        charges and organizer settlements.
      </p>
      {event.status === "PENDING_REVIEW" && (
        <div className="ops-notice" role="status">
          <h2>With the Raunak review team</h2>
          <p>Your event is saved and will appear publicly after it is approved.</p>
        </div>
      )}
      {(event.status === "NEEDS_CHANGES" || event.status === "REJECTED") && (
        <div className="ops-notice" role="status">
          <h2>{event.status === "REJECTED" ? "Review decision" : "A few updates are needed"}</h2>
          <p>{event.reviewNote || "Open the event details, make the requested updates, then resubmit for review."}</p>
        </div>
      )}
      {event.status === "CANCELLED" && (
        <div className="ops-notice">
          <h2>Event cancelled</h2>
          <p>
            Sales and check-in are closed. Customer cancellation updates are
            queued automatically. Review confirmed bookings below and request
            refunds according to your policy.
          </p>
        </div>
      )}
      {canManage && eventQuality(event).length > 0 && (
        <details className="ops-notice">
          <summary>
            Event quality · {eventQuality(event).length} things to review
          </summary>
          <ul>
            {eventQuality(event).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p>
            Content and image recommendations are advisory. Preview your event
            before publishing.
          </p>
        </details>
      )}
      <section className="ops-section">
        <div className="ops-section-heading">
          <h2>Ticket inventory</h2>
          <div className="ops-links">
            {canManage && (
              <Link href={`/dashboard/events/${id}/tickets`}>
                Manage tickets ↗
              </Link>
            )}
            <Link href={`/dashboard/events/${id}/attendees`}>Attendees ↗</Link>
            {event.status === "PUBLISHED" && (
              <Link href={`/e/${event.slug}`}>Public event ↗</Link>
            )}
          </div>
        </div>
        {event.ticketTypes.length ? (
          <div className="ops-inventory">
            {event.ticketTypes.map((type) => (
              <article key={type.id}>
                <strong>{type.name}</strong>
                <p>
                  {type.quantitySold} confirmed · {type.quantityHeld} reserved ·{" "}
                  {Math.max(
                    0,
                    type.quantityTotal - type.quantitySold - type.quantityHeld,
                  )}{" "}
                  available
                </p>
                <progress
                  value={type.quantitySold}
                  max={type.quantityTotal}
                  aria-label={`Sold inventory for ${type.name}`}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="ops-empty">
            Add a ticket type and a processed poster before publishing.
          </p>
        )}
      </section>
      <section id="bookings" className="ops-section">
        <div className="ops-section-heading">
          <h2>
            Bookings <small>{totalOrders}</small>
          </h2>
          <LiveRefresh />
        </div>
        <form className="ops-filters">
          <label className="sr-only" htmlFor="booking-q">
            Search bookings
          </label>
          <input
            id="booking-q"
            name="q"
            defaultValue={q}
            placeholder="Name, email or phone"
            maxLength={100}
          />
          <label className="sr-only" htmlFor="booking-status">
            Booking status
          </label>
          <select id="booking-status" name="status" defaultValue={status || ""}>
            <option value="">All bookings</option>
            {[
              "PAID",
              "PENDING",
              "FAILED",
              "EXPIRED",
              "CANCELLED",
              "REFUNDED",
            ].map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
          <button className="r-quiet-button">Search</button>
          {(q || status) && (
            <Link href={`/dashboard/events/${id}#bookings`}>Clear</Link>
          )}
        </form>
        {orders.length ? (
          <ul className="ops-bookings">
            {orders.map((order) => {
              const refunds = order.payments.flatMap(
                (payment) => payment.refunds,
              );
              return (
                <li key={order.id}>
                  <div className="ops-booking-top">
                    <div>
                      <h3>{order.buyerName}</h3>
                      <p>
                        {order.buyerEmail}
                        {order.buyerPhone ? ` · ${order.buyerPhone}` : ""}
                      </p>
                    </div>
                    <div>
                      <strong>{formatInr(order.totalPaise)}</strong>
                      <span className="tk-status">{order.status}</span>
                    </div>
                  </div>
                  <p>
                    {order.items
                      .map(
                        (item) => `${item.quantity} × ${item.ticketType.name}`,
                      )
                      .join(" · ")}
                  </p>
                  <small>
                    Order {order.id} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: event.timezone,
                    }).format(order.createdAt)}
                  </small>
                  <p className="ops-note">
                    Latest email:{" "}
                    {order.notificationLogs[0]?.status || "Not queued"}
                  </p>
                  {refunds.map((refund) => (
                    <div className="ops-refund" key={refund.id}>
                      <strong>
                        Refund {formatInr(refund.amountPaise)} · {refund.status}
                      </strong>
                      <p>{refund.reason}</p>
                      <small>Reference {refund.cfRefundId || refund.id}</small>
                      {refund.status === "FAILED" && (
                        <p>
                          Provider confirmation failed. Check the status again;
                          review this reference in Cashfree if it remains
                          failed.
                        </p>
                      )}
                    </div>
                  ))}
                  <BookingActions
                    eventId={id}
                    orderId={order.id}
                    paid={order.status === "PAID"}
                    amount={order.totalPaise}
                    canRefund={canRefund}
                    canResend={canManage && event.status !== "CANCELLED"}
                    refund={refunds.some(
                      (refund) => refund.status !== "SUCCESS",
                    )}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ops-empty">No bookings match these filters.</p>
        )}
        <nav className="ops-pagination" aria-label="Booking pages">
          {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
          <span>
            Page {page} · {totalOrders} bookings
          </span>
          {page * 25 < totalOrders && <Link href={href(page + 1)}>Next →</Link>}
        </nav>
      </section>
    </main>
  );
}
