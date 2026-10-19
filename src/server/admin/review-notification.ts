import { db } from "@/server/db/client";
import { sendEmail } from "@/server/providers/email/provider";
import { escapeHtml } from "@/server/notifications/templates";

const reviewInbox = "yadurajsingham@gmail.com";

type ReviewEmailInput = {
  id: string;
  title: string;
  category: string | null;
  mode: string;
  startsAt: Date;
  timezone: string;
  venueName: string | null;
  address: string | null;
  city: string | null;
  orgName: string;
  submittedAt: Date;
};

export function createReviewRequestEmail(
  input: ReviewEmailInput,
  appUrl: string,
) {
  const reviewUrl = new URL(
    `/admin?event=${encodeURIComponent(input.id)}`,
    appUrl,
  ).toString();
  const starts = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(input.startsAt);
  const submitted = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(input.submittedAt);
  const venue =
    input.mode === "ONLINE"
      ? "Online event"
      : [input.venueName, input.address, input.city]
          .filter(Boolean)
          .join(", ") || "Venue not supplied";
  const details = [
    ["Organizer", input.orgName],
    ["Category", input.category || "Not set"],
    ["Starts", starts],
    ["Location", venue],
    ["Submitted", submitted],
  ];
  const text = [
    "A Raunak event is waiting for platform review.",
    "",
    `Event: ${input.title}`,
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `Open the private review queue: ${reviewUrl}`,
  ].join("\n");
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 12px 10px 0;color:#70695e;font-size:13px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 0;color:#211e18;font-size:14px;line-height:1.5">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Event review requested</title></head><body style="margin:0;padding:24px 12px;background:#eeeae2;color:#211e18;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.title)} is waiting for review.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf7;border:1px solid #d8d0c1;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 26px;background:#234d3c;color:#fffdf7;font-family:Georgia,serif;font-size:28px">Raunak<span style="color:#ffca45">.</span></td></tr><tr><td style="padding:28px 26px 18px"><p style="margin:0 0 10px;color:#ad3a23;font-family:monospace;font-size:11px;letter-spacing:2px">PLATFORM REVIEW</p><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:34px;font-weight:normal;line-height:1.15">A new event is ready for review.</h1><h2 style="margin:0;font-size:21px;line-height:1.35">${escapeHtml(input.title)}</h2></td></tr><tr><td style="padding:4px 26px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #d8d0c1;border-bottom:1px solid #d8d0c1">${rows}</table></td></tr><tr><td align="center" style="padding:0 26px 26px"><a href="${escapeHtml(reviewUrl)}" style="display:block;background:#ff5635;color:#21150f;padding:15px 20px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:bold">Review this event ↗</a><p style="margin:12px 0 0;color:#70695e;font-size:12px;line-height:1.5">This link opens Raunak’s private review queue and requires your admin sign-in.</p></td></tr></table><p style="margin:16px 0 0;color:#766d60;text-align:center;font-size:11px">An automated Raunak platform review alert.</p></td></tr></table></body></html>`;
  return {
    to: reviewInbox,
    subject: `Event review requested · ${input.title}`,
    text,
    html,
    idempotencyKey: `review-${input.id}-${input.submittedAt.getTime()}`,
  };
}

export async function sendEventReviewNotification(eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { org: { select: { name: true } } },
  });
  if (event.status !== "PENDING_REVIEW" || !event.reviewSubmittedAt) return;
  await sendEmail(
    createReviewRequestEmail(
      {
        id: event.id,
        title: event.title,
        category: event.category,
        mode: event.mode,
        startsAt: event.startsAt,
        timezone: event.timezone,
        venueName: event.venueName,
        address: event.address,
        city: event.city,
        orgName: event.org.name,
        submittedAt: event.reviewSubmittedAt,
      },
      process.env.APP_URL || "http://localhost:3000",
    ),
  );
}
