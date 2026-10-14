ALTER TYPE "NotificationStatus" ADD VALUE 'SENDING';
ALTER TYPE "NotificationStatus" ADD VALUE 'SKIPPED';
ALTER TABLE "Order" ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "fulfilmentQueuedAt" TIMESTAMPTZ(6);
ALTER TABLE "NotificationLog" ADD COLUMN "dedupeKey" TEXT;
UPDATE "NotificationLog" SET "dedupeKey" = id::text;
ALTER TABLE "NotificationLog" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");
