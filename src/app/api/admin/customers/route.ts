import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await requireAdmin();
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;

  const customers = await db.customer.findMany({
    where: {
      shop: {
        businessId: user.businessId,
      },
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json(customers);
}
