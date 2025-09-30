-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "twitterAccessToken" TEXT,
ADD COLUMN     "twitterCodeVerifier" TEXT,
ADD COLUMN     "twitterRefreshToken" TEXT;
