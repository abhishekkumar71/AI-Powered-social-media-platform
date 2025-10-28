import { chromium, BrowserContext, Cookie } from "playwright";
import crypto from "crypto";
import { prisma } from "@/lib/prisma"; 

const ENC_KEY = process.env.COOKIE_ENC_KEY; 
if (!ENC_KEY) throw new Error("Missing COOKIE_ENC_KEY in env");

function encrypt(text: string) {
const key = Buffer.from(ENC_KEY as string, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(dataB64: string) {
const key = Buffer.from(ENC_KEY as string, "base64");
  const data = Buffer.from(dataB64, "base64");
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Launch an interactive Playwright browser, let the user login, then capture cookies for x.com
 * Stores encrypted cookies to prisma.user.cookieEncrypted and cookieExpires
 */
export async function captureSessionCookies(userId: string, sessionTimeoutHours = 24) {
  const browser = await chromium.launch({ headless: false }); // show UI so user can login
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to login page
  await page.goto("https://x.com/login", { waitUntil: "networkidle" });

  // Instruct dev: user logs in manually in the opened browser
  console.log("Please log in manually in the Playwright browser window. Once logged in, press Enter in terminal.");

  // Wait for user confirmation in terminal (simple)
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });

  // After user confirms, ensure we are logged in by checking a cookie or a known selector
  // Wait for a cookie like 'auth_token' to appear or for the home page composer to be visible
  try {
    // wait up to 30s for auth cookie
    await page.waitForFunction(() => {
      return document.cookie && document.cookie.indexOf("auth_token") !== -1;
    }, { timeout: 30000 });
  } catch {
    console.warn("auth_token cookie not detected automatically. Attempting to gather cookies anyway.");
  }

  // Collect cookies for the domain x.com (and .x.com)
  const cookies = await context.cookies("https://x.com");
  // Filter relevant cookies or store all
  const wanted = cookies.filter(c => ["auth_token","ct0","twid","guest_id"].includes(c.name) || c.domain.includes("x.com"));

  // Save cookies as JSON, encrypt and store
  const payload = JSON.stringify({ cookies: wanted, capturedAt: Date.now() });
  const enc = encrypt(payload);

  const expiry = new Date(Date.now() + sessionTimeoutHours * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      cookieEncrypted: enc,
      cookieExpires: expiry,
    },
  });

  await browser.close();
  return { saved: true, expiresAt: expiry };
}

/**
 * Use stored encrypted cookies for a user to open a context and post a tweet by simulating typing+click.
 * Returns { success: boolean, details?: any }
 */
export async function postTweetWithCookies(userId: string, text: string): Promise<{ success: boolean; message?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.cookieEncrypted || !user.cookieExpires) {
    return { success: false, message: "No cookies available for user" };
  }
  if (new Date() > user.cookieExpires) {
    return { success: false, message: "Cookies expired; please re-capture session" };
  }

  // decrypt
  let payloadJson: string;
  try {
    payloadJson = decrypt(user.cookieEncrypted);
  } catch (e) {
    console.error("Failed to decrypt cookies:", e);
    return { success: false, message: "Failed to decrypt cookies" };
  }
  const payload = JSON.parse(payloadJson);
  const cookiesFromDb: Cookie[] = payload.cookies;

  // Launch headless browser for posting (headless true is ok; use headless:false for debugging)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Add cookies into context (must include url or domain)
  // Playwright Cookie shape: { name, value, domain, path, expires, httpOnly, secure, sameSite }
  // Ensure domain is correct: if stored cookie domain is ".x.com" keep it
  const toAdd = cookiesFromDb.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain.startsWith(".") ? c.domain : c.domain,
    path: c.path || "/",
    expires: c.expires ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? true,
    sameSite: c.sameSite ?? "Lax",
    url: "https://x.com" // ensures context.addCookies works in some Playwright versions
  }));

  try {
    await context.addCookies(toAdd);

    const page = await context.newPage();
    // Go to composer page. Use compose URL to ensure composer is loaded.
    await page.goto("https://x.com/compose/post", { waitUntil: "networkidle" });

    // Wait for composer textbox
    // NOTE: selector might vary over time; this is a commonly used role selector
    const textboxSelector = 'div[role="textbox"]';
    await page.waitForSelector(textboxSelector, { timeout: 15000 });

    // Focus and type with delay to mimic human typing
    await page.focus(textboxSelector);
    await page.type(textboxSelector, text, { delay: 80 });

    // Click tweet/post button — selector varies; check current data-testid or role
    // Common selector: button[data-testid="tweetButton"] or div[data-testid="tweetButton"]
    const buttonSelectors = [
      'div[data-testid="tweetButton"]', 
      'div[data-testid="tweetButtonInline"]', 
      'button[data-testid="tweetButton"]',
      'div[data-testid="confirmationSheetConfirm"]'
    ];
    let posted = false;
    for (const sel of buttonSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        posted = true;
        break;
      }
    }
    if (!posted) {
      // fallback: try enter key on textbox (less reliable)
      await page.keyboard.press("Control+Enter").catch(()=>{});
    }

    // Wait for confirmation toast or navigation change
    // This will vary. Look for a toast selector, or check network activity for CreateTweet response.
    // We'll try both: wait a short period and inspect recent responses for 'CreateTweet' endpoint.
    const success = await waitForTweetCreateResponse(page, 10000);
    await browser.close();
    if (success) return { success: true, message: "Tweet posted" };
    return { success: false, message: "No confirmation detected — post may have failed" };

  } catch (err) {
    console.error("Posting error:", err);
    await browser.close();
    return { success: false, message: String(err) };
  }
}


async function waitForTweetCreateResponse(page: any, timeout = 10000) {
  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const onResponse = (resp: any) => {
      try {
        const url: string = resp.url();
        if (url.includes("/i/api/graphql/") && url.includes("/CreateTweet")) {
          resp.json().then((j: any) => {
            if (j && j.data && j.data.createTweet && j.data.createTweet.tweet && j.data.createTweet.tweet.id) {
              if (!resolved) { resolved = true; cleanup(); resolve(true); }
            }
          }).catch(()=>{});
        }
      } catch(e){/*ignore*/}
    };

    function cleanup() {
      page.off("response", onResponse);
      clearTimeout(timer);
    }

    page.on("response", onResponse);
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; cleanup(); resolve(false); }
    }, timeout);
  });
}
