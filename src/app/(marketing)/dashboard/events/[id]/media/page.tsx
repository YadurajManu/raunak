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
          sizeBytes:image.sizeBytes,
          mime:image.mime,
          width:image.width,
          height:image.height,
        }))}
        initialPeople={people.map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          bio: person.bio,
          photoKey: person.photoKey,
          links:person.links,
        }))}
      />
      <details className="mm-documents"><summary>Event documents · {documentsSchema.parse(event.documents).length} PDFs</summary><DocumentManager
        eventId={id}
        documents={documentsSchema.parse(event.documents)}
      /></details>
      <div className="mm-page-actions"><Link href={`/dashboard/events/${id}`}>Review event ↗</Link>
      <Link className="m-button" href={`/dashboard/events/${id}/tickets`}>
        Next: set up tickets ↗
      </Link>
      </div>
    </main>
  );
}
