import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { receiveCustomerPaymentSchema } from "@/validators/shop/customer-validator";
import { receiveCustomerPayment } from "@/services/shop/customer-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireShop();
  const { id } = await params;
  const body = await request.json();
  const parsed = receiveCustomerPaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const entry = await receiveCustomerPayment(user, id, parsed.data);
  return NextResponse.json(entry, { status: 201 });
}
