import { expect, it } from "vitest";
import { walletWhere } from "@/lib/wallet";

it("requires valid future tickets for Upcoming and moves used tickets to Past", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  expect(walletWhere("owner", "upcoming", "", now)).toMatchObject({
    order: { buyerId: "owner" },
    AND: [{ status: "VALID", event: { endsAt: { gt: now } } }],
  });
  expect(walletWhere("owner", "past", "", now)).toMatchObject({
    order: { buyerId: "owner" },
    AND: [{ OR: [{ status: "USED" }, { event: { endsAt: { lte: now } } }] }],
  });
});
