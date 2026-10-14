import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireOrgRoleForUser } from "@/server/rbac/access";
import { EventForm } from "@/components/dashboard/event-form";

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Create event</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Start with the essentials, then add images and tickets.
      </p>
      <EventForm orgId={org} />
    </main>
  );
}
