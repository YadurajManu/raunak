import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { whatsappEventUrl } from "@/lib/event-share";

const mocks = vi.hoisted(() => ({ update: vi.fn(), access: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  db: { event: { update: mocks.update } },
}));
vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: "owner" }),
}));
vi.mock("@/server/auth/origin", () => ({ requireSameOrigin: () => {} }));
vi.mock("@/server/rbac/access", () => ({
  requireEventAccessForUser: mocks.access,
}));
import { PATCH } from "@/app/api/events/[eventId]/share/route";
const request = (slug: string) =>
  new Request("https://raunak.example/api/events/event/share", {
    method: "PATCH",
    body: JSON.stringify({ slug }),
  });
const params = Promise.resolve({ eventId: "event" });
beforeEach(() => {
  mocks.update.mockReset();
  mocks.access.mockReset();
});

it("encodes the title and canonical event link for WhatsApp", () => {
  const url = new URL(
    whatsappEventUrl("Garba & friends", "https://raunak.example/e/garba"),
  );
  expect(url.searchParams.get("text")).toBe(
    "Garba & friends\nhttps://raunak.example/e/garba",
  );
});
it("updates the event URL after access checks", async () => {
  expect((await PATCH(request("garba-night"), { params })).status).toBe(200);
  expect(mocks.access).toHaveBeenCalledWith("owner", "event", [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "event" },
    data: { slug: "garba-night" },
  });
});
it("rejects malformed URLs without writing", async () => {
  expect((await PATCH(request("../private"), { params })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("blocks unauthorized URL edits", async () => {
  mocks.access.mockRejectedValue(new Error("Denied"));
  expect((await PATCH(request("garba-night"), { params })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("handles a simultaneous URL conflict without leaking database errors", async () => {
  mocks.update.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError("private details", {
      code: "P2002",
      clientVersion: "7",
    }),
  );
  const response = await PATCH(request("garba-night"), { params });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "This event URL is already taken. Choose another name.",
  });
});
