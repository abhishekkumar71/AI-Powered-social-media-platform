// pages/api/auth/generate-content.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, type } = req.body; // type can be "text", "image", or "both"

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required and must be a string" });
    }

    const result: any = {};

    // ===== Generate Text =====
    if (type === "text" || type === "both") {
      const finalPrompt = `
Generate a human-like post based on the following input:
"${prompt}"

Rules:
- Maximum 280 characters
- No links, hashtags, mentions
- Simple, safe, engaging
- Single paragraph suitable for posting
      `;

      const textRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": process.env.GEMINI_API_KEY || "",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: finalPrompt }] }],
          }),
        }
      );
      const textData = await textRes.json();
      const candidateContent = textData?.candidates?.[0]?.content;
      let content = "";
      if (candidateContent?.parts && Array.isArray(candidateContent.parts)) {
        content = candidateContent.parts.map((part: any) => part.text).join(" ");
      } else if (candidateContent?.text) {
        content = candidateContent.text;
      }
      result.text = content;
    }

    // ===== Generate Image =====
    if (type === "image" || type === "both") {
      const imageRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-image:generateImage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": process.env.GEMINI_API_KEY || "",
          },
          body: JSON.stringify({
            prompt,
            imageCount: 1,
            size: "1024x1024",
          }),
        }
      );
      const imageData = await imageRes.json();
      result.imageUrl = imageData?.images?.[0]?.url || null;
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
