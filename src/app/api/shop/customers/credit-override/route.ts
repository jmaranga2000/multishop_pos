import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
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
    const user = await requireUser();
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
      where: user.role === "SHOP" ? { id: customerId, shopId: user.shopId } : { id: customerId },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify sale exists
    const sale = await db.sale.findFirst({
      where: user.role === "SHOP" ? { id: saleId, shopId: user.shopId } : { id: saleId },
    });
    if (!sale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    // Only administrators or shop users may approve overrides; if admin, record shop from sale
    if (user.role !== "ADMIN" && user.role !== "SHOP") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Record override in audit log
    const auditShopId = sale?.shopId ?? user.shopId ?? null;
    await writeAuditLog(db, {
      action: "CREDIT_LIMIT_OVERRIDE",
      userId: user.id,
      shopId: auditShopId,
      description: `Credit limit override for sale ${saleId}`,
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
