import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { catalogModels } from "./catalog.model";
import { coreModels } from "./core.model";
import { expenseModels } from "./expense.model";
import { etimsModels } from "./etims.model";
import { inventoryModels } from "./inventory.model";
import type {
  BaseDocument,
  DefaultValue,
  MongoModelDefinition,
} from "./model.types";
import { mpesaModels } from "./mpesa.model";
import { notificationModels } from "./notification.model";
import { offlineModels } from "./offline.model";
import { reportingModels } from "./reporting.model";
import { procurementModels } from "./procurement.model";
import { stocktakeModels } from "./stocktake.model";
import { salesModels } from "./sales.model";
import { systemModels } from "./system.model";
import { customerModels } from "./customer.model";
import { supplierModels } from "./supplier.model";

export const modelDefinitions = {
  ...coreModels,
  ...catalogModels,
  ...inventoryModels,
  ...salesModels,
  ...customerModels,
  ...expenseModels,
  ...mpesaModels,
  ...notificationModels,
  ...supplierModels,
  ...procurementModels,
  ...stocktakeModels,
  ...offlineModels,
  ...reportingModels,
  ...etimsModels,
  ...systemModels,
};

export type ModelKey = keyof typeof modelDefinitions;
export type ModelDocument<K extends ModelKey> =
  typeof modelDefinitions[K] extends MongoModelDefinition<infer TDocument>
    ? TDocument
    : BaseDocument;

export function getModelDefinition(modelKey: string): MongoModelDefinition {
  const definition = modelDefinitions[modelKey as ModelKey] as MongoModelDefinition | undefined;
  if (!definition) throw new Error(`Unknown MongoDB model: ${modelKey}`);
  return definition;
}

function cloneDefault(value: DefaultValue) {
  if (typeof value === "function") return value();
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
}

export function prepareInsert(
  modelKey: string,
  data: Record<string, unknown>,
) {
  const definition = modelDefinitions[modelKey as ModelKey] as MongoModelDefinition | undefined;
  if (!definition) throw new Error(`Unknown MongoDB model: ${modelKey}`);
  const result: Record<string, unknown> = { id: randomUUID() };
  for (const [key, value] of Object.entries(definition.defaults ?? {})) {
    result[key] = cloneDefault(value);
  }
  Object.assign(result, data);

  const timestampMode = definition.timestamps ?? "both";
  const timestamp = new Date();
  if (timestampMode === "both" || timestampMode === "created") {
    result.createdAt ??= timestamp;
  }
  if (timestampMode === "both" || timestampMode === "updated") {
    result.updatedAt ??= timestamp;
  }

  validateModelData(modelKey, result, false);
  return result;
}

export function prepareUpdate(
  modelKey: string,
  data: Record<string, unknown>,
) {
  const definition = modelDefinitions[modelKey as ModelKey] as MongoModelDefinition | undefined;
  if (!definition) throw new Error(`Unknown MongoDB model: ${modelKey}`);
  validateModelData(modelKey, data, true);
  const timestampMode = definition.timestamps ?? "both";
  return timestampMode === "both" || timestampMode === "updated"
    ? { ...data, updatedAt: new Date() }
    : data;
}

function validateModelData(
  modelKey: string,
  data: Record<string, unknown>,
  partial: boolean,
) {
  const definition = modelDefinitions[modelKey as ModelKey] as MongoModelDefinition | undefined;
  if (!definition) throw new Error(`Unknown MongoDB model: ${modelKey}`);
  if (!partial) {
    for (const field of ["id", ...(definition.required ?? [])]) {
      if (data[field] === undefined || data[field] === null || data[field] === "") {
        throw new Error(`${modelKey}.${field} is required.`);
      }
    }
  }
  for (const [field, values] of Object.entries(definition.enums ?? {})) {
    if (data[field] !== undefined && !values?.includes(String(data[field]))) {
      throw new Error(`${modelKey}.${field} must be one of: ${values?.join(", ")}.`);
    }
  }
}

export async function ensureMongoModels(database: mongoose.mongo.Db) {
  const existing = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name),
  );

  await Promise.all(
    Object.values(modelDefinitions).map(async (definition) => {
      const validator = {
        $jsonSchema: {
          bsonType: "object",
          required: ["id", ...(definition.required ?? [])],
          properties: {
            id: { bsonType: "string" },
            ...Object.fromEntries(
              Object.entries(definition.enums ?? {}).map(([field, values]) => [
                field,
                { enum: [...(values ?? [])] },
              ]),
            ),
          },
        },
      };

      if (!existing.has(definition.collection)) {
        try {
          await database.createCollection(definition.collection, { validator });
        } catch (error: unknown) {
          if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 48) throw error;
        }
      } else {
        await database.command({ collMod: definition.collection, validator });
      }

      await database.collection(definition.collection).createIndexes([
        { key: { id: 1 }, unique: true, name: "unique_application_id" },
        ...(definition.indexes ?? []),
      ]);
    }),
  );
}
