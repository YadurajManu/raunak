import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  event: vi.fn(),
  email: vi.fn(),
  origin: vi.fn(),
  increment: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: class {
    eval = mocks.increment;
  },
}));
vi.mock("@/server/db/client", () => ({
  db: { event: { findFirst: mocks.event } },
}));
vi.mock("@/server/providers/email/provider", () => ({ sendEmail: mocks.email }));
vi.mock("@/server/auth/origin", () => ({ requireSameOrigin: mocks.origin }));

import { POST } from "@/app/api/public/events/[eventId]/organizer-contact/route";

function request(body: Record<string, unknown>) {
  return new Request("https://raunak.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://raunak.test", "x-real-ip": "192.0.2.10" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.increment.mockResolvedValue(1);
  mocks.event.mockResolvedValue({
    title: "A <great> event",
    org: { name: "Organizer", supportEmail: "private@example.test" },
  });
  mocks.email.mockResolvedValue(undefined);
});

it("sends a validated, escaped message without returning the organizer address", async () => {
  const response = await POST(request({
    name: "<Visitor>",
    email: "visitor@example.test",
    message: "Please share the venue details.",
  }), { params: Promise.resolve({ eventId: "00000000-0000-4000-8000-000000000001" }) });

  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload).toEqual({ ok: true });
  expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({
    to: "private@example.test",
    replyTo: "visitor@example.test",
    html: expect.stringContaining("&lt;Visitor&gt;"),
  }));
  expect(JSON.stringify(payload)).not.toContain("private@example.test");
});

it("rejects invalid input and origin before sending", async () => {
  const invalid = await POST(request({ name: "", email: "bad", message: "x" }), { params: Promise.resolve({ eventId: "00000000-0000-4000-8000-000000000001" }) });
  expect(invalid.status).toBe(400);
  mocks.origin.mockImplementationOnce(() => { throw new Error("origin"); });
  const crossOrigin = await POST(request({ name: "Visitor", email: "visitor@example.test", message: "A valid message." }), { params: Promise.resolve({ eventId: "00000000-0000-4000-8000-000000000001" }) });
  expect(crossOrigin.status).toBe(403);
  expect(mocks.email).not.toHaveBeenCalled();
});

it("silently accepts honeypot submissions and enforces rate limits", async () => {
  const spam = await POST(request({ name: "Bot", email: "bot@example.test", message: "Automated message.", website: "filled" }), { params: Promise.resolve({ eventId: "event-id" }) });
  expect(spam.status).toBe(200);
  expect(mocks.event).not.toHaveBeenCalled();
  expect(mocks.email).not.toHaveBeenCalled();

  mocks.increment.mockResolvedValue(6);
  const limited = await POST(request({ name: "Visitor", email: "visitor@example.test", message: "A valid message." }), { params: Promise.resolve({ eventId: "00000000-0000-4000-8000-000000000001" }) });
  expect(limited.status).toBe(429);
  expect(mocks.email).not.toHaveBeenCalled();
});
