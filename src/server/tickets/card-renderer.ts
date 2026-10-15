import sharp, { type OverlayOptions } from "sharp";
import QRCode from "qrcode";
import { APP_NAME } from "@/lib/constants";

function escape(value: string) {
  return value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
}
function lines(value: string, width: number, max = 2) {
  const words = value.replace(/\s+/g, " ").trim().split(" "),
    result: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width && current) {
      result.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) result.push(current);
  return result
    .slice(0, max)
    .map(
      (line, index) =>
        line.slice(0, width) +
        ((index === max - 1 && result.length > max) || line.length > width
          ? "…"
          : ""),
    );
}
export async function renderTicketCard(input: {
  title: string;
  date: string;
  venue: string;
  holder: string;
  type: string;
  code: string;
  url: string;
  poster?: Buffer;
  sample?: boolean;
}) {
  const title = lines(input.title, 35),
    venue = lines(input.venue, 58);
  const svg = Buffer.from(
    `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1350" fill="#f5f0e6"/><rect width="1080" height="300" fill="#244e3d"/><g font-family="Noto Sans,Arial,sans-serif" fill="#14120f"><text x="60" y="350" font-size="32" fill="#aa301b">${escape(APP_NAME)} · ${input.sample ? "SAMPLE — NOT VALID FOR ENTRY" : "YOUR WAY IN"}</text>${title.map((line, i) => `<text x="60" y="${410 + i * 57}" font-size="49" font-weight="600">${escape(line)}</text>`).join("")}<text x="60" y="530" font-size="29">${escape(input.date.slice(0, 65))}</text>${venue.map((line, i) => `<text x="60" y="${575 + i * 33}" font-size="27" fill="#5c564c">${escape(line)}</text>`).join("")}<text x="60" y="660" font-size="31">${escape(input.holder.slice(0, 48))}</text><text x="60" y="700" font-size="25" fill="#5c564c">${escape(input.type.slice(0, 60))}</text><text x="540" y="1285" text-anchor="middle" font-size="32" font-family="monospace">${escape(input.code.slice(0, 40))}</text><text x="540" y="1330" text-anchor="middle" font-size="23">${input.sample ? "Connection test only. No admission ticket is issued." : "Keep this ticket private. Present the QR at entry."}</text></g></svg>`,
  );
  const overlays: OverlayOptions[] = [];
  if (input.poster) {
    try {
      overlays.push({
        input: await sharp(input.poster, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize(1080, 300, { fit: "cover" })
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      });
    } catch {
      /* Artwork failure must not remove the entry QR. */
    }
  }
  const modules = QRCode.create(input.url, { errorCorrectionLevel: "H" })
    .modules.size;
  const scale = Math.max(1, Math.floor(520 / (modules + 8)));
  const width = (modules + 8) * scale;
  // Integer module pixels avoid uneven QR edges; preserve a four-module quiet zone.
  const qr = await QRCode.toBuffer(input.url, {
    scale,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  overlays.push({ input: qr, top: 725, left: Math.floor((1080 - width) / 2) });
  const card = await sharp(svg)
    .composite(overlays)
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
    .toBuffer();
  if (card.length >= 1024 * 1024)
    throw new Error("Ticket card exceeds the 1 MB delivery limit.");
  return card;
}
