import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { cameraGuidance } from "@/lib/checkin-camera";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  search: vi.fn(),
  check: vi.fn(),
  origin: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ currentUser: mocks.user }));
vi.mock("@/server/checkin/service", () => ({
  searchAttendees: mocks.search,
  checkIn: mocks.check,
}));
vi.mock("@/server/auth/origin", () => ({ requireSameOrigin: mocks.origin }));
import { GET, POST } from "@/app/api/checkin/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "staff" });
});
it("provides actionable permission, busy, missing-camera and secure-context guidance", () => {
  expect(cameraGuidance({ name: "NotAllowedError" }).message).toContain(
    "site settings",
  );
  expect(cameraGuidance({ name: "NotReadableError" }).title).toBe(
    "Camera is busy",
  );
  expect(cameraGuidance({ name: "NotFoundError" }).title).toBe(
    "No camera found",
  );
  expect(cameraGuidance({ name: "SecurityError" }).message).toContain("HTTPS");
  expect(cameraGuidance(null).message).toContain("manually");
});
it("distinguishes signed-out, unauthorized, invalid and temporary failure responses", async () => {
  const request = () =>
    new Request("http://localhost/api/checkin?eventId=x&q=test");
  mocks.user.mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  mocks.search.mockRejectedValueOnce(new Error("Access denied."));
  expect((await GET(request())).status).toBe(403);
  mocks.search.mockRejectedValueOnce(new z.ZodError([]));
  expect((await GET(request())).status).toBe(400);
  mocks.search.mockRejectedValueOnce(new Error("private database failure"));
  const failure = await GET(request());
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("private database");
  expect(failure.headers.get("cache-control")).toContain("no-store");
});
it("rejects cross-origin admission without calling the service", async () => {
  mocks.origin.mockImplementation(() => {
    throw new Error("Request origin is not allowed.");
  });
  expect(
    (
      await POST(
        new Request("http://localhost/api/checkin", { method: "POST" }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.check).not.toHaveBeenCalled();
});
