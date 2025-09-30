import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./[...nextauth]"
import puppeteer from "puppeteer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "POST") {
    const { platform, content, credentials } = req.body;
    // credentials = { username, password } 

    if (!platform || !content || !credentials) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      if (platform === "twitter") {
        await page.goto("https://twitter.com/login");
        await page.type('input[name="text"]', credentials.username);
        await page.type('input[name="password"]', credentials.password);
        await page.click('div[data-testid="LoginForm_Login_Button"]');
        await page.waitForNavigation();
        await page.goto("https://twitter.com/compose/tweet");
        await page.type('div[data-testid="tweetTextarea_0"]', content);
        await page.click('div[data-testid="tweetButtonInline"]');
      }

      if (platform === "linkedin") {
        await page.goto("https://www.linkedin.com/login");
        await page.type('#username', credentials.username);
        await page.type('#password', credentials.password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        await page.goto("https://www.linkedin.com/feed/");
        await page.click('button[data-control-name="share_post"]'); // Open post modal
        await page.type('div[role="textbox"]', content);
        await page.click('button[data-control-name="share_post_submit"]');
      }

      await browser.close();
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Automation failed" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
