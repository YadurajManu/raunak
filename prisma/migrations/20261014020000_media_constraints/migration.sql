CREATE UNIQUE INDEX "EventImage_storageKey_key" ON "EventImage"("storageKey");
CREATE UNIQUE INDEX "EventImage_one_poster" ON "EventImage"("eventId") WHERE "kind" = 'POSTER';
CREATE UNIQUE INDEX "EventImage_one_cover" ON "EventImage"("eventId") WHERE "kind" = 'COVER';
