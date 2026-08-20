import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

export type CreateQuotationInput = {
  shopId: string;
  counterId?: string | null;
  cashierId?: string | null;
  cashierName: string;
  counterName: string;
  customerId?: string | null;
  customerName: string;
  quotationNumber: string;
  issuedAt: Date;
  validUntil: Date;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
  notes?: string | null;
  items: Array<Record<string, unknown>>;
};

export async function createShopQuotation(user: { id: string; businessId: string }, input: CreateQuotationInput) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: user.businessId, isActive: true } });
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);
  if (input.validUntil <= input.issuedAt) throw new AppError("Quotation validity must be after the issue date.", "INVALID_QUOTATION_DATES", 400);

  return db.quotation.create({
    data: {
      businessId: user.businessId,
      shopId: input.shopId,
      counterId: input.counterId ?? null,
      cashierId: input.cashierId ?? user.id,
      cashierName: input.cashierName,
      counterName: input.counterName,
      customerId: input.customerId ?? null,
      customerName: input.customerName || "Walk-in customer",
      quotationNumber: input.quotationNumber,
      status: "ISSUED",
      issuedAt: input.issuedAt,
      validUntil: input.validUntil,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      vatTotal: input.vatTotal,
      grandTotal: input.grandTotal,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({
        ...item,
        productName: String(item.productName ?? item.name ?? "Unknown product"),
      })),
      shareToken: randomUUID(),
    },
  });
}

export async function searchShopQuotations(user: { businessId: string; shopId: string }, quotationNumber: string) {
  return db.quotation.findFirst({ where: { businessId: user.businessId, shopId: user.shopId, quotationNumber: { contains: quotationNumber.trim() } }, orderBy: { issuedAt: "desc" } });
}

export async function getQuotationForPdf(input: { id?: string; token?: string; businessId?: string; shopId?: string }) {
  const quotation = await db.quotation.findFirst({ where: input.token ? { shareToken: input.token } : { id: input.id, businessId: input.businessId, ...(input.shopId ? { shopId: input.shopId } : {}) } });
  if (!quotation) throw new AppError("Quotation was not found.", "QUOTATION_NOT_FOUND", 404);
  return quotation;
}

export async function markQuotationConverted(user: { businessId: string; shopId: string }, quotationId: string, saleId: string) {
  const quotation = await db.quotation.findFirst({ where: { id: quotationId, businessId: user.businessId, shopId: user.shopId } });
  if (!quotation) throw new AppError("Quotation was not found.", "QUOTATION_NOT_FOUND", 404);
  if (quotation.status !== "ISSUED") throw new AppError("Only issued quotations can be converted.", "QUOTATION_ALREADY_CONVERTED", 409);
  if (new Date(quotation.validUntil).getTime() <= Date.now()) throw new AppError("This quotation has expired.", "QUOTATION_EXPIRED", 409);
  return db.quotation.update({ where: { id: quotation.id }, data: { status: "CONVERTED", convertedSaleId: saleId } });
}