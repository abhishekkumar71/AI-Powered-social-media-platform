import type { NextApiRequest, NextApiResponse } from "next";

type InstagramEvent = {
  object: string;
  entry: Array<any>;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const VERIFY_TOKEN = process.env.INSTA_TOKEN; 

  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log(" Webhook verified!");
        res.status(200).send(challenge); 
      } else {
        console.warn(" Webhook verification failed");
        res.status(403).end();
      }
    } else {
      res.status(400).end();
    }
  } else if (req.method === "POST") {
    const body: InstagramEvent = req.body;

    if (body.object === "instagram") {
      body.entry.forEach((entry) => {
        if (entry.messaging) {
          entry.messaging.forEach((msg: any) => {
            if (msg.message) {
              console.log("Message received:", msg.message);
            }
            if (msg.reaction) {
              console.log("Reaction received:", msg.reaction);
            }
          });
        }

        if (entry.changes) {
          entry.changes.forEach((change: any) => {
            if (change.field === "comments") {
              console.log("Comment received:", change.value);
            }
          });
        }
      });

      res.status(200).end();
    } else {
      console.warn("Unknown webhook object:", body.object);
      res.status(400).end(); 
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(); 
  }
}
