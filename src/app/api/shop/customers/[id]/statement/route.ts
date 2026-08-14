import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { getCustomerStatement } from "@/services/shop/ledger-query-service";
import { AppError } from "@/lib/errors/app-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireShop();
    const { id } = await params;
    const statement = await getCustomerStatement(id, user.shopId);
    return NextResponse.json(statement, { status: 200 });
  } catch (error) {
    console.error("[customer-statement]", error);
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
