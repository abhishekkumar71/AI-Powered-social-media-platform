import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";
import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
  if (err) return res.status(500).json({ error: "File parsing failed" });

  // Ensure files.file exists and normalize to array
  const fileList = files.file
    ? Array.isArray(files.file)
      ? files.file
      : [files.file]
    : [];

  if (fileList.length === 0)
    return res.status(400).json({ error: "No file uploaded" });

  try {
    // Upload each file
    const uploadedUrls = [];
    for (const file of fileList) {
      if (!file) continue; // type-guard
      const upload = await cloudinary.uploader.upload(file.filepath, {
        resource_type: "auto",
        folder: "x_media_uploads",
      });
      uploadedUrls.push(upload.secure_url);
      fs.unlinkSync(file.filepath);
    }

    return res.status(200).json({ url: uploadedUrls.length === 1 ? uploadedUrls[0] : uploadedUrls });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Cloudinary upload failed" });
  }
});

}
