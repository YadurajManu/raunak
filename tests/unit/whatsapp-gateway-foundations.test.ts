import { describe, expect, it } from "vitest";
import { authorize, encryptState, decryptState } from "../../services/wa-gateway/src/security";
import { MockEngine } from "../../services/wa-gateway/src/engines/mock";
import { gatewayMessageSchema } from "@raunak/wa-contracts";

describe("WhatsApp gateway foundations", () => {
  it("authenticates private requests and rejects missing/short/wrong keys", () => {
    const secret = "s".repeat(40);
    expect(authorize(`Bearer ${secret}`, secret)).toBe(true);
    expect(authorize("Bearer wrong", secret)).toBe(false);
    expect(authorize(undefined, secret)).toBe(false);
    expect(authorize("Bearer tiny", "tiny")).toBe(false);
  });
  it("encrypts and authenticates state, bound to one session", () => {
    const secret = "ab".repeat(32), blob = encryptState("secret credentials", secret, "session");
    expect(blob.toString()).not.toContain("credentials");
    expect(decryptState(blob, secret, "session")).toBe("secret credentials");
    expect(() => decryptState(blob, secret, "other")).toThrow();
    blob[30] ^= 1;
    expect(() => decryptState(blob, secret, "session")).toThrow();
  });
  it("mock engine never sends before connection and records deterministic delivery", async () => {
    const engine = new MockEngine();
    await expect(engine.sendText("session", "+919876543210", "Ticket")).rejects.toThrow("SESSION_DISCONNECTED");
    engine.emit({ type: "status", sessionId: "session", status: "CONNECTED" });
    const sent = await engine.sendImage("session", "+919876543210", Buffer.from("image"), "Ticket");
    expect(sent.providerMessageId).toMatch(/^mock-/);
    expect(engine.sent).toHaveLength(1);
  });
  it("rejects broadcast triggers and unbounded content", () => {
    expect(gatewayMessageSchema.safeParse({ trigger: "MARKETING" }).success).toBe(false);
  });
});
