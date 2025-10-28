/*
  Warnings:

  - You are about to drop the column `proxyUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "proxyUrl";

-- CreateTable
CREATE TABLE "public"."Proxy" (
    "id" TEXT NOT NULL,
    "proxyUrl" TEXT NOT NULL,
    "assignedToId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastAssignedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_proxyUrl_key" ON "public"."Proxy"("proxyUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_assignedToId_key" ON "public"."Proxy"("assignedToId");

-- AddForeignKey
ALTER TABLE "public"."Proxy" ADD CONSTRAINT "Proxy_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
