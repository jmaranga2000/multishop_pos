import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Seeding is blocked in production. Set ALLOW_PRODUCTION_SEED=true only for an intentional, reviewed operation.");
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.test").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "DemoAdmin123!";
  const shopPassword = process.env.SEED_SHOP_PASSWORD ?? "DemoShop123!";
  const cashierPin = process.env.SEED_CASHIER_PIN ?? "1234";
  const [adminHash, shopHash, pinHash] = await Promise.all([argon2.hash(adminPassword), argon2.hash(shopPassword), argon2.hash(cashierPin)]);

  const business = await prisma.business.upsert({
    where: { code: "DEMO-BUSINESS" },
    update: { name: "Demo Multi-Shop Retail", currency: "KES", timezone: "Africa/Nairobi" },
    create: { code: "DEMO-BUSINESS", name: "Demo Multi-Shop Retail", email: adminEmail, phone: "+254700000000", address: "Development seed data", currency: "KES", timezone: "Africa/Nairobi", receiptFooter: "Thank you for shopping with us.", offlineSessionHours: 24, syncIntervalMinutes: 5 },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { businessId: business.id, name: "Demo Administrator", role: "ADMIN", status: "ACTIVE", passwordHash: adminHash },
    create: { businessId: business.id, name: "Demo Administrator", email: adminEmail, passwordHash: adminHash, role: "ADMIN" },
  });

  await prisma.notificationPreference.upsert({ where: { businessId: business.id }, update: {}, create: { businessId: business.id } });

  const categoryDefinitions = [
    { name: "Groceries", slug: "groceries" },
    { name: "Beverages", slug: "beverages" },
    { name: "Household", slug: "household" },
  ];
  const categories = new Map<string, string>();
  for (const category of categoryDefinitions) {
    const saved = await prisma.category.upsert({ where: { businessId_slug: { businessId: business.id, slug: category.slug } }, update: { name: category.name }, create: { businessId: business.id, ...category } });
    categories.set(category.slug, saved.id);
  }

  const brandDefinitions = ["Demo Essentials", "Demo Fresh", "Demo Home"];
  const brands = new Map<string, string>();
  for (const name of brandDefinitions) {
    const saved = await prisma.brand.upsert({ where: { businessId_name: { businessId: business.id, name } }, update: {}, create: { businessId: business.id, name } });
    brands.set(name, saved.id);
  }

  const unitDefinitions = [{ name: "Piece", symbol: "pc" }, { name: "Kilogram", symbol: "kg" }, { name: "Litre", symbol: "L" }];
  const units = new Map<string, string>();
  for (const unit of unitDefinitions) {
    const saved = await prisma.unit.upsert({ where: { businessId_symbol: { businessId: business.id, symbol: unit.symbol } }, update: { name: unit.name }, create: { businessId: business.id, ...unit } });
    units.set(unit.symbol, saved.id);
  }

  const shopDefinitions = [
    { name: "Demo Nairobi Shop", code: "DEMO-NBI", email: "nairobi.shop@example.test", phone: "+254711000001", address: "Nairobi development location" },
    { name: "Demo Mombasa Shop", code: "DEMO-MSA", email: "mombasa.shop@example.test", phone: "+254711000002", address: "Mombasa development location" },
    { name: "Demo Kisumu Shop", code: "DEMO-KSM", email: "kisumu.shop@example.test", phone: "+254711000003", address: "Kisumu development location" },
  ];
  const shops = [];
  for (const definition of shopDefinitions) {
    const shop = await prisma.shop.upsert({ where: { code: definition.code }, update: { businessId: business.id, name: definition.name, email: definition.email, phone: definition.phone, address: definition.address, isActive: true }, create: { businessId: business.id, ...definition } });
    shops.push(shop);
    await prisma.user.upsert({ where: { email: definition.email }, update: { businessId: business.id, shopId: shop.id, name: `${definition.name} account`, passwordHash: shopHash, role: "SHOP", status: "ACTIVE", createdById: admin.id }, create: { businessId: business.id, shopId: shop.id, name: `${definition.name} account`, email: definition.email, passwordHash: shopHash, role: "SHOP", createdById: admin.id } });
    await prisma.register.upsert({ where: { shopId_code: { shopId: shop.id, code: "MAIN" } }, update: { name: "Main counter", isActive: true }, create: { shopId: shop.id, code: "MAIN", name: "Main counter" } });
    await prisma.salespersonProfile.upsert({ where: { shopId_code: { shopId: shop.id, code: "SP-001" } }, update: { name: "Demo Salesperson", pinHash, isActive: true }, create: { shopId: shop.id, code: "SP-001", name: "Demo Salesperson", pinHash } });
  }

  const productDefinitions = [
    { name: "Demo Maize Flour 2kg", sku: "DEMO-MF-2KG", barcode: "990000000001", category: "groceries", brand: "Demo Essentials", unit: "pc", cost: 150, price: 190 },
    { name: "Demo Cooking Oil 1L", sku: "DEMO-OIL-1L", barcode: "990000000002", category: "groceries", brand: "Demo Fresh", unit: "L", cost: 240, price: 285 },
    { name: "Demo Bottled Water 500ml", sku: "DEMO-WATER-500", barcode: "990000000003", category: "beverages", brand: "Demo Fresh", unit: "pc", cost: 25, price: 50 },
    { name: "Demo Laundry Soap", sku: "DEMO-SOAP-01", barcode: "990000000004", category: "household", brand: "Demo Home", unit: "pc", cost: 80, price: 110 },
    { name: "Demo Sugar 2kg", sku: "DEMO-SUGAR-2KG", barcode: "990000000005", category: "groceries", brand: "Demo Essentials", unit: "pc", cost: 260, price: 315 },
    { name: "Demo Fruit Juice 1L", sku: "DEMO-JUICE-1L", barcode: "990000000006", category: "beverages", brand: "Demo Fresh", unit: "L", cost: 140, price: 185 },
  ];
  const products = [];
  for (const definition of productDefinitions) {
    const product = await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: definition.sku } },
      update: { name: definition.name, barcode: definition.barcode, categoryId: categories.get(definition.category), brandId: brands.get(definition.brand), unitId: units.get(definition.unit), defaultCostPrice: definition.cost, defaultSellingPrice: definition.price, status: "ACTIVE" },
      create: { businessId: business.id, name: definition.name, sku: definition.sku, barcode: definition.barcode, categoryId: categories.get(definition.category), brandId: brands.get(definition.brand), unitId: units.get(definition.unit), defaultCostPrice: definition.cost, defaultSellingPrice: definition.price },
    });
    products.push({ product, definition });
  }

  for (const [shopIndex, shop] of shops.entries()) {
    for (const [productIndex, item] of products.entries()) {
      const quantity = Math.max(0, 34 - shopIndex * 6 - productIndex * 5);
      await prisma.shopInventory.upsert({
        where: { shopId_productId: { shopId: shop.id, productId: item.product.id } },
        update: { quantity, costPrice: item.definition.cost, sellingPrice: item.definition.price + shopIndex * 5, reorderLevel: 10, criticalLevel: 5, reorderQuantity: 30, isAvailable: true },
        create: { shopId: shop.id, productId: item.product.id, quantity, costPrice: item.definition.cost, sellingPrice: item.definition.price + shopIndex * 5, reorderLevel: 10, criticalLevel: 5, reorderQuantity: 30 },
      });
    }
  }

  for (const name of ["Transport", "Packaging", "Cleaning", "Repairs", "Utilities"]) {
    await prisma.expenseCategory.upsert({ where: { businessId_name: { businessId: business.id, name } }, update: {}, create: { businessId: business.id, name } });
  }

  await prisma.systemSetting.upsert({ where: { key: "demo.seed.version" }, update: { value: { version: 1, seededAt: new Date().toISOString() } }, create: { key: "demo.seed.version", value: { version: 1, seededAt: new Date().toISOString() } } });
  console.log(`Seed completed for ${business.name}. Administrator: ${admin.email}. Shop accounts: ${shopDefinitions.map((shop) => shop.email).join(", ")}. Passwords are sourced from SEED_* environment variables.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
