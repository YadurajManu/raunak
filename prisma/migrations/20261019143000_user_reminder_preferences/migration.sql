ALTER TABLE "User"
  ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "whatsappRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;
