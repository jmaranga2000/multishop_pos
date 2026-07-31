"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import {
  createProduct,
  updateProduct,
  createProductCategory,
  createProductBrand,
  createProductUnit,
} from "@/services/admin/product-service";
import {
  createProductSchema,
  updateProductSchema,
  createProductCategorySchema,
  createProductBrandSchema,
  createProductUnitSchema,
} from "@/validators/admin/product-validator";

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

export async function createProductCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductCategorySchema.parse(Object.fromEntries(formData));
  await createProductCategory(admin, input);
  revalidatePath("/admin/products/categories");
  revalidatePath("/admin/products/new");
}

export async function createProductBrandAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductBrandSchema.parse(Object.fromEntries(formData));
  await createProductBrand(admin, input);
  revalidatePath("/admin/products/brands");
  revalidatePath("/admin/products/new");
}

export async function createProductUnitAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductUnitSchema.parse(Object.fromEntries(formData));
  await createProductUnit(admin, input);
  revalidatePath("/admin/products/units");
  revalidatePath("/admin/products/new");
}
