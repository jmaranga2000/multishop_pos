import { z } from "zod";

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.preprocess((v) => {
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  }, z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()).optional()),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  counters: z.preprocess((value) => {
    if (typeof value === "string") {
      const names = value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
      return names.length ? names : ["Main counter"];
    }
    if (Array.isArray(value)) {
      const names = value.map((entry) => String(entry).trim()).filter(Boolean);
      return names.length ? names : ["Main counter"];
    }
    return ["Main counter"];
  }, z.array(z.string().trim().min(2).max(80)).default(["Main counter"])),
});

export const resetShopPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const toggleShopSchema = z.object({ shopId: z.string().min(1), isActive: z.enum(["true", "false"]) });
export const toggleArchiveSchema = z.object({ shopId: z.string().min(1), isArchived: z.enum(["true", "false"]) });

export const updateShopSchema = z.object({
  shopId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  email: z.preprocess((v) => {
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  }, z.string().trim().email().transform((value) => value.toLowerCase()).optional()),
  password: z.preprocess((v) => {
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  }, z.string().min(8).max(128).optional()),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
});
