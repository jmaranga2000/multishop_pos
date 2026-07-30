import { db } from "@/lib/db";

export async function getShopProfile(userId: string, shopId: string) {
  return db.user.findFirstOrThrow({
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
