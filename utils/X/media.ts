import { Page, ElementHandle } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { execSync } from "child_process";

interface VideoInfo {
  width: number;
  height: number;
  sizeMB: number;
  durationSec: number;
}

function detectMediaType(file: string): "image" | "gif" | "video" | "unknown" {
  const ext = path.extname(file).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  if (ext === ".gif") return "gif";
  if ([".mp4", ".mov", ".m4v"].includes(ext)) return "video";
  return "unknown";
}

async function getImageResolution(file: string) {
  try {
    const meta = await sharp(file).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

function getVideoInfo(file: string): VideoInfo | null {
  try {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 "${file}"`;
    const output = execSync(cmd).toString().trim();
    const [width, height, duration] = output.split(",").map(Number);
    const stats = fs.statSync(file);
    return { width, height, sizeMB: stats.size / 1024 / 1024, durationSec: duration };
  } catch (err) {
    console.warn("[mediaUpload] Video info extraction failed", err);
    return null;
  }
}

export async function attachFilesToComposer(
  page: Page,
  localPaths: string[]
): Promise<string[] | null> {
  if (!localPaths || localPaths.length === 0) return [];

  // ---- Detect types and enforce limits ----
  const types = localPaths.map(detectMediaType);
  const hasImages = types.includes("image");
  const hasGif = types.includes("gif");
  const hasVideo = types.includes("video");

  if ((hasVideo && (hasImages || hasGif)) || (hasGif && (hasImages || hasVideo)))
    throw new Error("You can only upload either images OR a single GIF/video, not mixed.");

  if (hasImages && localPaths.length > 4) localPaths = localPaths.slice(0, 4);
  if ((hasGif || hasVideo) && localPaths.length > 1) localPaths = [localPaths[0]];

  // Optional: Check video resolution & size
  if (hasVideo) {
    const info = getVideoInfo(localPaths[0]);
    if (info) {
      if (info.width > 1920 || info.height > 1200)
        throw new Error("Video resolution too high (max 1920x1200)");
      if (info.sizeMB > 512) throw new Error("Video size exceeds 512MB");
      if (info.durationSec > 600) throw new Error("Video duration exceeds 10 minutes");
    }
  }

  const uploadedMediaIds: string[] = [];
  const MAX_RETRIES = 3;

  // Listen to FINALIZE requests to detect completed uploads
  page.on("requestfinished", async (req) => {
    try {
      const url = req.url();
      if (url.includes("/i/media/upload.json?command=FINALIZE")) {
        const data = JSON.parse(req.postData() || "{}");
        if (data?.media_id_string && !uploadedMediaIds.includes(data.media_id_string)) {
          uploadedMediaIds.push(data.media_id_string);
          console.info("[mediaUpload] finalized media:", data.media_id_string);
        }
      }
    } catch {}
  });

  const safePaths = localPaths.map((p) => p.replace(/\\/g, "/"));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let targetInput: ElementHandle<HTMLElement | SVGElement> | null = null;

      const composer = await page.$('div[role="textbox"]');
      if (composer) {
        const inputs = await composer.$$('input[type="file"]');
        if (inputs.length > 0) targetInput = inputs[inputs.length - 1];
      }

      if (!targetInput) {
        const inputs = await page.$$('input[type="file"]');
        if (inputs.length > 0) targetInput = inputs[inputs.length - 1];
      }

      if (!targetInput) throw new Error("No file input found");

      await targetInput.setInputFiles(safePaths);

      // Wait until post button becomes enabled as sign of upload completion
      const postButtonSelector = `
        div[data-testid="tweetButtonInline"],
        div[data-testid="tweetButton"],
        button:has-text("Tweet"),
        button:has-text("Post")
      `;
      const start = Date.now();
      const timeout = 60000; // 60s max wait
      while (uploadedMediaIds.length < safePaths.length) {
        const btn = await page.$(postButtonSelector);
        const isDisabled = btn ? await btn.getAttribute("disabled") : "true";
        if (btn && !isDisabled) break;
        if (Date.now() - start > timeout) break;
        await page.waitForTimeout(300);
      }

      if (uploadedMediaIds.length === safePaths.length) {
        console.info("[mediaUpload] All media uploaded successfully");
        return uploadedMediaIds;
      } else {
        console.warn(`[mediaUpload] Attempt ${attempt} incomplete, retrying...`);
      }
    } catch (err) {
      console.warn(`[mediaUpload] Attempt ${attempt} failed:`, err);
      await page.waitForTimeout(500);
    }
  }

  console.error("[mediaUpload] Failed to attach all media after retries");
  return null;
}
export async function downloadToTempFile(url: string): Promise<string | null> {
  try {
    const fetchFn =
      (globalThis as any).fetch ?? (await import("node-fetch")).default;
    const res = await fetchFn(url);
    if (!res || !res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = (url.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|m4v)(?:\?|$)/i) ||
      [])[1];
    if (ext) ext = "." + ext.toLowerCase();
    else {
      const ct = (res.headers?.get?.("content-type") || "").toLowerCase();
      if (ct.includes("jpeg")) ext = ".jpg";
      else if (ct.includes("png")) ext = ".png";
      else if (ct.includes("gif")) ext = ".gif";
      else if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("mp4")) ext = ".mp4";
      else if (ct.includes("quicktime") || ct.includes("mov")) ext = ".mov";
      else ext = ".bin";
    }

    const tmpPath = path.join(os.tmpdir(), `post_media_${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  } catch (err) {
    console.warn("[postToX] media download failed:", err);
    return null;
  }
}
