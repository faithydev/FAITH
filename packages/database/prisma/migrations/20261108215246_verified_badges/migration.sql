-- CreateEnum
CREATE TYPE "BadgeStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "badgeKind" TEXT;

-- CreateTable
CREATE TABLE "VerifiedBadge" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "BadgeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedBadge_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "VerifiedBadge_status_grantAt_idx" ON "VerifiedBadge"("status", "grantAt");

-- AddForeignKey
ALTER TABLE "VerifiedBadge" ADD CONSTRAINT "VerifiedBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
