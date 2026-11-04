import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";
import "./theme-tokens.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-ui" });

export const metadata: Metadata = {
  metadataBase: new URL("https://raunak.yaduraj.me"),
  title: APP_NAME,
  description: "Raunak helps organizers in India create events, sell tickets, send QR tickets by email, and check guests in. WhatsApp delivery depends on event settings.",
  openGraph: { siteName: APP_NAME, locale: "en_IN", type: "website", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
  manifest: "/manifest.webmanifest",
  icons: { apple: "/brand/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([{ "@context": "https://schema.org", "@type": "Organization", name: APP_NAME, url: "https://raunak.yaduraj.me", logo: "https://raunak.yaduraj.me/brand/icon-512.png" }, { "@context": "https://schema.org", "@type": "WebSite", name: APP_NAME, url: "https://raunak.yaduraj.me" }]) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("raunak-theme");if(t==="light"||t==="dark")document.documentElement.dataset.marketingTheme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geist.className}`}>{children}</body>
    </html>
  );
}
