// pages/api/auth/twitter/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]";
import { prisma } from "@/lib/prisma";

type StatusResponse = {
  isValid: boolean;
  method?: "token" | "cookie";
  username?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse | { error: string }>
) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Not authenticated" });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        twitterAccessToken: true,
        twitterTokenExpires: true,
        twitterAuthCookie: true,
        twitterCookieExpires: true,
        twitterUsername: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Check token
    const tokenValid =
      !!user.twitterAccessToken &&
      !!user.twitterTokenExpires &&
      new Date() < new Date(user.twitterTokenExpires);
    if (tokenValid)
      return res.json({
        isValid: true,
        method: "token",
        username: user.twitterUsername ?? undefined,
      });

    // Check cookie
    let cookieValid = false;
    if (user.twitterAuthCookie && user.twitterCookieExpires) {
      const expires = new Date(user.twitterCookieExpires);
      cookieValid = new Date() < expires;
    }

    if (cookieValid)
      return res.json({
        isValid: true,
        method: "cookie",
        username: user.twitterUsername ?? undefined,
      });

    return res.json({ isValid: false });
  } catch (err: any) {
    console.error("[twitter/status] Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
