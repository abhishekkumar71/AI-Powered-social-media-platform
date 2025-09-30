/*
  Warnings:

  - You are about to drop the column `twitterCodeVerifier` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "twitterCodeVerifier";
