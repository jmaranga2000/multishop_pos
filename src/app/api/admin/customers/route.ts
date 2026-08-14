import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await requireAdmin();
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;

  // First, get all shops for this business
  const shops = await db.shop.findMany({
    where: {
      businessId: user.businessId,
    },
  });

  const shopIds = shops.map((s) => s.id);

  // Then get customers from those shops
  const customers = await db.customer.findMany({
    where: {
      shopId: { in: shopIds },
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json(customers);
}
