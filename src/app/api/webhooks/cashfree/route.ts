import { processCashfreeWebhook } from "@/server/checkout/webhook";
import { boundedBody } from "@/server/http/form-data";
import { z } from "zod";

export function GET() {
  return Response.json({ ok: true, service: "cashfree-webhook" });
}

export async function POST(request: Request) {
  try {
    await processCashfreeWebhook(
      (await boundedBody(request, 1024 * 1024)).toString("utf8"),
      request.headers.get("x-webhook-timestamp"),
      request.headers.get("x-webhook-signature"),
    );
    return Response.json({ ok: true });
  } catch (error) {
    const invalid =
      error instanceof Error && error.message === "Invalid webhook signature.";
    console.warn("Cashfree webhook rejected", {
      reason: invalid ? "signature" : error instanceof z.ZodError ? "payload_schema" : "processing",
      ...(error instanceof z.ZodError ? { fields: error.issues.map(issue => issue.path.join(".")) } : {}),
    });
    return Response.json(
      { error: invalid ? "Invalid signature." : "Webhook processing failed." },
      { status: invalid ? 401 : 500 },
    );
  }
}
