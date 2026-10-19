import { cookies } from "next/headers";
import { cache } from "react";
import { adminAuth } from "@/server/auth/firebase-admin";
import { db } from "@/server/db/client";

const SESSION_COOKIE = "eventra_session";
const SESSION_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string, rememberMe = true) {
  const decoded = await adminAuth().verifyIdToken(idToken);
  if (!decoded.email)
    throw new Error("An email address is required to sign in.");
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60)
    throw new Error("Please sign in again.");
  const session = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_AGE_MS,
  });
  const existing = await db.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });
  const user = await db.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: {
      email: decoded.email,
      avatarKey: existing?.avatarKey?.startsWith("avatars/")
        ? existing.avatarKey
        : (decoded.picture ?? existing?.avatarKey ?? null),
    },
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
    ...(rememberMe ? { maxAge: SESSION_AGE_MS / 1000 } : {}),
  });
  return user;
}

export const currentUser = cache(async function currentUser() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  let uid: string;
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return null;
  }
  return db.user.findUnique({ where: { firebaseUid: uid } });
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Authentication required.");
  return user;
}

export class PlatformAdminError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Authentication required." : "Platform admin access required.");
    this.name = "PlatformAdminError";
  }
}

export function isPlatformAdminUid(uid: string) {
  return (process.env.RAUNAK_ADMIN_FIREBASE_UIDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(uid);
}

export async function currentPlatformAdmin() {
  const user = await currentUser();
  return user && isPlatformAdminUid(user.firebaseUid) ? user : null;
}

export async function requirePlatformAdmin() {
  const user = await currentUser();
  if (!user) throw new PlatformAdminError(401);
  if (!isPlatformAdminUid(user.firebaseUid)) throw new PlatformAdminError(403);
  return user;
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
