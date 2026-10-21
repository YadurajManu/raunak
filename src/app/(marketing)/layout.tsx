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
import "./calm-ui.css";
import { GlobalNavbar } from "@/components/global-navbar";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { SmoothScroll } from "@/lib/motion/smooth-scroll";
import { ticketToken } from "@/server/tickets/qr";
import { navigationFor } from "@/config/nav";

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
  const membershipRows = user
    ? await db.organizationMember.findMany({
        where: { userId: user.id, status: "ACTIVE", org: { status: "ACTIVE" } },
        select: { orgId: true, role: true, org: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const memberships = membershipRows.map(({ orgId, role, org }) => ({
    id: orgId,
    name: org.name,
    role,
  }));
  const checkinAssignment = user
    ? await db.eventStaff.findFirst({
        where: {
          userId: user.id,
          role: "CHECKIN",
          event: { status: "PUBLISHED", deletedAt: null },
        },
        select: { eventId: true },
        orderBy: { event: { startsAt: "asc" } },
      })
    : null;
  const now = new Date();
  const ticketWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [todayTicketCount, firstTodayTicket, unreadCount] = user
    ? await Promise.all([
        db.ticket.count({
          where: {
            status: "VALID",
            order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
            event: { startsAt: { lte: ticketWindowEnd }, endsAt: { gt: now } },
          },
        }),
        db.ticket.findFirst({
          where: {
            status: "VALID",
            order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
            event: { startsAt: { lte: ticketWindowEnd }, endsAt: { gt: now } },
          },
          select: { id: true, eventId: true, event: { select: { title: true } } },
          orderBy: { event: { startsAt: "asc" } },
        }),
        db.inAppNotification.count({ where: { userId: user.id, readAt: null } }),
      ])
    : [0, null, 0];
  let ticketHref = "/my-tickets?tab=upcoming";
  if (firstTodayTicket) {
    try {
      ticketHref = `/t/${ticketToken(firstTodayTicket.id, firstTodayTicket.eventId)}`;
    } catch {
      ticketHref = `/my-tickets/${firstTodayTicket.id}`;
    }
  }
  const todayTicket = firstTodayTicket
    ? { count: todayTicketCount, title: firstTodayTicket.event.title, href: ticketHref }
    : null;
  const navigation = navigationFor({
    signedIn: Boolean(user),
    memberships,
    assignedCheckInEventId: checkinAssignment?.eventId,
  });
  return (
    <GlobalNavbar
      organizations={memberships.map(({ id, name }) => ({ id, name }))}
      navigation={navigation}
      city={user?.city || null}
      todayTicket={todayTicket}
      initialUnreadCount={unreadCount}
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
