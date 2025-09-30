import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "POST") {
    const { content, platforms } = req.body;
    try {
      const post = await prisma.post.create({
        data: {
          userId: session.user.id,
          content,
          platforms,
        },
      });
      return res.status(201).json(post);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create post" });
    }
  }

  if (req.method === "GET") {
    const posts = await prisma.post.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(posts);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
