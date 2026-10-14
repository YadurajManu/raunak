import { DocumentManager } from "@/components/dashboard/document-manager";
import { documentsSchema } from "@/server/events/documents";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { MediaManager } from "@/components/dashboard/media-manager";

export default async function EventMediaPage({
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
  const images = await db.eventImage.findMany({
    where: { eventId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const people = await db.eventPerson.findMany({
    where: { eventId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  return (
    <main className="py-10">
      <h1 className="text-3xl font-semibold">Media and lineup</h1>
      <p className="mt-2 text-[var(--muted)] dark:text-[var(--muted)]">
        Add images and introduce the people behind this event.
      </p>
      <MediaManager
        eventId={id}
        initialImages={images.map((image) => ({
          id: image.id,
          kind: image.kind,
          alt: image.alt,
          storageKey: image.storageKey,
          sortOrder: image.sortOrder,
          variants: image.variants,
          processingError: image.processingError,
          crop: image.crop,
        }))}
        initialPeople={people.map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          bio: person.bio,
          photoKey: person.photoKey,
        }))}
      />
      <DocumentManager
        eventId={id}
        documents={documentsSchema.parse(event.documents)}
      />
      <Link className="m-button" href={`/dashboard/events/${id}/tickets`}>
        Next: set up tickets ↗
      </Link>
    </main>
  );
}
