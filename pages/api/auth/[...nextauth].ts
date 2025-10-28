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
        (session.user as any).id = user.id;

        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { proxy: true },
        });

        // if (fullUser && !fullUser.proxy) {
        //   const proxy = await assignProxyToUser(fullUser.id);
        //   console.log("[session] Assigned proxy:", proxy);
        // }
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // // Assign a dedicated proxy immediately after creation
      // const proxy = await assignProxyToUser(user.id);
      // console.log("[createUser] Assigned proxy:", proxy);
    },
  },
};

export default NextAuth(authOptions);
