import * as dotenv from "dotenv";
import mongoose from "mongoose";
import { ShopModel } from "../src/models/core.model";
import { connectToMongoDB, disconnectFromMongoDB } from "../src/lib/mongodb";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to run the migration.");
  }

  await connectToMongoDB();
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const shopCollection = db.collection(ShopModel.collection);

  const result = await shopCollection.updateMany(
    { isArchived: { $exists: false } },
    { $set: { isArchived: false } },
  );

  console.log(`Updated ${result.modifiedCount} shop document(s) to include isArchived: false.`);
}

main()
  .then(() => {
    console.log("Migration completed.");
    return disconnectFromMongoDB();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });