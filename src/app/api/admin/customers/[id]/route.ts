import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: {
      id,
      shop: {
        businessId: user.businessId,
      },
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

  const customer = await db.customer.findFirst({
    where: {
      id,
      shop: {
        businessId: user.businessId,
      },
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
