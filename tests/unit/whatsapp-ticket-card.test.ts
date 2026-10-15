import "dotenv/config";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, it } from "vitest";
import { renderTicketCard } from "@/server/tickets/card";
import { ticketUrl, verifyTicketToken } from "@/server/tickets/qr";
import { decodeMedia } from "../../services/wa-gateway/src/media";
import { decodeCard } from "../helpers/decode-qr";
it("renders a sub-1 MB ticket with a real signed QR that decodes at phone size", async () => {
  const eventId = randomUUID(),
    ticketId = randomUUID(),
    url = ticketUrl(ticketId, eventId);
  const image = await renderTicketCard({
    title: "Music & stories <live>",
    date: "24 Oct 2026 · 6 pm IST",
    venue: "Riverside, Pune",
    holder: "Aditi Sharma",
    type: "General admission",
    code: "TEST1234",
    url,
  });
  expect(await sharp(image).metadata()).toMatchObject({
    width: 1080,
    height: 1350,
    format: "png",
  });
  expect(image.length).toBeLessThan(1024 * 1024);
  expect(await decodeCard(image)).toBe(url);
  expect(
    await decodeCard(await sharp(image).resize(390).png().toBuffer()),
  ).toBe(url);
  expect(
    verifyTicketToken(new URL(url).pathname.split("/").pop()!, eventId),
  ).toBe(true);
  expect(
    decodeMedia([
      {
        kind: "image",
        mimetype: "image/png",
        content: image.toString("base64"),
      },
    ])[0].buffer,
  ).toEqual(image);
});
it("rejects malformed, mismatched and oversized media at the gateway boundary", () => {
  expect(() =>
    decodeMedia([
      {
        kind: "image",
        mimetype: "image/png",
        content: Buffer.from("not an image").toString("base64"),
      },
    ]),
  ).toThrow("MEDIA_TOO_LARGE");
  expect(() =>
    decodeMedia([
      {
        kind: "document",
        mimetype: "image/jpeg",
        content: Buffer.from("%PDF-fake").toString("base64"),
      },
    ]),
  ).toThrow("MEDIA_TOO_LARGE");
  expect(() =>
    decodeMedia([
      { kind: "document", mimetype: "application/pdf", content: "invalid" },
    ]),
  ).toThrow("MEDIA_TOO_LARGE");
});
it("keeps the signed QR readable with artwork, long labels and an unavailable poster", async () => {
  const url = ticketUrl(randomUUID(), randomUUID());
  const poster = await sharp(
    Buffer.from(
      '<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="400" fill="#ff593a"/><circle cx="300" cy="200" r="150" fill="#ffcc4d"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  for (const artwork of [poster, Buffer.from("unavailable artwork")]) {
    const image = await renderTicketCard({
      title:
        "An exceptionally long event title that should wrap safely without obscuring any important ticket details",
      date: "24 Oct 2026 · 6:00 pm IST",
      venue:
        "A long venue address with neighbourhood and city information, Mumbai, Maharashtra",
      holder: "Aditi Sharma",
      organizer: "Independent Arts & Culture Collective",
      type: "General admission",
      code: "PREVIEW123",
      url,
      poster: artwork,
    });
    expect(image.length).toBeLessThan(1024 * 1024);
    expect(await decodeCard(image)).toBe(url);
    expect(
      await decodeCard(await sharp(image).resize(390).png().toBuffer()),
    ).toBe(url);
  }
});
it("decodes different signed payloads reliably across integer module sizes", async () => {
  for (let index = 1; index <= 12; index++) {
    const url = ticketUrl(
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      "00000000-0000-4000-8000-000000000099",
    );
    const image = await renderTicketCard({
      title: "A night worth showing up for",
      date: "24 Oct 2026",
      venue: "Pune",
      holder: "Guest",
      type: "Admission",
      code: `ABCDEF${index}`,
      url,
    });
    expect(await decodeCard(image)).toBe(url);
    expect(
      await decodeCard(await sharp(image).resize(390).png().toBuffer()),
    ).toBe(url);
  }
});
