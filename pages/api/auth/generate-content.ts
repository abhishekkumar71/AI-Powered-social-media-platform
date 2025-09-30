import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Prompt is required and must be a string" });
    }

    const finalPrompt = `
Generate a human-like tweet based on the following input:
"${prompt}"

Rules:
- Maximum 280 characters in simple language
- Do not include links, hashtags,no extra spaces or mentions
- Do not add extra spaces after punctuation
- Do not insert line breaks; keep the text in a single continuous line suitable for a tweet
- Must be safe for all audiences (no adult or harmful content)
- Sound natural, engaging, and human-written
- Include a clear idea or interesting fact, humor, or a positive message.
- Format it as a single paragraph suitable for posting directly as a tweet.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    console.log("Gemini raw response:", JSON.stringify(data, null, 2));

    const candidateContent = data?.candidates?.[0]?.content;

    let content = "";
    if (candidateContent?.parts && Array.isArray(candidateContent.parts)) {
      content = candidateContent.parts.map((part: any) => part.text).join(" ");
    } else if (candidateContent?.text) {
      content = candidateContent.text;
    }

    return res.status(200).json({ content });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
