/*
  Warnings:

  - You are about to drop the column `proxyUrl` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[proxyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "proxyUrl",
ADD COLUMN     "proxyId" TEXT;

-- CreateTable
CREATE TABLE "public"."Proxy" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "assigned" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_proxyId_key" ON "public"."User"("proxyId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "public"."Proxy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
