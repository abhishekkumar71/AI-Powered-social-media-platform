import type { NextApiRequest, NextApiResponse } from "next";
import type { Cookie } from "playwright-core";
import { chromium } from "playwright-core";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  attachResponseWatcher,
  humanClickElement,
  uploadBufferToCloudinary,
  captureAndUpload,
  realisticMouseMove,
  scrollAndIdle,
  installInitScript,
  humanType,
} from "./helpers";

type Resp = { success: boolean; message: string };

const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");
if (!BROWSERLESS_TOKEN)
  console.warn(
    "Missing BROWSERLESS_TOKEN in env (continuing without Browserless)"
  );

/* ---------------- Encryption helpers ---------------- */
function ensureKey(): Buffer {
  const key = Buffer.from(ENC_KEY_B64!, "base64");
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
    (c) => typeof c.expires === "number" && isFinite(c.expires as number)
  );
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((c) => (c.expires as number)!)) * 1000);
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
  let browser: any = null;
  let context: any = null;

  try {
    browser = await chromium.launch({
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled",
        "--disable-site-isolation-trials",
        "--disable-infobars",
        "--disable-web-security",
        "--allow-running-insecure-content",
        "--ignore-certificate-errors",
        "--window-size=1280,800",
      ],
    });

    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.59 Safari/537.36";

    context = await browser.newContext({
      userAgent,
      locale: "en-US",
      viewport: { width: 1280, height: 800 },
      timezoneId: "Asia/Kolkata",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-CH-UA":
          '"Chromium";v="142", "Google Chrome";v="142", "Not A(Brand";v="99"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
      },
    });

    const page = await context.newPage();

    try {
      const cdp = await context.newCDPSession(page);
      await cdp
        .send("Network.setUserAgentOverride", { userAgent })
        .catch((e: any) => {
          console.warn(
            "[stealth] Network.setUserAgentOverride failed (non-fatal) ->",
            e?.message || e
          );
        });
    } catch (e: any) {
      console.warn(
        "[stealth] newCDPSession/send failed (continuing)",
        e?.message || e
      );
    }

    await installInitScript(context, page);
    attachResponseWatcher(page);

    page.on("console", (msg: any) => {
      try {
        console.log("[console]", msg.text ? msg.text() : msg);
      } catch {}
    });
    page.on("pageerror", (err: Error) =>
      console.log("[pageerror]", err && err.message)
    );

    console.log("[testLogin] Navigating to login page...");
    await page.goto("https://x.com/i/flow/login", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForTimeout(2500);
    await captureAndUpload(page, "before_error_check");

    const bodyText = await page.textContent("body").catch(() => null);
    const title = await page.title().catch(() => "");
    if (
      bodyText?.includes("Something went wrong") ||
      (title && title.toLowerCase().includes("something went wrong"))
    ) {
      console.warn("[testLogin] Detected 'Something went wrong' page");
      await captureAndUpload(page, "error_something_went_wrong");
      return res.status(200).json({
        success: false,
        message:
          "Detected 'Something went wrong' screen — likely fingerprint or network issue.",
      });
    }

    await page.waitForTimeout(2000);
    await captureAndUpload(page, "01_login_page_loaded");
    await page.waitForTimeout(3500 + Math.random() * 1200);
    console.log("[testLogin] Waiting for username input...");
    await page.waitForSelector(
      'input[name="text"], input[type="text"], input[name="session[username_or_email]"], input[name="username"]',
      { timeout: 45000 }
    );

    await captureAndUpload(page, "02_username_field_ready");
    await scrollAndIdle(page);

    console.log("[testLogin] Typing username...");
    const usernameSelectors = [
      'input[name="text"]',
      'input[type="text"]',
      'input[name="session[username_or_email]"]',
      'input[name="username"]',
    ];
    let usedSelector = "";
    for (const sel of usernameSelectors) {
      const el = await page.$(sel);
      if (el) {
        usedSelector = sel;
        break;
      }
    }
    if (!usedSelector)
      throw new Error("Could not find username input after wait");

    await humanType(page, usedSelector, twitterUsername);
    await captureAndUpload(page, "after_username_typed");

    try {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
    } catch (e) {
      console.warn("[testLogin] Enter press failed, will try manual click");
    }
    await captureAndUpload(page, "after_enter_pressed");

    try {
      const nextButtons = await page.$$(
        'div[role="button"]:scope, button:scope, span:scope'
      );
      let picked: any = null;
      for (const b of nextButtons) {
        try {
          const txt = (await b.innerText()).trim();
          if (
            /^\s*(Next|Continue|Log in|Log in to|Next\u2026)\s*$/i.test(txt) ||
            /Next|Continue/i.test(txt)
          ) {
            picked = b;
            break;
          }
        } catch (e) {}
      }
      if (picked) {
        console.log(
          "[testLogin] Found candidate Next button, performing human click"
        );
        await picked.scrollIntoViewIfNeeded().catch(() => {});
        await humanClickElement(page, picked);
        await captureAndUpload(page, "after_next_button_clicked");
        await Promise.race([
          page
            .waitForSelector('input[name="password"], input[type="password"]', {
              timeout: 8000,
            })
            .catch(() => null),
          page
            .waitForResponse(
              (r: any) =>
                /graphql.*user_flow|onboarding\/task/i.test(r.url()) &&
                r.status() === 200,
              { timeout: 8000 }
            )
            .catch(() => null),
        ]);
      }
    } catch (e: any) {
      console.warn(
        "[testLogin] Next/Continue click fallback failed",
        e?.message || e
      );
    }

    console.log("[testLogin] Waiting for password input...");
    await page.waitForSelector(
      'input[name="password"], input[type="password"]',
      { timeout: 45000 }
    );
    await captureAndUpload(page, "03_password_field_ready");

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
    ];
    let usedPassSelector = "";
    for (const sel of passwordSelectors) {
      const el = await page.$(sel);
      if (el) {
        usedPassSelector = sel;
        break;
      }
    }
    if (!usedPassSelector)
      throw new Error("Could not find password input after wait");

    await humanType(page, usedPassSelector, twitterPassword);
    await page.keyboard.press("Enter").catch(() => {});

    console.log("[testLogin] Waiting for post-login redirect / home...");
    await page.waitForTimeout(7000);
    await captureAndUpload(page, "04_after_login_submit");

    const currentURL = page.url();
    console.log("[testLogin] URL after submit:", currentURL);

    if (currentURL.includes("/home") || currentURL.includes("/i/home")) {
      console.log("[testLogin] Login appears successful — capturing cookies");

      const allCookies = await context.cookies();
      const safeCookies = allCookies.map((c: any) => ({
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
        data: { twitterAuthCookie: encrypted, twitterCookieExpires: expiresAt },
      });

      return res
        .status(200)
        .json({ success: true, message: "Login successful & cookies saved." });
    } else {
      console.warn(
        "[testLogin] Not redirected to home - possible challenge/2FA. URL:",
        currentURL
      );
      await captureAndUpload(page, "05_not_on_home");
      return res.status(200).json({
        success: false,
        message:
          "Login failed or X showed an unexpected page/challenge. Screenshots captured.",
      });
    }
  } catch (err: any) {
    console.error("[testLogin] error:", err);
    if (err.message.includes("Something went wrong")) {
      console.log("[backoff] Sleeping 5min to cool down");
      await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
    }

    try {
      const pages = context?.pages?.() ?? [];
      if (pages[0]) await captureAndUpload(pages[0], "crash_or_error");
    } catch (e2) {
      console.warn("[debug] crash screenshot failed", e2);
    }
    return res
      .status(500)
      .json({ success: false, message: err?.message || "Unknown error" });
  } finally {
    await context?.clearCookies?.();
    await context?.clearPermissions?.();
    try {
      await context?.close?.();
    } catch {}
    try {
      await browser?.close?.();
    } catch {}
  }
}
