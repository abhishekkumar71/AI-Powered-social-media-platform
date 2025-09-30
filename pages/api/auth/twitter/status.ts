// pages/api/auth/twitter/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Not authenticated" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      twitterAccessToken: true,
      twitterRefreshToken: true,
      twitterTokenExpires: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const isValid = user.twitterAccessToken && user.twitterTokenExpires
    ? new Date() < user.twitterTokenExpires
    : false;

  res.json({ isValid });
}
