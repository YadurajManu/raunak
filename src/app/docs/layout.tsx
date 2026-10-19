import type { Metadata } from "next";
import { Instrument_Serif, Geist_Mono } from "next/font/google";
import { DocsFrame } from "@/components/docs/docs-frame";
import { docsSearchIndex } from "@/server/docs";
import "./docs.css";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Raunak documentation", template: "%s · Raunak docs" },
  description: "Discover events, sell tickets and scan guests in. Product guides and developer documentation for Raunak.",
  openGraph: { title: "Raunak documentation", description: "A field guide to discovering, hosting and showing up.", url: "https://raunak.yaduraj.me/docs", images: [{ url: "/docs-assets/discover.webp", width: 1440, height: 1316 }] },
};

export default async function DocumentationLayout({ children }: { children: React.ReactNode }) {
  const index = await docsSearchIndex();
  return <div className={`${display.variable} ${mono.variable}`}><DocsFrame searchIndex={index}>{children}</DocsFrame></div>;
}
