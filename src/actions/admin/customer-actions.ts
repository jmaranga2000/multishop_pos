"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";

const createAdminCustomerSchema = z.object({
  shopId: z.string().min(1, "Shop is required"),
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().trim().optional().transform((value) => (value && value.length > 0 ? value : undefined)),
  email: z.string().trim().optional().transform((value) => (value && value.length > 0 ? value : undefined)),
  creditLimitMinor: z.coerce.number().int().min(0).default(0),
});

export async function createCustomerAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createAdminCustomerSchema.parse({
    shopId: formData.get("shopId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    creditLimitMinor: formData.get("creditLimitMinor") ?? 0,
  });

  const shop = await db.shop.findFirst({
    where: { id: input.shopId, businessId: admin.businessId },
  });

  if (!shop) {
    throw new Error("Selected shop was not found in this business");
  }

  await db.customer.create({
    data: {
      shopId: shop.id,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      creditLimit: input.creditLimitMinor,
      cachedOutstandingMinor: 0,
    },
  });

  revalidatePath("/admin/customers");
  redirect("/admin/customers");
}
