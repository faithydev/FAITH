-- CreateTable
CREATE TABLE "PaymentCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "holder" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCard_userId_idx" ON "PaymentCard"("userId");

-- AddForeignKey
ALTER TABLE "PaymentCard" ADD CONSTRAINT "PaymentCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
