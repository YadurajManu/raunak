-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "tagline" VARCHAR(160);
ALTER TABLE "Organization" ADD COLUMN "bio" VARCHAR(2000);
ALTER TABLE "Organization" ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Organization" ADD COLUMN "coverKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "profileVisible" BOOLEAN NOT NULL DEFAULT true;
