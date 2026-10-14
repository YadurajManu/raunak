import Link from "next/link";
export const metadata = { robots: { index: false, follow: false } };
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?intent=organizer");
  if (!user.onboardingCompletedAt) redirect("/onboarding?next=/dashboard");
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id, status: "ACTIVE", org: { status: "ACTIVE" } },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  if (!memberships.length) redirect("/organizer/setup");
  return (
    <>
      <p className="m-eyebrow">YOUR IDEAS LIVE HERE</p>
      <h1>Your workspaces</h1>
      <p className="r-account-intro">
        Choose a workspace to manage its events and team.
      </p>
      <div className="r-account-section-title">
        <h2>Choose where to create</h2>
        <Link href="/organizer/setup">Create another ↗</Link>
      </div>
      <div className="r-account-cards">
        {memberships.map(({ org, role }) => (
          <Link href={`/dashboard/events?org=${org.id}`} key={org.id}>
            <article>
              <p className="m-mono">{role}</p>
              <h3>{org.name}</h3>
              <p>Events · Team · Tickets</p>
              <span>Open workspace ↗</span>
            </article>
          </Link>
        ))}
      </div>
    </>
  );
}
