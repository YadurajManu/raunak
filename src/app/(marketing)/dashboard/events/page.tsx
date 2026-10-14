import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- Event images are already optimized by the media worker. */
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { listEvents } from "@/server/events/service";
import { db } from "@/server/db/client";
import { formatInr } from "@/lib/money";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; q?: string; status?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { org: orgId, q = "", status = "" } = await searchParams;
  if (!orgId) redirect("/dashboard");
  let events;
  try {
    events = await listEvents(user.id, orgId);
  } catch {
    redirect("/dashboard");
  }
  const membership = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId, userId: user.id } },
  });
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true },
  });
  const filtered = events.filter(
    (event) =>
      (!status || event.status === status) &&
      (!q || event.title.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-6 dark:border-[var(--line)]">
        <Link href="/dashboard" className="text-xl font-semibold">
          {APP_NAME}
        </Link>
        <span>{org.name}</span>
      </header>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="mt-2 text-[var(--muted)] dark:text-[var(--muted)]">
            Create and manage events for {org.name}.
          </p>
        </div>
        {membership.role !== "CHECKIN" && (
          <Link
            href={`/dashboard/events/new?org=${orgId}`}
            className="rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-white"
          >
            Create event
          </Link>
        )}
      </div>
      <form className="mt-8 flex flex-wrap gap-3">
        <input type="hidden" name="org" value={orgId} />
        <label className="sr-only" htmlFor="event-search">
          Search events
        </label>
        <input
          id="event-search"
          name="q"
          defaultValue={q}
          placeholder="Search events"
          className="rounded-xl border border-[var(--line)] bg-transparent px-4 py-2 dark:border-[var(--line)]"
        />
        <label className="sr-only" htmlFor="event-status">
          Status
        </label>
        <select
          id="event-status"
          name="status"
          defaultValue={status}
          className="rounded-xl border border-[var(--line)] bg-transparent px-4 py-2 dark:border-[var(--line)]"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="ENDED">Ended</option>
        </select>
        <button className="rounded-xl border border-[var(--line)] px-4 py-2 dark:border-[var(--line)]">
          Filter
        </button>
      </form>
      {filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--line)] p-10 text-center text-[var(--muted)] dark:border-[var(--line)]">
          No events match these filters.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <li key={event.id}>
              <Link
                href={`/dashboard/events/${event.id}${membership.role === "CHECKIN" ? "/attendees" : ""}`}
                className="block overflow-hidden rounded-2xl border border-[var(--line)] hover:border-[var(--accent)] dark:border-[var(--line)]"
              >
                <div className="flex h-36 items-center justify-center bg-[var(--green)] text-3xl text-[var(--sun)] dark:bg-[var(--paper)]">
                  {imageUrl(event.images[0]?.variants) ? (
                    <img
                      src={imageUrl(event.images[0]?.variants)!}
                      alt={event.images[0].alt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "✦"
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)] dark:text-[var(--accent)]">
                    {event.status}
                  </span>
                  <h2 className="mt-2 text-xl font-semibold">{event.title}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeZone: event.timezone,
                    }).format(event.startsAt)}{" "}
                    · {event.city || event.mode}
                  </p>
                  <p className="mt-4 text-sm">
                    From{" "}
                    {event.ticketTypes.length
                      ? formatInr(
                          Math.min(
                            ...event.ticketTypes.map((type) => type.pricePaise),
                          ),
                        )
                      : "No tickets yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function imageUrl(variants: unknown): string | null {
  if (!variants || typeof variants !== "object") return null;
  const card = (variants as { card?: { jpeg?: string } }).card;
  return card?.jpeg ?? null;
}
