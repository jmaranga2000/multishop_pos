import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { createAdjustmentSchema } from "@/validators/shop/customer-validator";
import { createCustomerAdjustment } from "@/services/shop/customer-service";
import { AppError } from "@/lib/errors/app-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireShop();
    const { id } = await params;
    const body = await request.json();
    const parsed = createAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const entry = await createCustomerAdjustment(user, id, parsed.data);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[customer-adjustments]", error);
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
