const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('NO_URI');
  process.exit(1);
}

const supplierId = '72981888-75c1-4749-b545-e0ee319197f6';

async function main() {
  const dbName = new URL(uri).pathname.slice(1);
  await mongoose.connect(uri, { dbName, connectTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const supplier = await db.collection('suppliers').findOne({ id: supplierId });
  if (!supplier) {
    console.error('Supplier not found');
    process.exit(1);
  }
  const supplierProducts = await db.collection('supplierProducts').find({ supplierId }).toArray();
  const productIds = supplierProducts.map((p) => p.productId);
  const shopInventory = await db.collection('shopInventories').find({ shopId: supplier.shopId, productId: { $in: productIds } }).toArray();
  const products = await db.collection('products').find({ id: { $in: productIds } }).project({ id: 1, name: 1, sku: 1 }).toArray();
  const prodMap = new Map(products.map((p) => [p.id, p]));

  const rows = supplierProducts.map((sp) => {
    const inventory = shopInventory.find((i) => i.productId === sp.productId);
    const product = prodMap.get(sp.productId) || { name: 'UNKNOWN', sku: 'UNKNOWN' };
    return {
      productId: sp.productId,
      productName: product.name,
      sku: product.sku,
      targetQuantity: sp.targetQuantity,
      currentQuantity: inventory?.quantity ?? null,
      reorderLevel: inventory?.reorderLevel ?? null,
      criticalLevel: inventory?.criticalLevel ?? null,
      needsRestock: inventory ? sp.targetQuantity > inventory.quantity : true,
    };
  });

  console.log('supplier', {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    shopId: supplier.shopId,
    status: supplier.status,
  });
  console.log('products', rows.length);
  console.log(JSON.stringify(rows.sort((a,b) => (a.currentQuantity === null ? 1 : a.currentQuantity) - (b.currentQuantity === null ? 1 : b.currentQuantity)).slice(0, 50), null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
