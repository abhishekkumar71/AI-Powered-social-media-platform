import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

interface TwitterToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: "Missing code or state" });

  let decodedState: { email: string; pendingText?: string };
  try {
    decodedState = JSON.parse(Buffer.from(state as string, "base64").toString());
  } catch {
    return res.status(400).json({ error: "Invalid state" });
  }

  // Retrieve code_verifier from DB
  const oauthRecord = await prisma.twitterOAuth.findUnique({ where: { state: state as string } });
  if (!oauthRecord) return res.status(400).json({ error: "Missing PKCE code_verifier" });

  // Exchange code for token
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: code as string,
    redirect_uri: process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI!,
    client_id: process.env.TWITTER_CLIENT_ID!,
    code_verifier: oauthRecord.codeVerifier,
  });

  let tokenData: TwitterToken;
  try {
 const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": "Basic " + Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString("base64"),
  },
  body: params.toString(),
});


    tokenData = (await tokenRes.json()) as TwitterToken;
    if (!tokenData.access_token) {
      return res.status(400).json({ error: "Failed to get access token", details: tokenData });
    }
  } catch {
    return res.status(500).json({ error: "Failed to fetch token" });
  }

  // Save tokens in user table
  await prisma.user.update({
    where: { email: decodedState.email },
    data: {
      twitterAccessToken: tokenData.access_token,
      twitterRefreshToken: tokenData.refresh_token ?? null,
      twitterTokenExpires: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
      twitterState: state as string,
    },
  });

  // Delete used OAuth record
  await prisma.twitterOAuth.delete({ where: { state: state as string } });

  res.redirect(`/dashboard?pendingText=${encodeURIComponent(decodedState.pendingText || "")}`);
}
