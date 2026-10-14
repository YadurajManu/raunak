import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { MediaManager } from "@/components/dashboard/media-manager";

export default async function EventMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  try { await requireEventAccessForUser(user.id, id, ["OWNER", "ADMIN", "MANAGER"]); }
  catch { redirect("/dashboard"); }
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  const images = await db.eventImage.findMany({ where: { eventId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const people = await db.eventPerson.findMany({ where: { eventId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
    <header className="flex items-center justify-between border-b border-zinc-200 pb-6 dark:border-zinc-800"><Link href="/dashboard" className="text-xl font-semibold">Eventra</Link><span>{event.title}</span></header>
    <h1 className="mt-10 text-3xl font-semibold">Media and lineup</h1>
    <p className="mt-2 text-zinc-600 dark:text-zinc-400">Add images and introduce the people behind this event.</p>
    <MediaManager key={`${images.map(image => image.updatedAt.getTime()).join(",")}:${people.map(person => person.updatedAt.getTime()).join(",")}`} eventId={id} initialImages={images.map(image => ({ id: image.id, kind: image.kind, alt: image.alt, storageKey: image.storageKey, sortOrder: image.sortOrder, variants: image.variants, processingError: image.processingError }))} initialPeople={people.map(person => ({ id: person.id, name: person.name, title: person.title, bio: person.bio, photoKey: person.photoKey }))} />
  </main>;
}
