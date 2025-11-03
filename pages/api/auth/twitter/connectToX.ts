import type { NextApiRequest, NextApiResponse } from "next";
import { chromium, Cookie } from "playwright";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type Resp = { success: boolean; message: string };

const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;

function ensureKey(): Buffer {
  if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");
  const key = Buffer.from(ENC_KEY_B64, "base64");
  if (key.length !== 32)
    throw new Error("COOKIE_ENC_KEY must decode to 32 bytes");
  return key;
}

function encryptPayload(obj: unknown): string {
  const key = ensureKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(obj);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function cookieExpiryFromCookies(
  cookies: Array<{ expires: number | null }>
): Date | null {
  const secs = cookies
    .map((c) =>
      typeof c.expires === "number" && isFinite(c.expires) ? c.expires : null
    )
    .filter((v) => v !== null) as number[];
  if (secs.length === 0) return null;
  const maxSec = Math.max(...secs);
  return new Date(maxSec * 1000);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });

  const { userId } = req.body;
  if (!userId)
    return res
      .status(400)
      .json({ success: false, message: "Missing userId in request" });

  // 🔹 Fetch credentials from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twitterUsername: true,
      twitterPassword: true,
    },
  });

  if (!user?.twitterUsername || !user?.twitterPassword) {
    return res.status(400).json({
      success: false,
      message: "User does not have saved Twitter credentials.",
    });
  }

  const username = user.twitterUsername;
  const password = user.twitterPassword;

  let browser: any = null;
  try {
    console.log("[testLogin] Launching browser...");
    const chromePath =
      process.env.CHROME_PATH || "/app/.apt/opt/google/chrome/chrome";
    const browser = await chromium.launch({
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      headless: true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("[testLogin] Navigating to login page...");
    await page.goto("https://x.com/i/flow/login", {
      waitUntil: "domcontentloaded",
    });

    // Step 1: Username
    await page.waitForSelector('input[name="text"]', { timeout: 60000 });
    console.log("[testLogin] Typing username...");
    await page.click('input[name="text"]');
    await page.keyboard.type(username, { delay: 150 });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");

    // Step 2: Password
    console.log("[testLogin] Waiting for password field...");
    await page.waitForSelector('input[name="password"]', { timeout: 60000 });
    await page.click('input[name="password"]');
    await page.keyboard.type(password, { delay: 150 });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");

    console.log("[testLogin] Waiting for redirect...");
    await page.waitForTimeout(8000);

    const currentURL = page.url();
    console.log("[testLogin] Current URL:", currentURL);

    if (currentURL.includes("/home")) {
      console.log("Login successful!");

      const allCookies = await context.cookies("https://x.com");
      const safeCookies = allCookies.map((c: Cookie) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: (c as any).sameSite || "None",
        expires: Number.isFinite(c.expires as number)
          ? (c.expires as number)
          : null,
      }));

      const payload = {
        capturedAt: Date.now(),
        cookies: safeCookies,
      };
      const encrypted = encryptPayload(payload);
      const expiresAt =
        cookieExpiryFromCookies(safeCookies) ??
        new Date(Date.now() + 24 * 3600 * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: {
          twitterAuthCookie: encrypted,
          twitterCookieExpires: expiresAt,
          twitterUsername: username,
        },
      });

      res.status(200).json({
        success: true,
        message: "Login successful and cookies saved!",
      });
    } else {
      console.log("Login not confirmed.");
      res.status(200).json({
        success: false,
        message: "Login attempt made, but not confirmed.",
      });
    }

    await browser.close();
  } catch (err: any) {
    console.error("[testLogin] error:", err);
    try {
      await browser?.close?.();
    } catch {}
    res
      .status(500)
      .json({ success: false, message: String(err?.message ?? err) });
  }
}
