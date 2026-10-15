import sharp, { type OverlayOptions } from "sharp";
import QRCode from "qrcode";
import { APP_NAME } from "@/lib/constants";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { variantUrl } from "@/lib/images";
import { ticketUrl } from "./qr";

function escape(value: string) { return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!); }
function lines(value: string, width: number, max = 2) {
  const words = value.replace(/\s+/g, " ").trim().split(" "), result: string[] = []; let current = "";
  for (const word of words) { if (`${current} ${word}`.trim().length > width && current) { result.push(current); current = word; } else current = `${current} ${word}`.trim(); }
  if (current) result.push(current);
  return result.slice(0, max).map((line, index) => line.slice(0, width) + (index === max - 1 && result.length > max || line.length > width ? "…" : ""));
}
export async function eventPoster(eventId: string) {
  const image = await db.eventImage.findFirst({ where: { eventId, kind: "POSTER", processingError: null }, orderBy: { sortOrder: "asc" } });
  if (!image?.variants) return undefined;
  const url = variantUrl(image.variants, "card"), prefix = `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "")}/`;
  if (!url?.startsWith(prefix)) return undefined;
  const key = decodeURIComponent(url.slice(prefix.length));
  if (!key.startsWith(`orgs/`) && !key.startsWith(`events/`)) return undefined;
  try { return await storage.read(key, 5 * 1024 * 1024); } catch { return undefined; }
}
export async function renderTicketCard(input: { title: string; date: string; venue: string; holder: string; type: string; code: string; url: string; poster?: Buffer; sample?: boolean }) {
  const title = lines(input.title, 35), venue = lines(input.venue, 58);
  const svg = Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1350" fill="#f5f0e6"/><rect width="1080" height="320" fill="#244e3d"/><g font-family="Noto Sans,Arial,sans-serif" fill="#14120f"><text x="60" y="378" font-size="32" fill="#aa301b">${escape(APP_NAME)} · ${input.sample ? "SAMPLE — NOT VALID FOR ENTRY" : "YOUR WAY IN"}</text>${title.map((line, i) => `<text x="60" y="${438 + i * 57}" font-size="49" font-weight="600">${escape(line)}</text>`).join("")}<text x="60" y="553" font-size="29">${escape(input.date.slice(0, 65))}</text>${venue.map((line, i) => `<text x="60" y="${600 + i * 33}" font-size="27" fill="#5c564c">${escape(line)}</text>`).join("")}<text x="60" y="687" font-size="31">${escape(input.holder.slice(0, 48))}</text><text x="60" y="724" font-size="25" fill="#5c564c">${escape(input.type.slice(0, 60))}</text><text x="540" y="1263" text-anchor="middle" font-size="32" font-family="monospace">${escape(input.code.slice(0, 40))}</text><text x="540" y="1310" text-anchor="middle" font-size="23">${input.sample ? "Connection test only. No admission ticket is issued." : "Keep this ticket private. Present the QR at entry."}</text></g></svg>`);
  const overlays: OverlayOptions[] = [];
  if (input.poster) {
    try { overlays.push({ input: await sharp(input.poster, { limitInputPixels: 40_000_000 }).rotate().resize(1080, 320, { fit: "cover" }).png().toBuffer(), top: 0, left: 0 }); } catch { /* Artwork failure must not remove the entry QR. */ }
  }
  const qr = await QRCode.toBuffer(input.url, { width: 470, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  overlays.push({ input: qr, top: 755, left: 305 });
  const card = await sharp(svg).composite(overlays).png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 }).toBuffer();
  if (card.length >= 1024 * 1024) throw new Error("Ticket card exceeds the 1 MB delivery limit.");
  return card;
}
export async function ticketCard(ticketId: string) {
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { event: true, ticketType: true, order: true } });
  if (ticket.order.status !== "PAID" || ticket.status !== "VALID" || ticket.event.status === "CANCELLED" || ticket.event.deletedAt) throw new Error("This ticket is no longer valid for entry.");
  const event = ticket.event;
  return renderTicketCard({ title: event.title, date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(event.startsAt), venue: [event.venueName || (event.mode === "ONLINE" ? "Online event" : event.address || "Venue to be announced"), event.city].filter(Boolean).join(", "), holder: ticket.holderName, type: ticket.ticketType.name, code: ticket.code, url: ticketUrl(ticket.id, event.id), poster: await eventPoster(event.id) });
}
