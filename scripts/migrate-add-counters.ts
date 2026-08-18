import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  const { initializeMongoModels, disconnectFromMongoDB } = await import("../src/lib/mongodb");
  const { db } = await import("../src/lib/db");

  try {
    await initializeMongoModels();
    console.log("✓ MongoDB models initialized");

    // Get all shops
    const shops = await db.shop.findMany({ select: { id: true, name: true } });
    console.log(`Found ${shops.length} shops to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const shop of shops) {
      // Check if shop already has counters
      const existingCounters = await db.counter.count({ where: { shopId: shop.id } });

      if (existingCounters > 0) {
        console.log(`✓ Shop "${shop.name}" already has ${existingCounters} counter(s) - skipping`);
        skippedCount++;
        continue;
      }

      // Create default Counter 1 for this shop
      try {
        const counter = await db.counter.create({
          data: {
            shopId: shop.id,
            name: "Counter 1",
            code: "C01",
            status: "ACTIVE",
            description: "Default counter created during migration",
          },
        });

        console.log(`✓ Created Counter 1 for shop "${shop.name}" (${counter.id})`);

        // Link all existing registerSessions (if any) without counterId to this counter
        const updateResult = await db.registerSession.updateMany({
          where: { shopId: shop.id, counterId: null },
          data: { counterId: counter.id },
        });

        if (updateResult.count > 0) {
          console.log(`  ✓ Linked ${updateResult.count} existing register session(s) to Counter 1`);
        }

        // Link all existing sales (if any) without counterId to this counter
        const salesUpdateResult = await db.sale.updateMany({
          where: { shopId: shop.id, counterId: null },
          data: { counterId: counter.id },
        });

        if (salesUpdateResult.count > 0) {
          console.log(`  ✓ Linked ${salesUpdateResult.count} existing sale(s) to Counter 1`);
        }

        // Link all existing M-Pesa payments (if any) without counterId to this counter
        const mpesaUpdateResult = await db.mpesaPayment.updateMany({
          where: { shopId: shop.id, counterId: null },
          data: { counterId: counter.id },
        });

        if (mpesaUpdateResult.count > 0) {
          console.log(`  ✓ Linked ${mpesaUpdateResult.count} existing M-Pesa payment(s) to Counter 1`);
        }

        createdCount++;
      } catch (error) {
        console.error(`✗ Failed to create Counter 1 for shop "${shop.name}":`, error instanceof Error ? error.message : error);
      }
    }

    console.log("\n=== Migration Summary ===");
    console.log(`Created: ${createdCount} new counter(s)`);
    console.log(`Skipped: ${skippedCount} shop(s) (already have counters)`);
    console.log("✓ Migration complete");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await disconnectFromMongoDB();
  }
}

main();
