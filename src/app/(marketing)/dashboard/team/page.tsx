import { PageHeader, SettingsNavigation } from "@/components/ui";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { TeamActions } from "./team-actions";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { org: orgId } = await searchParams;
  if (!orgId) redirect("/dashboard");
  let membership;
  try {
    membership = await requireOrgRoleForUser(user.id, orgId, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "CHECKIN",
      "FINANCE",
    ]);
  } catch {
    redirect("/dashboard");
  }
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const members = await db.organizationMember.findMany({
    where: { orgId, status: "ACTIVE" },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <PageHeader backHref={`/dashboard/events?org=${orgId}`} backLabel="Workspace events" title="Team" description={`Members of ${org.name}`} />
      <SettingsNavigation orgId={orgId} current="team" className="ui-settings-horizontal" />
      {membership.role === "OWNER" || membership.role === "ADMIN" ? (
        <TeamActions
          orgId={orgId}
          members={members.map(({ userId, role, user }) => ({
            userId,
            role,
            name: user.name,
            email: user.email,
          }))}
        />
      ) : null}
      <ul className="mt-8 divide-y divide-[var(--line)]">
        {members.map(({ userId, role, user }) => (
          <li key={userId} className="flex justify-between gap-4 p-4">
            <span>
              {user.name || user.email}
              <span className="block text-sm text-[var(--muted)]">
                {user.email}
              </span>
            </span>
            <span className="text-sm text-[var(--muted)]">{role}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
