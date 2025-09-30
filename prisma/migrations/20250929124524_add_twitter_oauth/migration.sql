-- CreateTable
CREATE TABLE "public"."TwitterOAuth" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitterOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterOAuth_state_key" ON "public"."TwitterOAuth"("state");
