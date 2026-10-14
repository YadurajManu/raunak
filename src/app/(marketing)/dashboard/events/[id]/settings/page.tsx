import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { DeleteEventButton } from "@/components/dashboard/delete-event-button";
import { EventShare } from "@/components/dashboard/event-share";
import { TestEventToggle } from "@/components/dashboard/test-event-toggle";
import { variantUrl } from "@/lib/images";

export default async function EventSettings({
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
  const event = await db.event.findUniqueOrThrow({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  const membership = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId: user.id } },
  });
  return (
    <main className="max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <TestEventToggle eventId={id} isTest={event.isTest} />
      <EventShare
        eventId={id}
        slug={event.slug}
        title={event.title}
        summary={event.summary}
        base={process.env.APP_URL || "http://localhost:3000"}
        published={event.status === "PUBLISHED"}
        poster={variantUrl(
          event.images.find((image) => image.kind === "POSTER")?.variants,
          "card",
        )}
      />
      <dl className="mt-8 space-y-4 rounded-2xl border border-[var(--line)] p-6 dark:border-[var(--line)]">
        <div>
          <dt className="text-sm text-[var(--muted)]">Public URL</dt>
          <dd className="mt-1 break-all">/e/{event.slug}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Status</dt>
          <dd className="mt-1">{event.status}</dd>
        </div>
      </dl>
      {(membership.role === "OWNER" || membership.role === "ADMIN") &&
        event.status === "DRAFT" && (
          <section className="mt-10 rounded-2xl border border-red-200 p-6 dark:border-red-900">
            <h2 className="text-xl font-semibold">Delete draft</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Drafts without orders can be removed from your workspace.
            </p>
            <DeleteEventButton eventId={id} orgId={event.orgId} />
          </section>
        )}
    </main>
  );
}
