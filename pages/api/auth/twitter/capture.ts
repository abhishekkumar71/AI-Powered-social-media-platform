// // pages/api/auth/twitter/capture.ts
// import type { NextApiRequest, NextApiResponse } from "next";
// import { getServerSession } from "next-auth";
// import { authOptions } from "../[...nextauth]";
// import { captureSessionCookies } from "@/lib/playwrightCookieManager";

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const session = await getServerSession(req, res, authOptions);
//   if (!session?.user?.id) return res.status(401).end();
//   try {
//     const result = await captureSessionCookies(session.user.id);
//     res.json(result);
//   } catch (err:any) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// }
