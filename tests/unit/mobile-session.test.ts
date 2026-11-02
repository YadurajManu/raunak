import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  currentUser: vi.fn(),
  clearSession: vi.fn(),
  eval: vi.fn(),
}));
vi.mock("@/server/auth/session", () => mocks);
vi.mock("ioredis", () => ({
  default: class {
    eval = mocks.eval;
  },
}));
import { POST, GET, DELETE } from "@/app/api/mobile/session/route";
const user = {
  id: "user-id",
  name: "Aarav",
  email: "aarav@example.test",
  firebaseUid: "private-uid",
  phone: "private-number",
};
function request(body: unknown, extra: Record<string, string> = {}) {
  return new Request("https://raunak.example/api/mobile/session", {
    method: "POST",
    headers: { "content-type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.eval.mockResolvedValue(1);
  mocks.createSession.mockResolvedValue(user);
});
it("exchanges a verified token through the existing session service and returns only public account fields", async () => {
  const response = await POST(request({ idToken: "firebase-token" }));
  expect(response.status).toBe(200);
  expect(mocks.createSession).toHaveBeenCalledWith("firebase-token", true);
  expect(await response.json()).toEqual({
    user: { id: user.id, name: user.name, email: user.email },
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects browser requests to prevent an alternate browser login/CSRF path", async () => {
  for (const headers of [
    { origin: "https://attacker.example" },
    { "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[]) {
    expect((await POST(request({ idToken: "token" }, headers))).status).toBe(
      403,
    );
  }
  expect(mocks.createSession).not.toHaveBeenCalled();
});
it("rejects malformed token requests before opening a session", async () => {
  expect((await POST(request({ idToken: "" }))).status).toBe(400);
  expect(mocks.createSession).not.toHaveBeenCalled();
});
it("limits attempts and fails closed when its limiter is unavailable", async () => {
  mocks.eval.mockResolvedValue(21);
  expect((await POST(request({ idToken: "token" }))).status).toBe(429);
  mocks.eval.mockRejectedValue(new Error("redis details"));
  const response = await POST(request({ idToken: "token" }));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("redis details");
});
it("does not disclose internal authentication errors", async () => {
  mocks.createSession.mockRejectedValue(
    new Error("private credentials or database failure"),
  );
  const response = await POST(request({ idToken: "bad" }));
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain("private credentials");
});
it("distinguishes an expired session from an unavailable backend", async () => {
  mocks.currentUser.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  mocks.currentUser.mockRejectedValue(new Error("database down"));
  expect((await GET()).status).toBe(503);
  mocks.currentUser.mockResolvedValue(user);
  expect(await (await GET()).json()).toEqual({
    user: { id: user.id, name: user.name, email: user.email },
  });
});
it("clears native sessions but blocks browser sign-out requests", async () => {
  expect(
    (
      await DELETE(
        new Request("https://raunak.example", {
          method: "DELETE",
          headers: { origin: "https://attacker.example" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.clearSession).not.toHaveBeenCalled();
  expect(
    (await DELETE(new Request("https://raunak.example", { method: "DELETE" })))
      .status,
  ).toBe(200);
  expect(mocks.clearSession).toHaveBeenCalledOnce();
});
