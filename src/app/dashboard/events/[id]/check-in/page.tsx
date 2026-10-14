import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { CheckinScanner } from "@/components/dashboard/checkin-scanner";
export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login"); const { id } = await params;
  const access = await requireEventAccessForUser(user.id, id, ["OWNER", "ADMIN", "MANAGER", "CHECKIN"]);
  const history = await db.auditLog.findMany({ where: { orgId: access.orgId, action: { startsWith: "checkin." }, meta: { path: ["eventId"], equals: id } }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  return <main className="py-10"><p className="text-sm uppercase tracking-widest">THE DOOR IS OPEN</p><h1 className="mb-8 mt-3 text-3xl font-semibold">Check-in</h1><CheckinScanner eventId={id} /><h2 className="mb-4 mt-10 text-2xl font-semibold">Recent entry checks</h2>{history.length ? <ul className="divide-y rounded-xl border">{history.map(log => <li key={log.id} className="flex flex-wrap justify-between gap-3 p-4"><span>{log.action.replace("checkin.", "").replaceAll("_", " ")}</span><span>{log.actor?.name || "Staff"} · {log.createdAt.toLocaleString("en-IN")}</span></li>)}</ul> : <p>No entry checks yet.</p>}</main>;
}
