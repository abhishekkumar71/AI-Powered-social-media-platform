// /pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../lib/prisma";
// import { assignProxyToUser } from "../../../scripts/assign";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "database",
  },

  pages: {
    signIn: "/auth/signin",
  },

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // Basic user id
        (session.user as any).id = user.id;

        // Fetch full user from Prisma
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            twitterUsername: true,
            twitterPassword: true,
            proxy: true,
          },
        });

        // Add custom fields
        if (fullUser) {
          (session.user as any).twitterUsername = fullUser.twitterUsername ?? null;
          (session.user as any).twitterPassword = fullUser.twitterPassword ?? null;
        }
      }

      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // // Assign proxy when new user is created
      // const proxy = await assignProxyToUser(user.id);
      // console.log("[createUser] Assigned proxy:", proxy);
    },
  },
};

export default NextAuth(authOptions);
