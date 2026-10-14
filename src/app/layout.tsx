import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Event management and ticketing for organizers in India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.className}>{children}</body>
    </html>
  );
}
