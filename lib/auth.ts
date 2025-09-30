// lib/auth.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";

import type { NextApiRequest, NextApiResponse } from "next";

export const getServerAuthSession = async (req: NextApiRequest, res: NextApiResponse) => {
  return await getServerSession(
    req as unknown as import("http").IncomingMessage & { cookies: Record<string, string> },
    res as unknown as import("http").ServerResponse,
    authOptions
  );
};
