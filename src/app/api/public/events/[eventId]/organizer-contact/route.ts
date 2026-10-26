import { createHash } from "node:crypto";
import IORedis from "ioredis";
import { z } from "zod";
import { db } from "@/server/db/client";
import { sendEmail } from "@/server/providers/email/provider";
import { escapeHtml } from "@/server/notifications/templates";
import { requireSameOrigin } from "@/server/auth/origin";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  message: z.string().trim().min(5).max(2000),
  website: z.string().max(200).optional(),
});
const increment = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n`;

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    requireSameOrigin(request);
    const body = schema.parse(await request.json());
    if (body.website) return Response.json({ ok: true });
    const eventId = z.uuid().parse((await params).eventId);
    const forwarded = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ip = createHash("sha256").update(forwarded).digest("hex");
    const ipCount = await redis.eval(increment, 1, `organizer-contact:ip:${ip}`);
    if (Number(ipCount) > 5) return Response.json({ error: "Too many messages. Please try again later." }, { status: 429, headers: { "cache-control": "no-store" } });
    const event = await db.event.findFirst({
      where: { id: eventId, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, isTest: false, org: { status: "ACTIVE" } },
      select: { title: true, org: { select: { name: true, supportEmail: true } } },
    });
    if (!event?.org.supportEmail) return Response.json({ error: "Organizer contact is unavailable." }, { status: 404 });
    const eventCount = await redis.eval(increment, 1, `organizer-contact:event:${eventId}`);
    if (Number(eventCount) > 40) return Response.json({ error: "Too many messages. Please try again later." }, { status: 429, headers: { "cache-control": "no-store" } });
    const name = body.name.replace(/[\r\n\t]/g, " ");
    const subject = `Question about ${event.title}`.replace(/[\r\n\t]/g, " ").slice(0, 180);
    const text = `A visitor sent a message about ${event.title}.\n\nFrom: ${name}\nReply to: ${body.email}\n\n${body.message}`;
    const html = `<p>A visitor sent a message about <strong>${escapeHtml(event.title)}</strong>.</p><p><strong>From:</strong> ${escapeHtml(name)}<br><strong>Reply to:</strong> ${escapeHtml(body.email)}</p><p style="white-space:pre-wrap">${escapeHtml(body.message)}</p>`;
    await sendEmail({ to: event.org.supportEmail, replyTo: body.email, subject, text, html });
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid name, email and message." }, { status: 400, headers: { "cache-control": "no-store" } });
    if (error instanceof Error && error.message.toLowerCase().includes("origin")) return Response.json({ error: "Request could not be verified." }, { status: 403, headers: { "cache-control": "no-store" } });
    return Response.json({ error: "Message could not be sent. Please try again later." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
