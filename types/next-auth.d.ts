import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    twitterCodeVerifier?: string;
    twitterAccessToken?: string;
    twitterRefreshToken?: string;
    twitterUsername?: string | null;
    twitterPassword?: string | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      twitterCodeVerifier?: string;
      twitterAccessToken?: string;
      twitterRefreshToken?: string;
      twitterUsername?: string | null;
      twitterPassword?: string | null;
    } & DefaultSession["user"];
  }
}
