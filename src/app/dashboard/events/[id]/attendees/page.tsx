import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  try {
    await requireEventAccessForUser(user.id, id, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "CHECKIN",
    ]);
  } catch {
    redirect("/dashboard");
  }
  const { q = "" } = await searchParams;
  const tickets = await db.ticket.findMany({
    where: {
      eventId: id,
      ...(q
        ? {
            OR: [
              { holderName: { contains: q, mode: "insensitive" } },
              { holderEmail: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { ticketType: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main className="py-10">
      <h1 className="text-3xl font-semibold">Attendees</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Search by name, email, or ticket code.
      </p>
      <form className="mt-6 flex gap-3">
        <label htmlFor="attendee-search" className="sr-only">
          Search attendees
        </label>
        <input
          id="attendee-search"
          name="q"
          defaultValue={q}
          className="rounded-xl border border-zinc-300 bg-transparent px-4 py-2 dark:border-zinc-700"
        />
        <button className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
          Search
        </button>
      </form>
      {tickets.length ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Ticket</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="p-4">{ticket.holderName}</td>
                  <td className="p-4">{ticket.holderEmail}</td>
                  <td className="p-4">
                    {ticket.ticketType.name} · {ticket.code}
                  </td>
                  <td className="p-4">{ticket.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          No attendees found.
        </p>
      )}
    </main>
  );
}
