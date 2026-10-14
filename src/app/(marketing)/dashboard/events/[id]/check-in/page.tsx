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
  const history = await db.auditLog.findMany({
    where: {
      orgId: access.orgId,
      action: { startsWith: "checkin." },
      meta: { path: ["eventId"], equals: id },
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const [event, arrived, valid] = await Promise.all([db.event.findUniqueOrThrow({ where: { id }, select: { timezone: true, status: true } }), db.ticket.count({ where: { eventId: id, checkedInAt: { not: null } } }), db.ticket.count({ where: { eventId: id, status: "VALID", order: { status: "PAID" } } })]);
  const tickets = await db.ticket.findMany({ where: { eventId: id, id: { in: history.map(log => log.entityId).filter(value => /^[0-9a-f-]{36}$/.test(value)) } }, select: { id: true, holderName: true, code: true } });
  return (
    <main className="ops-page">
      <p className="text-sm uppercase tracking-widest">THE DOOR IS OPEN</p>
      <h1 className="mb-8 mt-3 text-3xl font-semibold">Check-in</h1>
      <div className="ops-metrics"><article><p>Arrived</p><strong>{arrived}</strong></article><article><p>Valid tickets remaining</p><strong>{valid}</strong></article></div><LiveRefresh />
      {event.status === "PUBLISHED" ? <CheckinScanner eventId={id} /> : <p className="ops-notice">Check-in is closed. This event is {event.status.toLowerCase()}.</p>}
      <h2 className="mb-4 mt-10 text-2xl font-semibold">Recent entry checks</h2>
      {history.length ? (
        <ul className="divide-y rounded-xl border">
          {history.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap justify-between gap-3 p-4"
            >
              <span>
                {log.action.replace("checkin.", "").replaceAll("_", " ")}
                {tickets.find(ticket => ticket.id === log.entityId) && <> · {tickets.find(ticket => ticket.id === log.entityId)!.holderName} · {tickets.find(ticket => ticket.id === log.entityId)!.code}</>}
              </span>
              <span>
                {log.actor?.name || "Staff"} ·{" "}
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(log.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No entry checks yet.</p>
      )}
    </main>
  );
}
