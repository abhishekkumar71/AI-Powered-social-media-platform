import type { NextApiRequest, NextApiResponse } from "next";
import {
  chromium,
  BrowserContext,
  Response as PlaywrightResponse,
} from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";
import { decryptPayload } from "../../../../utils/X/cookies";
import { downloadToTempFile } from "../../../../utils/X/media";
import { secondsBetween, randInt } from "../../../../utils/X/delay";
import { extractTweetIdFromJson } from "../../../../utils/X/tweetHelper";
import { getCachedMedia, clearOldCache } from "../../../../utils/mediaCache";

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
const CHROME_PATH = process.env.CHROME_PATH;

if (!ENC_KEY_B64) throw new Error("Missing COOKIE_ENC_KEY in .env.local");

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

  const nextAvailablePost = new Date(
    Date.now() + randInt(MIN_DELAY_MIN * 60_000, MAX_DELAY_MIN * 60_000)
  );
  await prisma.user.update({
    where: { id: userId },
    data: { lastPostedAt: nextAvailablePost },
  });

  let cookies: any[] = [];
  try {
    cookies = decryptPayload(user.twitterAuthCookie).cookies;
    if (!Array.isArray(cookies)) throw new Error("Invalid cookie payload");
  } catch (err) {
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

  const cookieObjects = cookies.map((c: any) => ({
    name: String(c.name),
    value: String(c.value),
    path: c.path ?? "/",
    domain: c.domain ?? "x.com",
    expires: typeof c.expires === "number" ? c.expires : undefined,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    sameSite: c.sameSite || "None",
  }));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-chrome-"));
  let browser: any = null;
  let context: BrowserContext | null = null;
  let tweetUrl: string | null = null;

  try {
    const launchOpts: any = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };
    // if (CHROME_PATH) launchOpts.executablePath = CHROME_PATH;
    // else launchOpts.channel = "chrome";

    browser = await chromium.launch(launchOpts);
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });

    await context?.addCookies(cookieObjects);

    const page = await context!.newPage();
    await page.addInitScript(() => {
      try {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
      } catch {}
    });

    await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
    const loggedIn = await detectLoggedIn(page);
    if (!loggedIn)
      return {
        success: false,
        message: "Session invalid — reconnect.",
        needReconnect: true,
      };

    await page.goto("https://x.com/compose/post", {
      waitUntil: "domcontentloaded",
    });

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
        const uploadSelector = 'input[data-testid="fileInput"]';
        await page.waitForSelector(uploadSelector, { timeout: 15000 });
        const fileInput = await page.$(uploadSelector);
        if (!fileInput) throw new Error("Upload input not found");

        await fileInput.setInputFiles(localPaths);
        console.log("[postToX] Media upload triggered:", localPaths);

        const postBtnSelector =
          'div[data-testid="tweetButtonInline"], div[data-testid="tweetButton"], button:has-text("Post")';
        const postBtn = await page.waitForSelector(postBtnSelector, {
          timeout: 45000,
        });

        // wait until button is enabled as sign of media upload completion
        const start = Date.now();
        while (!(await postBtn.isEnabled()) && Date.now() - start < 60000) {
          await page.waitForTimeout(300);
        }
      }
    }

    const textboxSelector = 'div[role="textbox"]';
    await page.waitForSelector(textboxSelector, { timeout: 20000 });
    await page.click(textboxSelector);

    for (const ch of text)
      await page.keyboard.type(ch, { delay: 40 + Math.random() * 30 });
    await page.waitForTimeout(800);

    const postBtnSelector =
      'div[data-testid="tweetButtonInline"], div[data-testid="tweetButton"], button:has-text("Post")';
    let tweetId: string | null = null;
    page.on("response", async (resp: PlaywrightResponse) => {
      try {
        const url = resp.url();
        if (
          url.includes("/i/api/graphql/") &&
          url.toLowerCase().includes("createtweet")
        ) {
          const json = await resp.json().catch(() => null);
          const id = extractTweetIdFromJson(json);
          if (id) tweetId = id;
        }
      } catch {}
    });

    const btn = await page.waitForSelector(postBtnSelector, { timeout: 15000 });
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await btn.click();

    const start = Date.now();
    while (!tweetId && Date.now() - start < 20000)
      await page.waitForTimeout(200);

    if (tweetId)
      tweetUrl = user.twitterUsername
        ? `https://x.com/${user.twitterUsername}/status/${tweetId}`
        : `https://x.com/i/web/status/${tweetId}`;

    if (tweetUrl && postId)
      await prisma.post.update({
        where: { id: postId },
        data: { posted: true, tweetUrl, postedAt: new Date() },
      });

    return tweetUrl
      ? { success: true, tweetUrl }
      : { success: false, message: "Post not visible on timeline." };
  } catch (err: any) {
    console.error("[postToX] ERROR:", err);
    return { success: false, message: err?.message ?? "Unknown error" };
  } finally {
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

async function detectLoggedIn(page: any): Promise<boolean> {
  try {
    const composer = await page.$('div[role="textbox"]');
    if (composer) return true;
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
  console.log(result);
  return res.status(result.success ? 200 : 500).json(result);
}
