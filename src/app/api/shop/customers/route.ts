import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { createCustomerSchema } from "@/validators/shop/customer-validator";
import { createCustomer } from "@/services/shop/customer-service";

export async function GET(request: Request) {
  const user = await requireShop();
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const customers = await (await import("@/services/shop/customer-service")).listCustomers(user, { search });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const user = await requireShop();
  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const customer = await createCustomer(user, parsed.data);
  return NextResponse.json(customer, { status: 201 });
}
