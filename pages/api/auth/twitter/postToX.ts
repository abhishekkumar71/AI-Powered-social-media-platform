import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]";
import { prisma } from "../../../../lib/prisma";
import { getValidTwitterToken } from "@/lib/twitter";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || !req.body.text) {
    return res
      .status(400)
      .json({ success: false, message: "Missing text or user" });
  }

  const accessToken = await getValidTwitterToken(user.id);
  if (!accessToken) {
    return res
      .status(401)
      .json({
        success: false,
        message: "Twitter not connected or token expired",
      });
  }

  try {
    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: req.body.text }),
    });
    const tweet = await tweetRes.json();
    console.log(tweetRes);
    console.log(tweet);
    if (tweetRes.status !== 201) {
      return res.status(tweetRes.status).json({
        success: false,
        message: tweet?.detail || "Failed to post tweet",
        error: tweet,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Tweet posted successfully",
      data: tweet,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to post tweet" });
  }
}
