import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { caption, imageUrl } = req.body;
  console.log(caption, imageUrl);

  if (!caption || !imageUrl) {
    return res
      .status(400)
      .json({ error: "Missing required fields: caption or imageUrl" });
  }

  // Read from .env
  const igUserId = process.env.NEXT_PUBLIC_IG_USER_ID!;
  const accessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN!;

  try {
    // Step 1: Create media object
    const mediaRes = await axios.post(
      `https://graph.facebook.com/v23.0/${igUserId}/media`,
      null,
      {
        params: {
          image_url: imageUrl, // must be a direct image URL
          caption,
          access_token: accessToken,
          comment_enabled: true, // required now
        },
      }
    );

    const creationId = mediaRes.data.id;
    await new Promise((res) => setTimeout(res, 5000)); // 5s delay

    const publishRes = await axios.post(
      `https://graph.facebook.com/v23.0/${igUserId}/media_publish`,
      null,
      { params: { creation_id: creationId, access_token: accessToken } }
    );

    res.status(200).json({ publishedPost: publishRes.data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create post" });
  }
}
