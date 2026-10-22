import { currentUser } from "@/server/auth/session";
import { adminAuth } from "@/server/auth/firebase-admin";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET() {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in required." },
      { status: 401, headers },
    );
  try {
    const record = await adminAuth().getUser(user.firebaseUid);
    return Response.json(
      {
        providers: [
          ...new Set(
            record.providerData
              .map((provider) => provider.providerId)
              .filter((provider) =>
                ["google.com", "password", "phone"].includes(provider),
              ),
          ),
        ],
        emailVerified: record.emailVerified,
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Could not load sign-in details. Please retry." },
      { status: 503, headers },
    );
  }
}
