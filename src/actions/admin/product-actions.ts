"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createProduct } from "@/services/admin/product-service";
import { createProductSchema } from "@/validators/admin/product-validator";

export async function createProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductSchema.parse(Object.fromEntries(formData));
  await createProduct(admin, input);
  revalidatePath("/admin/products");
}
