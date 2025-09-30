import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const APP_SECRET = process.env.INSTA_APP_SECRET || ""; // Your Instagram App Secret

// Helper to decode base64url
function base64UrlDecode(str: string) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

// Verify signed_request and return payload
function parseSignedRequest(signedRequest: string) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) throw new Error("Invalid signed_request format");

  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const data = JSON.parse(base64UrlDecode(payload));

  // Check algorithm
  if (data.algorithm !== "HMAC-SHA256") throw new Error("Unknown algorithm");

  // Validate signature
  const expectedSig = crypto
    .createHmac("sha256", APP_SECRET)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) throw new Error("Invalid signature");

  return data;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { signed_request } = req.body;
    if (!signed_request) return res.status(400).send("Missing signed_request");

    const data = parseSignedRequest(signed_request);
    console.log("Instagram deauthorization payload:", data);

    const userId = data.user_id;
    // TODO: Delete this user's tokens from your database
    // await deleteUserTokens(userId);

    res.status(200).send("Deauthorization handled successfully");
  } catch (err) {
    console.error("Deauthorize error:", err);
    res.status(500).send("Error handling deauthorization");
  }
}
