import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to initialize MongoDB.");
  }
  const { initializeMongoModels, disconnectFromMongoDB } = await import("../src/lib/mongodb");
  try {
    await initializeMongoModels();
    console.log("MongoDB collections, validation rules, and indexes are ready.");
  } finally {
    await disconnectFromMongoDB();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
