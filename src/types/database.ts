import type { ModelDocument, ModelKey } from "@/models/registry";

export type DatabaseRecord<TDocument> =
  TDocument & Record<string, any>;

export type DatabaseQuery = {
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: Record<string, any> | Array<Record<string, any>>;
  take?: number;
  skip?: number;
};

export interface DatabaseDelegate<TDocument> {
  findMany(options?: DatabaseQuery): Promise<Array<DatabaseRecord<TDocument>>>;
  findFirst(options?: DatabaseQuery): Promise<DatabaseRecord<TDocument> | null>;
  findUnique(options?: DatabaseQuery): Promise<DatabaseRecord<TDocument> | null>;
  findFirstOrThrow(options?: DatabaseQuery): Promise<DatabaseRecord<TDocument>>;
  findUniqueOrThrow(options?: DatabaseQuery): Promise<DatabaseRecord<TDocument>>;
  create(options: {
    data: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<DatabaseRecord<TDocument>>;
  createMany(options: {
    data: Array<Record<string, any>>;
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
  update(options: {
    where: Record<string, any>;
    data: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<DatabaseRecord<TDocument>>;
  updateMany(options: {
    where: Record<string, any>;
    data: Record<string, any>;
  }): Promise<{ count: number }>;
  upsert(options: {
    where: Record<string, any>;
    update: Record<string, any>;
    create: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<DatabaseRecord<TDocument>>;
  deleteMany(options?: {
    where?: Record<string, any>;
  }): Promise<{ count: number }>;
  count(options?: { where?: Record<string, any> }): Promise<number>;
  aggregate(options: {
    where?: Record<string, any>;
    _sum?: Record<string, boolean>;
    _avg?: Record<string, boolean>;
    _count?: Record<string, boolean>;
  }): Promise<{
    _sum: Record<string, number | null>;
    _avg: Record<string, number | null>;
  }>;
}

type ModelDelegates = {
  [K in ModelKey]: DatabaseDelegate<ModelDocument<K>>;
};

export type DatabaseClient = ModelDelegates & {
  $connect(): Promise<void>;
  $transaction<T>(
    callback: (transaction: DatabaseClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};
