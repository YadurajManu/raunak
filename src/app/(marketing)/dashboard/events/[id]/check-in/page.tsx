import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { CheckinScanner } from "@/components/dashboard/checkin-scanner";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const access = await requireEventAccessForUser(user.id, id, [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "CHECKIN",
  ]);
  const [event, arrived, valid, history] = await Promise.all([
    db.event.findUniqueOrThrow({
      where: { id },
      select: {
        title: true,
        timezone: true,
        status: true,
        deletedAt: true,
        isTest: true,
        org: { select: { status: true } },
      },
    }),
    db.ticket.count({
      where: { eventId: id, status: "USED", order: { status: "PAID" } },
    }),
    db.ticket.count({
      where: { eventId: id, status: "VALID", order: { status: "PAID" } },
    }),
    db.auditLog.findMany({
      where: {
        orgId: access.orgId,
        action: { startsWith: "checkin." },
        meta: { path: ["eventId"], equals: id },
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const tickets = await db.ticket.findMany({
    where: {
      eventId: id,
      id: {
        in: history
          .map((log) => log.entityId)
          .filter((value) => /^[0-9a-f-]{36}$/.test(value)),
      },
    },
    select: { id: true, holderName: true, code: true },
  });
  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const open =
    event.status === "PUBLISHED" &&
    !event.deletedAt &&
    !event.isTest &&
    event.org.status === "ACTIVE";
  return (
    <main className="ops-page">
      <PageHeader title="Guest check-in" description={event.title} />
      <div className="gate-summary" aria-label="Entry totals">
        <article>
          <p>Guests admitted</p>
          <strong>{arrived}</strong>
        </article>
        <article>
          <p>Tickets ready for entry</p>
          <strong>{valid}</strong>
        </article>
      </div>
      <LiveRefresh />
      {open ? (
        <CheckinScanner eventId={id} timezone={event.timezone} />
      ) : (
        <p className="ops-notice">
          Check-in is closed for this event. Ask an organizer to review its
          status.
        </p>
      )}
      <section className="gate-history" aria-labelledby="entry-history-heading">
        <h2 id="entry-history-heading">Recent entry checks</h2>
        <p>
          Confirmed admissions, repeat scans and rejected tickets. Times are
          shown in {event.timezone}.
        </p>
        {history.length ? (
          <ul>
            {history.map((log) => {
              const ticket = ticketById.get(log.entityId);
              const label =
                log.action === "checkin.valid"
                  ? "Admitted"
                  : log.action === "checkin.already_used"
                    ? "Duplicate · not admitted again"
                    : "Rejected · not admitted";
              return (
                <li key={log.id}>
                  <div>
                    <strong>{label}</strong>
                    {ticket && (
                      <small>
                        {ticket.holderName} · {ticket.code}
                      </small>
                    )}
                  </div>
                  <small>
                    {log.actor?.name || "Entry staff"} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: event.timezone,
                    }).format(log.createdAt)}
                  </small>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No entry checks yet. Confirmed checks will appear here.</p>
        )}
      </section>
    </main>
  );
}
import { PageHeader } from "@/components/ui";
