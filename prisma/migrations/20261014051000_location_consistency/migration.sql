ALTER TABLE "User" DROP CONSTRAINT "user_location_valid";
ALTER TABLE "User" ADD CONSTRAINT "user_location_valid" CHECK (("latitude" IS NULL AND "longitude" IS NULL AND "locationConsentAt" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "locationConsentAt" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));
