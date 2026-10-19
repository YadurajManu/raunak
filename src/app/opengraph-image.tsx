import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/constants";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/icon-192.png"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#F5F0E6",
        color: "#14120F",
        padding: "60px 75px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "65%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={`data:image/png;base64,${logo.toString("base64")}`} width={48} height={48} alt="" />
          <span style={{ fontSize: 36, letterSpacing: -2 }}>{APP_NAME}</span>
        </div>
        <span
          style={{
            fontSize: 78,
            lineHeight: 1.02,
            letterSpacing: -4,
            marginTop: 70,
          }}
        >
          Throw the event.
        </span>
        <span style={{ fontSize: 78, lineHeight: 1.02, letterSpacing: -4 }}>
          We’ll handle
        </span>
        <span
          style={{
            fontSize: 85,
            lineHeight: 1.02,
            letterSpacing: -4,
            color: "#FF4B2B",
            fontStyle: "italic",
          }}
        >
          the door.
        </span>
        <span style={{ fontSize: 21, marginTop: 32 }}>
          Your first event is free to host.
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 310,
          height: 450,
          background: "#FF4B2B",
          border: "2px solid #14120F",
          borderRadius: 22,
          transform: "rotate(7deg)",
          marginTop: 35,
          padding: 30,
        }}
      >
        <span style={{ fontSize: 15 }}>ADMIT ONE GREAT IDEA</span>
        <span style={{ fontSize: 68, lineHeight: 1.02, marginTop: 70 }}>
          Your
          <br />
          next
          <br />
          big night.
        </span>
        <span
          style={{
            fontSize: 20,
            marginTop: 40,
            borderTop: "2px dashed #14120F",
            paddingTop: 20,
          }}
        >
          ₹0 TO START ↗
        </span>
      </div>
    </div>,
    size,
  );
}
