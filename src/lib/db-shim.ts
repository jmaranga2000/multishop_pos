// Lightweight compatibility shim exposing a subset of the Prisma API backed by Supabase
// This is intentionally small — migrate services incrementally to use `supabaseClient` directly.

import { supabaseServiceRoleClient } from "./supabase";

if (!supabaseServiceRoleClient) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when using the db-shim on the server.");
}

const svc = supabaseServiceRoleClient;

export const db = {
  // Example: db.user.findUnique({ where: { email } })
  user: {
    async findUnique({ where }: { where: Record<string, any> }) {
      const key = Object.keys(where)[0];
      const value = where[key];
      const { data, error } = await svc.from("\"User\"").select("*").eq(key, value).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    async update({ where, data }: { where: Record<string, any>; data: Record<string, any> }) {
      const key = Object.keys(where)[0];
      const value = where[key];
      const { data: updated, error } = await svc.from("\"User\"").update(data).eq(key, value).select().maybeSingle();
      if (error) throw error;
      return updated;
    },
    async create({ data }: { data: Record<string, any> }) {
      const { data: created, error } = await svc.from("\"User\"").insert(data).select().maybeSingle();
      if (error) throw error;
      return created;
    },
  },

  // Generic query helpers for other tables
  async table(tableName: string) {
    return {
      findMany: async (opts: { where?: Record<string, any>; orderBy?: any; limit?: number } = {}) => {
        let q = svc.from(tableName).select("*");
        if (opts.where) {
          for (const [k, v] of Object.entries(opts.where)) q = q.eq(k, v as any);
        }
        if (opts.limit) q = q.limit(opts.limit);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      },
      findFirst: async (opts: { where?: Record<string, any> } = {}) => {
        const rows = await (await svc.from(tableName).select("*").limit(1)).data;
        return rows?.[0] ?? null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const { data: created, error } = await svc.from(tableName).insert(data).select().maybeSingle();
        if (error) throw error;
        return created;
      },
      update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const key = Object.keys(where)[0];
        const value = where[key];
        const { data: updated, error } = await svc.from(tableName).update(data).eq(key, value).select().maybeSingle();
        if (error) throw error;
        return updated;
      },
    };
  },
};

export default db;
