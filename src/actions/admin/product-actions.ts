"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { z } from "zod";
import {
  createProduct,
  updateProduct,
  createProductCategory,
  createProductBrand,
  createProductUnit,
  deleteProduct,
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
  redirect("/admin/products");
}

export async function updateProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateProductSchema.parse(Object.fromEntries(formData));
  await updateProduct(admin, input);
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function deleteProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ productId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await deleteProduct(admin, { id: input.productId });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function createProductCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductCategorySchema.parse(Object.fromEntries(formData));
  await createProductCategory(admin, input);
  revalidatePath("/admin/products/categories");
  revalidatePath("/admin/products/new");
  redirect("/admin/products/categories");
}

export async function createProductBrandAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductBrandSchema.parse(Object.fromEntries(formData));
  await createProductBrand(admin, input);
  revalidatePath("/admin/products/brands");
  revalidatePath("/admin/products/new");
  redirect("/admin/products/brands");
}

export async function createProductUnitAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductUnitSchema.parse(Object.fromEntries(formData));
  await createProductUnit(admin, input);
  revalidatePath("/admin/products/units");
  revalidatePath("/admin/products/new");
  redirect("/admin/products/units");
}

export async function updateProductCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductCategorySchema.extend({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  // lazy import the service update to avoid circulars
  const { updateProductCategory } = await import("@/services/admin/product-service");
  await updateProductCategory(admin, input as any);
  revalidatePath(`/admin/products/categories/${(input as any).id}`);
  revalidatePath("/admin/products/new");
  redirect("/admin/products/categories");
}

export async function updateProductBrandAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductBrandSchema.extend({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  const { updateProductBrand } = await import("@/services/admin/product-service");
  await updateProductBrand(admin, input as any);
  revalidatePath(`/admin/products/brands/${(input as any).id}`);
  revalidatePath("/admin/products/new");
  redirect("/admin/products/brands");
}

export async function updateProductUnitAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createProductUnitSchema.extend({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  const { updateProductUnit } = await import("@/services/admin/product-service");
  await updateProductUnit(admin, input as any);
  revalidatePath(`/admin/products/units/${(input as any).id}`);
  revalidatePath("/admin/products/new");
  redirect("/admin/products/units");
}

export async function toggleProductCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ id: z.string().min(1), isActive: z.string().optional() }).parse(Object.fromEntries(formData));
  const { toggleProductCategoryActive } = await import("@/services/admin/product-service");
  await toggleProductCategoryActive(admin, { id: input.id, isActive: (input.isActive === "true") });
  revalidatePath(`/admin/products/categories/${input.id}`);
  revalidatePath("/admin/products/categories");
  redirect("/admin/products/categories");
}

export async function deleteProductCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  const { deleteProductCategory } = await import("@/services/admin/product-service");
  await deleteProductCategory(admin, { id: input.id });
  revalidatePath("/admin/products/categories");
  redirect("/admin/products/categories");
}

export async function toggleProductBrandAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ id: z.string().min(1), isActive: z.string().optional() }).parse(Object.fromEntries(formData));
  const { toggleProductBrandActive } = await import("@/services/admin/product-service");
  await toggleProductBrandActive(admin, { id: input.id, isActive: (input.isActive === "true") });
  revalidatePath(`/admin/products/brands/${input.id}`);
  revalidatePath("/admin/products/brands");
  redirect("/admin/products/brands");
}

export async function deleteProductBrandAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  const { deleteProductBrand } = await import("@/services/admin/product-service");
  await deleteProductBrand(admin, { id: input.id });
  revalidatePath("/admin/products/brands");
  redirect("/admin/products/brands");
}

export async function deleteProductUnitAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  const { deleteProductUnit } = await import("@/services/admin/product-service");
  await deleteProductUnit(admin, { id: input.id });
  revalidatePath("/admin/products/units");
  redirect("/admin/products/units");
}
