import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import {
  exportPersonalData,
  PrivacyRequestError,
  requestAccountDeletion,
} from "@/server/profile/privacy";
import { boundedBody } from "@/server/http/form-data";

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
    return Response.json(await exportPersonalData(user.id), {
      headers: {
        ...headers,
        "Content-Disposition":
          'attachment; filename="raunak-personal-data.json"',
      },
    });
  } catch {
    return Response.json(
      { error: "Could not export your data. Please retry." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers },
    );
  }
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in required." },
      { status: 401, headers },
    );
  try {
    const body = request.body
      ? (await boundedBody(request, 1024)).toString("utf8")
      : "";
    z.object({})
      .strict()
      .parse(body.trim() ? JSON.parse(body) : {});
  } catch (error) {
    return Response.json(
      { error: "Send an empty deletion request." },
      {
        status:
          error instanceof Error && error.message === "Upload is too large."
            ? 413
            : 400,
        headers,
      },
    );
  }
  try {
    return Response.json(await requestAccountDeletion(user.id), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof PrivacyRequestError
            ? error.message
            : "Could not record your request. Please retry.",
      },
      {
        status: error instanceof PrivacyRequestError ? error.status : 503,
        headers: { ...headers, "Retry-After": "60" },
      },
    );
  }
}
