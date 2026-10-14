import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
import { utcToLocalEventTime } from "@/lib/dates";
import { TicketEditor } from "@/components/dashboard/ticket-editor";

export default async function TicketsPage({
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
  const event = await db.event.findUniqueOrThrow({
    where: { id },
    include: {
      ticketTypes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  return (
    <main className="py-10">
      <h1 className="text-3xl font-semibold">Tickets</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Set prices, sale windows, and inventory for {event.title}.
      </p>
      <TicketEditor
        eventId={id}
        timezone={event.timezone}
        types={event.ticketTypes.map((type) => ({
          id: type.id,
          name: type.name,
          description: type.description,
          pricePaise: type.pricePaise,
          quantityTotal: type.quantityTotal,
          quantitySold: type.quantitySold,
          quantityHeld: type.quantityHeld,
          saleStartsAt: type.saleStartsAt
            ? utcToLocalEventTime(
                type.saleStartsAt.toISOString(),
                event.timezone,
              )
            : null,
          saleEndsAt: type.saleEndsAt
            ? utcToLocalEventTime(type.saleEndsAt.toISOString(), event.timezone)
            : null,
          minPerOrder: type.minPerOrder,
          maxPerOrder: type.maxPerOrder,
          isHidden: type.isHidden,
        }))}
      />
    </main>
  );
}
