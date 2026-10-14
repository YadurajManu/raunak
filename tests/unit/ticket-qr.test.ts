import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import {
  ticketToken,
  tokenTicketId,
  verifyTicketToken,
} from "@/server/tickets/qr";
afterEach(() => vi.unstubAllEnvs());
it("binds entry tokens to the ticket and event and rejects tampering", () => {
  vi.stubEnv(
    "TICKET_SIGNING_SECRET",
    "test-ticket-signing-secret-at-least-32-characters",
  );
  const id = randomUUID();
  const event = randomUUID();
  const token = ticketToken(id, event);
  expect(tokenTicketId(token)).toBe(id);
  expect(verifyTicketToken(token, event)).toBe(true);
  expect(verifyTicketToken(token, randomUUID())).toBe(false);
  expect(verifyTicketToken(token.replace(id, randomUUID()), event)).toBe(false);
  expect(tokenTicketId("v1.invalid.signature")).toBeNull();
});
