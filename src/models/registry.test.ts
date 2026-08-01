import test from "node:test";
import assert from "node:assert/strict";
import { ensureMongoModels, modelDefinitions } from "./registry";

test("ensureMongoModels updates validators for existing collections so enum defaults stay current", async () => {
  const collModCalls: Array<{ collMod: string; validator: unknown }> = [];
  const createdIndexesCalls: string[] = [];

  const database = {
    listCollections() {
      return {
        toArray: async () => Object.values(modelDefinitions).map((definition) => ({ name: definition.collection })),
      };
    },
    async command(payload: { collMod: string; validator: unknown }) {
      collModCalls.push(payload);
    },
    async createCollection() {
      return undefined;
    },
    collection(name: string) {
      return {
        async createIndexes(indexes: unknown[]) {
          createdIndexesCalls.push(name);
          assert.ok(Array.isArray(indexes));
        },
      };
    },
  } as any;

  await ensureMongoModels(database as any);

  assert.ok(collModCalls.some((call) => call.collMod === "sales"));
  const salesCollMod = collModCalls.find((call) => call.collMod === "sales");
  assert.ok(salesCollMod);
  const validator = salesCollMod!.validator as { $jsonSchema: { properties: Record<string, unknown> } };
  const status = validator.$jsonSchema.properties.status as { enum: string[] };
  assert.ok(Array.isArray(status.enum));
  assert.ok(status.enum.includes("PENDING"));
  assert.ok(createdIndexesCalls.includes("sales"));
});
