-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "twitterAuthCookie" TEXT,
ADD COLUMN     "twitterCookieExpires" TIMESTAMP(3),
ADD COLUMN     "twitterCsrfToken" TEXT,
ADD COLUMN     "twitterPassword" TEXT,
ADD COLUMN     "twitterUsername" TEXT;

-- CreateTable
CREATE TABLE "public"."Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "scheduled" TIMESTAMP(3) NOT NULL,
    "posted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
