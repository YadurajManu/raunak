CREATE TYPE "WhatsAppMode" AS ENUM ('DISABLED', 'PLATFORM_NUMBER', 'ORG_NUMBER', 'OFFICIAL_API');
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('DISCONNECTED', 'QR_PENDING', 'CONNECTING', 'CONNECTED', 'LOGGED_OUT', 'BANNED_SUSPECTED', 'PAUSED');
CREATE TYPE "WhatsAppSuppressionReason" AS ENUM ('STOP_REPLY', 'NOT_ON_WHATSAPP', 'MANUAL', 'COMPLAINT');
ALTER TABLE "Organization" ADD COLUMN "whatsappMode" "WhatsAppMode" NOT NULL DEFAULT 'DISABLED';
ALTER TABLE "Order" ADD COLUMN "whatsappOptInAt" TIMESTAMPTZ(6);
ALTER TABLE "Order" ADD CONSTRAINT "Order_whatsapp_phone_required" CHECK (NOT "whatsappOptIn" OR NULLIF(TRIM("buyerPhone"), '') IS NOT NULL);
ALTER TABLE "MessageTemplate" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '{"ticketCard":true,"ticketPdf":false,"poster":false}';
CREATE TABLE "WhatsAppSession" (
  "id" UUID NOT NULL, "orgId" UUID, "label" TEXT NOT NULL DEFAULT 'default',
  "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'DISCONNECTED', "phoneE164" TEXT, "pushName" TEXT,
  "authStateEnc" BYTEA, "authVersion" INTEGER NOT NULL DEFAULT 0,
  "connectedAt" TIMESTAMPTZ(6), "lastSeenAt" TIMESTAMPTZ(6), "lastError" TEXT,
  "warmupStartedAt" TIMESTAMPTZ(6), "dailyCapOverride" INTEGER, "createdByUserId" UUID,
  "pausedUntil" TIMESTAMPTZ(6), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppSession_dailyCapOverride_check" CHECK ("dailyCapOverride" IS NULL OR "dailyCapOverride" BETWEEN 1 AND 10000)
);
CREATE UNIQUE INDEX "WhatsAppSession_orgId_label_key" ON "WhatsAppSession"("orgId", "label");
CREATE UNIQUE INDEX "WhatsAppSession_platform_label_key" ON "WhatsAppSession"("label") WHERE "orgId" IS NULL;
CREATE TABLE "WhatsAppSuppression" (
  "id" UUID NOT NULL, "orgId" UUID, "phoneE164" TEXT NOT NULL,
  "reason" "WhatsAppSuppressionReason" NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppSuppression_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppSuppression_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppSuppression_orgId_phoneE164_key" ON "WhatsAppSuppression"("orgId", "phoneE164");
CREATE UNIQUE INDEX "WhatsAppSuppression_global_phone_key" ON "WhatsAppSuppression"("phoneE164") WHERE "orgId" IS NULL;
ALTER TABLE "NotificationLog" ADD COLUMN "sessionId" UUID, ADD COLUMN "attachmentsSent" JSONB, ADD COLUMN "errorCode" TEXT;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "NotificationLog_sessionId_providerMessageId_idx" ON "NotificationLog"("sessionId", "providerMessageId");
