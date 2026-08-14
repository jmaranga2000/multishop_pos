import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;

  // Get all shops for this business
  const shops = await db.shop.findMany({
    where: {
      businessId: user.businessId,
    },
  });

  const shopIds = shops.map((s) => s.id);

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

  return NextResponse.json(customer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  // Get all shops for this business
  const shops = await db.shop.findMany({
    where: {
      businessId: user.businessId,
    },
  });

  const shopIds = shops.map((s) => s.id);

  const customer = await db.customer.findFirst({
    where: {
      id,
      shopId: { in: shopIds },
    },
  });

  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found" },
      { status: 404 }
    );
  }

  const updatedCustomer = await db.customer.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
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

  return NextResponse.json(updatedCustomer);
}
