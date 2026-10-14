import {
  receiveWebhook,
  validSignature,
  validVerifyToken,
  webhookSchema,
} from "@/server/whatsapp/webhook";

export const runtime = "nodejs";
const MAX_BYTES = 1024 * 1024;

export function GET(request: Request) {
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected) return new Response("Webhook not configured", { status: 503 });
  const params = new URL(request.url).searchParams;
  const token = params.get("hub.verify_token") || "";
  const challenge = params.get("hub.challenge");
  if (
    params.get("hub.mode") !== "subscribe" ||
    !challenge ||
    challenge.length > 256 ||
    token.length > 256 ||
    !validVerifyToken(token, expected)
  )
    return new Response("Verification denied", { status: 403 });
  return new Response(challenge, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return new Response("Invalid signature", { status: 401 });
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return new Response("Payload too large", { status: 413 });
  let body: Buffer;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response("Missing payload", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return new Response("Payload too large", { status: 413 });
      }
      chunks.push(chunk.value);
    }
    body = Buffer.concat(chunks);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  if (!validSignature(body, signature, secret))
    return new Response("Invalid signature", { status: 401 });
  let payload;
  try {
    payload = webhookSchema.parse(JSON.parse(body.toString("utf8")));
  } catch {
    return new Response("Invalid WhatsApp payload", { status: 400 });
  }
  try {
    await receiveWebhook(payload);
    return Response.json({ ok: true });
  } catch {
    // Acknowledge only durable receipts so Meta retries a database outage.
    return new Response("Temporarily unavailable", { status: 503 });
  }
}
