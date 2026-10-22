ALTER TABLE "User"
  ADD COLUMN "interestCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "deletionRequestedAt" TIMESTAMPTZ(6),
  ADD COLUMN "deletionNotificationSentAt" TIMESTAMPTZ(6),
  ADD COLUMN "deletionNotificationAttemptAt" TIMESTAMPTZ(6);
