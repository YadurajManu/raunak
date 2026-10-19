import { escapeHtml } from "./templates";
const e = (value: string | undefined) => escapeHtml(value || "");
export function emailMarkup(
  text: string,
  values: Record<string, string>,
  qr = false,
  trigger = "ORDER_CONFIRMED",
) {
  const heading = qr
    ? "Your way in."
    : trigger === "ORDER_CONFIRMED"
      ? "You're going."
      : trigger === "PAYMENT_FAILED"
        ? "Let's try that again."
        : trigger === "EVENT_CANCELLED"
          ? "A change of plans."
          : "A little update.";
  const status = qr
    ? "ENTRY TICKET"
    : trigger === "ORDER_CONFIRMED"
      ? "BOOKING CONFIRMED"
      : trigger.replaceAll("_", " ");
  const rows = [
    ["When", `${values.event_date} · ${values.event_time}`],
    ["Where", [values.venue, values.city].filter(Boolean).join(", ")],
    ...(qr
      ? [
          ["Ticket", values.ticket_type],
          ["Guest", values.attendee_name],
        ]
      : [["Tickets", values.quantity]]),
    ...(trigger === "ORDER_CONFIRMED" || qr
      ? [["Total paid", values.amount_paid]]
      : []),
  ];
  const safeLink = /^https?:\/\//i.test(values.ticket_url || "")
    ? values.ticket_url
    : "#";
  const logoUrl = new URL("/brand/icon-192.png", process.env.APP_URL || "https://raunak.yaduraj.me").href;
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(values.event_title)}</title></head><body style="margin:0;padding:0;background:#eeeae2;color:#211e18;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(status)} · ${e(values.event_title)} · ${e(values.event_date)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fffdf7;border:1px solid #d8d0c1;border-radius:18px;overflow:hidden">
  <tr><td style="padding:26px 28px;background:#234d3c;color:#fffdf7"><table role="presentation" width="100%"><tr><td width="52"><img src="${e(logoUrl)}" width="42" height="42" alt="" style="display:block;border:0;background:#f5f0e6"></td><td style="font-family:Georgia,serif;font-size:34px">Raunak<span style="color:#ffca45">.</span></td><td align="right" style="font-size:12px;letter-spacing:2px;color:#f5ead0">GOOD PEOPLE.<br>GREAT EVENTS.</td></tr></table></td></tr>
  <tr><td style="padding:30px 28px 18px"><p style="margin:0 0 12px;font-family:monospace;font-size:11px;letter-spacing:2px;color:#ad3a23">${e(status)}</p><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:38px;line-height:1.1;margin:0 0 18px">${heading}</h1><h2 style="font-size:23px;line-height:1.3;margin:0 0 14px">${e(values.event_title)}</h2><p style="font-size:14px;line-height:1.65;margin:0;color:#5c554a;white-space:pre-line;overflow-wrap:anywhere">${e(text)}</p></td></tr>
  <tr><td style="padding:8px 28px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #d8d0c1;border-bottom:1px solid #d8d0c1">${rows.map(([label, value]) => `<tr><td width="90" style="padding:12px 8px 12px 0;vertical-align:top;color:#6b6256;font-size:12px">${label}</td><td style="padding:12px 0;font-size:14px;line-height:1.4;overflow-wrap:anywhere">${e(value || "")}</td></tr>`).join("")}</table></td></tr>
  ${qr ? `<tr><td align="center" style="padding:0 28px 24px"><table role="presentation" width="100%" style="border:1px dashed #c5bcab;border-radius:14px;background:#fff"><tr><td align="center" style="padding:20px"><p style="font-size:11px;letter-spacing:2px;color:#665d50;margin:0 0 12px">SCAN AT THE DOOR</p><img src="cid:ticket-qr" width="220" height="220" alt="Your entry QR code — open your ticket if images are hidden" style="display:block;border:0;background:#fff;max-width:100%;height:auto"><p style="font-family:monospace;font-size:17px;letter-spacing:2px;margin:12px 0">${e(values.ticket_code || "")}</p><p style="font-size:12px;color:#655c50;margin:0;line-height:1.5">One QR. One guest. One good memory.<br>Your PDF ticket is attached for offline use.</p></td></tr></table></td></tr>` : ""}
  <tr><td align="center" style="padding:0 28px 26px"><a href="${e(safeLink)}" style="display:block;background:#ff5635;color:#21150f;padding:16px 22px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:bold">${qr ? "Open my entry ticket ↗" : "View my booking ↗"}</a>${qr ? '<p style="font-size:11px;color:#766d60;margin:12px 0 0">Keep your entry QR private. Sharing it can let someone else enter first.</p>' : ""}</td></tr>
  <tr><td style="padding:20px 28px;background:#f4f0e7;border-top:1px solid #ded7c9"><p style="font-size:11px;color:#746a5c;line-height:1.6;margin:0;overflow-wrap:anywhere">Order ${e(values.order_id)}<br>Hosted by ${e(values.organizer_name || "your organizer")}<br>Need a hand? ${e(values.support_contact)}</p></td></tr></table>
  <p style="font-size:11px;color:#766d60;line-height:1.6;margin:18px 0">A little less admin. A lot more event.<br>Made for getting together. · Raunak</p>
  </td></tr></table></body></html>`;
}
