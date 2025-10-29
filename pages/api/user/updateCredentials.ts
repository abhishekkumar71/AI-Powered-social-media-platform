import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  const { twitterUsername, twitterPassword } = req.body;

  try {
    await prisma.user.update({
      where: { email: session.user.email },
      data: { twitterUsername, twitterPassword },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating credentials:", err);
    res.status(500).json({ success: false, message: "DB update failed" });
  }
}
