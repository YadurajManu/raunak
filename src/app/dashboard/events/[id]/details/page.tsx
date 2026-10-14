import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { utcToLocalEventTime } from "@/lib/dates";
import { EventForm } from "@/components/dashboard/event-form";

export default async function EventDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  try {
    await requireEventAccessForUser(user.id, id, ["OWNER", "ADMIN", "MANAGER"]);
  } catch {
    redirect("/dashboard");
  }
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  return (
    <main className="max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">Event details</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Edit the information guests see on your event page.
      </p>
      <EventForm
        event={{
          id,
          title: event.title,
          summary: event.summary,
          description: event.description,
          category: event.category,
          mode: event.mode,
          visibility: event.visibility,
          startsAt: utcToLocalEventTime(
            event.startsAt.toISOString(),
            event.timezone,
          ),
          endsAt: utcToLocalEventTime(
            event.endsAt.toISOString(),
            event.timezone,
          ),
          timezone: event.timezone,
          venueName: event.venueName,
          address: event.address,
          mapUrl: event.mapUrl,
          city: event.city,
          onlineUrl: event.onlineUrl,
          capacity: event.capacity,
          refundPolicy: event.refundPolicy,
        }}
      />
    </main>
  );
}
