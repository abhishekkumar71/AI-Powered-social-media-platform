import type { NextApiRequest, NextApiResponse } from "next";
import type { Cookie } from "playwright-core";
import { chromium } from "playwright-core";
import crypto from "crypto";
// import fs from "fs";
// import path from "path";
import { prisma } from "@/lib/prisma";
import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

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

async function debugScreenshot(page: any, label: string) {
  try {
    const buffer = await page.screenshot({ fullPage: false });
    const timestamp = Date.now();
    const uploadRes = await cloudinary.v2.uploader.upload_stream(
      {
        folder: "browserless-debug",
        public_id: `${label}_${timestamp}`,
        resource_type: "image",
      },
      (error, result) => {
        if (error) console.error("[debugScreenshot] upload failed:", error);
        else console.log(`[debug] Screenshot uploaded: ${result?.secure_url}`);
      }
    );

    const stream = uploadRes as unknown as NodeJS.WritableStream;
    stream.end(buffer);
  } catch (e) {
    console.error("[debugScreenshot] failed:", e);
  }
}
// Inject stealth patches dynamically after page loads
async function injectStealth(page: any) {
  try {
    await page.evaluate(() => {
      try {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3],
        });
        Object.defineProperty(navigator, "platform", {
          get: () => "Win32",
        });
      } catch (e) {
        console.warn("[stealth] failed injection", e);
      }
    });
  } catch (e) {
    console.warn("[stealth] runtime inject failed", e);
  }
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
    const wsEndpoint = `wss://production-sfo.browserless.io?token=${BROWSERLESS_TOKEN}`;
    console.log("[testLogin] Connecting to Browserless:", wsEndpoint);
    browser = await chromium.connectOverCDP(wsEndpoint);

    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("[testLogin] Configuring stealth context (CDP-safe)...");

    console.log("[testLogin] Configuring stealth context (CDP-safe)...");

    console.log("[testLogin] Navigating to login page...");
    try {
      await page.goto("https://x.com/i/flow/login", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      await injectStealth(page); // works fine
    } catch (e) {
      console.warn("[testLogin] Primary login failed, trying mobile...");
      await page.goto("https://mobile.twitter.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await injectStealth(page);
    }

    await page.waitForTimeout(5000);

    // detect X error page
    const bodyText = await page.textContent("body");
    if (bodyText?.includes("Something went wrong")) {
      console.warn("[testLogin] Detected reload page — refreshing once...");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
    }

    const title = (await page.title())?.toLowerCase();
    if (!title.includes("login")) {
      console.warn(
        "[testLogin] Warning: unexpected page title:",
        await page.title()
      );
    }

    await page.waitForTimeout(5000);

    if (!(await page.title()).toLowerCase().includes("login")) {
      console.warn(
        "[testLogin] Warning: unexpected page title",
        await page.title()
      );
    }

    // give Browserless time to settle before first capture
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: "/tmp/screenshots/01_login_page_loaded.png",
    });
    console.log(
      "[debug] Screenshot saved: /tmp/screenshots/01_login_page_loaded.png"
    );

    await debugScreenshot(page, "01_login_page_loaded");

    console.log("[testLogin] Waiting for username input...");
    await page.waitForSelector('input[name="text"]', { timeout: 45000 });
    await debugScreenshot(page, "02_username_field_ready");

    console.log("[testLogin] Typing username...");
    await page.fill('input[name="text"]', twitterUsername);
    await page.keyboard.press("Enter");

    console.log("[testLogin] Waiting for password...");
    await page.waitForSelector('input[name="password"]', { timeout: 45000 });
    await debugScreenshot(page, "03_password_field_ready");

    await page.fill('input[name="password"]', twitterPassword);
    await page.keyboard.press("Enter");

    console.log("[testLogin] Waiting post-login redirect...");
    await page.waitForTimeout(8000);
    await debugScreenshot(page, "04_after_login_submit");

    const currentURL = page.url();
    console.log("[testLogin] URL:", currentURL);

    if (currentURL.includes("/home")) {
      console.log("[testLogin] Login successful!");
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

      const payload = { capturedAt: Date.now(), cookies: safeCookies };
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

      return res
        .status(200)
        .json({ success: true, message: "Login successful & cookies saved." });
    } else {
      return res.status(200).json({
        success: false,
        message: "Login failed or Twitter/X showed an unexpected page.",
      });
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
