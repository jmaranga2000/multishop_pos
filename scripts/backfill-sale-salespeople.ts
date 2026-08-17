import * as dotenv from "dotenv";
import mongoose from "mongoose";
import { connectToMongoDB, disconnectFromMongoDB } from "../src/lib/mongodb";

dotenv.config({ path: ".env.local" });
dotenv.config();

type SaleWithoutCashier = {
  id: string;
  shopId: string;
  registerSessionId?: string | null;
};

type RegisterSessionCashier = {
  id: string;
  shopId: string;
  salespersonId?: string | null;
};

const applyChanges = process.argv.includes("--apply");
const batchSize = 500;

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to backfill sale cashiers.");
  }

  await connectToMongoDB();
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB connection is not available.");
  }

  const sales = await database.collection<SaleWithoutCashier>("sales").find(
    {
      $or: [
        { salespersonId: null },
        { salespersonId: { $exists: false } },
      ],
      registerSessionId: { $type: "string" },
    },
    { projection: { id: 1, shopId: 1, registerSessionId: 1 } },
  ).toArray();

  const registerSessionIds = [...new Set(
    sales.flatMap((sale) => sale.registerSessionId ? [sale.registerSessionId] : []),
  )];

  const sessions = registerSessionIds.length > 0
    ? await database.collection<RegisterSessionCashier>("registerSessions").find(
      {
        id: { $in: registerSessionIds },
        salespersonId: { $type: "string" },
      },
      { projection: { id: 1, shopId: 1, salespersonId: 1 } },
    ).toArray()
    : [];

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const repairs = sales.flatMap((sale) => {
    const session = sale.registerSessionId ? sessionsById.get(sale.registerSessionId) : undefined;
    if (!session?.salespersonId || session.shopId !== sale.shopId) return [];
    return [{ saleId: sale.id, salespersonId: session.salespersonId }];
  });

  console.log(`Found ${sales.length} sale(s) without a cashier.`);
  console.log(`${repairs.length} sale(s) have a same-shop register-session cashier and can be repaired.`);
  console.log(`${sales.length - repairs.length} sale(s) were skipped because there is no safely matching cashier.`);

  if (!applyChanges) {
    console.log("Dry run complete. Re-run with --apply to update only the eligible sales.");
    return;
  }

  let modifiedCount = 0;
  for (let start = 0; start < repairs.length; start += batchSize) {
    const batch = repairs.slice(start, start + batchSize);
    const result = await database.collection<SaleWithoutCashier>("sales").bulkWrite(
      batch.map((repair) => ({
        updateOne: {
          filter: {
            id: repair.saleId,
            $or: [
              { salespersonId: null },
              { salespersonId: { $exists: false } },
            ],
          },
          update: { $set: { salespersonId: repair.salespersonId, updatedAt: new Date() } },
        },
      })),
      { ordered: false },
    );
    modifiedCount += result.modifiedCount;
  }

  console.log(`Repaired ${modifiedCount} sale(s).`);
}

main()
  .then(() => disconnectFromMongoDB())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
