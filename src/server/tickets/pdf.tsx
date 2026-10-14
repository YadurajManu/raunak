import React from "react";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  Image as PdfImage,
  View,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/server/db/client";
import { storage } from "@/server/providers/storage/s3";
import { ticketUrl } from "./qr";
import { variantUrl } from "@/lib/images";
Font.register({
  family: "Raunak Sans",
  src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
});
Font.register({
  family: "Raunak Devanagari",
  src: path.join(process.cwd(), "public/fonts/NotoSansDevanagari-Regular.ttf"),
});

export async function ticketPdf(ticketId: string) {
  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      event: { include: { images: { where: { kind: "POSTER" }, take: 1 } } },
      ticketType: true,
      order: true,
    },
  });
  if (ticket.order.status !== "PAID")
    throw new Error("This order has no active ticket PDF.");
  const event = ticket.event;
  const qr = await QRCode.toDataURL(ticketUrl(ticket.id, event.id), {
    width: 360,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  let poster: Buffer | undefined;
  const image = event.images[0];
  if (image?.variants) {
    try {
      const card = variantUrl(image.variants, "card");
      const prefix = `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "")}/`;
      const key = card?.startsWith(prefix) ? decodeURIComponent(card.slice(prefix.length)) : `${image.storageKey.replace("/original/", "/variants/")}/card.jpg`;
      poster = await storage.read(
        key,
        5 * 1024 * 1024,
      );
    } catch {
      /* The QR remains usable when artwork is unavailable. */
    }
  }
  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(event.startsAt);
  return renderToBuffer(
    <Document title={`${event.title} - ${ticket.code}`} author="Raunak">
      <Page
        size="A5"
        style={{
          padding: 28,
          backgroundColor: "#f4f1eb",
          color: "#25241f",
          fontFamily: ["Raunak Sans", "Raunak Devanagari"],
          fontSize: 10,
        }}
      >
        <Text style={{ color: "#bd452c", fontSize: 22, marginBottom: 16 }}>
          raunak.
        </Text>
        <Text style={{ fontSize: 9, color: "#234d3c", marginBottom: 10 }}>YOUR WAY IN · ENTRY TICKET</Text>
        {poster && (
          <PdfImage
            src={{ data: poster, format: "jpg" }}
            style={{
              width: "100%",
              height: 115,
              objectFit: "cover",
              marginBottom: 16,
            }}
          />
        )}
        <Text style={{ fontSize: 24, marginBottom: 12 }}>{event.title}</Text>
        <Text style={{ marginBottom: 8 }}>{date}</Text>
        <Text>
          {event.venueName || (event.mode === "ONLINE" ? "Online event" : "Venue to be announced")}
          {event.city ? `, ${event.city}` : ""}
        </Text>
        {event.address && <Text style={{ marginTop: 5 }}>{event.address}</Text>}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: "#c6c1b6",
            marginTop: 18,
            paddingTop: 16,
          }}
        >
          <Text style={{ fontSize: 15 }}>{ticket.holderName}</Text>
          <Text style={{ marginTop: 6 }}>{ticket.ticketType.name}</Text>
        </View>
        <PdfImage
          src={qr}
          style={{
            width: 145,
            height: 145,
            alignSelf: "center",
            marginTop: 12,
          }}
        />
        <Text style={{ textAlign: "center", fontSize: 13 }}>{ticket.code}</Text>
        <Text style={{ textAlign: "center", marginTop: 8 }}>
          Present this QR at entry. Each ticket admits one person.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 8 }}>
          Keep this ticket private. Sharing it may let another person enter
          first.
        </Text>
      </Page>
    </Document>,
  );
}
export async function prepareTicketPdfs(orderId: string) {
  const tickets = await db.ticket.findMany({
    where: { orderId, order: { status: "PAID" }, pdfKey: null },
  });
  for (const ticket of tickets) {
    try {
      const pdf = await ticketPdf(ticket.id);
      const key = `tickets/${ticket.eventId}/${ticket.id}.pdf`;
      await storage.write(key, pdf, "application/pdf");
      await db.ticket.update({
        where: { id: ticket.id },
        data: { pdfKey: key, pdfError: null },
      });
    } catch (error) {
      await db.ticket.update({
        where: { id: ticket.id },
        data: { pdfError: "Ticket PDF could not be prepared. Please retry." },
      });
      throw error;
    }
  }
}
