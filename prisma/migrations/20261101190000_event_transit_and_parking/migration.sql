-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_station_name" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_line_name" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_line_color" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_distance_m" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_walk_min" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "transit_source" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "parking_type" TEXT DEFAULT 'unknown';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "parking_note" VARCHAR(500);
