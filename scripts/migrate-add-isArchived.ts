import * as dotenv from "dotenv";
import mongoose from "mongoose";
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
  if (!db) {
    throw new Error("MongoDB connection is not available.");
  }

  const shopCollection = db.collection("shops");

  const result = await shopCollection.updateMany(
    { isArchived: { $exists: false } },
    { $set: { isArchived: false } },
  );

  console.log(`Updated ${result.modifiedCount} shop document(s) to include isArchived: false.`);
}

main()
  .then(() => disconnectFromMongoDB())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });