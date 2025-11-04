import type { NextApiRequest, NextApiResponse } from "next";
import type { Cookie } from "playwright-core";

import { chromium } from "playwright-core";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type Resp = { success: boolean; message: string };

const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

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
  const data = Buffer.concat([
    cipher.update(JSON.stringify(obj), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64");
}

function cookieExpiryFromCookies(
  cookies: Array<{ expires: number | null }>
): Date | null {
  const valid = cookies.filter(
    (c) => typeof c.expires === "number" && isFinite(c.expires)
  );
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((c) => c.expires!)) * 1000);
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
    return res.status(400).json({ success: false, message: "Missing userId" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twitterUsername: true, twitterPassword: true },
  });

  if (!user?.twitterUsername || !user?.twitterPassword)
    return res.status(400).json({
      success: false,
      message: "User missing stored Twitter credentials.",
    });

  const { twitterUsername, twitterPassword } = user;

  let browser: any;
  try {
    const wsEndpoint = new URL(
      `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
    );
    // if (proxyUrl) wsEndpoint.searchParams.set("--proxy-server", proxyUrl);

    console.log("[testLogin] Connecting remotely...");
    browser = await chromium.connectOverCDP(wsEndpoint.href);
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://x.com/i/flow/login", {
      waitUntil: "domcontentloaded",
    });

    await page.waitForSelector('input[name="text"]', { timeout: 45000 });
    await page.fill('input[name="text"]', twitterUsername);
    await page.keyboard.press("Enter");

    await page.waitForSelector('input[name="password"]', { timeout: 45000 });
    await page.fill('input[name="password"]', twitterPassword);
    await page.keyboard.press("Enter");

    await page.waitForTimeout(7000);
    const currentURL = page.url();

    if (currentURL.includes("/home")) {
      const cookies = await context.cookies("https://x.com");
      const safeCookies = cookies.map((c: Cookie) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: (c as any).sameSite || "None",
        expires: Number.isFinite(c.expires) ? c.expires : null,
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
        },
      });

      res
        .status(200)
        .json({ success: true, message: "Login successful & cookies saved." });
    } else {
      res
        .status(200)
        .json({ success: false, message: "Login failed or 2FA required." });
    }
  } catch (err: any) {
    console.error("[testLogin] error:", err);
    res
      .status(500)
      .json({ success: false, message: err?.message || "Unknown error" });
  } finally {
    try {
      await browser?.close?.();
    } catch {}
  }
}
