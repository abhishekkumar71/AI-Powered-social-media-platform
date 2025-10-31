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


  callbacks: {
    async session({ session, user }) {
      try {
        if (!session.user) return session;

        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            twitterUsername: true,
            twitterPassword: true,
            proxy: true,
          },
        });

        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            twitterUsername: fullUser?.twitterUsername ?? null,
            twitterPassword: fullUser?.twitterPassword ?? null,
          },
        };
      } catch (error) {
        console.error("Error in session callback:", error);
        return session;
      }
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
