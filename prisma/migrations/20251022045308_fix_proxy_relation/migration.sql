/*
  Warnings:

  - A unique constraint covering the columns `[ip]` on the table `Proxy` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Proxy" ADD COLUMN     "protocol" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_ip_key" ON "public"."Proxy"("ip");
