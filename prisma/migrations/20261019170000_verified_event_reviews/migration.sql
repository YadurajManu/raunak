CREATE TABLE "EventReview" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "body" VARCHAR(1200),
  "firstTimerFriendly" BOOLEAN,
  "easyToReach" BOOLEAN,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EventReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "EventReview_eventId_userId_key" ON "EventReview"("eventId", "userId");
CREATE INDEX "EventReview_eventId_createdAt_idx" ON "EventReview"("eventId", "createdAt");

ALTER TABLE "EventReview"
  ADD CONSTRAINT "EventReview_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventReview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
