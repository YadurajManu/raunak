import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { utcToLocalEventTime } from "@/lib/dates";
import { EventForm } from "@/components/dashboard/event-form";
import { PageHeader } from "@/components/ui";

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
    <main className="r-event-create">
      <PageHeader title="Event details" description="Edit the information guests see on your event page." />
      <EventForm
        event={{
          id,
          lat: event.lat == null ? null : Number(event.lat),
          lng: event.lng == null ? null : Number(event.lng),
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
