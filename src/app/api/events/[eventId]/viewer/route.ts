import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { ticketToken } from "@/server/tickets/qr";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const parsed = z.uuid().safeParse((await params).eventId);
  if (!parsed.success)
    return Response.json(
      { error: "Event not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );

  const event = await db.event.findFirst({
    where: { id: parsed.data, deletedAt: null },
    select: {
      id: true,
      slug: true,
      orgId: true,
      mode: true,
      onlineUrl: true,
      status: true,
      visibility: true,
      isTest: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!event)
    return Response.json(
      { error: "Event not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );

  const user = await currentUser();
  if (!user) {
    const publicEvent =
      (event.status === "PUBLISHED" ||
        event.status === "ENDED" ||
        event.status === "CANCELLED") &&
      (event.visibility === "PUBLIC" || event.visibility === "UNLISTED") &&
      !event.isTest;
    if (!publicEvent)
      return Response.json(
        { error: "Event not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    return Response.json(
      {
        authenticated: false,
        saved: false,
        isFollowing: false,
        followerCount: 0,
        ticketCount: 0,
        teamRole: null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  let hasEventAccess = false;
  try {
    await requireEventAccessForUser(user.id, event.id, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "CHECKIN",
      "FINANCE",
    ]);
    hasEventAccess = true;
  } catch {
    // A hidden, draft or test event should look absent to non-team viewers.
  }
  const publicEvent =
    (event.status === "PUBLISHED" ||
      event.status === "ENDED" ||
      event.status === "CANCELLED") &&
    (event.visibility === "PUBLIC" || event.visibility === "UNLISTED") &&
    !event.isTest;
  if (!publicEvent && !hasEventAccess)
    return Response.json(
      { error: "Event not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );

  const [validTickets, saved, followerCount, following, membership, ownReview, reviewTicket] =
    await Promise.all([
      db.ticket.findMany({
        where: {
          eventId: event.id,
          status: "VALID",
          order: {
            buyerId: user.id,
            status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
          },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      db.savedEvent.findUnique({
        where: { userId_eventId: { userId: user.id, eventId: event.id } },
        select: { eventId: true },
      }),
      db.organizationFollower.count({ where: { orgId: event.orgId } }),
      db.organizationFollower.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: event.orgId } },
        select: { id: true },
      }),
      db.organizationMember.findUnique({
        where: { orgId_userId: { orgId: event.orgId, userId: user.id } },
        select: { role: true, status: true },
      }),
      db.eventReview.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        select: {
          rating: true,
          body: true,
          firstTimerFriendly: true,
          easyToReach: true,
        },
      }),
      db.ticket.findFirst({
        where: {
          eventId: event.id,
          status: { in: ["VALID", "USED"] },
          order: {
            buyerId: user.id,
            status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
          },
        },
        select: { id: true },
      }),
    ]);

  let teamRole: string | null = null;
  if (membership?.status === "ACTIVE" && hasEventAccess)
    teamRole = membership.role;

  const ticketCount =
    event.status !== "CANCELLED" && event.endsAt > new Date()
      ? validTickets.length
      : 0;
  let ticketHref: string | null = null;
  if (validTickets[0]) {
    try {
      ticketHref = `/t/${ticketToken(validTickets[0].id, event.id)}`;
    } catch {
      ticketHref = "/account";
    }
  }

  const mayReview =
    (event.status === "PUBLISHED" || event.status === "ENDED") &&
    event.visibility === "PUBLIC" &&
    !event.isTest &&
    event.endsAt <= new Date() &&
    Boolean(reviewTicket);
  const canManage =
    teamRole === "OWNER" || teamRole === "ADMIN" || teamRole === "MANAGER";
  const links = teamRole
    ? {
        edit: canManage ? `/dashboard/events/${event.id}/details` : null,
        orders: ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(teamRole)
          ? `/dashboard/events/${event.id}`
          : null,
        checkIn: ["OWNER", "ADMIN", "MANAGER", "CHECKIN"].includes(teamRole)
          ? `/dashboard/events/${event.id}/check-in`
          : null,
        preview: `/e/${event.slug}?preview=visitor`,
      }
    : null;

  return Response.json(
    {
      authenticated: true,
      saved: Boolean(saved),
      isFollowing: Boolean(following),
      followerCount,
      ticketCount,
      ticketHref,
      onlineUrl:
        ticketCount && event.mode !== "IN_PERSON" ? event.onlineUrl : null,
      teamRole,
      managementLinks: links,
      canReview: mayReview,
      ownReview: mayReview ? ownReview : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
