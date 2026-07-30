import * as dotenv from "dotenv";
import { hash } from "argon2";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "jmaranga35@gmail.com")
  .trim()
  .toLowerCase();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true only for an intentional seed.",
    );
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to seed the MongoDB database.");
  }
  if (!process.env.SEED_ADMIN_PASSWORD) {
    throw new Error("SEED_ADMIN_PASSWORD is required. The seed never invents an administrator password.");
  }

  const [{ db }, { disconnectFromMongoDB }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/mongodb"),
  ]);

  const shopPassword = process.env.SEED_SHOP_PASSWORD ?? "DemoShop123!";
  const cashierPin = process.env.SEED_CASHIER_PIN ?? "1234";
  const [adminHash, shopHash, pinHash] = await Promise.all([
    hash(process.env.SEED_ADMIN_PASSWORD),
    hash(shopPassword),
    hash(cashierPin),
  ]);

  try {
    const business = await db.business.upsert({
      where: { code: "DEMO-BUSINESS" },
      update: {
        name: "Demo Multi-Shop Retail",
        email: ADMIN_EMAIL,
        currency: "KES",
        timezone: "Africa/Nairobi",
      },
      create: {
        code: "DEMO-BUSINESS",
        name: "Demo Multi-Shop Retail",
        email: ADMIN_EMAIL,
        phone: "+254700000000",
        address: "Development seed data",
        currency: "KES",
        timezone: "Africa/Nairobi",
        receiptFooter: "Thank you for shopping with us.",
        offlineSessionHours: 24,
        syncIntervalMinutes: 5,
      },
    });

    const admin = await db.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        businessId: business.id,
        name: "Administrator",
        passwordHash: adminHash,
        role: "ADMIN",
        status: "ACTIVE",
        shopId: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        businessId: business.id,
        name: "Administrator",
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    await db.notificationPreference.upsert({
      where: { businessId: business.id },
      update: {},
      create: { businessId: business.id },
    });

    const categories = new Map<string, string>();
    for (const definition of [
      { name: "Groceries", slug: "groceries" },
      { name: "Beverages", slug: "beverages" },
      { name: "Household", slug: "household" },
    ]) {
      const category = await db.category.upsert({
        where: { businessId_slug: { businessId: business.id, slug: definition.slug } },
        update: { name: definition.name, isActive: true },
        create: { businessId: business.id, ...definition },
      });
      categories.set(definition.slug, category.id);
    }

    const brands = new Map<string, string>();
    for (const name of ["Demo Essentials", "Demo Fresh", "Demo Home"]) {
      const brand = await db.brand.upsert({
        where: { businessId_name: { businessId: business.id, name } },
        update: { isActive: true },
        create: { businessId: business.id, name },
      });
      brands.set(name, brand.id);
    }

    const units = new Map<string, string>();
    for (const definition of [
      { name: "Piece", symbol: "pc" },
      { name: "Kilogram", symbol: "kg" },
      { name: "Litre", symbol: "L" },
    ]) {
      const unit = await db.unit.upsert({
        where: { businessId_symbol: { businessId: business.id, symbol: definition.symbol } },
        update: { name: definition.name },
        create: { businessId: business.id, ...definition },
      });
      units.set(definition.symbol, unit.id);
    }

    const shops: Array<{ id: string; email: string }> = [];
    for (const definition of [
      {
        name: "Demo Nairobi Shop",
        code: "DEMO-NBO",
        email: "nairobi.shop@example.test",
        phone: "+254711000001",
        address: "Nairobi development location",
      },
      {
        name: "Demo Mombasa Shop",
        code: "DEMO-MSA",
        email: "mombasa.shop@example.test",
        phone: "+254711000002",
        address: "Mombasa development location",
      },
      {
        name: "Demo Kisumu Shop",
        code: "DEMO-KSM",
        email: "kisumu.shop@example.test",
        phone: "+254711000003",
        address: "Kisumu development location",
      },
    ]) {
      const shop = await db.shop.upsert({
        where: { code: definition.code },
        update: { businessId: business.id, ...definition, isActive: true },
        create: { businessId: business.id, ...definition },
      });
      shops.push({ id: shop.id, email: definition.email });

      await db.user.upsert({
        where: { email: definition.email },
        update: {
          businessId: business.id,
          shopId: shop.id,
          name: `${definition.name} account`,
          passwordHash: shopHash,
          role: "SHOP",
          status: "ACTIVE",
          createdById: admin.id,
        },
        create: {
          businessId: business.id,
          shopId: shop.id,
          name: `${definition.name} account`,
          email: definition.email,
          passwordHash: shopHash,
          role: "SHOP",
          createdById: admin.id,
        },
      });
      await db.register.upsert({
        where: { shopId_code: { shopId: shop.id, code: "MAIN" } },
        update: { name: "Main counter", isActive: true },
        create: { shopId: shop.id, code: "MAIN", name: "Main counter" },
      });
      await db.salespersonProfile.upsert({
        where: { shopId_code: { shopId: shop.id, code: "SP-001" } },
        update: { name: "Demo Salesperson", pinHash, isActive: true },
        create: {
          shopId: shop.id,
          code: "SP-001",
          name: "Demo Salesperson",
          pinHash,
        },
      });
    }

    const products: Array<{
      id: string;
      cost: number;
      price: number;
    }> = [];
    for (const definition of [
      { name: "Demo Maize Flour 2kg", sku: "DEMO-FLOUR-2KG", barcode: "990000000001", category: "groceries", brand: "Demo Essentials", unit: "pc", cost: 145, price: 180 },
      { name: "Demo Milk 500ml", sku: "DEMO-MILK-500", barcode: "990000000002", category: "beverages", brand: "Demo Fresh", unit: "pc", cost: 55, price: 70 },
      { name: "Demo Dish Soap 750ml", sku: "DEMO-SOAP-750", barcode: "990000000003", category: "household", brand: "Demo Home", unit: "pc", cost: 165, price: 220 },
      { name: "Demo Rice 1kg", sku: "DEMO-RICE-1KG", barcode: "990000000004", category: "groceries", brand: "Demo Essentials", unit: "kg", cost: 175, price: 225 },
      { name: "Demo Sugar 2kg", sku: "DEMO-SUGAR-2KG", barcode: "990000000005", category: "groceries", brand: "Demo Essentials", unit: "pc", cost: 260, price: 315 },
      { name: "Demo Fruit Juice 1L", sku: "DEMO-JUICE-1L", barcode: "990000000006", category: "beverages", brand: "Demo Fresh", unit: "L", cost: 140, price: 185 },
    ]) {
      const product = await db.product.upsert({
        where: { businessId_sku: { businessId: business.id, sku: definition.sku } },
        update: {
          name: definition.name,
          barcode: definition.barcode,
          categoryId: categories.get(definition.category),
          brandId: brands.get(definition.brand),
          unitId: units.get(definition.unit),
          defaultCostPrice: definition.cost,
          defaultSellingPrice: definition.price,
          status: "ACTIVE",
        },
        create: {
          businessId: business.id,
          name: definition.name,
          sku: definition.sku,
          barcode: definition.barcode,
          categoryId: categories.get(definition.category),
          brandId: brands.get(definition.brand),
          unitId: units.get(definition.unit),
          defaultCostPrice: definition.cost,
          defaultSellingPrice: definition.price,
        },
      });
      products.push({ id: product.id, cost: definition.cost, price: definition.price });
    }

    for (const [shopIndex, shop] of shops.entries()) {
      for (const [productIndex, product] of products.entries()) {
        const quantity = Math.max(0, 34 - shopIndex * 6 - productIndex * 5);
        await db.shopInventory.upsert({
          where: { shopId_productId: { shopId: shop.id, productId: product.id } },
          update: {
            quantity,
            costPrice: product.cost,
            sellingPrice: product.price + shopIndex * 5,
            reorderLevel: 10,
            criticalLevel: 5,
            reorderQuantity: 30,
            isAvailable: true,
          },
          create: {
            shopId: shop.id,
            productId: product.id,
            quantity,
            costPrice: product.cost,
            sellingPrice: product.price + shopIndex * 5,
            reorderLevel: 10,
            criticalLevel: 5,
            reorderQuantity: 30,
          },
        });
      }
    }

    for (const name of ["Transport", "Packaging", "Cleaning", "Repairs", "Utilities"]) {
      await db.expenseCategory.upsert({
        where: { businessId_name: { businessId: business.id, name } },
        update: { isActive: true },
        create: { businessId: business.id, name },
      });
    }

    await db.systemSetting.upsert({
      where: { key: "demo.seed.version" },
      update: { value: { version: 2, seededAt: new Date().toISOString(), database: "mongodb" } },
      create: {
        key: "demo.seed.version",
        value: { version: 2, seededAt: new Date().toISOString(), database: "mongodb" },
      },
    });

    console.log(`MongoDB seed completed. Administrator: ${ADMIN_EMAIL}`);
  } finally {
    await disconnectFromMongoDB();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
