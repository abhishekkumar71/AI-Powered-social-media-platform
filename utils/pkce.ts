// utils/pkce.ts
import crypto from "crypto";

export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("hex");
}

export function generateCodeChallenge(codeVerifier: string) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
