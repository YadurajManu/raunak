import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/server/auth/firebase-admin";
import { db } from "@/server/db/client";

async function main() {
  const base = process.env.MOBILE_SMOKE_URL;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  assert(
    base && key,
    "Set MOBILE_SMOKE_URL and the Firebase public client configuration.",
  );
  const email = `raunak-mobile-smoke-${randomUUID()}@example.test`;
  const password = `${randomUUID()}Aa1!`;
  let uid: string | undefined;
  try {
    const firebase = async (operation: string, body: unknown) => {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
      assert.equal(
        response.status,
        200,
        `Firebase ${operation} did not succeed.`,
      );
      return response.json();
    };
    const signup = await firebase("signUp", {
      email,
      password,
      returnSecureToken: true,
    });
    uid = signup.localId;
    await firebase("update", {
      idToken: signup.idToken,
      displayName: "Mobile smoke check",
      returnSecureToken: true,
    });
    const login = await firebase("signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });
    const session = await fetch(new URL("/api/mobile/session", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: login.idToken }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(session.status, 200, "Native session exchange failed.");
    const user = (await session.json()).user;
    assert.equal(user.email, email);
    assert.equal(user.name, "Mobile smoke check");
    assert.deepEqual(Object.keys(user).sort(), ["email", "id", "name"]);
    const cookie = session.headers
      .get("set-cookie")
      ?.match(/eventra_session=[^;,\s]+/)?.[0];
    assert(cookie, "No session cookie returned.");
    const restored = await fetch(new URL("/api/mobile/session", base), {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(restored.status, 200, "Session restoration failed.");
    assert.equal((await restored.json()).user.id, user.id);
    const discovery = await fetch(new URL("/api/mobile/discover", base), {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(discovery.status, 200, "Discovery failed.");
    assert(Array.isArray((await discovery.json()).events));
    const wallet = await fetch(new URL("/api/mobile/tickets", base), {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(wallet.status, 200, "Private wallet failed.");
    assert(Array.isArray((await wallet.json()).tickets));
    const inaccessible = await fetch(
      new URL(`/api/mobile/tickets/${randomUUID()}`, base),
      { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15000) },
    );
    assert.equal(
      inaccessible.status,
      404,
      "Unavailable ticket must not be disclosed.",
    );
    const logout = await fetch(new URL("/api/mobile/session", base), {
      method: "DELETE",
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(logout.status, 200, "Sign-out failed.");
    console.log(
      "PASS: Firebase signup/sign-in, native session, restoration, public discovery, private wallet and sign-out.",
    );
  } finally {
    if (uid) {
      await db.user.deleteMany({ where: { firebaseUid: uid } });
      await adminAuth().deleteUser(uid);
      console.log("Disposable smoke account removed.");
    }
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Mobile smoke check failed. No credentials are logged.");
  process.exitCode = 1;
});
