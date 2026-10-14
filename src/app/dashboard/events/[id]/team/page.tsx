import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { EventTeam } from "@/components/dashboard/event-team";

export default async function EventTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
    ]);
  } catch {
    redirect("/dashboard");
  }
  const membership = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId: user.id } },
  });
  const members = await db.organizationMember.findMany({
    where: {
      orgId: access.orgId,
      status: "ACTIVE",
      role: { in: ["MANAGER", "CHECKIN"] },
    },
    include: { user: { select: { name: true, email: true } } },
  });
  const assigned = await db.eventStaff.findMany({
    where: { eventId: id },
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <main className="max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">Event team</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Assigned managers can edit this event. Check-in staff can access its
        guest list and scanner.
      </p>
      <EventTeam
        eventId={id}
        canManage={membership.role === "OWNER" || membership.role === "ADMIN"}
        members={members.map((member) => ({
          id: member.userId,
          name: member.user.name,
          email: member.user.email,
          role: member.role,
        }))}
        assigned={assigned.map((staff) => ({
          id: staff.userId,
          name: staff.user.name,
          email: staff.user.email,
          role: staff.role,
        }))}
      />
    </main>
  );
}
