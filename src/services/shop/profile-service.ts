import { prisma } from "@/lib/prisma";

export async function getShopProfile(userId: string, shopId: string) {
  return prisma.user.findFirstOrThrow({
    where: { id: userId, shopId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      shop: { select: { id: true, name: true, code: true, phone: true, email: true, address: true, isActive: true } },
    },
  });
}
