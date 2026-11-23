-- Direct payments to a seller's own card or company account, confirmed by a receipt.
CREATE TYPE "ReceiptStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "DirectPayAccount" (
    "storeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cardNumber" TEXT,
    "cardHolder" TEXT,
    "legalName" TEXT,
    "tin" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "mfo" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectPayAccount_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentReceipt_paymentId_key" ON "PaymentReceipt"("paymentId");
CREATE INDEX "PaymentReceipt_storeId_status_submittedAt_idx" ON "PaymentReceipt"("storeId", "status", "submittedAt");

ALTER TABLE "DirectPayAccount" ADD CONSTRAINT "DirectPayAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One device per account, and a temporary block after repeated capture attempts.
ALTER TABLE "Session" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "contentBlockedUntil" TIMESTAMP(3);

-- Protected video in VIP community posts.
ALTER TABLE "Post" ADD COLUMN "videoKey" TEXT;
