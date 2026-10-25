ALTER TYPE "MessageTrigger" ADD VALUE 'ATTENDEE_BROADCAST';

ALTER TABLE "NotificationLog"
  ADD COLUMN "campaignText" TEXT;
