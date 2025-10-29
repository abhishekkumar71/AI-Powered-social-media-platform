import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      twitterCodeVerifier?: string;
      twitterAccessToken?: string;
      twitterRefreshToken?: string;
      twitterUsername?: string | null;
      twitterPassword?: string | null;
    } & DefaultSession["user"];
  }
}
