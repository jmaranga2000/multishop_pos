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
});

export const resetShopPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const toggleShopSchema = z.object({ shopId: z.string().min(1), isActive: z.enum(["true", "false"]) });

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
