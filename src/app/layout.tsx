import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-ui" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: APP_NAME,
  description: "Event management and ticketing for organizers in India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("raunak-theme");if(t)document.documentElement.dataset.marketingTheme=t}catch(e){}` }} /></head>
      <body className={`${geist.variable} ${geist.className}`}>{children}</body>
    </html>
  );
}
