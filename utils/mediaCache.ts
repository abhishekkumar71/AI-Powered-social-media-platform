import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import mime from "mime-types";

const CACHE_DIR = path.join(process.cwd(), "tmp", "media-cache");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

fs.ensureDirSync(CACHE_DIR);


export async function getCachedMedia(url: string): Promise<string | null> {
  try {
    // Derive cache file name based on URL hash
    const hash = Buffer.from(url).toString("base64").replace(/[=+/]/g, "");
    const ext = mime.extension(mime.lookup(url) || "") || "bin";
    const cachedPath = path.join(CACHE_DIR, `${hash}.${ext}`);

    // If file exists and is recent, return it
    if (fs.existsSync(cachedPath)) {
      const stats = await fs.stat(cachedPath);
      const age = Date.now() - stats.mtimeMs;
      if (age < CACHE_TTL) {
        console.log(`[mediaCache] Using cached file for ${url}`);
        return cachedPath;
      }
    }

    console.log(`[mediaCache] Downloading ${url}`);

    // Fetch media
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[mediaCache] Failed to fetch ${url} (${res.status})`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    await fs.writeFile(cachedPath, Buffer.from(buffer));

    // Validate MIME type (optional but safer)
    const contentType = res.headers.get("content-type") || mime.lookup(url);
    if (!contentType) {
      console.warn(`[mediaCache] Unknown MIME type for ${url}`);
      return cachedPath;
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      console.warn(`[mediaCache] Unsupported media type: ${contentType}`);
      await fs.remove(cachedPath);
      return null;
    }

    console.log(`[mediaCache] Cached: ${cachedPath}`);
    return cachedPath;
  } catch (err) {
    console.error(`[mediaCache] Error caching ${url}:`, err);
    return null;
  }
}

/**
 * Deletes old cache files (older than CACHE_TTL)
 */
export async function clearOldCache() {
  try {
    const files = await fs.readdir(CACHE_DIR);
    const now = Date.now();

    for (const file of files) {
      const fullPath = path.join(CACHE_DIR, file);
      const stats = await fs.stat(fullPath);
      const age = now - stats.mtimeMs;

      if (age > CACHE_TTL) {
        await fs.remove(fullPath);
        console.log(`[mediaCache] Removed old cache file: ${file}`);
      }
    }
  } catch (err) {
    console.warn("[mediaCache] Failed to clear old cache:", err);
  }
}
