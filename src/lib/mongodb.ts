import mongoose from "mongoose";
import { ensureMongoModels } from "@/models/registry";

type MongoCache = {
  promise: Promise<mongoose.mongo.Db> | null;
};

declare global {
  var mongoCache: MongoCache | undefined;
}

const cache = global.mongoCache ?? {
  promise: null,
};
global.mongoCache = cache;

function databaseNameFromUri(uri: string) {
  const pathname = new URL(uri).pathname.replace(/^\//, "");
  return pathname || "multishop_pos";
}

export async function connectToMongoDB() {
  if (cache.promise) return await cache.promise;
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  cache.promise = (async () => {
    await mongoose.connect(process.env.MONGODB_URI!, {
      maxPoolSize: 20,
      minPoolSize: 1,
      retryReads: true,
      retryWrites: true,
      serverSelectionTimeoutMS: 10_000,
      dbName: databaseNameFromUri(process.env.MONGODB_URI!),
    });

    const database = mongoose.connection.db;
    if (!database) {
      throw new Error("Mongoose failed to initialize the MongoDB database connection.");
    }

    await ensureMongoModels(database);
    return database;
  })();

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

export async function disconnectFromMongoDB() {
  if (!mongoose.connection.readyState) return;
  await mongoose.disconnect();
  cache.promise = null;
}
