import crypto from "crypto";

const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;
if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");
const ENC_KEY = Buffer.from(ENC_KEY_B64, "base64");
if (ENC_KEY.length !== 32) throw new Error("COOKIE_ENC_KEY must decode to 32 bytes");

export function decryptPayload(encryptedB64: string): { cookies: any[] } {
  const data = Buffer.from(encryptedB64, "base64");
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
