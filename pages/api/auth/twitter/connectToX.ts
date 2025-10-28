// // pages/api/auth/twitter/connectToX.ts
// import type { NextApiRequest, NextApiResponse } from "next";
// import { chromium, Cookie } from "playwright";
// import crypto from "crypto";
// import { prisma } from "@/lib/prisma";
// import fs from "fs";
// import os from "os";
// import path from "path";

// const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;

// function ensureKey(): Buffer {
//   if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");
//   const key = Buffer.from(ENC_KEY_B64, "base64");
//   if (key.length !== 32) throw new Error("COOKIE_ENC_KEY must decode to 32 bytes");
//   return key;
// }

// function encryptPayload(obj: unknown): string {
//   const key = ensureKey();
//   const iv = crypto.randomBytes(12);
//   const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
//   const plaintext = JSON.stringify(obj);
//   const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
//   const tag = cipher.getAuthTag();
//   return Buffer.concat([iv, tag, ct]).toString("base64");
// }

// function cookieExpiryFromCookies(
//   cookies: Array<{ expires: number | null }>
// ): Date | null {
//   const secs = cookies
//     .map((c) =>
//       typeof c.expires === "number" && isFinite(c.expires) ? c.expires : null
//     )
//     .filter((v) => v !== null) as number[];
//   if (secs.length === 0) return null;
//   const maxSec = Math.max(...secs);
//   return new Date(maxSec * 1000);
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== "POST")
//     return res.status(405).json({ success: false, message: "Method not allowed" });

//   const userId = req.body?.userId || req.query?.userId;
//   if (!userId || typeof userId !== "string")
//     return res.status(400).json({ success: false, message: "Missing userId" });

//   const CHROME_PATH = process.env.CHROME_PATH;
//   const LAUNCH_OPTS: any = {
//     headless: false,
//     args: ["--disable-blink-features=AutomationControlled", "--disable-infobars"],
//   };
//   if (CHROME_PATH) LAUNCH_OPTS.executablePath = CHROME_PATH;
//   else LAUNCH_OPTS.channel = "chrome";

//   let browser: any = null;
//   let context: any = null;
//   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "connect-chrome-"));

//   try {
//     // Launch browser (real Chrome channel or provided executable)
//     browser = await chromium.launch({
//       ...LAUNCH_OPTS,
//     });

//     context = await browser.newContext({
//       viewport: { width: 1280, height: 900 },
//     });

//     const page = await context.newPage();

//     await page.addInitScript(() => {
//       try {
//         Object.defineProperty(navigator, "webdriver", { get: () => undefined });
//         Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
//         const originalQuery = (navigator as any).permissions?.query;
//         if (originalQuery) {
//           (navigator as any).permissions.query = (parameters: any) =>
//             parameters.name === "notifications"
//               ? Promise.resolve({ state: Notification.permission })
//               : originalQuery(parameters);
//         }
//       } catch {}
//     });

//     // Navigate to login page (X)
//     await page.goto("https://x.com/login", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});

//     // Wait for either logged-in UI or for login to be completed by the user.
//     // We accept multiple indicators: home link, composer textbox, timeline article.
//     const WAIT_TIMEOUT = 120_000; // 2 minutes
//     try {
//       await page.waitForSelector('a[href*="/home"], div[role="textbox"], article', { timeout: WAIT_TIMEOUT });
//     } catch (e) {
//       // timed out waiting for auto-login; return helpful message
//       await context.close().catch(() => {});
//       await browser.close().catch(() => {});
//       fs.rmSync(tempDir, { recursive: true, force: true });
//       return res.status(400).json({
//         success: false,
//         message:
//           "Timed out waiting for login. Please complete login in the opened browser window (you may need to retry).",
//       });
//     }

//     // Small wait to ensure any post-login network requests finish
//     await page.waitForTimeout(800);

//     // Capture cookies for x.com
//     const allCookies = await context.cookies("https://x.com");
//     const safeCookies = allCookies.map((c: Cookie) => ({
//       name: c.name,
//       value: c.value,
//       domain: c.domain,
//       path: c.path,
//       httpOnly: !!c.httpOnly,
//       secure: !!c.secure,
//       sameSite: (c as any).sameSite || "None",
//       // Playwright reports expires in seconds (or -1/0). Normalize to null if invalid.
//       expires: Number.isFinite(c.expires as number) ? (c.expires as number) : null,
//     }));

//     // Capture localStorage snapshot (some sessions store tokens there)
//     let localStorageSnapshot: Record<string, string> | null = null;
//     try {
//       const ls = await page.evaluate(() => {
//         const obj: Record<string, string> = {};
//         for (let i = 0; i < localStorage.length; i++) {
//           const k = localStorage.key(i);
//           if (k) obj[k] = localStorage.getItem(k) as string;
//         }
//         return obj;
//       });
//       localStorageSnapshot = ls;
//     } catch (e) {
//       localStorageSnapshot = null;
//     }

//     // Try to extract username (best-effort)
//     let username: string | null = null;
//     try {
//       username = await page.evaluate(() => {
//         try {
//           // search for anchor patterns /username
//           const anchors = Array.from(document.querySelectorAll("a[href]"));
//           for (const a of anchors) {
//             const href = a.getAttribute("href") || "";
//             if (href.startsWith("/")) {
//               const m = href.match(/^\/([A-Za-z0-9_]{1,15})(?:$|[?#/])/);
//               if (m) {
//                 const candidate = m[1];
//                 if (!["home", "i", "settings", "share"].includes(candidate.toLowerCase()))
//                   return candidate;
//               }
//             }
//           }
//           // Try aria-label profile link
//           const profile = document.querySelector('[aria-label*="Profile"] a[href^="/"]') as HTMLAnchorElement | null;
//           if (profile) {
//             const m = profile.getAttribute("href")?.match(/^\/([A-Za-z0-9_]{1,15})/);
//             if (m) return m[1];
//           }
//         } catch {}
//         return null;
//       });
//       if (typeof username !== "string") username = null;
//     } catch (e) {
//       username = null;
//     }

//     // Prepare payload
//     const payload = {
//       capturedAt: Date.now(),
//       cookies: safeCookies,
//       localStorage: localStorageSnapshot,
//     };

//     const encrypted = encryptPayload(payload);
//     const expiresAt = cookieExpiryFromCookies(safeCookies) ?? new Date(Date.now() + 24 * 3600 * 1000);

//     // Persist to DB
//     await prisma.user.update({
//       where: { id: userId },
//       data: {
//         twitterAuthCookie: encrypted,
//         twitterCookieExpires: expiresAt,
//         twitterUsername: username ?? undefined,
//       },
//     });

//     // Cleanup and return
//     await context.close().catch(() => {});
//     await browser.close().catch(() => {});
//     fs.rmSync(tempDir, { recursive: true, force: true });

//     return res.status(200).json({
//       success: true,
//       message: "Cookies (and localStorage) captured and saved",
//       username: username ?? undefined,
//     });
//   } catch (err: any) {
//     console.error("[connectToX] ERROR:", err);
//     try { if (context) await context.close(); } catch {}
//     try { if (browser) await browser.close(); } catch {}
//     try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }
// pages/api/auth/twitter/testLogin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { chromium, Cookie } from "playwright";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type Resp = { success: boolean; message: string };

// --- Encryption Helpers (same as connectToX) ---
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

// --- Main Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });

  const { userId } = req.body;
  const username = "@abhishek_k65761";
  const password = "forgot password";

  let browser: any = null;
  try {
    console.log("[testLogin] Launching browser...");
    browser = await chromium.launch({
      headless: false,
      slowMo: 250,
      args: ["--disable-blink-features=AutomationControlled"],
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

      // --- Capture cookies and update DB ---
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

      res
        .status(200)
        .json({
          success: true,
          message: "Login successful and cookies saved!",
        });
    } else {
      console.log("Login not confirmed.");
      res
        .status(200)
        .json({
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
