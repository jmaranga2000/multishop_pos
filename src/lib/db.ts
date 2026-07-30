import mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import type { DatabaseClient } from "@/types/database";
import { connectToMongoDB } from "./mongodb";
import {
  getModelDefinition,
  prepareInsert,
  prepareUpdate,
} from "@/models/registry";
import {
  modelRelations,
  type RelationDefinition,
} from "@/models/relations";

type PlainRecord = Record<string, any>;
type QueryOptions = {
  where?: PlainRecord;
  include?: PlainRecord;
  select?: PlainRecord;
  orderBy?: PlainRecord | PlainRecord[];
  take?: number;
  skip?: number;
};

function isPlainObject(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function clean(value: any): any {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(clean);
  if (value instanceof Date) return value;
  if (!isPlainObject(value)) return value;

  const source = typeof value.toObject === "function"
    ? value.toObject({ virtuals: false })
    : value;
  const output: PlainRecord = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === "_id" || key === "__v" || entry === undefined) continue;
    output[key] = clean(entry);
  }
  return output;
}

function operatorFilter(value: PlainRecord) {
  const output: PlainRecord = {};
  for (const [operator, operand] of Object.entries(value)) {
    switch (operator) {
      case "equals":
        return operand;
      case "in":
        output.$in = operand;
        break;
      case "notIn":
        output.$nin = operand;
        break;
      case "gt":
        output.$gt = operand;
        break;
      case "gte":
        output.$gte = operand;
        break;
      case "lt":
        output.$lt = operand;
        break;
      case "lte":
        output.$lte = operand;
        break;
      case "not":
        if (isPlainObject(operand)) output.$not = operatorFilter(operand);
        else output.$ne = operand;
        break;
      case "contains":
        output.$regex = String(operand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        output.$options = "i";
        break;
      case "startsWith":
        output.$regex = `^${String(operand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
        output.$options = "i";
        break;
      case "endsWith":
        output.$regex = `${String(operand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
        output.$options = "i";
        break;
      default:
        output[operator.startsWith("$") ? operator : `$${operator}`] = operand;
    }
  }
  return output;
}

async function compileWhere(
  modelKey: string,
  where: PlainRecord = {},
  session?: ClientSession,
): Promise<PlainRecord> {
  const output: PlainRecord = {};
  const relations = modelRelations[modelKey] ?? {};

  for (const [key, rawValue] of Object.entries(where)) {
    if (rawValue === undefined) continue;

    if ((key === "AND" || key === "OR") && Array.isArray(rawValue)) {
      output[key === "AND" ? "$and" : "$or"] = await Promise.all(
        rawValue.map((entry) => compileWhere(modelKey, entry, session)),
      );
      continue;
    }
    if (key === "NOT") {
      output.$nor = [await compileWhere(modelKey, rawValue as PlainRecord, session)];
      continue;
    }

    const relation = relations[key];
    if (relation && isPlainObject(rawValue)) {
      const targetFilter = await compileWhere(relation.target, rawValue, session);
      const database = await connectToMongoDB();
      const matches = await database
        .collection(getModelDefinition(relation.target).collection)
        .find(targetFilter, {
          projection: { [relation.foreignField]: 1 },
          ...(session ? { session } : {}),
        })
        .toArray();
      const values = matches.map((match: any) => match[relation.foreignField]);
      output[relation.localField] = { $in: values };
      continue;
    }

    if (
      key.includes("_")
      && isPlainObject(rawValue)
      && !Object.keys(rawValue).some((entry) => entry.startsWith("$"))
    ) {
      for (const [compoundKey, compoundValue] of Object.entries(rawValue)) {
        output[compoundKey] = compoundValue;
      }
      continue;
    }

    output[key] = isPlainObject(rawValue) ? operatorFilter(rawValue) : rawValue;
  }
  return output;
}

function requestedRelationOptions(value: unknown): PlainRecord {
  return value === true ? {} : isPlainObject(value) ? value : {};
}

async function attachRelations(
  modelKey: string,
  rows: PlainRecord[],
  include: PlainRecord | undefined,
  session?: ClientSession,
) {
  if (!include || rows.length === 0) return rows;
  const relations = modelRelations[modelKey] ?? {};

  for (const [relationName, includeValue] of Object.entries(include)) {
    if (relationName === "_count" || !includeValue) continue;
    const relation = relations[relationName];
    if (!relation) continue;
    const relationOptions = requestedRelationOptions(includeValue);
    const values = [...new Set(rows.map((row) => row[relation.localField]).filter(Boolean))];
    if (values.length === 0) {
      for (const row of rows) row[relationName] = relation.many ? [] : null;
      continue;
    }

    const related = await createDelegate(relation.target, session).findMany({
      where: { [relation.foreignField]: { in: values } },
      include: relationOptions.include,
      orderBy: relationOptions.orderBy,
    });
    for (const row of rows) {
      const matches = related.filter(
        (entry: PlainRecord) => entry[relation.foreignField] === row[relation.localField],
      );
      const selectedMatches = relationOptions.select
        ? matches.map((entry: PlainRecord) => project(entry, relationOptions.select))
        : matches;
      row[relationName] = relation.many ? selectedMatches : selectedMatches[0] ?? null;
    }
  }

  const countRequest = include._count;
  if (isPlainObject(countRequest) && isPlainObject(countRequest.select)) {
    for (const row of rows) {
      row._count = {};
      for (const [relationName, enabled] of Object.entries(countRequest.select)) {
        if (!enabled) continue;
        const relation = relations[relationName];
        if (!relation) continue;
        const filter = await compileWhere(
          relation.target,
          { [relation.foreignField]: row[relation.localField] },
          session,
        );
        const database = await connectToMongoDB();
        row._count[relationName] = await database
          .collection(getModelDefinition(relation.target).collection)
          .countDocuments(filter, session ? { session } : undefined);
      }
    }
  }
  return rows;
}

function relationIncludesFromSelect(modelKey: string, select?: PlainRecord) {
  if (!select) return undefined;
  const relations = modelRelations[modelKey] ?? {};
  const include: PlainRecord = {};
  for (const [key, value] of Object.entries(select)) {
    if (relations[key] && value) include[key] = value;
  }
  return Object.keys(include).length ? include : undefined;
}

function project(row: PlainRecord, select?: PlainRecord) {
  if (!select) return row;
  const result: PlainRecord = {};
  for (const [key, requested] of Object.entries(select)) {
    if (!requested) continue;
    if (requested === true) result[key] = row[key];
    else if (isPlainObject(requested) && row[key] !== undefined) {
      const nestedSelect = requested.select;
      result[key] = Array.isArray(row[key])
        ? row[key].map((entry: PlainRecord) => project(entry, nestedSelect))
        : row[key] === null ? null : project(row[key], nestedSelect);
    }
  }
  return result;
}

function getOrderValue(
  row: PlainRecord,
  order: PlainRecord,
): { value: any; direction: "asc" | "desc" } {
  const [key, direction] = Object.entries(order)[0] ?? [];
  if (!key) return { value: undefined, direction: "asc" };
  if (isPlainObject(direction)) {
    return {
      value: getOrderValue(row[key] ?? {}, direction).value,
      direction: getOrderValue(row[key] ?? {}, direction).direction,
    };
  }
  return { value: row[key], direction: direction === "desc" ? "desc" : "asc" };
}

function sortRows(rows: PlainRecord[], orderBy?: PlainRecord | PlainRecord[]) {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  if (!orders.length) return rows;
  return rows.sort((left, right) => {
    for (const order of orders) {
      const leftOrder = getOrderValue(left, order);
      const rightOrder = getOrderValue(right, order);
      if (leftOrder.value === rightOrder.value) continue;
      const comparison = leftOrder.value == null
        ? -1
        : rightOrder.value == null
          ? 1
          : leftOrder.value > rightOrder.value ? 1 : -1;
      return leftOrder.direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
}

function relationOrderIncludes(modelKey: string, orderBy?: PlainRecord | PlainRecord[]) {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  const relations = modelRelations[modelKey] ?? {};
  const include: PlainRecord = {};
  for (const order of orders) {
    for (const [key] of Object.entries(order)) {
      if (relations[key]) include[key] = true;
    }
  }
  return include;
}

function buildUpdate(data: PlainRecord) {
  const $set: PlainRecord = {};
  const $inc: PlainRecord = {};
  const $unset: PlainRecord = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && "increment" in value) $inc[key] = value.increment;
    else if (isPlainObject(value) && "decrement" in value) $inc[key] = -Number(value.decrement);
    else if (isPlainObject(value) && "set" in value) $set[key] = value.set;
    else if (isPlainObject(value) && "unset" in value) $unset[key] = 1;
    else $set[key] = value;
  }

  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($inc).length ? { $inc } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
}

function nestedCreates(
  modelKey: string,
  data: PlainRecord,
): Array<{ relation: RelationDefinition; payload: PlainRecord[] }> {
  const relations = modelRelations[modelKey] ?? {};
  const result: Array<{ relation: RelationDefinition; payload: PlainRecord[] }> = [];
  for (const [key, value] of Object.entries(data)) {
    const relation = relations[key];
    if (!relation || !isPlainObject(value)) continue;
    const raw = value.create ?? value.createMany?.data;
    if (!raw) continue;
    result.push({ relation, payload: (Array.isArray(raw) ? raw : [raw]).map(clean) });
  }
  return result;
}

function scalarCreateData(modelKey: string, data: PlainRecord) {
  const relations = modelRelations[modelKey] ?? {};
  const result: PlainRecord = {};
  for (const [key, value] of Object.entries(data)) {
    const relation = relations[key];
    if (!relation) {
      if (value !== undefined) result[key] = clean(value);
      continue;
    }
    if (isPlainObject(value) && value.connect && relation.localField !== "id") {
      result[relation.localField] = value.connect[relation.foreignField];
    }
  }
  return result;
}

function createDelegate(modelKey: string, session?: ClientSession) {
  const definition = getModelDefinition(modelKey);

  async function collection() {
    const database = await connectToMongoDB();
    return database.collection(definition.collection);
  }

  const delegate = {
    async findMany(options: QueryOptions = {}) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const source = await collection();
      const documents = await source
        .find(filter, session ? { session } : undefined)
        .toArray();
      let rows = documents.map(clean);

      const selectIncludes = relationIncludesFromSelect(modelKey, options.select);
      const orderIncludes = relationOrderIncludes(modelKey, options.orderBy);
      const include = { ...orderIncludes, ...selectIncludes, ...(options.include ?? {}) };
      rows = await attachRelations(modelKey, rows, include, session);
      rows = sortRows(rows, options.orderBy);
      if (options.skip) rows = rows.slice(options.skip);
      if (options.take !== undefined) rows = rows.slice(0, options.take);
      return options.select
        ? rows.map((row: PlainRecord) => project(row, options.select))
        : rows;
    },

    async findFirst(options: QueryOptions = {}) {
      return (await delegate.findMany({ ...options, take: 1 }))[0] ?? null;
    },

    async findUnique(options: QueryOptions = {}) {
      return delegate.findFirst(options);
    },

    async findFirstOrThrow(options: QueryOptions = {}) {
      const row = await delegate.findFirst(options);
      if (!row) throw new Error(`${modelKey} record was not found.`);
      return row;
    },

    async findUniqueOrThrow(options: QueryOptions = {}) {
      return delegate.findFirstOrThrow(options);
    },

    async create(options: { data: PlainRecord; include?: PlainRecord; select?: PlainRecord }) {
      await connectToMongoDB();
      const data = prepareInsert(modelKey, scalarCreateData(modelKey, options.data));
      const source = await collection();
      await source.insertOne(data, session ? { session } : undefined);
      const parent = clean(data);

      for (const nested of nestedCreates(modelKey, options.data)) {
        if (nested.relation.localField !== "id") continue;
        const childDelegate = createDelegate(nested.relation.target, session);
        for (const child of nested.payload) {
          await childDelegate.create({
            data: { ...child, [nested.relation.foreignField]: parent.id },
          });
        }
      }

      if (options.include || options.select) {
        return delegate.findFirstOrThrow({
          where: { id: parent.id },
          include: options.include,
          select: options.select,
        });
      }
      return parent;
    },

    async createMany(options: { data: PlainRecord[]; skipDuplicates?: boolean }) {
      await connectToMongoDB();
      const documents = options.data.map((entry) =>
        prepareInsert(modelKey, scalarCreateData(modelKey, entry))
      );
      if (!documents.length) return { count: 0 };
      try {
        const source = await collection();
        const inserted = await source.insertMany(documents, {
          ordered: !options.skipDuplicates,
          ...(session ? { session } : {}),
        });
        return { count: inserted.insertedCount };
      } catch (error: any) {
        if (options.skipDuplicates && error?.result?.insertedCount !== undefined) {
          return { count: error.result.insertedCount };
        }
        throw error;
      }
    },

    async update(options: {
      where: PlainRecord;
      data: PlainRecord;
      include?: PlainRecord;
      select?: PlainRecord;
    }) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const source = await collection();
      const document = await source.findOneAndUpdate(
        filter,
        buildUpdate(prepareUpdate(modelKey, options.data)),
        {
        returnDocument: "after",
        ...(session ? { session } : {}),
        },
      );
      if (!document) throw new Error(`${modelKey} record was not found for update.`);
      const row = clean(document);
      if (options.include || options.select) {
        return delegate.findFirstOrThrow({
          where: { id: row.id },
          include: options.include,
          select: options.select,
        });
      }
      return row;
    },

    async updateMany(options: { where: PlainRecord; data: PlainRecord }) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const source = await collection();
      const result = await source.updateMany(filter, buildUpdate(prepareUpdate(modelKey, options.data)), {
        ...(session ? { session } : {}),
      });
      return { count: result.modifiedCount };
    },

    async upsert(options: {
      where: PlainRecord;
      update: PlainRecord;
      create: PlainRecord;
      include?: PlainRecord;
      select?: PlainRecord;
    }) {
      const existing = await delegate.findFirst({ where: options.where });
      if (existing) {
        return delegate.update({
          where: { id: existing.id },
          data: options.update,
          include: options.include,
          select: options.select,
        });
      }
      return delegate.create({
        data: options.create,
        include: options.include,
        select: options.select,
      });
    },

    async deleteMany(options: { where?: PlainRecord } = {}) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const source = await collection();
      const result = await source.deleteMany(filter, session ? { session } : undefined);
      return { count: result.deletedCount };
    },

    async count(options: { where?: PlainRecord } = {}) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const source = await collection();
      return source.countDocuments(filter, session ? { session } : undefined);
    },

    async aggregate(options: {
      where?: PlainRecord;
      _sum?: PlainRecord;
      _avg?: PlainRecord;
      _count?: PlainRecord;
    }) {
      await connectToMongoDB();
      const filter = await compileWhere(modelKey, options.where, session);
      const group: PlainRecord = { _id: null };
      for (const key of Object.keys(options._sum ?? {})) group[`sum_${key}`] = { $sum: `$${key}` };
      for (const key of Object.keys(options._avg ?? {})) group[`avg_${key}`] = { $avg: `$${key}` };
      const source = await collection();
      const [result = {}] = await source
        .aggregate([{ $match: filter }, { $group: group }], session ? { session } : undefined)
        .toArray();
      return {
        _sum: Object.fromEntries(
          Object.keys(options._sum ?? {}).map((key) => [key, result[`sum_${key}`] ?? null]),
        ),
        _avg: Object.fromEntries(
          Object.keys(options._avg ?? {}).map((key) => [key, result[`avg_${key}`] ?? null]),
        ),
      };
    },
  };

  return delegate;
}

function createDatabase(session?: ClientSession) {
  return new Proxy(
    {
      async $transaction<T>(
        callback: (transaction: any) => Promise<T>,
        _options?: { maxWait?: number; timeout?: number },
      ) {
        await connectToMongoDB();
        const mongoSession = await mongoose.startSession();
        try {
          let result!: T;
          await mongoSession.withTransaction(async () => {
            result = await callback(createDatabase(mongoSession));
          });
          return result;
        } finally {
          await mongoSession.endSession();
        }
      },
      async $connect() {
        await connectToMongoDB();
      },
    } as PlainRecord,
    {
      get(target, property) {
        if (typeof property !== "string") return Reflect.get(target, property);
        if (property in target) return target[property];
        return createDelegate(property, session);
      },
    },
  );
}

export const db = createDatabase() as DatabaseClient;
