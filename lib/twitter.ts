import { prisma } from "./prisma";

export async function getValidTwitterToken(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twitterAccessToken || !user.twitterRefreshToken) return null;

  // If token still valid
  if (user.twitterTokenExpires && user.twitterTokenExpires > new Date()) {
    return user.twitterAccessToken;
  }

  // Refresh token
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: user.twitterRefreshToken,
    client_id: process.env.TWITTER_CLIENT_ID!,
  });

  try {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
          ).toString("base64"),
      },
      body: params.toString(),
    });

    const newData = await res.json();
    if (!newData.access_token) return null;

    // Save rotated tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        twitterAccessToken: newData.access_token,
        twitterRefreshToken: newData.refresh_token ?? user.twitterRefreshToken,
        twitterTokenExpires: new Date(
          Date.now() + (newData.expires_in ?? 7200) * 1000
        ),
      },
    });

    return newData.access_token;
  } catch (err) {
    console.error("Failed to refresh Twitter token", err);
    return null;
  }
}
