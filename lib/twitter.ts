import { prisma } from "./prisma";
import { chromium } from "playwright";

interface TwitterCookies {
  authCookie: string;
  csrfToken: string;
}

export async function getValidTwitterCookies(userId: string): Promise<TwitterCookies | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (
    user.twitterAuthCookie &&
    user.twitterCsrfToken &&
    user.twitterCookieExpires &&
    user.twitterCookieExpires > new Date()
  ) {
    return {
      authCookie: user.twitterAuthCookie,
      csrfToken: user.twitterCsrfToken,
    };
  }

  if (!user.twitterUsername || !user.twitterPassword) {
    throw new Error("Twitter username or password missing");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("https://x.com/login");
    await page.fill('input[name="text"]', user.twitterUsername);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(Math.random() * 1000 + 500);
    await page.fill('input[name="password"]', user.twitterPassword);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 30000 });

    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === "auth_token")?.value;
    const csrfToken = cookies.find((c) => c.name === "ct0")?.value;

    if (!authCookie || !csrfToken) {
      throw new Error("Failed to retrieve cookies");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twitterAuthCookie: authCookie,
        twitterCsrfToken: csrfToken,
        twitterCookieExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { authCookie, csrfToken };
  } finally {
    await browser.close();
  }
}

export async function getValidTwitterToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twitterAccessToken || !user.twitterRefreshToken) return null;

  if (user.twitterTokenExpires && user.twitterTokenExpires > new Date()) {
    return user.twitterAccessToken;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: user.twitterRefreshToken,
    client_id: process.env.TWITTER_CLIENT_ID!,
  });

  try {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
          ).toString("base64"),
      },
      body: params.toString(),
    });

    const newData: { access_token: string; refresh_token?: string; expires_in?: number } = await res.json();
    if (!newData.access_token) return null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        twitterAccessToken: newData.access_token,
        twitterRefreshToken: newData.refresh_token ?? user.twitterRefreshToken,
        twitterTokenExpires: new Date(Date.now() + (newData.expires_in ?? 7200) * 1000),
      },
    });

    return newData.access_token;
  } catch (err) {
    console.error("Failed to refresh Twitter token", err);
    return null;
  }
}