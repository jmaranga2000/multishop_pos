import { connectToMongoDB } from "@/lib/mongodb";

export type EtimsHistoryRow = {
  id: string;
  saleId: string;
  receiptNumber: string;
  shopName: string;
  status: string;
  taxpayerPin: string | null;
  officialInvoiceNumber: string | null;
  fiscalDocumentNumber: string | null;
  controlCode: string | null;
  taxableAmount: number;
  vatAmount: number;
  grossAmount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date | string | null;
  confirmedAt: Date | string | null;
};

type TransactionRecord = Omit<EtimsHistoryRow, "receiptNumber" | "shopName"> & { shopId: string };
type ShopRecord = { id: string; name: string };
type SaleRecord = { id: string; receiptNumber: string };

function asAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export async function getAdminEtimsReportingData(businessId: string) {
  const database = await connectToMongoDB();
  const [business, shops, transactions] = await Promise.all([
    database.collection("businesses").findOne({ id: businessId }, { projection: { _id: 0, currency: 1 } }),
    database.collection("shops").find({ businessId }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    database.collection("etimsTransactions").find(
      { businessId },
      { projection: { _id: 0 } },
    ).sort({ createdAt: -1 }).limit(250).toArray(),
  ]);

  const transactionRows = transactions as unknown as TransactionRecord[];
  const sales = transactionRows.length
    ? await database.collection("sales").find(
      { id: { $in: transactionRows.map((transaction) => transaction.saleId) } },
      { projection: { _id: 0, id: 1, receiptNumber: 1 } },
    ).toArray() as unknown as SaleRecord[]
    : [];
  const shopsById = new Map((shops as unknown as ShopRecord[]).map((shop) => [shop.id, shop]));
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const rows = transactionRows.map((transaction) => ({
    ...transaction,
    receiptNumber: salesById.get(transaction.saleId)?.receiptNumber ?? transaction.saleId,
    shopName: shopsById.get(transaction.shopId)?.name ?? "Unknown shop",
    taxpayerPin: transaction.taxpayerPin ?? null,
    officialInvoiceNumber: transaction.officialInvoiceNumber ?? null,
    fiscalDocumentNumber: transaction.fiscalDocumentNumber ?? null,
    controlCode: transaction.controlCode ?? null,
    taxableAmount: asAmount(transaction.taxableAmount),
    vatAmount: asAmount(transaction.vatAmount),
    grossAmount: asAmount(transaction.grossAmount),
    errorCode: transaction.errorCode ?? null,
    errorMessage: transaction.errorMessage ?? null,
    createdAt: transaction.createdAt ?? null,
    confirmedAt: transaction.confirmedAt ?? null,
  }));
  const fiscalized = rows.filter((row) => row.status === "ETIMS_SUCCESS");

  return {
    currency: String((business as { currency?: string } | null)?.currency ?? "KES"),
    rows,
    summary: {
      fiscalizedCount: fiscalized.length,
      pendingCount: rows.filter((row) => ["ETIMS_PENDING", "ETIMS_SUBMITTING", "ETIMS_RETRY_REQUIRED"].includes(row.status)).length,
      failedCount: rows.filter((row) => ["ETIMS_FAILED", "ETIMS_REJECTED", "ETIMS_CANCELLED"].includes(row.status)).length,
      taxableAmount: fiscalized.reduce((total, row) => total + row.taxableAmount, 0),
      vatAmount: fiscalized.reduce((total, row) => total + row.vatAmount, 0),
      grossAmount: fiscalized.reduce((total, row) => total + row.grossAmount, 0),
    },
  };
}