import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/server/orgs/service", () => ({ createOrganization: create }));
vi.mock("@/server/auth/session", () => ({ requireUser: async () => ({ id: "owner" }) }));
vi.mock("@/server/auth/origin", () => ({ requireSameOrigin: () => {} }));
import { POST } from "@/app/api/orgs/route";

const request = () => new Request("https://raunak.example/api/orgs", { method: "POST", body: JSON.stringify({ name: "My workspace", slug: "my-workspace" }) });
beforeEach(() => { create.mockReset(); });

it("returns a field error for a duplicate workspace URL without database details", async () => {
  create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private database details", { code: "P2002", clientVersion: "7", meta: { target: ["slug"] } }));
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ field: "slug", error: "This URL name is already taken. Try adding your city or a short suffix." });
});

it("hides unexpected internal errors", async () => {
  create.mockRejectedValue(new Error("private connection details"));
  const response = await POST(request());
  expect(await response.json()).toEqual({ error: "Could not create workspace. Please try again." });
});

it("returns actionable validation feedback", async () => {
  const result = z.object({ slug: z.string().min(3) }).safeParse({ slug: "x" });
  create.mockRejectedValue(result.error);
  const response = await POST(request());
  expect((await response.json()).field).toBe("slug");
});

it("preserves successful workspace creation", async () => {
  create.mockResolvedValue({ id: "workspace-id", slug: "my-workspace" });
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: "workspace-id", slug: "my-workspace" });
});
