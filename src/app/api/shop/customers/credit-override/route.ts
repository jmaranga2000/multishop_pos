import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/services/shared/audit-service";
import { AppError } from "@/lib/errors/app-error";
import { z } from "zod";

const creditOverrideSchema = z.object({
  saleId: z.string(),
  customerId: z.string(),
  overrideReason: z.string().min(1, "Reason required"),
  amountMinor: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const user = await requireShop();
    const body = await request.json();
    const parsed = creditOverrideSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { saleId, customerId, overrideReason, amountMinor } = parsed.data;

    // Verify customer belongs to shop
    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: user.shopId },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify sale exists
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: user.shopId },
    });
    if (!sale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    // Record override in audit log
    await writeAuditLog(db, {
      action: "CREDIT_LIMIT_OVERRIDE",
      userId: user.id,
      shopId: user.shopId,
      description: `Manager override for credit limit on sale ${saleId}`,
      metadata: {
        saleId,
        customerId,
        overrideReason,
        amountMinor,
      },
    });

    return NextResponse.json(
      { success: true, message: "Override approved and logged" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[credit-override]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
