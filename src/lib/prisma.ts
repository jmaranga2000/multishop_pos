import { db } from "./db-shim";

// Legacy Prisma compatibility shim for incremental migration.
// Most services only need a `prisma` object with `findMany`, `findFirst`, `create`, `update`, `count`, and `$transaction`.

export const prisma: any = new Proxy(db, {
  get(target, prop) {
    if (prop === "$transaction") {
      return async (callback: (tx: any) => Promise<any>) => {
        return callback(target);
      };
    }
    if (prop === "$connect" || prop === "$disconnect") {
      return async () => undefined;
    }
    if (prop === "$executeRaw" || prop === "$queryRaw") {
      return async () => {
        throw new Error(`Raw query execution is not supported by the Prisma shim: ${String(prop)}`);
      };
    }
    if (typeof prop === "string" && prop in target) {
      return (target as any)[prop];
    }
    return target.table(prop as string);
  },
});
