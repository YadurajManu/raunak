import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { adminAuth } from "../src/server/auth/firebase-admin";
import { db } from "../src/server/db/client";

// Use a disposable Firebase account and remove both Firebase and database records.
async function main() {
  const origin = new URL(process.env.AUTH_SMOKE_URL || "http://localhost:3000")
    .origin;
  const email = `auth-smoke-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const auth = adminAuth();
  const user = await auth.createUser({
    email,
    password,
    emailVerified: false,
    displayName: "Auth smoke",
  });
  async function signIn() {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const result = await response.json();
    assert.equal(response.status, 200, result.error?.message);
    return result.idToken as string;
  }
  async function session(idToken: string, rememberMe = true) {
    return fetch(`${origin}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({ idToken, rememberMe }),
    });
  }
  try {
    const first = await session(await signIn());
    assert.equal(
      first.status,
      200,
      "Unverified email should proceed directly to onboarding",
    );
    assert.equal(
      (await first.json()).redirectTo,
      "/onboarding?next=%2Faccount",
    );
    assert.ok(first.headers.get("set-cookie")?.includes("Max-Age=1209600"));
    const cookie = first.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    const profile = await fetch(`${origin}/api/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin, cookie },
      body: JSON.stringify({
        name: "Smoke profile saved",
        phone: "+919876543210",
        gender: null,
        location: null,
      }),
    });
    assert.equal(profile.status, 200);
    const returning = await session(await signIn());
    assert.equal(returning.status, 200);
    assert.equal((await returning.json()).redirectTo, "/account");
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { firebaseUid: user.uid } }))
        .name,
      "Smoke profile saved",
    );
    const account = await fetch(`${origin}/account`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(account.status, 200);
    assert.ok((await account.text()).includes("Smoke profile saved"));
    for (const path of ["/", "/login", "/signup"]) {
      const response: Response = await fetch(`${origin}${path}`, {
        headers: { cookie },
        redirect: "manual",
      });
      if (response.status === 307)
        assert.equal(response.headers.get("location"), "/account");
      else {
        assert.equal(response.status, 200);
        assert.ok(
          (await response.text()).includes("/account"),
          "Streamed redirect must lead to account",
        );
      }
    }
    const temporary = await session(await signIn(), false);
    assert.equal(temporary.status, 200);
    assert.ok(!temporary.headers.get("set-cookie")?.includes("Max-Age="));
    const logout = await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: { origin, cookie },
    });
    assert.equal(logout.status, 200);
    assert.ok(logout.headers.get("set-cookie")?.includes("eventra_session="));
    console.log(
      "Live auth passed: email sign-in without verification, new-user onboarding, profile save, returning-user dashboard, profile preservation, logout.",
    );
  } finally {
    await db.user.deleteMany({ where: { firebaseUid: user.uid } });
    await auth.deleteUser(user.uid);
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Auth verification failed",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
