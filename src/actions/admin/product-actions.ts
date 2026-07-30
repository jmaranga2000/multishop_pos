"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createProduct, updateProduct } from "@/services/admin/product-service";
import { createProductSchema, updateProductSchema } from "@/validators/admin/product-validator";

export async function createProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductSchema.parse(Object.fromEntries(formData));
  await createProduct(admin, input);
  revalidatePath("/admin/products");
}

export async function updateProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateProductSchema.parse(Object.fromEntries(formData));
  await updateProduct(admin, input);
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
}
