import sharp, { type OverlayOptions } from "sharp";
import QRCode from "qrcode";
import {
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  QRCodeReader,
} from "@zxing/library";
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
async function readsTicket(image: Buffer, expected: string) {
  const { data, info } = await sharp(image)
    .flatten({ background: "#fff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  try {
    return (
      new QRCodeReader()
        .decode(
          new BinaryBitmap(
            new HybridBinarizer(
              new RGBLuminanceSource(
                new Uint8ClampedArray(data),
                info.width,
                info.height,
              ),
            ),
          ),
        )
        .getText() === expected
    );
  } catch {
    return false;
  }
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
  organizer?: string;
}) {
  const title = lines(input.title, 32),
    venue = lines(input.venue, 56);
  const svg = Buffer.from(
    `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#f5f0e6"/>
    <rect width="1080" height="220" fill="#244e3d"/>
    <path d="M0 220H1080" stroke="#ff593a" stroke-width="8"/>
    <g font-family="Noto Sans,Arial,sans-serif">
      <text x="54" y="92" font-family="Noto Serif,Georgia,serif" font-size="62" fill="#f5f0e6">${escape(APP_NAME)}</text>
      <text x="56" y="137" font-size="19" letter-spacing="3" fill="#ffcc4d">GOOD PEOPLE. GREAT EVENTS.</text>
      <text x="56" y="189" font-size="23" fill="#f5f0e6">${escape((input.organizer ? `Hosted by ${input.organizer}` : "A little less admin. A lot more event.").slice(0, 43))}</text>
      <text x="56" y="269" font-size="20" letter-spacing="2" fill="#a93622">${input.sample ? "PREVIEW ONLY · NOT VALID FOR ENTRY" : "BOOKED. YOU’RE ON THE LIST."}</text>
      ${title.map((line, i) => `<text x="54" y="${326 + i * 59}" font-size="51" font-weight="600" fill="#14120f">${escape(line)}</text>`).join("")}
      <text x="56" y="433" font-size="29" font-weight="600" fill="#244e3d">${escape(input.date.slice(0, 65))}</text>
      ${venue.map((line, i) => `<text x="56" y="${480 + i * 34}" font-size="27" fill="#5c564c">${escape(line)}</text>`).join("")}
      <path d="M56 545H1024" stroke="#d7cfc0"/>
      <text x="56" y="582" font-size="18" letter-spacing="2" fill="#746b5d">TICKET HOLDER</text>
      <text x="56" y="622" font-size="30" font-weight="600" fill="#14120f">${escape(input.holder.slice(0, 48))}</text>
      <text x="56" y="660" font-size="25" fill="#5c564c">${escape(input.type.slice(0, 60))}</text>
      <path d="M32 687H1048" stroke="#c9beac" stroke-dasharray="8 9"/>
      <circle cx="0" cy="687" r="20" fill="#244e3d"/><circle cx="1080" cy="687" r="20" fill="#244e3d"/>
      <rect x="32" y="710" width="1016" height="546" rx="18" fill="#ffffff"/>
      <text x="540" y="1293" text-anchor="middle" font-size="27" letter-spacing="2" fill="#244e3d" font-family="monospace">${escape(input.code.slice(0, 40))}</text>
      <text x="540" y="1330" text-anchor="middle" font-size="22" fill="#5c564c">${input.sample ? "Sample only. This QR does not grant admission." : "YOUR WAY IN · Show this QR at entry. Keep it private."}</text>
    </g></svg>`,
  );
  const overlays: OverlayOptions[] = [];
  if (input.poster) {
    try {
      overlays.push({
        input: await sharp(input.poster, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize(400, 188, { fit: "cover" })
          .png()
          .toBuffer(),
        top: 16,
        left: 664,
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
  // Some valid masks confuse the entry scanner's alignment detector. Verify the
  // finished card at delivery and phone sizes before choosing a standard mask.
  for (const maskPattern of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
    const qr = await QRCode.toBuffer(input.url, {
      scale,
      margin: 4,
      errorCorrectionLevel: "H",
      maskPattern,
      color: { dark: "#000000", light: "#ffffff" },
    });
    const card = await sharp(svg)
      .composite([
        ...overlays,
        { input: qr, top: 725, left: Math.floor((1080 - width) / 2) },
      ])
      .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
      .toBuffer();
    if (card.length >= 1024 * 1024)
      throw new Error("Ticket card exceeds the 1 MB delivery limit.");
    if (
      (await readsTicket(card, input.url)) &&
      (await readsTicket(
        await sharp(card).resize(390).png().toBuffer(),
        input.url,
      ))
    )
      return card;
  }
  throw new Error("Could not render a reliably scannable ticket card.");
}
