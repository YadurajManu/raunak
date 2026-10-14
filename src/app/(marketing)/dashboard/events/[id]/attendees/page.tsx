import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { attendeeFilters } from "@/lib/attendees";
import { BookingActions } from "@/components/dashboard/booking-actions";
export default async function AttendeesPage({
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
      "CHECKIN",
      "FINANCE",
    ]);
  } catch {
    redirect("/dashboard");
  }
  const member = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId: user.id } },
  });
  const canResend = ["OWNER", "ADMIN", "MANAGER"].includes(member.role);
  const canExport = member.role !== "CHECKIN";
  const query = await searchParams;
  const q = (query.q || "").slice(0, 100);
  const status = ["VALID", "USED", "CANCELLED", "REFUNDED"].includes(
    query.status || "",
  )
    ? query.status!
    : "";
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.page || "1") || 1),
  );
  const where = attendeeFilters(id, q, status);
  const [count, tickets, event] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      include: {
        ticketType: { select: { name: true } },
        order: { select: { status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      skip: (page - 1) * 50,
    }),
    db.event.findUniqueOrThrow({ where: { id }, select: { timezone: true, status: true } }),
  ]);
  const filters = new URLSearchParams({ q, status });
  const href = (next: number) =>
    `?q=${encodeURIComponent(q)}&status=${status}&page=${next}`;
  return (
    <main className="ops-page">
      <header className="ops-heading">
        <div>
          <p className="m-eyebrow">YOUR GUEST LIST</p>
          <h1>
            Attendees <small>{count}</small>
          </h1>
          <p>
            Search every ticket. Delivery actions send to the booking buyer.
          </p>
        </div>
        {canExport && (
          <a
            href={`/api/events/${id}/attendees/export?${filters}`}
            className="r-quiet-button"
          >
            Export CSV ↓
          </a>
        )}
      </header>
      <form className="ops-filters">
        <label className="sr-only" htmlFor="attendee-search">
          Search attendees
        </label>
        <input
          id="attendee-search"
          name="q"
          defaultValue={q}
          placeholder="Name, email, phone or ticket code"
          maxLength={100}
        />
        <label className="sr-only" htmlFor="attendee-status">
          Ticket status
        </label>
        <select id="attendee-status" name="status" defaultValue={status}>
          <option value="">All tickets</option>
          {["VALID", "USED", "CANCELLED", "REFUNDED"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button className="r-quiet-button">Search</button>
        {(q || status) && (
          <Link href={`/dashboard/events/${id}/attendees`}>Clear</Link>
        )}
      </form>
      {tickets.length ? (
        <ul className="ops-attendees">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <div>
                <h2>{ticket.holderName}</h2>
                <p>{ticket.holderEmail}</p>
                <small>{ticket.holderPhone}</small>
              </div>
              <div>
                <strong>{ticket.ticketType.name}</strong>
                <p className="m-mono">{ticket.code}</p>
              </div>
              <div>
                <span className="tk-status">
                  {ticket.status === "USED" ? "Checked in" : ticket.status}
                </span>
                {ticket.checkedInAt && (
                  <p>
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: event.timezone,
                    }).format(ticket.checkedInAt)}
                  </p>
                )}
              </div>
              {canResend && event.status !== "CANCELLED" && (
                <BookingActions
                  eventId={id}
                  orderId={ticket.orderId}
                  paid={ticket.order.status === "PAID"}
                  amount={0}
                  canRefund={false}
                  canResend
                  refund={false}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <section className="ops-empty">
          <h2>No attendees found</h2>
          <p>Try another name, ticket code or status.</p>
        </section>
      )}
      <nav className="ops-pagination" aria-label="Attendee pages">
        {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
        <span>
          Page {page} · {count} tickets
        </span>
        {page * 50 < count && <Link href={href(page + 1)}>Next →</Link>}
      </nav>
    </main>
  );
}
