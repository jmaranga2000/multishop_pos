import type { mongo } from "mongoose";
import type { BaseDocument, MongoModelDefinition } from "./model.types";

export const now = () => new Date();

export const index = (
  key: Record<string, 1 | -1>,
  options: Omit<mongo.IndexDescription, "key"> = {},
): mongo.IndexDescription => ({ key, ...options });

export function defineModel<TDocument extends BaseDocument>(
  definition: MongoModelDefinition<TDocument>,
) {
  return definition;
}
