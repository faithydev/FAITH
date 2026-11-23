-- Paid video under DRM, hosted by the DRM provider.
CREATE TABLE "DrmVideo" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrmVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrmVideo_ownerId_idx" ON "DrmVideo"("ownerId");
ALTER TABLE "DrmVideo" ADD CONSTRAINT "DrmVideo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lesson" ADD COLUMN "drmVideoId" TEXT;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_drmVideoId_fkey" FOREIGN KEY ("drmVideoId") REFERENCES "DrmVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD COLUMN "drmVideoId" TEXT;
ALTER TABLE "Post" ADD CONSTRAINT "Post_drmVideoId_fkey" FOREIGN KEY ("drmVideoId") REFERENCES "DrmVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
