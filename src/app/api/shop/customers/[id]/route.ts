import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { getCustomer } from "@/services/shop/customer-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireShop();
  const { id } = await params;
  const customer = await getCustomer(user, id);
  return NextResponse.json(customer);
}
