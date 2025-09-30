import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code } = req.query;

  if (!code) return res.status(400).send("Code is missing");

  const appId = process.env.NEXT_PUBLIC_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URL;

  try {
    // Exchange code for short-lived access token
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`
    );

    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange short-lived token for long-lived token
    const longLivedResponse = await axios.get(
      `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );

    const longLivedToken = longLivedResponse.data.access_token;

    // Store the token in DB here (or return it for demo)
    console.log("LONG-LIVED TOKEN:", longLivedToken);

    res
      .status(200)
      .send("Instagram connected successfully! You can close this tab.");
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to exchange code for token");
  }
}
