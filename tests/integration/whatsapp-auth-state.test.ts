import "dotenv/config";
import { expect, it } from "vitest";
import { db } from "@/server/db/client";
import { postgresAuth } from "../../services/wa-gateway/src/engines/auth-state";
import { decryptState } from "../../services/wa-gateway/src/security";
import { disconnectAction } from "../../services/wa-gateway/src/engines/baileys";
it("persists credentials and every v7 key family atomically and restores without file auth", async () => {
  const session = await db.whatsAppSession.create({ data: { label: `test-${crypto.randomUUID()}` } });
  const secret = "ab".repeat(32);
  try {
    const auth = await postgresAuth(session, async () => {}, secret);
    auth.update({ registered: true });
    await auth.state.keys.set({ "lid-mapping": { "123@lid": "919876543210@s.whatsapp.net" }, "device-list": { phone: ["1", "2"] }, tctoken: { phone: { token: Buffer.from("token") } }, session: { test: Buffer.from([1, 2, 3]) } });
    await auth.close();
    const current = await db.whatsAppSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(Buffer.from(current.authStateEnc!).toString()).not.toContain("919876543210");
    expect(JSON.parse(decryptState(current.authStateEnc!, secret, session.id)).creds.registered).toBe(true);
    const restored = await postgresAuth(current, async () => {}, secret);
    expect(restored.state.creds.registered).toBe(true);
    expect(await restored.state.keys.get("lid-mapping", ["123@lid"])).toEqual({ "123@lid": "919876543210@s.whatsapp.net" });
    expect((await restored.state.keys.get("tctoken", ["phone"])).phone.token).toEqual(Buffer.from("token"));
    await restored.state.keys.set({ session: { test: null } });
    expect(await restored.state.keys.get("session", ["test"])).toEqual({});
    await restored.close();
    const stale = await postgresAuth(current, async () => {}, secret);
    await expect(stale.state.keys.set({ "device-list": { other: [] } })).rejects.toThrow("Auth version changed");
    await stale.close(true).catch(() => {});
  } finally { await db.whatsAppSession.delete({ where: { id: session.id } }); }
});
it("does not fight replacement, logout, invalid credentials or ban-like disconnects", () => {
  expect(disconnectAction(401)).toBe("LOGGED_OUT");
  expect(disconnectAction(440)).toBe("PAUSED");
  expect(disconnectAction(403)).toBe("BANNED_SUSPECTED");
  expect(disconnectAction(500)).toBe("DISCONNECTED");
  for (const code of [408, 428, 515, 503, undefined]) expect(disconnectAction(code)).toBe("RECONNECT");
});
