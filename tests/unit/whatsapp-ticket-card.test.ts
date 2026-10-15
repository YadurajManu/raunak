import "dotenv/config";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, it } from "vitest";
import { renderTicketCard } from "@/server/tickets/card";
import { ticketUrl, verifyTicketToken } from "@/server/tickets/qr";
import { decodeMedia } from "../../services/wa-gateway/src/media";
import { decodeCard } from "../helpers/decode-qr";
it("renders a sub-1 MB ticket with a real signed QR that decodes at phone size", async () => {
  const eventId = randomUUID(), ticketId = randomUUID(), url = ticketUrl(ticketId, eventId);
  const image = await renderTicketCard({ title: "Music & stories <live>", date: "24 Oct 2026 · 6 pm IST", venue: "Riverside, Pune", holder: "Aditi Sharma", type: "General admission", code: "TEST1234", url });
  expect(await sharp(image).metadata()).toMatchObject({ width: 1080, height: 1350, format: "png" });
  expect(image.length).toBeLessThan(1024 * 1024);
  expect(await decodeCard(image)).toBe(url);
  expect(await decodeCard(await sharp(image).resize(390).png().toBuffer())).toBe(url);
  expect(verifyTicketToken(new URL(url).pathname.split("/").pop()!, eventId)).toBe(true);
  expect(decodeMedia([{ kind: "image", mimetype: "image/png", content: image.toString("base64") }])[0].buffer).toEqual(image);
});
it("rejects malformed, mismatched and oversized media at the gateway boundary", () => {
  expect(() => decodeMedia([{ kind: "image", mimetype: "image/png", content: Buffer.from("not an image").toString("base64") }])).toThrow("MEDIA_TOO_LARGE");
  expect(() => decodeMedia([{ kind: "document", mimetype: "image/jpeg", content: Buffer.from("%PDF-fake").toString("base64") }])).toThrow("MEDIA_TOO_LARGE");
  expect(() => decodeMedia([{ kind: "document", mimetype: "application/pdf", content: "invalid" }])).toThrow("MEDIA_TOO_LARGE");
});
