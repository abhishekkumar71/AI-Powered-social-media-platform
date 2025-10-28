// testLogin-persistent.js
import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

async function testLogin() {
  const useProxy = true; 
  const proxy = {
    server: "107.172.163.27:6543",
    username: "guchhcqj",
    password: "eplqnbk70xvj",
  };
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataDir = path.resolve(__dirname, "tmp", "chrome-profile");
if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });


  const executablePath = "C:\\Users\\marsa\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"; 

  console.log("userDataDir:", userDataDir);
  console.log("executablePath:", executablePath);

  const launchOptions = {
    headless: false,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-infobars",
    ],
    proxy: useProxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
  };

  console.log("Launching persistent context...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
    ignoreHTTPSErrors: true,
  });

 
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();



  try {
    // quick IP check to verify proxy is applied
    console.log("Checking public IP (ipinfo.io)...");
    await page.goto("https://ipinfo.io/json", { waitUntil: "networkidle", timeout: 30000 });
    let ipjson = await page.locator("body").innerText();
    console.log("ipinfo:", ipjson.slice(0, 400));

    console.log("Opening X (https://x.com) ...");
    await page.goto("https://x.com/", { waitUntil: "networkidle", timeout: 60000 });
    console.log("Loaded x.com");

    // quick content check for blocking messages
    const html = (await page.content()).toLowerCase();
    if (html.includes("this browser or app may not be secure") || html.includes("not secure")) {
      console.warn("⚠️ X indicates browser/app may not be secure (detected).");
    }
    if (html.includes("captcha") || html.includes("verify")) {
      console.warn("Captcha/verification may be required (proxy likely flagged).");
    }


    console.log("If UI rendered, try a manual login in the opened browser window.");
    console.log("I'll wait 2 minutes for manual interaction...");
    // wait so you can manually complete any challenge
    await page.waitForTimeout(120000); // 2 minutes

  } catch (err) {
    console.error("Error/timeout while navigating:", err);
    // capture page HTML & screenshot on error
    try {
      const snippet = (await page.content()).slice(0, 1000);
      console.log("Page snippet:", snippet);
    } catch (e) {
      console.warn("Could not capture page on error:", e);
    }
  } finally {
    console.log("Closing context (but keeping userDataDir for next run)...");
    try { await context.close(); } catch (e) { console.warn("close error:", e); }
  }
}

testLogin().catch((e) => {
  console.error("Fatal:", e);
});
