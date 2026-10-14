import { Instrument_Serif, Geist_Mono } from "next/font/google";
import "./marketing.css";
import "./workspace.css";
import "./discover.css";
import { SmoothScroll } from "@/lib/motion/smooth-scroll";

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

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`marketing ${display.variable} ${mono.variable}`}>
      <SmoothScroll />
      <noscript>
        <style>{`.marketing .m-reveal,.marketing .m-mini-bubble,.marketing .m-paid-stamp{opacity:1!important;transform:none!important}.marketing .m-word-mask>span{transform:none!important}`}</style>
      </noscript>
      {children}
    </div>
  );
}
