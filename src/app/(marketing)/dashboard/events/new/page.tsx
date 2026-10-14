import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { EventForm } from "@/components/dashboard/event-form";
import Link from "next/link";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { org } = await searchParams;
  if (!org) redirect("/dashboard");
  try {
    await requireOrgRoleForUser(user.id, org, ["OWNER", "ADMIN", "MANAGER"]);
  } catch {
    redirect("/dashboard");
  }
  return (
    <main className="r-event-create">
      <Link href={`/dashboard/events?org=${org}`} className="r-back-link">← Workspace events</Link>
      <div className="r-compact-heading"><div><h1>Create event</h1><p>Start with the details. Add your images, people and tickets next.</p></div><span className="r-status-chip">NEW DRAFT</span></div>
      <EventForm orgId={org} />
    </main>
  );
}
