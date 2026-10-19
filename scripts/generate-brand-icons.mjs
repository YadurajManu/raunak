import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL("../public/brand/", import.meta.url);
await mkdir(output, { recursive: true });
const dark = await sharp(fileURLToPath(new URL("../bgdarklogo.png", import.meta.url)))
  .trim({ threshold: 40 })
  .resize(650, 548, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await writeFile(new URL("mark-dark.png", output), dark);

// Opaque paper keeps the real ink mark readable on either browser chrome theme.
const mark = fileURLToPath(new URL("../src/image.png", import.meta.url));
async function icon(size, padding = 0.12) {
  const artwork = await sharp(mark).resize(Math.round(size * (1 - padding * 2)), Math.round(size * (1 - padding * 2)), { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 245, g: 240, b: 230, alpha: 1 } } })
    .composite([{ input: artwork, gravity: "centre" }]).ensureAlpha(1).png().toBuffer();
}
for (const [name, size, padding] of [["icon-32.png", 32, 0.06], ["apple-touch-icon.png", 180, 0.12], ["icon-192.png", 192, 0.12], ["icon-512.png", 512, 0.12], ["icon-maskable-512.png", 512, 0.2]]) {
  await writeFile(new URL(name, output), await icon(size, padding));
}
const entries = await Promise.all([16, 32].map((size) => icon(size, 0.06)));
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((png, i) => {
  const at = 6 + i * 16;
  header[at] = [16, 32][i];
  header[at + 1] = [16, 32][i];
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, ...entries]));
const universal = await icon(192, 0.12);
await writeFile(new URL("../src/app/icon.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,${universal.toString("base64")}"/></svg>\n`);
console.log("Generated theme-aware brand mark and opaque 16–512px app icons.");
