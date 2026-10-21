import { Instrument_Serif, Geist_Mono } from "next/font/google";
import "@/app/(marketing)/marketing.css";
import "@/app/(marketing)/marketplace.css";
import "@/app/(marketing)/discovery-premium.css";
import "@/app/(marketing)/account/account-plans.css";
import "@/app/(marketing)/calm-ui.css";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`marketing ${display.variable} ${mono.variable}`}>{children}</div>;
}
