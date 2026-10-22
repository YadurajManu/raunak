import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  origin: vi.fn(),
  export: vi.fn(),
  deletion: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ currentUser: mocks.user }));
vi.mock("@/server/auth/origin", () => ({ requireSameOrigin: mocks.origin }));
vi.mock("@/server/auth/firebase-admin", () => ({
  adminAuth: () => ({ getUser: mocks.getUser }),
}));
vi.mock("@/server/profile/privacy", async (original) => ({
  ...(await original<typeof import("@/server/profile/privacy")>()),
  exportPersonalData: mocks.export,
  requestAccountDeletion: mocks.deletion,
}));
import { GET as exportGet, POST } from "@/app/api/profile/privacy/route";
import { GET as securityGet } from "@/app/api/profile/security/route";
import { interestsSchema } from "@/server/profile/service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "account-id",
    firebaseUid: "private-firebase-id",
  });
  mocks.origin.mockImplementation(() => {});
});

it("requires authentication for both private reads and deletion", async () => {
  mocks.user.mockResolvedValue(null);
  expect((await exportGet()).status).toBe(401);
  expect((await securityGet()).status).toBe(401);
  expect(
    (
      await POST(
        new Request("https://example.test/api/profile/privacy", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
  expect(mocks.export).not.toHaveBeenCalled();
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.deletion).not.toHaveBeenCalled();
});

it("downloads private data using the authenticated identity", async () => {
  mocks.export.mockResolvedValue({
    account: { email: "me@example.test" },
    bookings: [],
  });
  const response = await exportGet();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(mocks.export).toHaveBeenCalledWith("account-id");
});

it("rejects cross-origin and supplied identities before recording deletion", async () => {
  mocks.origin.mockImplementationOnce(() => {
    throw new Error("origin");
  });
  expect(
    (await POST(new Request("https://example.test", { method: "POST" })))
      .status,
  ).toBe(403);
  expect(
    (
      await POST(
        new Request("https://example.test", {
          method: "POST",
          body: JSON.stringify({ userId: "someone-else" }),
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.deletion).not.toHaveBeenCalled();
});

it("keeps provider errors private and permits retry", async () => {
  mocks.getUser.mockRejectedValueOnce(new Error("secret provider token"));
  const failed = await securityGet();
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain("secret");
  mocks.getUser.mockResolvedValue({
    emailVerified: true,
    uid: "private",
    providerData: [
      { providerId: "google.com", uid: "private" },
      { providerId: "password" },
      { providerId: "unlisted-provider" },
    ],
  });
  expect(await (await securityGet()).json()).toEqual({
    providers: ["google.com", "password"],
    emailVerified: true,
  });
});

it("rejects oversized deletion requests before recording a request", async () => {
  expect(
    (
      await POST(
        new Request("https://example.test", {
          method: "POST",
          body: " ".repeat(2048),
        }),
      )
    ).status,
  ).toBe(413);
  expect(mocks.deletion).not.toHaveBeenCalled();
});

it("accepts only canonical interests and an isolated strict interests branch", () => {
  expect(
    interestsSchema.parse({
      interestCategories: ["Arts & culture", "Arts & culture"],
    }),
  ).toEqual({ interestCategories: ["Arts & culture"] });
  expect(
    interestsSchema.safeParse({ interestCategories: ["not a category"] })
      .success,
  ).toBe(false);
  expect(
    interestsSchema.safeParse({
      interestCategories: [],
      email: "other@example.test",
    }).success,
  ).toBe(false);
});
