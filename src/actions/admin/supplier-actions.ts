"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { z } from "zod";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  assignSupplierProducts,
  generateSupplierRestockRequest,
} from "@/services/admin/supplier-service";
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierProductAssignmentSchema,
} from "@/validators/admin/supplier-validator";

export async function createSupplierAction(formData: FormData) {
  const admin = await requireAdmin();
  const productIds = formData.getAll("productIds").map((value) => String(value)).filter(Boolean);
  const input = createSupplierSchema.parse({
    ...Object.fromEntries(formData.entries()),
    productIds,
  });
  await createSupplier(admin, input, productIds);
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers");
}

export async function updateSupplierAction(formData: FormData) {
  const admin = await requireAdmin();
  const productIds = formData.getAll("productIds").map((value) => String(value)).filter(Boolean);
  const input = updateSupplierSchema.parse({
    ...Object.fromEntries(formData.entries()),
    productIds,
  });
  await updateSupplier(admin, input, productIds);
  revalidatePath(`/admin/suppliers/${input.supplierId}`);
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers");
}

export async function deleteSupplierAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ supplierId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await deleteSupplier(admin, input.supplierId);
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers");
}

export async function assignSupplierProductsAction(formData: FormData) {
  const admin = await requireAdmin();
  const supplierId = formData.get("supplierId") as string;
  const productIds = formData.getAll("productIds") as string[];
  const targetQuantities: Record<string, number> = {};

  for (const key of formData.keys()) {
    if (key.startsWith("targetQuantity_")) {
      const productId = key.replace("targetQuantity_", "");
      targetQuantities[productId] = Number(formData.get(key));
    }
  }

  const input = supplierProductAssignmentSchema.parse({
    supplierId,
    productIds: productIds.length ? productIds : undefined,
    targetQuantities: Object.keys(targetQuantities).length ? targetQuantities : undefined,
  });

  await assignSupplierProducts(admin, input);
  revalidatePath(`/admin/suppliers/${supplierId}`);
  redirect(`/admin/suppliers/${supplierId}`);
}

export async function generateSupplierRestockRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const supplierId = formData.get("supplierId") as string;
  if (!supplierId) throw new Error("Supplier ID is required");
  
  await generateSupplierRestockRequest(admin, supplierId);
  revalidatePath(`/admin/suppliers/${supplierId}`);
}
