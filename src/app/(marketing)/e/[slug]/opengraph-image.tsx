import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { publicEvent } from "@/server/public/events";
import { variantUrl } from "@/lib/images";
import sharp from "sharp";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await publicEvent((await params).slug);
  if (!event) notFound();
  const poster = event.images.find((image) => image.kind === "POSTER") || event.images.find((image) => image.kind === "COVER");
  const posterUrl = variantUrl(poster?.variants, "og", "jpeg");
  if (posterUrl) {
    const response = await fetch(
      /^https?:\/\//.test(posterUrl)
        ? posterUrl
        : new URL(posterUrl, process.env.APP_URL || "http://localhost:3000"),
    );
    if (response.ok)
      return new Response(
        await sharp(await response.arrayBuffer())
          .resize(1200, 630, { fit: "contain", background: "#12110e" })
          .png()
          .toBuffer(),
        { headers: { "Content-Type": "image/png" } },
      );
  }
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#12110e",
        color: "white",
        fontSize: 72,
        fontWeight: 700,
        padding: 64,
      }}
    >
      {event.title}
    </div>,
    size,
  );
}
