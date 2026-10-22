import { db } from "@/server/db/client";
import { sendEmail } from "@/server/providers/email/provider";

export class PrivacyRequestError extends Error {
  constructor(
    public readonly status: 429 | 503,
    message: string,
  ) {
    super(message);
  }
}

export async function exportPersonalData(userId: string) {
  const account = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      phone: true,
      gender: true,
      city: true,
      region: true,
      countryCode: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
      locationConsentAt: true,
      emailRemindersEnabled: true,
      whatsappRemindersEnabled: true,
      interestCategories: true,
      deletionRequestedAt: true,
      createdAt: true,
    },
  });
  const bookings = await db.order.findMany({
    where: { buyerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      totalPaise: true,
      whatsappOptIn: true,
      whatsappOptInAt: true,
      event: {
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          venueName: true,
          city: true,
        },
      },
      items: {
        select: { quantity: true, ticketType: { select: { name: true } } },
      },
    },
  });
  return { exportedAt: new Date().toISOString(), account, bookings };
}

export async function requestAccountDeletion(userId: string, now = new Date()) {
  await db.user.updateMany({
    where: { id: userId, deletionRequestedAt: null },
    data: { deletionRequestedAt: now },
  });
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      deletionRequestedAt: true,
      deletionNotificationSentAt: true,
    },
  });
  const requestedAt = user.deletionRequestedAt!;
  if (user.deletionNotificationSentAt)
    return { requestedAt: requestedAt.toISOString(), pending: true as const };
  // Atomic delivery lease also throttles failed retries; an interrupted sender can retry after one minute.
  const claimed = await db.user.updateMany({
    where: {
      id: userId,
      deletionNotificationSentAt: null,
      OR: [
        { deletionNotificationAttemptAt: null },
        {
          deletionNotificationAttemptAt: {
            lte: new Date(now.getTime() - 60_000),
          },
        },
      ],
    },
    data: { deletionNotificationAttemptAt: now },
  });
  if (!claimed.count)
    throw new PrivacyRequestError(
      429,
      "Your request is recorded. Please wait a minute before retrying the notification.",
    );
  try {
    await sendEmail({
      to: "yadurajsingham@gmail.com",
      subject: "Raunak account deletion review requested",
      text: [
        "An authenticated Raunak user requested account deletion.",
        `Account: ${user.email}`,
        `Name: ${user.name || "Not supplied"}`,
        `Requested: ${requestedAt.toISOString()}`,
        "Review this request manually. No records have been deleted. Preserve records required for bookings, payments and legal obligations.",
      ].join("\n\n"),
      idempotencyKey: `privacy-${userId}-${requestedAt.getTime()}`,
    });
    await db.user.updateMany({
      where: { id: userId, deletionNotificationAttemptAt: now },
      data: { deletionNotificationSentAt: new Date() },
    });
  } catch {
    throw new PrivacyRequestError(
      503,
      "Your request is recorded, but the review email could not be sent. Please retry in a minute.",
    );
  }
  return { requestedAt: requestedAt.toISOString(), pending: true as const };
}
