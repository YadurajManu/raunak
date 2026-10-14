import { Instrument_Serif, Geist_Mono } from "next/font/google";
import "./marketing.css";
import { SmoothScroll } from "@/lib/motion/smooth-scroll";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`marketing ${display.variable} ${mono.variable}`}><SmoothScroll />{children}</div>;
}
