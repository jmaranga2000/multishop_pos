import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { fromMinorUnits, toMinorUnits } from "@/lib/utils";
import { writeAuditLog } from "@/services/shared/audit-service";
import { calculateVatTotals } from "@/services/tax/tax-service";
import { getEtimsProvider, hasConfiguredEtimsProvider, type NormalizedEtimsInvoice } from "./etims-provider";

const TAX_SETTINGS_DEFAULT = {
  vatEnabled: true,
  standardVatRate: 16,
  priceTaxMode: "VAT_EXCLUSIVE" as const,
  allowShopEtimsCheckout: false,
};

type CheckoutUser = {
  id: string;
  businessId: string;
  shopId: string;
  role: "ADMIN" | "SHOP";
  shop: { id: string; name: string; code: string; isActive: boolean };
};

type EtimsCheckoutInput = {
  checkoutRequestId: string;
  registerSessionId: string;
  customerId?: string | null;
  customerName?: string | null;
  discountMinor: number;
  note?: string | null;
  payments: Array<{ method: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "CREDIT"; amountMinor: number; reference?: string | null }>;
  items: Array<{ productId: string; unitId?: string | null; quantity: number }>;
};

function receiptNumber(shopCode: string, id: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${shopCode}-${date}-ET-${id.replaceAll("-", "").slice(-8).toUpperCase()}`;
}

function requestReference(shopId: string, checkoutRequestId: string) {
  return `etims:${shopId}:${checkoutRequestId}`;
}

function toEtimsStatus(status: "SUCCESS" | "FAILED" | "RETRY_REQUIRED" | "REJECTED") {
  if (status === "SUCCESS") return "ETIMS_SUCCESS" as const;
  if (status === "RETRY_REQUIRED") return "ETIMS_RETRY_REQUIRED" as const;
  if (status === "REJECTED") return "ETIMS_REJECTED" as const;
  return "ETIMS_FAILED" as const;
}

function sanitizeResponseData(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  const sensitive = /token|secret|password|authorization|credential|key/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)));
}

export async function getTaxSettings(businessId: string) {
  return db.taxSettings.upsert({
    where: { businessId },
    create: { businessId, ...TAX_SETTINGS_DEFAULT },
    update: {},
  });
}

export async function getEtimsCheckoutAvailability(input: Pick<CheckoutUser, "businessId" | "shopId" | "role">) {
  const [taxSettings, configuration] = await Promise.all([
    getTaxSettings(input.businessId),
    db.etimsConfiguration.findFirst({ where: { businessId: input.businessId, shopId: input.shopId } }),
  ]);
  const permitted = input.role === "ADMIN" || Boolean(taxSettings.allowShopEtimsCheckout);
  const errors: string[] = [];
  if (!permitted) errors.push("Your account is not authorized to use eTIMS checkout.");
  if (!taxSettings.vatEnabled) errors.push("VAT is disabled in the business tax settings.");
  if (!configuration?.enabled) errors.push("eTIMS is not enabled for this shop.");
  if (!configuration?.taxpayerPin || !configuration?.branchCode || !configuration?.deviceId || !configuration?.credentialReference) {
    errors.push("This shop is missing required eTIMS identification or credential-reference configuration.");
  }
  if (!hasConfiguredEtimsProvider()) errors.push("No certified KRA eTIMS OSCU/VSCU provider adapter is installed on this server.");

  return {
    permitted,
    available: errors.length === 0,
    reason: errors[0] ?? null,
    configurationRequired: errors,
    vatEnabled: Boolean(taxSettings.vatEnabled),
    standardVatRate: Number(taxSettings.standardVatRate),
    priceTaxMode: taxSettings.priceTaxMode,
  };
}

async function validateMpesaPayments(shopId: string, payments: EtimsCheckoutInput["payments"]) {
  for (const payment of payments.filter((entry) => entry.method === "MPESA")) {
    if (!payment.reference) throw new AppError("A confirmed M-Pesa reference is required for eTIMS checkout.", "MPESA_REFERENCE_REQUIRED", 400);
    const mpesa = await db.mpesaPayment.findFirst({
      where: {
        shopId,
        status: { in: ["SUCCESSFUL", "MATCHED"] },
        OR: [
          { id: payment.reference },
          { internalReference: payment.reference },
          { transactionId: payment.reference },
          { receiptNumber: payment.reference },
        ],
      },
    });
    if (!mpesa || Number(mpesa.receivedAmountMinor) < payment.amountMinor) {
      throw new AppError("The selected M-Pesa payment has not been confirmed for the required amount.", "MPESA_NOT_CONFIRMED", 409);
    }
  }
}

export async function submitEtimsCheckout(user: CheckoutUser, input: EtimsCheckoutInput) {
  const availability = await getEtimsCheckoutAvailability(user);
  if (!availability.permitted) throw new AppError(availability.reason ?? "eTIMS checkout is not authorized.", "ETIMS_FORBIDDEN", 403);
  if (!availability.available) throw new AppError(availability.reason ?? "eTIMS checkout is not ready for this shop.", "ETIMS_NOT_READY", 409);
  if (input.customerId || input.payments.some((payment) => payment.method === "CREDIT")) {
    throw new AppError("eTIMS customer-credit checkout must be enabled through the certified provider workflow before use.", "ETIMS_CREDIT_NOT_CONFIGURED", 409);
  }

  const ref = requestReference(user.shopId, input.checkoutRequestId);
  const existingTransaction = await db.etimsTransaction.findFirst({ where: { requestReference: ref } });
  if (existingTransaction) {
    const sale = await db.sale.findUniqueOrThrow({ where: { id: existingTransaction.saleId } });
    return { sale, transaction: existingTransaction, duplicate: true };
  }

  const [settings, configuration, session] = await Promise.all([
    getTaxSettings(user.businessId),
    db.etimsConfiguration.findFirstOrThrow({ where: { businessId: user.businessId, shopId: user.shopId, enabled: true } }),
    db.registerSession.findFirstOrThrow({ where: { id: input.registerSessionId, shopId: user.shopId, status: "OPEN" } }),
  ]);
  if (!session.salespersonId) throw new AppError("The open register session does not have an active cashier.", "SALESPERSON_CONTEXT_REQUIRED", 409);
  await validateMpesaPayments(user.shopId, input.payments);

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const [products, inventoryRows] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds }, businessId: user.businessId, status: "ACTIVE" }, include: { pricingUnits: true } }),
    db.shopInventory.findMany({ where: { shopId: user.shopId, productId: { in: productIds }, isAvailable: true } }),
  ]);
  if (products.length !== productIds.length || inventoryRows.length !== productIds.length) {
    throw new AppError("One or more cart products are unavailable in this shop.", "ETIMS_PRODUCT_UNAVAILABLE", 409);
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const inventoryByProduct = new Map(inventoryRows.map((inventory) => [inventory.productId, inventory]));
  const requestedQuantities = new Map<string, number>();
  const serverLines = input.items.map((item) => {
    const product = productsById.get(item.productId)!;
    const inventory = inventoryByProduct.get(item.productId)!;
    if (!product.etimsItemCode?.trim()) {
      throw new AppError(`${product.name} is not configured for eTIMS checkout. Please contact an administrator.`, "ETIMS_PRODUCT_NOT_CONFIGURED", 409);
    }
    const pricing = (product.pricingUnits ?? []).find((entry: { unitId: string }) => entry.unitId === item.unitId);
    const isDefaultUnit = !item.unitId || item.unitId === product.unitId;
    const unitPrice = pricing?.sellingPrice ?? (isDefaultUnit ? product.defaultSellingPrice : undefined);
    if (unitPrice === undefined) throw new AppError(`${product.name} does not have a valid pricing unit.`, "ETIMS_UNIT_INVALID", 409);
    const multiplier = Number(pricing?.multiplier ?? 1);
    const effectiveQuantity = item.quantity * multiplier;
    const aggregateQuantity = (requestedQuantities.get(item.productId) ?? 0) + effectiveQuantity;
    requestedQuantities.set(item.productId, aggregateQuantity);
    if (aggregateQuantity > Number(inventory.quantity) - Number(inventory.reservedQuantity ?? 0)) {
      throw new AppError(`${product.name} no longer has enough available stock.`, "ETIMS_INSUFFICIENT_STOCK", 409);
    }
    const treatment = product.taxTreatment ?? "STANDARD";
    const vatRate = treatment === "STANDARD"
      ? Number(product.taxRate) > 0 ? Number(product.taxRate) : Number(settings.standardVatRate)
      : 0;
    return {
      product,
      inventory,
      unitId: item.unitId ?? null,
      quantity: item.quantity,
      effectiveQuantity,
      unitPriceMinor: toMinorUnits(unitPrice.toString()),
      unitCostMinor: toMinorUnits((pricing?.costPrice ?? product.defaultCostPrice).toString()),
      taxTreatment: treatment,
      vatRate,
    };
  });

  const totals = calculateVatTotals(serverLines.map((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    taxTreatment: line.taxTreatment,
    vatRate: line.vatRate,
  })), settings.priceTaxMode);
  if (input.discountMinor > totals.grossMinor) throw new AppError("Discount cannot exceed the sale total.", "ETIMS_INVALID_DISCOUNT", 400);
  if (input.discountMinor > 0) throw new AppError("Discounted eTIMS checkout requires the certified provider discount mapping.", "ETIMS_DISCOUNT_NOT_CONFIGURED", 409);
  const paidMinor = input.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  if (paidMinor < totals.grossMinor) throw new AppError("Payment total is lower than the fiscal sale total.", "ETIMS_PAYMENT_INSUFFICIENT", 400);

  const saleId = randomUUID();
  const now = new Date();
  const saleReceipt = receiptNumber(user.shop.code, saleId);
  const invoice: NormalizedEtimsInvoice = {
    requestReference: ref,
    taxpayerPin: configuration.taxpayerPin!,
    branchCode: configuration.branchCode,
    deviceId: configuration.deviceId,
    currency: "KES",
    netMinor: totals.netMinor,
    vatMinor: totals.vatMinor,
    grossMinor: totals.grossMinor,
    lines: totals.lines.map((line) => ({
      itemCode: serverLines.find((serverLine) => serverLine.product.id === line.productId)?.product.etimsItemCode!,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      netMinor: line.netMinor,
      vatMinor: line.vatMinor,
      grossMinor: line.grossMinor,
      taxTreatment: line.taxTreatment,
      vatRate: line.vatRate,
    })),
  };

  const created = await db.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        id: saleId,
        shopId: user.shopId,
        registerSessionId: session.id,
        salespersonId: session.salespersonId,
        receiptNumber: saleReceipt,
        clientReference: ref,
        status: "PENDING",
        subtotal: fromMinorUnits(totals.netMinor),
        discountTotal: 0,
        taxTotal: fromMinorUnits(totals.vatMinor),
        total: fromMinorUnits(totals.grossMinor),
        amountPaid: fromMinorUnits(paidMinor),
        changeDue: fromMinorUnits(Math.max(0, paidMinor - totals.grossMinor)),
        customerName: input.customerName ?? "Walk-in customer",
        note: input.note ?? null,
        isOffline: false,
        occurredAt: now,
        checkoutMode: "ETIMS",
        taxableAmount: fromMinorUnits(totals.taxableMinor),
        vatAmount: fromMinorUnits(totals.vatMinor),
        vatRate: Number(settings.standardVatRate),
        taxTreatment: totals.taxTreatment,
        etimsStatus: "ETIMS_SUBMITTING",
        items: {
          create: totals.lines.map((line) => {
            const serverLine = serverLines.find((entry) => entry.product.id === line.productId)!;
            return {
              productId: serverLine.product.id,
              productName: serverLine.product.name,
              sku: serverLine.product.sku,
              unitId: serverLine.unitId,
              quantity: serverLine.quantity,
              unitCost: fromMinorUnits(serverLine.unitCostMinor),
              unitPrice: fromMinorUnits(serverLine.unitPriceMinor),
              taxTotal: fromMinorUnits(line.vatMinor),
              vatRate: line.vatRate,
              taxTreatment: line.taxTreatment,
              lineTotal: fromMinorUnits(line.grossMinor),
            };
          }),
        },
      },
    });
    const transaction = await tx.etimsTransaction.create({
      data: {
        saleId: sale.id,
        businessId: user.businessId,
        shopId: user.shopId,
        cashierId: session.salespersonId,
        registerId: session.registerId,
        status: "ETIMS_SUBMITTING",
        requestReference: ref,
        taxableAmount: fromMinorUnits(totals.taxableMinor),
        vatAmount: fromMinorUnits(totals.vatMinor),
        grossAmount: fromMinorUnits(totals.grossMinor),
        vatRate: Number(settings.standardVatRate),
        submittedAt: now,
      },
    });
    await tx.sale.update({ where: { id: sale.id }, data: { etimsTransactionId: transaction.id } });
    for (const line of serverLines) {
      await tx.shopInventory.update({ where: { id: line.inventory.id }, data: { reservedQuantity: { increment: line.effectiveQuantity } } });
    }
    await writeAuditLog(tx, {
      userId: user.id,
      shopId: user.shopId,
      action: "ETIMS_SALE_SUBMITTED",
      entityType: "ETIMS_TRANSACTION",
      entityId: transaction.id,
      description: `Submitted eTIMS sale ${sale.receiptNumber}.`,
      metadata: { requestReference: ref, grossMinor: totals.grossMinor },
    });
    return { sale, transaction };
  });

  const provider = getEtimsProvider(configuration.integrationMode);
  let providerResult;
  try {
    await provider.validateSale(invoice);
    providerResult = await provider.submitInvoice(invoice);
  } catch (error) {
    providerResult = {
      status: "FAILED" as const,
      errorCode: "ETIMS_PROVIDER_ERROR",
      errorMessage: error instanceof Error ? error.message : "eTIMS provider validation failed.",
    };
  }

  const fiscalStatus = toEtimsStatus(providerResult.status);
  if (fiscalStatus !== "ETIMS_SUCCESS") {
    await db.$transaction(async (tx) => {
      await tx.etimsTransaction.update({
        where: { id: created.transaction.id },
        data: {
          status: fiscalStatus,
          responseData: sanitizeResponseData(providerResult.responseData),
          errorCode: providerResult.errorCode ?? null,
          errorMessage: providerResult.errorMessage ?? "eTIMS submission failed.",
        },
      });
      await tx.sale.update({ where: { id: created.sale.id }, data: { etimsStatus: fiscalStatus } });
      for (const line of serverLines) {
        await tx.shopInventory.update({ where: { id: line.inventory.id }, data: { reservedQuantity: { increment: -line.effectiveQuantity } } });
      }
      await writeAuditLog(tx, {
        userId: user.id,
        shopId: user.shopId,
        action: "ETIMS_SALE_FAILED",
        entityType: "ETIMS_TRANSACTION",
        entityId: created.transaction.id,
        description: `eTIMS submission failed for ${created.sale.receiptNumber}.`,
        metadata: { requestReference: ref, errorCode: providerResult.errorCode ?? null },
      });
    });
    const transaction = await db.etimsTransaction.findUniqueOrThrow({ where: { id: created.transaction.id } });
    const sale = await db.sale.findUniqueOrThrow({ where: { id: created.sale.id } });
    return { sale, transaction, duplicate: false };
  }

  const finalized = await db.$transaction(async (tx) => {
    const transaction = await tx.etimsTransaction.update({
      where: { id: created.transaction.id, status: "ETIMS_SUBMITTING" },
      data: {
        status: "ETIMS_SUCCESS",
        officialInvoiceNumber: providerResult.officialInvoiceNumber ?? null,
        fiscalDocumentNumber: providerResult.fiscalDocumentNumber ?? null,
        controlCode: providerResult.controlCode ?? null,
        qrCodeData: providerResult.qrCodeData ?? null,
        responseData: sanitizeResponseData(providerResult.responseData),
        confirmedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    const sale = await tx.sale.update({
      where: { id: created.sale.id },
      data: { status: "COMPLETED", etimsStatus: "ETIMS_SUCCESS", etimsTransactionId: transaction.id },
    });
    for (const payment of input.payments.filter((entry) => entry.method === "MPESA")) {
      const mpesa = await tx.mpesaPayment.findFirst({
        where: {
          shopId: user.shopId,
          status: { in: ["SUCCESSFUL", "MATCHED"] },
          OR: [
            { id: payment.reference },
            { internalReference: payment.reference },
            { transactionId: payment.reference },
            { receiptNumber: payment.reference },
          ],
        },
      });
      if (!mpesa || Number(mpesa.receivedAmountMinor) < payment.amountMinor) {
        throw new AppError("The confirmed M-Pesa payment is no longer available for this sale.", "MPESA_NOT_CONFIRMED", 409);
      }
      await tx.mpesaPayment.update({ where: { id: mpesa.id }, data: { saleId: sale.id, updatedAt: new Date() } });
    }
    await tx.payment.createMany({
      data: input.payments.map((payment) => ({
        saleId: sale.id,
        method: payment.method === "CREDIT" ? "CASH" : payment.method,
        status: payment.method === "CASH" || payment.method === "MPESA" ? "VERIFIED" : "PENDING",
        amount: fromMinorUnits(payment.amountMinor),
        reference: payment.reference ?? null,
      })),
    });
    for (const line of serverLines) {
      const current = await tx.shopInventory.findUniqueOrThrow({ where: { id: line.inventory.id } });
      if (Number(current.quantity) < line.effectiveQuantity) throw new AppError("Stock changed before the eTIMS sale could be finalized.", "ETIMS_STOCK_CHANGED", 409);
      await tx.shopInventory.update({
        where: { id: current.id },
        data: { quantity: Number(current.quantity) - line.effectiveQuantity, reservedQuantity: Math.max(0, Number(current.reservedQuantity ?? 0) - line.effectiveQuantity), lastSoldAt: new Date(), version: { increment: 1 } },
      });
      await tx.stockMovement.create({
        data: { shopId: user.shopId, productId: line.product.id, type: "SALE", quantityChange: -line.effectiveQuantity, quantityBefore: Number(current.quantity), quantityAfter: Number(current.quantity) - line.effectiveQuantity, referenceType: "SALE", referenceId: sale.id },
      });
    }
    await writeAuditLog(tx, {
      userId: user.id,
      shopId: user.shopId,
      action: "ETIMS_SALE_SUCCESS",
      entityType: "ETIMS_TRANSACTION",
      entityId: transaction.id,
      description: `eTIMS sale ${sale.receiptNumber} fiscalized successfully.`,
      metadata: { requestReference: ref },
    });
    return { sale, transaction };
  });
  return { ...finalized, duplicate: false };
}