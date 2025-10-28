import fetch from "node-fetch";
import { prisma } from "../lib/prisma.js";

export async function fetchWebshareProxies(): Promise<string[]> {
  const url =
    "https://proxy.webshare.io/api/v2/proxy/list/download/rkfjqrurpviqpgflddhygvkgdsddcfsfbjbzxyns/-/any/username/direct/-/?plan_id=12061887";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch proxy list");
  const text = await res.text();
  const proxies = text.split("\n").filter(Boolean);
  return proxies;
}
async function main() {
  const proxies = await fetchWebshareProxies();

  for (const line of proxies) {
    console.log(line);
    try {
      const [ip, portStr, username, password] = line.split(":");
      const port = parseInt(portStr, 10);

      if (!ip || !port || !username || !password) {
        console.warn("Skipping invalid proxy line:", line);
        continue;
      }

      await prisma.proxy.upsert({
        where: { ip },
        update: {},
        create: {
          ip,
          port,
          username,
          password,
          protocol: "http",
          assigned: false,
        },
      });
    } catch (err) {
      console.warn("Failed to parse proxy line:", line, err);
    }
  }

  console.log(`Imported ${proxies.length} proxies successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
