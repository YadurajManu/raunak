import type { Prisma } from "@/generated/prisma/client";
export const walletTabs = [
  "upcoming",
  "past",
  "cancelled",
  "refunded",
] as const;
export function walletWhere(
  userId: string,
  tab: string,
  q = "",
  now = new Date(),
): Prisma.TicketWhereInput {
  const refunded: Prisma.TicketWhereInput = {
    OR: [{ status: "REFUNDED" }, { order: { status: "REFUNDED" } }],
  };
  const cancelled: Prisma.TicketWhereInput = {
    NOT: refunded,
    OR: [
      { status: "CANCELLED" },
      {
        event: { OR: [{ status: "CANCELLED" }, { deletedAt: { not: null } }] },
      },
      { order: { status: { in: ["FAILED", "EXPIRED", "CANCELLED"] } } },
    ],
  };
  const active: Prisma.TicketWhereInput = {
    NOT: { OR: [refunded, cancelled] },
    order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
  };
  return {
    order: { buyerId: userId },
    AND: [
      tab === "refunded"
        ? refunded
        : tab === "cancelled"
          ? cancelled
          : {
              ...active,
              event: { endsAt: tab === "past" ? { lte: now } : { gt: now } },
            },
      ...(q
        ? [
            {
              OR: [
                {
                  event: {
                    title: { contains: q, mode: "insensitive" as const },
                  },
                },
                { code: { contains: q, mode: "insensitive" as const } },
                {
                  ticketType: {
                    name: { contains: q, mode: "insensitive" as const },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
}
