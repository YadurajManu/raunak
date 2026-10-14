import { processCashfreeWebhook } from "@/server/checkout/webhook";
export async function POST(request: Request) {
  try {
    await processCashfreeWebhook(
      await request.text(),
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
