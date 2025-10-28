import { prisma } from "./prisma";
import axios, { AxiosError } from "axios";
import UserAgent from "user-agents";
import { getValidTwitterCookies } from "./twitter";
import cron from "node-cron";
import crypto from "crypto";

export function startCronJobs(): void {
  cron.schedule("*/5 * * * *", async () => {
    console.log("Checking for scheduled posts...");
    const posts = await prisma.post.findMany({
      where: { posted: false, scheduled: { lte: new Date() } },
    });

    for (const post of posts) {
      const cookies = await getValidTwitterCookies(post.userId);
      if (!cookies) {
        console.error(`No cookies for user ${post.userId}`);
        continue;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 5000 + 2000)
      );

      try {
        const response = await axios.post(
          process.env.TWITTER_GRAPHQL_URL!,
          {
            variables: {
              tweet_text: post.text,
              media: {},
              with_replies: false,
            },
            query:
              "mutation CreateTweet($variables: CreateTweetInput!) { createTweet(input: $variables) { tweet { id } } }",
          },
          {
            headers: {
              "User-Agent": new UserAgent().toString(),
              "x-csrf-token": cookies.csrfToken,
              authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN!}`,
              "Content-Type": "application/json",
              Cookie: `auth_token=${cookies.authCookie}; ct0=${cookies.csrfToken}`,
              "x-twitter-active-user": "yes",
              "x-client-uuid": crypto.randomUUID(),
              "x-twitter-client-language": "en",
            },
          }
        );

        if (
          response.status === 200 &&
          response.data?.data?.createTweet?.tweet?.id
        ) {
          await prisma.post.update({
            where: { id: post.id },
            data: { posted: true },
          });
          console.log(`Posted tweet ${post.id} for user ${post.userId}`);
        } else {
          console.error(`Failed to post tweet ${post.id}:`, response.data);
        }
      } catch (err) {
        console.error(
          `Error posting tweet ${post.id}:`,
          (err as AxiosError).message
        );
      }
    }
  });
}
