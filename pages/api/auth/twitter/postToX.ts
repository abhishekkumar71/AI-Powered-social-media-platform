import type { NextApiRequest, NextApiResponse } from "next";
import type {
  Response as PlaywrightResponse,
  BrowserContext,
} from "playwright-core";

import { chromium } from "playwright-core";
import type { Cookie } from "playwright-core";

import fs from "fs";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";
import { decryptPayload } from "../../../../utils/X/cookies";
import { downloadToTempFile } from "../../../../utils/X/media";
import { secondsBetween, randInt } from "../../../../utils/X/delay";
import { extractTweetIdFromJson } from "../../../../utils/X/tweetHelper";
import { getCachedMedia, clearOldCache } from "../../../../utils/mediaCache";
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
type ApiResp =
  | { success: true; tweetUrl?: string }
  | {
      success: false;
      message?: string;
      needReconnect?: boolean;
      needWait?: boolean;
      waitUntil?: string;
    };

const GLOBAL_MIN_INTERVAL_SEC = Number(
  process.env.POST_MIN_INTERVAL_SEC ?? 120
);
const MIN_DELAY_MIN = Number(process.env.POST_MIN_DELAY_MIN ?? 2);
const MAX_DELAY_MIN = Number(process.env.POST_MAX_DELAY_MIN ?? 6);
const ENC_KEY_B64 = process.env.COOKIE_ENC_KEY;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");
// Note: browserless optional but preferred
if (!BROWSERLESS_TOKEN)
  console.warn("Missing BROWSERLESS_TOKEN in env (will try local chromium)");

/* ---------------- Normalize cookies for Playwright ---------------- */
function normalizeCookieForPlaywright(c: any): Cookie {
  // ensure domain is acceptable for Playwright
  const domain = String(c.domain ?? "x.com");
  return {
    name: String(c.name),
    value: String(c.value),
    path: c.path ?? "/",
    domain,
    expires: typeof c.expires === "number" ? c.expires : undefined,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    sameSite: (c as any).sameSite || "None",
  } as Cookie;
}

/* ---------------- Main function ---------------- */
export async function postToX(
  userId: string,
  text: string,
  postId?: string,
  mediaUrls?: string[]
): Promise<ApiResp> {
  if (!text) throw new Error("Post content cannot be empty");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastPostedAt: true,
      postingCooldownSecs: true,
      twitterAuthCookie: true,
      twitterCookieExpires: true,
      twitterUsername: true,
    },
  });

  if (!user) throw new Error("User not found");
  if (!user.twitterAuthCookie || !user.twitterCookieExpires)
    return {
      success: false,
      message: "No X cookie found",
      needReconnect: true,
    };

  if (new Date() >= new Date(user.twitterCookieExpires))
    return { success: false, message: "X cookie expired", needReconnect: true };

  const now = new Date();
  const last = user.lastPostedAt ?? null;
  const userCooldown =
    user.postingCooldownSecs && user.postingCooldownSecs > 0
      ? user.postingCooldownSecs
      : GLOBAL_MIN_INTERVAL_SEC;

  if (secondsBetween(last, now) < userCooldown) {
    return {
      success: false,
      message: "Too many posts. Wait before posting again.",
      needWait: true,
      waitUntil: new Date(
        (last?.getTime() ?? +now) + userCooldown * 1000
      ).toISOString(),
    };
  }

  // set next available posting time (user-level cooldown)
  const nextAvailablePost = new Date(
    Date.now() + randInt(MIN_DELAY_MIN * 60_000, MAX_DELAY_MIN * 60_000)
  );
  await prisma.user.update({
    where: { id: userId },
    data: { lastPostedAt: nextAvailablePost },
  });

  // decrypt cookies
  let cookies: any[] = [];
  try {
    cookies = decryptPayload(user.twitterAuthCookie).cookies;
    if (!Array.isArray(cookies)) throw new Error("Invalid cookie payload");
  } catch (err) {
    // rollback lastPostedAt
    await prisma.user
      .update({ where: { id: userId }, data: { lastPostedAt: last } })
      .catch(() => {});
    console.error("[postToX] decrypt error:", err);
    return {
      success: false,
      message: "Failed to decrypt cookies",
      needReconnect: true,
    };
  }

  const cookieObjects = cookies.map(normalizeCookieForPlaywright);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-chrome-"));
  let browser: any = null;
  let context: BrowserContext | null = null;
  let tweetUrl: string | null = null;

  try {
    // fallback to launching local chromium
    browser = await chromium.launch({
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--allow-running-insecure-content",
        "--ignore-certificate-errors",
        "--window-size=1280,900",
      ],
    });
    console.log("[postToX] Launched local chromium fallback");

    // create context and apply cookies
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.59 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
        "Sec-CH-UA":
          '"Chromium";v="142", "Google Chrome";v="142", "Not A(Brand";v="99"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
      },
    });

    const page = await context!.newPage();

    await installInitScript(context, page);
    attachResponseWatcher(page);

    page.on("console", (m: any) => {
      try {
        console.log("[console]", m.text ? m.text() : m);
      } catch {}
    });
    page.on("pageerror", (err: any) =>
      console.log("[pageerror]", err?.message ?? err)
    );

    // add cookies
    try {
      await context?.addCookies(cookieObjects as any[]);
      console.log("[postToX] cookies added to context");
    } catch (e: any) {
      console.warn(
        "[postToX] addCookies failed, continuing (cookies might be invalid):",
        e?.message ?? e
      );
    }

    // navigate to home and verify logged in
    await page.goto("https://x.com/home", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(1200 + Math.floor(Math.random() * 1200));
    await captureAndUpload(page, "home_loaded");
    await scrollAndIdle(page);
    const loggedIn = await detectLoggedIn(page);
    if (!loggedIn) {
      await prisma.user
        .update({ where: { id: userId }, data: { lastPostedAt: last } })
        .catch(() => {});
      return {
        success: false,
        message: "Session invalid — reconnect.",
        needReconnect: true,
      };
    }

    await page.goto("https://x.com/compose/post", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(800 + Math.random() * 800);
    await captureAndUpload(page, "compose_page_loaded");
    await scrollAndIdle(page);

    // media handling
    if (mediaUrls && mediaUrls.length > 0) {
      clearOldCache();
      const localPaths: string[] = [];
      for (const url of mediaUrls) {
        let local = url;
        if (/^https?:\/\//.test(url)) {
          const cached = await getCachedMedia(url);
          local = cached || (await downloadToTempFile(url)) || url;
        }
        if (fs.existsSync(local)) localPaths.push(local);
      }

      if (localPaths.length > 0) {
        // prefer file input
        const uploadSelector =
          'input[data-testid="fileInput"], input[type="file"]';
        await page.waitForSelector(uploadSelector, { timeout: 15000 });
        const fileInput = await page.$(uploadSelector);
        if (!fileInput) throw new Error("Upload input not found");
        await realisticMouseMove(page, 500, 400, 440, 420, 15);

        // set files
        await fileInput.setInputFiles(localPaths);
        console.log("[postToX] setInputFiles called:", localPaths);

        // wait for media preview (DOM) OR an upload request
        const previewPromise = page
          .waitForSelector(
            'div[role="textbox"] img, div[role="textbox"] video, [data-testid="mediaPreview"] img, [data-testid="media-preview"] img',
            { timeout: 45000 }
          )
          .catch(() => null);
        const networkPromise = page
          .waitForResponse(
            (r: PlaywrightResponse) =>
              /media_upload|upload|videos\/upload|images\/upload/i.test(
                r.url()
              ),
            { timeout: 45000 }
          )
          .catch(() => null);
        const previewResult = await Promise.race([
          previewPromise,
          networkPromise,
        ]);
        if (!previewResult) {
          console.warn(
            "[postToX] Media preview/upload not observed within 45s. Proceeding anyway (may fail)."
          );
        } else {
          console.log("[postToX] Media upload/preview detected");
          await captureAndUpload(page, "media_uploaded");
          await scrollAndIdle(page);
        }

        // wait until post button enabled (or timeout)
        const postBtnSelector =
          'div[data-testid="tweetButtonInline"], div[data-testid="tweetButton"], button:has-text("Post")';
        const postBtn = await page
          .waitForSelector(postBtnSelector, { timeout: 45000 })
          .catch(() => null);
        if (postBtn) {
          const start = Date.now();
          while (!(await postBtn.isEnabled()) && Date.now() - start < 60000) {
            await page.waitForTimeout(300);
          }
        } else {
          console.warn("[postToX] Post button not found after media upload");
        }
      }
    }

    // compose text
    const textboxSelector = 'div[role="textbox"]';
    await page.waitForSelector(textboxSelector, { timeout: 20000 });
    const composer = await page.$(textboxSelector);
    if (!composer) throw new Error("Composer textbox not found");

    // click into composer in human-like way
    await composer.scrollIntoViewIfNeeded().catch(() => {});
    await humanClickElement(page, composer);
    await page.waitForTimeout(500 + Math.floor(Math.random() * 600));

    await humanType(page, 'div[role="textbox"]', text);
    await realisticMouseMove(page, 500, 400, 700, 420, 15);

    await page.waitForTimeout(500 + Math.floor(Math.random() * 600));
    await captureAndUpload(page, "text_typed");
    await scrollAndIdle(page);
    // prepare to catch the createTweet GraphQL response
    let tweetId: string | null = null;
    page.on("response", async (resp: PlaywrightResponse) => {
      try {
        const url = resp.url();
        if (
          url.includes("/i/api/graphql/") &&
          /createtweet/i.test(url.toLowerCase())
        ) {
          const json = await resp.json().catch(() => null);
          const id = extractTweetIdFromJson(json);
          if (id) tweetId = id;
        }
      } catch {}
    });

    // click post
    const postBtnSelector =
      'div[data-testid="tweetButtonInline"], div[data-testid="tweetButton"], button:has-text("Post")';

    const btn = await page.waitForSelector(postBtnSelector, { timeout: 15000 });
    if (!btn) throw new Error("Post button not found");
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250 + Math.floor(Math.random() * 350));
    await btn.click();
    await captureAndUpload(page, "after_post_click");

    // wait for createTweet response OR some timeline update
    const start = Date.now();
    while (!tweetId && Date.now() - start < 25000) {
      await page.waitForTimeout(200);
    }

    if (tweetId) {
      tweetUrl = user.twitterUsername
        ? `https://x.com/${user.twitterUsername}/status/${tweetId}`
        : `https://x.com/i/web/status/${tweetId}`;

      if (tweetUrl && postId) {
        await prisma.post.update({
          where: { id: postId },
          data: { posted: true, tweetUrl, postedAt: new Date() },
        });
      }
      return { success: true, tweetUrl };
    } else {
      // no tweet id — try reading timeline to confirm or take a screenshot for debug
      console.warn(
        "[postToX] Post response not observed (no tweetId). Capturing debug info and rolling back if needed."
      );
      // rollback lastPostedAt to previous (allow immediate retry)
      await prisma.user
        .update({ where: { id: userId }, data: { lastPostedAt: last } })
        .catch(() => {});
      return { success: false, message: "Post not visible on timeline." };
    }
  } catch (err: any) {
    console.error("[postToX] ERROR:", err?.message ?? err);
    // rollback lastPostedAt to previous so user can retry
    try {
      await prisma.user
        .update({ where: { id: userId }, data: { lastPostedAt: last } })
        .catch(() => {});
    } catch {}
    return { success: false, message: err?.message ?? "Unknown error" };
  } finally {
    try {
      await context?.clearCookies?.();
    } catch {}
    try {
      await context?.close?.();
    } catch {}
    try {
      await browser?.close?.();
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/* ---------------- Logged-in detection ---------------- */
async function detectLoggedIn(page: any): Promise<boolean> {
  try {
    // if composer present, assume logged in
    const composer = await page.$('div[role="textbox"]');
    if (composer) return true;
    // otherwise if login link/button present, not logged in
    const loginBtn = await page.$(
      'a:has-text("Log in"), button:has-text("Log in")'
    );
    return !loginBtn;
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });

  const { userId, text, postId, mediaUrls } = req.body || {};
  if (!userId || !text)
    return res
      .status(400)
      .json({ success: false, message: "Missing userId or text" });

  const mediaArray = mediaUrls
    ? Array.isArray(mediaUrls)
      ? mediaUrls
      : [mediaUrls]
    : [];

  const result = await postToX(userId, text, postId, mediaArray);
  console.log("[postToX] result:", result);
  return res.status(result.success ? 200 : 500).json(result);
}
