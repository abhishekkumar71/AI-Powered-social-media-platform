export function extractTweetIdFromJson(json: any): string | null {
  if (!json || typeof json !== "object") return null;
  if (typeof json.rest_id === "string") return json.rest_id;
  if (typeof json.id === "string") return json.id;
  for (const k of Object.keys(json)) {
    const v = json[k];
    if (typeof v === "object") {
      const f = extractTweetIdFromJson(v);
      if (f) return f;
    }
  }
  return null;
}
