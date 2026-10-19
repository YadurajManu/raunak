import { Instrument_Serif, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./marketing.css";
import "./workspace.css";
import "./discover.css";
import "./media.css";
import "./media-editor.css";
import "./tickets.css";
import "./operations.css";
import "./marketplace.css";
import "./site-polish.css";
import "./global-navigation.css";
import "./discovery-premium.css";
import "./event-actions.css";
import "./checkin.css";
import { GlobalNavbar } from "@/components/global-navbar";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
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

async function SignedInGlobalNavbar() {
  const user = await currentUser();
  const organizations = user
    ? await db.organizationMember.findMany({
        where: { userId: user.id, status: "ACTIVE", org: { status: "ACTIVE" } },
        select: { orgId: true, org: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  return (
    <GlobalNavbar
      organizations={organizations.map(({ orgId, org }) => ({
        id: orgId,
        name: org.name,
      }))}
      preferences={
        user
          ? {
              emailRemindersEnabled: user.emailRemindersEnabled,
              whatsappRemindersEnabled: user.whatsappRemindersEnabled,
            }
          : undefined
      }
      user={
        user
          ? { name: user.name, email: user.email, avatarKey: user.avatarKey }
          : null
      }
    />
  );
}

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
      <Suspense fallback={<GlobalNavbar user={null} loading />}>
        <SignedInGlobalNavbar />
      </Suspense>
      <div id="site-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
