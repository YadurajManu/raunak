import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  verify: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("@/server/auth/firebase-admin", () => ({
  adminAuth: () => ({
    verifyIdToken: mocks.verify,
    createSessionCookie: mocks.create,
  }),
}));
vi.mock("@/server/db/client", () => ({
  db: { user: { findUnique: mocks.find, upsert: mocks.upsert } },
}));
import { createSession } from "@/server/auth/session";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({
    uid: "firebase-id",
    email: "user@example.test",
    auth_time: Date.now() / 1000,
  });
  mocks.create.mockResolvedValue("signed-session");
  mocks.find.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({ id: "user" });
});
it("remembers sign-in for fourteen days with a secure HTTP-only session", async () => {
  await createSession("token", true);
  expect(mocks.create).toHaveBeenCalledWith("token", {
    expiresIn: 14 * 24 * 60 * 60 * 1000,
  });
  expect(mocks.set.mock.calls[0][2]).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
});
it("leaves unchecked sessions as browser-session cookies and preserves uploaded photos", async () => {
  mocks.find.mockResolvedValue({ avatarKey: "avatars/user/photo.webp" });
  await createSession("token", false);
  expect(mocks.set.mock.calls[0][2]).not.toHaveProperty("maxAge");
  expect(mocks.upsert.mock.calls[0][0].update.avatarKey).toBe(
    "avatars/user/photo.webp",
  );
});
it("rejects old authentication before issuing a session", async () => {
  mocks.verify.mockResolvedValue({
    uid: "firebase-id",
    email: "user@example.test",
    auth_time: Date.now() / 1000 - 600,
  });
  await expect(createSession("token")).rejects.toThrow("sign in again");
  expect(mocks.create).not.toHaveBeenCalled();
});
