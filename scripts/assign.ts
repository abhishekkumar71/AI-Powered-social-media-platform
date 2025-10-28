import { prisma } from "@/lib/prisma";

export async function assignProxyToUser(userId: string) {
  // check if user already has a proxy
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { proxy: true },
  });
  if (existingUser?.proxy) return existingUser.proxy; // already assigned

  // find an unassigned proxy
  const proxy = await prisma.proxy.findFirst({
    where: { assigned: false },
  });

  if (!proxy) throw new Error("No available proxies.");

  // link proxy and user
  await prisma.proxy.update({
    where: { id: proxy.id },
    data: {
      assigned: true,
      assignedAt: new Date(),
      user: { connect: { id: userId } },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { proxyId: proxy.id },
  });

  console.log(`Assigned proxy ${proxy.ip}:${proxy.port} to user ${userId}`);
  return proxy;
}
