-- Explicit resends use a new dedupeKey; automatic retries retain their existing key.
DROP INDEX IF EXISTS "NotificationLog_order_trigger_channel_key";
DROP INDEX IF EXISTS "NotificationLog_ticket_trigger_channel_key";
