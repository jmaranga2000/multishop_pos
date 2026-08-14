import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in" },
        { status: 401 }
      );
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }
    const admin = user;
    const { id } = await params;

    // Get all shops for this business
    const shops = await db.shop.findMany({
      where: { businessId: admin.businessId },
      select: { id: true },
    });
    const shopIds = shops.map((s) => s.id);

    // Get customer and verify they belong to a shop in this business
    const customer = await db.customer.findFirst({
      where: {
        id,
        shopId: { in: shopIds },
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get ledger entries for this customer
    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { customerId: id, shopId: customer.shopId },
      orderBy: { occurredAt: "asc" },
    });

    // Calculate aged balance
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const current = ledgerEntries
      .filter((e) => e.occurredAt >= thirtyDaysAgo)
      .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

    const thirtyPlus = ledgerEntries
      .filter((e) => e.occurredAt >= sixtyDaysAgo && e.occurredAt < thirtyDaysAgo)
      .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

    const sixtyPlus = ledgerEntries
      .filter((e) => e.occurredAt >= ninetyDaysAgo && e.occurredAt < sixtyDaysAgo)
      .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

    const ninetyPlus = ledgerEntries
      .filter((e) => e.occurredAt < ninetyDaysAgo)
      .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

    return NextResponse.json(
      {
        customer,
        ledgerEntries,
        agedBalance: { current, thirtyPlus, sixtyPlus, ninetyPlus },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin-customer-statement]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
