import Link from "next/link";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { redirect } from "next/navigation";
import { formatInr } from "@/lib/money";
import { EventActions } from "@/components/dashboard/event-actions";

export default async function EventOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  try {
    await requireEventAccessForUser(user.id, id, ["OWNER", "ADMIN", "MANAGER"]);
  } catch {
    redirect("/dashboard");
  }
  const event = await db.event.findUniqueOrThrow({
    where: { id },
    include: {
      ticketTypes: true,
      images: { where: { kind: "POSTER" }, take: 1 },
    },
  });
  const sold = event.ticketTypes.reduce(
    (total, type) => total + type.quantitySold,
    0,
  );
  const grossPaise = await db.order.aggregate({
    where: { eventId: id, status: "PAID" },
    _sum: { totalPaise: true },
  });
  return (
    <main className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)] dark:text-[var(--accent)]">
            {event.status}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{event.title}</h1>
          <p className="mt-3 text-[var(--muted)] dark:text-[var(--muted)]">
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: event.timezone,
            }).format(event.startsAt)}{" "}
            · {event.venueName || "Online"}
          </p>
        </div>
        <EventActions eventId={id} status={event.status} />
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] p-6 dark:border-[var(--line)]">
          <p className="text-sm text-[var(--muted)]">Tickets sold</p>
          <p className="mt-3 text-3xl font-semibold">{sold}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] p-6 dark:border-[var(--line)]">
          <p className="text-sm text-[var(--muted)]">Revenue</p>
          <p className="mt-3 text-3xl font-semibold">
            {formatInr(grossPaise._sum.totalPaise || 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] p-6 dark:border-[var(--line)]">
          <p className="text-sm text-[var(--muted)]">Ticket types</p>
          <p className="mt-3 text-3xl font-semibold">
            {event.ticketTypes.length}
          </p>
        </div>
      </div>
      <div className="mt-10 rounded-2xl border border-[var(--line)] p-6 dark:border-[var(--line)]">
        <h2 className="text-xl font-semibold">Ready to publish?</h2>
        <p className="mt-2 text-[var(--muted)] dark:text-[var(--muted)]">
          Add a processed poster and at least one ticket type. Your event link
          will appear here after publishing.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-[var(--accent)] dark:text-[var(--accent)]">
          <Link href={`/dashboard/events/${id}/media`}>Manage media</Link>
          <Link href={`/dashboard/events/${id}/tickets`}>Manage tickets</Link>
          {event.status === "PUBLISHED" && (
            <Link href={`/e/${event.slug}`}>View public event</Link>
          )}
        </div>
      </div>
    </main>
  );
}
