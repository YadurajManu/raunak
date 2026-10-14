import { cookies } from "next/headers";
import { adminAuth } from "@/server/auth/firebase-admin";
import { db } from "@/server/db/client";

const SESSION_COOKIE = "eventra_session";
const SESSION_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string) {
  const decoded = await adminAuth().verifyIdToken(idToken);
  if (!decoded.email || !decoded.email_verified)
    throw new Error("Verify your email before signing in.");
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60)
    throw new Error("Please sign in again.");
  const session = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_AGE_MS,
  });
  const user = await db.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: { email: decoded.email, avatarKey: decoded.picture ?? null },
    create: {
      firebaseUid: decoded.uid,
      email: decoded.email,
      name: decoded.name ?? null,
      avatarKey: decoded.picture ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_AGE_MS / 1000,
  });
  return user;
}

export async function currentUser() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    return db.user.findUnique({ where: { firebaseUid: decoded.uid } });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Authentication required.");
  return user;
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
