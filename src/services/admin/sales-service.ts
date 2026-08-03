import { connectToMongoDB } from "@/lib/mongodb";

export type AdminSale = {
  id: string;
  receiptNumber: string;
  occurredAt: Date | string;
  total: number | string;
  isOffline: boolean;
  syncedAt: Date | string | null;
  shop: {
    id: string;
    name: string;
  };
  payments: Array<{
    method: string;
  }>;
  _count: {
    items: number;
  };
  products?: Array<{
    name: string;
    quantity: number;
    sku?: string | null;
  }>;
};

type BusinessDocument = {
  id: string;
  currency: string;
};

type ShopDocument = {
  id: string;
  name: string;
};

type SaleDocument = {
  id: string;
  shopId: string;
  receiptNumber: string;
  occurredAt: Date | string;
  total: number | string;
  isOffline: boolean;
  syncedAt?: Date | string | null;
};

type SaleItemDocument = {
  saleId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
};

type PaymentDocument = {
  saleId: string;
  method: string;
};

type SaleQuery = {
  start?: Date;
  end?: Date;
  take?: number;
};

type SalesPageData = {
  business: BusinessDocument;
  sales: AdminSale[];
};

async function getSalesWithDetails(
  businessId: string,
  { start, end, take }: SaleQuery = {},
): Promise<SalesPageData> {
  const database = await connectToMongoDB();
  const [businessResult, shopsResult] = await Promise.all([
    database.collection("businesses").findOne(
      { id: businessId },
      { projection: { _id: 0 } },
    ),
    database.collection("shops").find(
      { businessId },
      { projection: { _id: 0 } },
    ).toArray(),
  ]);
  const business = businessResult as BusinessDocument | null;
  const shops = shopsResult as unknown as ShopDocument[];

  if (!business) throw new Error("business record was not found.");
  const shopIds = shops.map((shop) => shop.id).filter(Boolean);
  if (!shopIds.length) return { business, sales: [] };

  const saleFilter: {
    shopId: { $in: string[] };
    occurredAt?: { $gte?: Date; $lte?: Date };
  } = { shopId: { $in: shopIds } };
  if (start || end) {
    saleFilter.occurredAt = {
      ...(start ? { $gte: start } : {}),
      ...(end ? { $lte: end } : {}),
    };
  }

  const saleCursor = database
    .collection("sales")
    .find(saleFilter, { projection: { _id: 0 } })
    .sort({ occurredAt: -1 });
  if (take !== undefined) saleCursor.limit(take);
  const sales = (await saleCursor.toArray()) as unknown as SaleDocument[];
  if (!sales.length) return { business, sales: [] };

  const saleIds = sales.map((sale) => sale.id);
  const [paymentsResult, itemCounts, saleItemsResult] = await Promise.all([
    database.collection("payments").find(
      { saleId: { $in: saleIds } },
      { projection: { _id: 0 } },
    ).toArray(),
    database.collection("saleItems").aggregate<{ _id: string; count: number }>([
      { $match: { saleId: { $in: saleIds } } },
      { $group: { _id: "$saleId", count: { $sum: 1 } } },
    ]).toArray(),
    database.collection("saleItems").find(
      { saleId: { $in: saleIds } },
      { projection: { _id: 0, saleId: 1, productName: 1, sku: 1, quantity: 1 } },
    ).toArray(),
  ]);
  const payments = paymentsResult as unknown as PaymentDocument[];
  const saleItems = saleItemsResult as unknown as SaleItemDocument[];

  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const paymentsBySaleId = new Map<string, PaymentDocument[]>();
  for (const payment of payments) {
    const salePayments = paymentsBySaleId.get(payment.saleId) ?? [];
    salePayments.push(payment);
    paymentsBySaleId.set(payment.saleId, salePayments);
  }
  const itemCountBySaleId = new Map(itemCounts.map((itemCount) => [itemCount._id, itemCount.count]));
  const productsBySaleId = new Map<string, Array<{ name: string; quantity: number; sku?: string | null }>>();
  for (const item of saleItems) {
    const saleProducts = productsBySaleId.get(item.saleId) ?? [];
    saleProducts.push({
      name: item.productName,
      quantity: item.quantity,
      sku: item.sku,
    });
    productsBySaleId.set(item.saleId, saleProducts);
  }

  return {
    business,
    sales: sales.map((sale) => {
      const shop = shopsById.get(sale.shopId);
      if (!shop) throw new Error(`Sale ${sale.id} references a shop outside this business.`);
      return {
        ...sale,
        syncedAt: sale.syncedAt ?? null,
        shop,
        payments: paymentsBySaleId.get(sale.id) ?? [],
        _count: { items: itemCountBySaleId.get(sale.id) ?? 0 },
        products: productsBySaleId.get(sale.id) ?? [],
      };
    }),
  };
}

export async function getAdminSalesPageData(businessId: string) {
  return getSalesWithDetails(businessId, { take: 200 });
}

export async function getBusinessSalesInRange(businessId: string, start: Date, end: Date) {
  const { sales } = await getSalesWithDetails(businessId, { start, end });
  return sales;
}
