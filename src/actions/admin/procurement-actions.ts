"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import {
  approvePurchaseOrder,
  approvePurchaseRequisition,
  createPurchaseOrder,
  createPurchaseRequisition,
  generateRequisitionsForActiveAlerts,
  receiveGoods,
  recordSupplierPayment,
  rejectPurchaseRequisition,
  sendPurchaseOrderToSupplier,
  submitPurchaseOrderForApproval,
} from "@/services/procurement/procurement-service";
import {
  createPurchaseOrderSchema,
  createRequisitionSchema,
  purchaseOrderIdSchema,
  receiveGoodsSchema,
  requisitionDecisionSchema,
  supplierPaymentSchema,
} from "@/validators/procurement/procurement-validator";

function jsonField(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw) throw new Error(`${field} is required.`);
  return JSON.parse(raw) as unknown;
}

function refresh() {
  revalidatePath("/admin/procurement");
  revalidatePath("/admin/stocktakes");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  revalidatePath("/shop/procurement");
  revalidatePath("/shop/stocktake");
}

export async function createAdminRequisitionAction(formData: FormData) {
  const admin = await requireAdmin();
  const shopId = String(formData.get("shopId") ?? "");
  const input = createRequisitionSchema.parse({ ...Object.fromEntries(formData), items: jsonField(formData, "itemsJson") });
  await createPurchaseRequisition({ ...admin, shopId }, input);
  refresh();
}

export async function approveRequisitionAction(formData: FormData) {
  const admin = await requireAdmin();
  await approvePurchaseRequisition(admin, requisitionDecisionSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function rejectRequisitionAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectPurchaseRequisition(admin, requisitionDecisionSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function createPurchaseOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createPurchaseOrderSchema.parse({
    ...Object.fromEntries(formData),
    requisitionId: formData.get("requisitionId") || undefined,
    expectedDeliveryDate: formData.get("expectedDeliveryDate") || undefined,
    items: jsonField(formData, "itemsJson"),
  });
  await createPurchaseOrder(admin, input);
  refresh();
}

export async function submitPurchaseOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  await submitPurchaseOrderForApproval(admin, purchaseOrderIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function approvePurchaseOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  await approvePurchaseOrder(admin, purchaseOrderIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function sendPurchaseOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  await sendPurchaseOrderToSupplier(admin, purchaseOrderIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function receiveGoodsAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = receiveGoodsSchema.parse({ ...Object.fromEntries(formData), items: jsonField(formData, "itemsJson") });
  await receiveGoods(admin, input);
  refresh();
}

export async function recordSupplierPaymentAction(formData: FormData) {
  const admin = await requireAdmin();
  await recordSupplierPayment(admin, supplierPaymentSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function generateRequisitionsAction() {
  const admin = await requireAdmin();
  await generateRequisitionsForActiveAlerts(admin);
  refresh();
}