// pages/api/auth/twitter/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]";
import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "../../../../utils/pcke";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Not authenticated" });

  const pendingText = req.query.pendingText || "";
  const statePayload = Buffer.from(
    JSON.stringify({
      email: session.user.email,
      pendingText,
      salt: crypto.randomBytes(8).toString("hex"),
    })
  ).toString("base64");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await prisma.twitterOAuth.create({
    data: {
      state: statePayload,
      codeVerifier,
      createdAt: new Date(),
    },
  });

  const callbackUrl = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI!;
  const oauthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${
    process.env.TWITTER_CLIENT_ID
  }&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(
    "tweet.read tweet.write users.read offline.access"
  )}&state=${encodeURIComponent(
    statePayload
  )}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  res.json({ redirect: oauthUrl });
}
