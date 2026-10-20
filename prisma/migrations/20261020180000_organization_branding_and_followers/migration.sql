-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "coverPosition" TEXT DEFAULT 'center';
ALTER TABLE "Organization" ADD COLUMN "highlights" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "OrganizationFollower" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFollower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationFollower_userId_orgId_key" ON "OrganizationFollower"("userId", "orgId");

-- CreateIndex
CREATE INDEX "OrganizationFollower_orgId_idx" ON "OrganizationFollower"("orgId");

-- CreateIndex
CREATE INDEX "OrganizationFollower_userId_idx" ON "OrganizationFollower"("userId");

-- AddForeignKey
ALTER TABLE "OrganizationFollower" ADD CONSTRAINT "OrganizationFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollower" ADD CONSTRAINT "OrganizationFollower_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
