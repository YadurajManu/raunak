import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";
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
      <p className="mt-2 text-[var(--muted)] dark:text-[var(--muted)]">
        Set prices, sale windows, and inventory for {event.title}.
      </p>
      <TicketEditor
        eventId={id}
        timezone={event.timezone}
        startsAt={event.startsAt.toISOString()}
        status={event.status}
        types={event.ticketTypes.map((type) => ({
          id: type.id,
          name: type.name,
          description: type.description,
          pricePaise: type.pricePaise,
          quantityTotal: type.quantityTotal,
          quantitySold: type.quantitySold,
          quantityHeld: type.quantityHeld,
          saleStartsAt: type.saleStartsAt
            ? type.saleStartsAt.toISOString()
            : null,
          saleEndsAt: type.saleEndsAt
            ? type.saleEndsAt.toISOString()
            : null,
          minPerOrder: type.minPerOrder,
          maxPerOrder: type.maxPerOrder,
          isHidden: type.isHidden,
        }))}
      />
      <Link className="m-button mt-8" href={`/dashboard/events/${id}`}>
        Next: review & publish ↗
      </Link>
    </main>
  );
}
