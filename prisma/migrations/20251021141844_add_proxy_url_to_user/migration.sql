/*
  Warnings:

  - You are about to drop the `Proxy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Proxy" DROP CONSTRAINT "Proxy_assignedToId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "proxyUrl" TEXT;

-- DropTable
DROP TABLE "public"."Proxy";
