/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "updatedAt",
ADD COLUMN     "cookieEncrypted" TEXT,
ADD COLUMN     "cookieExpires" TIMESTAMP(3),
ADD COLUMN     "lastPostedAt" TIMESTAMP(3),
ADD COLUMN     "postingCooldownSecs" INTEGER,
ADD COLUMN     "proxyUrl" TEXT;
