"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  createCounter,
  updateCounter,
  deactivateCounter,
  getCountersByShop,
  getCounterStatus,
  ensureDefaultCounterExists,
  type CreateCounterInput,
  type UpdateCounterInput,
} from "@/services/admin/counter-service";
import { z } from "zod";

// Validation schemas
const createCounterSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  deviceId: z.string().max(100).optional(),
  pin: z.string().regex(/^\d{6}$/, "Counter PIN must be exactly six digits."),
});

const updateCounterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
  description: z.string().max(500).optional(),
  deviceId: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  pin: z.string().regex(/^\d{6}$/, "Counter PIN must be exactly six digits.").optional(),
});


/**
 * Create a new counter for the admin's shop
 */
export async function createCounterAction(shopId: string, input: CreateCounterInput) {
  try {
    const user = await requireAdmin();

    // Admin check
    if (user.role !== "ADMIN") {
      throw new AppError("Only administrators can create counters", "PERMISSION_DENIED", 403);
    }

    // Validate input
    const validated = createCounterSchema.parse(input);

    const adminShop = await db.shop.findFirst({
      where: { id: shopId, businessId: user.businessId, isActive: true },
    });

    if (!adminShop) {
      throw new AppError("Shop not found or no access");
    }

    const counter = await createCounter(adminShop.id, user.id, validated);
    revalidatePath("/admin/counters");

    return { success: true, data: counter };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Update a counter
 */
export async function updateCounterAction(counterId: string, input: UpdateCounterInput) {
  try {
    const user = await requireAdmin();

    // Admin check
    if (user.role !== "ADMIN") {
      throw new AppError("Only administrators can update counters", "PERMISSION_DENIED", 403);
    }

    // Validate input
    const validated = updateCounterSchema.parse(input);

    // Verify admin has access to the counter's shop
    const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });
    const adminShop = await db.shop.findFirst({
      where: { id: counter.shopId, businessId: user.businessId },
    });

    if (!adminShop) {
      throw new AppError("No authorized shop found for this counter");
    }

    const updated = await updateCounter(counter.shopId, counterId, user.id, validated);

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Deactivate a counter
 */
export async function deactivateCounterAction(counterId: string) {
  try {
    const user = await requireAdmin();

    // Admin check
    if (user.role !== "ADMIN") {
      throw new AppError("Only administrators can deactivate counters", "PERMISSION_DENIED", 403);
    }

    // Verify admin has access to the counter's shop
    const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });
    const adminShop = await db.shop.findFirst({
      where: { id: counter.shopId, businessId: user.businessId },
    });

    if (!adminShop) {
      throw new AppError("No authorized shop found for this counter");
    }

    const deactivated = await deactivateCounter(counter.shopId, counterId, user.id);

    return { success: true, data: deactivated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Get all counters for a shop with their current session status
 */
export async function getCountersAction(shopId: string) {
  try {
    const user = await requireAdmin();

    // Admin check
    if (user.role !== "ADMIN") {
      throw new AppError("Only administrators can view counters", "PERMISSION_DENIED", 403);
    }

    // Verify admin has access to the shop
    const shop = await db.shop.findFirst({
      where: { id: shopId, businessId: user.businessId },
    });

    if (!shop) {
      throw new AppError("Shop not found or no access");
    }

    const counters = await getCountersByShop(shopId);

    return { success: true, data: counters };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Get counter details
 */
export async function getCounterAction(counterId: string) {
  try {
    const user = await requireAdmin();

    // Admin check
    if (user.role !== "ADMIN") {
      throw new AppError("Only administrators can view counter details", "PERMISSION_DENIED", 403);
    }

    // Verify admin has access to the counter's shop
    const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });
    const adminShop = await db.shop.findFirst({
      where: { id: counter.shopId, businessId: user.businessId },
    });

    if (!adminShop) {
      throw new AppError("Counter not found or no access");
    }

    const counterStatus = await getCounterStatus(counter.shopId, counterId);

    return { success: true, data: counterStatus };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Ensure default counter exists for a shop
 */
export async function ensureDefaultCounterAction(shopId: string) {
  try {
    const user = await requireAdmin();

    // System admin check only
    if (user.role !== "ADMIN" || user.businessId !== user.businessId) {
      throw new AppError("Only system administrators can initialize default counters", "PERMISSION_DENIED", 403);
    }

    const counter = await ensureDefaultCounterExists(shopId);

    return { success: true, data: counter };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
