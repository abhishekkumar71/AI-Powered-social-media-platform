import cloudinary from "cloudinary";
import type { Response as PlaywrightResponse } from "playwright-core";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      {
        folder: "browserless-debug",
        public_id: publicId,
        resource_type: "image",
      },
      (error: any, result: any) => {
        if (error) {
          console.error("[cloudinary] upload error:", error);
          resolve(null);
        } else {
          resolve(result?.secure_url ?? null);
        }
      }
    );
    stream.end(buffer);
  });
}
/* ---------------- Screenshot upload ---------------- */
export async function captureAndUpload(page: any, label: string) {
  const ts = Date.now();
  const publicId = `${label}_${ts}`;

  try {
    const buffer = await page.screenshot({ fullPage: false });

    // Async fire-and-forget upload
    (async () => {
      try {
        const url = await uploadBufferToCloudinary(
          Buffer.from(buffer),
          publicId
        );
        if (url) console.log(`[debug] Screenshot uploaded: ${url}`);
      } catch (e) {
        console.error("[debugScreenshot] async upload failed:", e);
      }
    })();
  } catch (e) {
    console.error("[debugScreenshot] failed:", e);
    return null;
  }
}
/* ---------------- Advanced helpers (mouse, human click, scroll) ---------------- */
export async function realisticMouseMove(
  page: any,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 18
) {
  const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 40;
  const cpY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 2) * startX +
      2 * (1 - t) * t * cpX +
      Math.pow(t, 2) * endX +
      (Math.random() - 0.5) * 2;
    const y =
      Math.pow(1 - t, 2) * startY +
      2 * (1 - t) * t * cpY +
      Math.pow(t, 2) * endY +
      (Math.random() - 0.5) * 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(8 + Math.floor(Math.random() * 18));
  }
}
/* ---------------- Human-like typing ---------------- */
export async function humanType(page: any, selector: string, text: string) {
  const el = await page.$(selector);
  if (!el) throw new Error("selector not found: " + selector);
  const box = await el.boundingBox();
  if (box) {
    await page.mouse.move(
      box.x + box.width / 2 + (Math.random() - 0.5) * 6,
      box.y + box.height / 2 + (Math.random() - 0.5) * 6
    );
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.click(selector, { force: true });
  }
  for (const ch of text) {
    await page.keyboard.type(ch, {
      delay: 60 + Math.floor(Math.random() * 80),
    });
  }
  await page.waitForTimeout(200 + Math.floor(Math.random() * 300));
}
export async function humanClickElement(page: any, elHandle: any) {
  const box = await elHandle.boundingBox();
  if (!box) {
    try {
      await elHandle.click({ force: true });
    } catch {
      // fallback
      await page.mouse.click(640, 360);
    }
    return;
  }
  const startX = Math.max(5, box.x - 50 + Math.random() * 60);
  const startY = Math.max(5, box.y - 30 + Math.random() * 40);
  const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 6;
  const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 6;
  await realisticMouseMove(page, startX, startY, targetX, targetY, 20);
  await page.mouse.down();
  await page.waitForTimeout(40 + Math.floor(Math.random() * 120));
  await page.mouse.up();
  await page.waitForTimeout(400 + Math.floor(Math.random() * 800));
}

export async function scrollAndIdle(page: any) {
  const height = await page.evaluate(() => document.body.scrollHeight || 1000);
  const passes = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < passes; i++) {
    const y = Math.floor(Math.random() * Math.min(600, height));
    await page.mouse.wheel(0, y);
    await page.waitForTimeout(300 + Math.floor(Math.random() * 800));
  }
  await page.mouse.move(
    640 + (Math.random() - 0.5) * 200,
    300 + (Math.random() - 0.5) * 200
  );
  await page.waitForTimeout(300 + Math.floor(Math.random() * 700));
}

export async function installInitScript(context: any, page: any) {
  const script = `() => {
    try {
      try { Object.defineProperty(navigator, "webdriver", { get: () => undefined, configurable: true }); } catch(e) {}
      try { Object.defineProperty(navigator, "languages", { get: () => ["en-US","en"], configurable: true }); } catch(e) {}
      try { Object.defineProperty(navigator, "platform", { get: () => "Win32", configurable: true }); } catch(e) {}
      try { Object.defineProperty(navigator, "maxTouchPoints", { get: () => 0, configurable: true }); } catch(e) {}
      try { Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8, configurable: true }); } catch(e) {}
      try { Object.defineProperty(navigator, "deviceMemory", { get: () => 8, configurable: true }); } catch(e) {}

      try {
        if (!window.chrome) window.chrome = { runtime: {}, webstore: {}, loadTimes: function(){}, csi: function(){} };
      } catch(e) {}

      try {
        if (!navigator.userAgentData) {
          Object.defineProperty(navigator, "userAgentData", {
            get: () => ({
              brands: [{ brand: "Chromium", version: "142" }, { brand: "Google Chrome", version: "142" }],
              mobile: false,
              platform: "Windows",
              getHighEntropyValues: async () => ({ architecture: "x86", bitness: "64", model: "", platform: "Windows", platformVersion: "10.0.0", uaFullVersion: "142.0.7444.59", fullVersionList: [{ brand:"Chromium", version:"142.0.7444.59" }] })
            }),
            configurable: true
          });
        }
      } catch(e) {}

      try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() { try { const ctx = this.getContext('2d'); if (ctx) ctx.fillRect(0,0,1,1); } catch(e){} return origToDataURL.apply(this, arguments); };
      } catch(e) {}

      try {
        const webglProto = window.WebGLRenderingContext && window.WebGLRenderingContext.prototype;
        if (webglProto && webglProto.getParameter) {
          const orig = webglProto.getParameter;
          webglProto.getParameter = function(p) {
            if (p === 37445) return 'Intel Inc.';
            if (p === 37446) return 'Intel Iris OpenGL Engine';
            try { return orig.call(this, p); } catch(e) { return null; }
          }
        }
      } catch(e) {}

      try { console.log('[stealth] init script applied'); } catch(e) {}
    } catch (err) { try { console.warn('[stealth] init error', err); } catch(e) {} }
  }`;
  try {
    if (context && typeof context.addInitScript === "function") {
      await context.addInitScript({ content: script });
      console.log("[stealth] installed via context.addInitScript");
      return;
    }
  } catch (e) {
    console.warn("[stealth] context.addInitScript failed", e);
  }
  try {
    if (page && typeof page.addInitScript === "function") {
      await page.addInitScript(script);
      console.log("[stealth] installed via page.addInitScript");
      return;
    }
  } catch (e) {
    console.warn("[stealth] page.addInitScript failed", e);
  }
  try {
    await page.evaluate(script);
    console.log("[stealth] installed via evaluate fallback");
  } catch (e) {
    console.warn("[stealth] evaluate fallback failed", e);
  }
}

export function attachResponseWatcher(page: any) {
  page.on("response", async (resp: PlaywrightResponse) => {
    try {
      const url = resp.url();
      const status = resp.status();

      // Watch for any of these important flows
      const match =
        /challenge|captcha|hcaptcha|login|session|graphql|api\/auth|rate_limit|429|onboarding\/task|graphql\/.*user_flow|graphql.*createTweet|upload|media/i.test(
          url
        );

      if (match || status === 429) {
        const text = await resp.text().catch(() => null);
        console.log(
          `[net-watch] ${status} ${url} => ${
            text
              ? text.length > 600
                ? text.slice(0, 600) + "..."
                : text
              : "<no-body>"
          }`
        );
      }
    } catch (e) {}
  });
}
