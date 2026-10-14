import { processCashfreeWebhook } from "@/server/checkout/webhook";
import { boundedBody } from "@/server/http/form-data";
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
    return Response.json(
      { error: invalid ? "Invalid signature." : "Webhook processing failed." },
      { status: invalid ? 401 : 500 },
    );
  }
}
