import { Instrument_Serif, Geist_Mono } from "next/font/google";
import "@/app/(marketing)/marketing.css";
import "@/app/(marketing)/workspace.css";
import "@/app/(marketing)/discover.css";
import "@/app/(marketing)/media.css";
import "@/app/(marketing)/media-editor.css";
import "@/app/(marketing)/tickets.css";
import "@/app/(marketing)/operations.css";
import "@/app/(marketing)/marketplace.css";
import "@/app/(marketing)/site-polish.css";
import "@/app/(marketing)/global-navigation.css";
import "@/app/(marketing)/discovery-premium.css";
import "@/app/(marketing)/event-actions.css";
import "@/app/(marketing)/checkin.css";
import "@/app/(marketing)/calm-ui.css";

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  preload: false,
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  preload: false,
  display: "swap",
});
export default function PersonalPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`marketing ${display.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
