import { afterEach, expect, it } from "vitest";
import { isPlatformAdminUid } from "@/server/auth/session";

const previous = process.env.RAUNAK_ADMIN_FIREBASE_UIDS;
afterEach(() => {
  if (previous === undefined) delete process.env.RAUNAK_ADMIN_FIREBASE_UIDS;
  else process.env.RAUNAK_ADMIN_FIREBASE_UIDS = previous;
});

it("grants platform admin access only to exact configured Firebase UIDs", () => {
  process.env.RAUNAK_ADMIN_FIREBASE_UIDS = "uid-one, uid-two";
  expect(isPlatformAdminUid("uid-one")).toBe(true);
  expect(isPlatformAdminUid("uid-two")).toBe(true);
  expect(isPlatformAdminUid("uid-one@example.test")).toBe(false);
  expect(isPlatformAdminUid("uid-three")).toBe(false);
});

it("fails closed when the allowlist is missing", () => {
  delete process.env.RAUNAK_ADMIN_FIREBASE_UIDS;
  expect(isPlatformAdminUid("some-user")).toBe(false);
});
