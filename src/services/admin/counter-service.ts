import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { CounterDocument } from "@/models/model.types";
import { writeAuditLog } from "@/services/shared/audit-service";

export interface CreateCounterInput {
  name: string;
  code: string;
  description?: string;
  deviceId?: string;
}

export interface UpdateCounterInput {
  name?: string;
  code?: string;
  description?: string;
  deviceId?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export type CounterWithStatus = CounterDocument & {
  registerId: string | null;
  registerName: string | null;
  currentSession: {
    id: string;
    salesperson: string;
    register: string;
    openedAt: Date;
    openingCash: number;
  } | null;
};

/**
 * Create a new counter for a shop
 */
export async function createCounter(shopId: string, userId: string, input: CreateCounterInput): Promise<CounterDocument> {
  // Validate counter code is unique within the shop
  const existing = await db.counter.findFirst({
    where: { shopId, code: input.code },
  });

  if (existing) {
    throw new AppError(`A counter with code '${input.code}' already exists in this shop.`);
  }

  // Create the counter
  const counter = await db.counter.create({
    data: {
      shopId,
      name: input.name,
      code: input.code,
      description: input.description || null,
      deviceId: input.deviceId || null,
      status: "ACTIVE",
    },
  });

  await db.register.create({
    data: {
      shopId,
      counterId: counter.id,
      name: `${counter.name} Register`,
      code: `${counter.code}-REG`,
      isActive: true,
    },
  });

  // Log the action
  await writeAuditLog(db, {
    userId,
    shopId,
    action: "COUNTER_CREATED",
    entityType: "COUNTER",
    entityId: counter.id,
    description: `Created counter '${counter.name}' with code '${counter.code}'.`,
    metadata: { name: counter.name, code: counter.code, deviceId: counter.deviceId },
  });

  return counter;
}

/**
 * Update a counter's information
 */
export async function updateCounter(
  shopId: string,
  counterId: string,
  userId: string,
  input: UpdateCounterInput,
): Promise<CounterDocument> {
  // Verify counter belongs to the shop
  const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });

  if (counter.shopId !== shopId) {
    throw new AppError("Counter does not belong to this shop.");
  }

  // If changing code, verify uniqueness within the shop
  if (input.code && input.code !== counter.code) {
    const existing = await db.counter.findFirst({
      where: { shopId, code: input.code },
    });

    if (existing) {
      throw new AppError(`A counter with code '${input.code}' already exists in this shop.`);
    }
  }

  // Update the counter
  const updated = await db.counter.update({
    where: { id: counterId },
    data: {
      name: input.name || counter.name,
      code: input.code || counter.code,
      description: input.description !== undefined ? input.description : counter.description,
      deviceId: input.deviceId !== undefined ? input.deviceId : counter.deviceId,
      status: input.status || counter.status,
    },
  });

  // Log the action
  const changes = [];
  if (input.name) changes.push(`name: '${counter.name}' → '${input.name}'`);
  if (input.code) changes.push(`code: '${counter.code}' → '${input.code}'`);
  if (input.description !== undefined) changes.push(`description updated`);
  if (input.deviceId !== undefined) changes.push(`device: '${counter.deviceId || "None"}' → '${input.deviceId || "None"}'`);
  if (input.status) changes.push(`status: '${counter.status}' → '${input.status}'`);

  await writeAuditLog(db, {
    userId,
    shopId,
    action: "COUNTER_UPDATED",
    entityType: "COUNTER",
    entityId: counterId,
    description: `Updated counter '${counter.name}': ${changes.join(", ")}`,
    metadata: { counterId, changes },
  });

  return updated;
}

/**
 * Deactivate a counter (soft delete)
 */
export async function deactivateCounter(shopId: string, counterId: string, userId: string): Promise<CounterDocument> {
  // Verify counter belongs to the shop
  const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });

  if (counter.shopId !== shopId) {
    throw new AppError("Counter does not belong to this shop.");
  }

  // Check if there's an open register session on this counter
  const openSession = await db.registerSession.findFirst({
    where: { counterId, status: "OPEN" },
  });

  if (openSession) {
    throw new AppError("Cannot deactivate a counter with an open register session. Please close the register first.");
  }

  // Deactivate the counter
  const deactivated = await db.counter.update({
    where: { id: counterId },
    data: { status: "INACTIVE" },
  });

  // Log the action
  await writeAuditLog(db, {
    userId,
    shopId,
    action: "COUNTER_DEACTIVATED",
    entityType: "COUNTER",
    entityId: counterId,
    description: `Deactivated counter '${counter.name}'.`,
    metadata: { counterId, counterName: counter.name },
  });

  return deactivated;
}

/**
 * Get all counters for a shop with their current session status
 */
export async function getCountersByShop(shopId: string): Promise<CounterWithStatus[]> {
  const counters = await db.counter.findMany({
    where: { shopId },
    orderBy: { name: "asc" },
  });

  // Get open sessions for each counter
  const sessions = await db.registerSession.findMany({
    where: { shopId, status: "OPEN" },
    include: { salesperson: true, register: true },
  });

  const registers = await db.register.findMany({ where: { shopId, isActive: true } });

  const registersByCounterId = new Map(registers.filter((register) => register.counterId).map((register) => [register.counterId, register]));
  for (const counter of counters) {
    if (registersByCounterId.has(counter.id)) continue;
    const code = `${counter.code}-REG`;
    const existingRegister = registers.find((register) => register.code === code);
    const register = existingRegister ?? await db.register.create({
      data: { shopId, counterId: counter.id, name: `${counter.name} Register`, code, isActive: true },
    });
    registersByCounterId.set(counter.id, register);
  }

  // Combine counters with their current session info
  return counters.map((counter) => {
    const currentSession = sessions.find((s) => s.counterId === counter.id);
    return {
      ...counter,
      status: counter.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      registerId: registersByCounterId.get(counter.id)?.id ?? null,
      registerName: registersByCounterId.get(counter.id)?.name ?? null,
      currentSession: currentSession
        ? {
            id: currentSession.id,
            salesperson: currentSession.salesperson?.name || "Unknown",
            register: currentSession.register?.name || "Unknown",
            openedAt: currentSession.openedAt,
            openingCash: currentSession.openingCash,
          }
        : null,
    };
  });
}

/**
 * Get a single counter with its current session details
 */
export async function getCounterStatus(shopId: string, counterId: string): Promise<CounterWithStatus> {
  const counter = await db.counter.findUniqueOrThrow({ where: { id: counterId } });

  if (counter.shopId !== shopId) {
    throw new AppError("Counter does not belong to this shop.");
  }

  const currentSession = await db.registerSession.findFirst({
    where: { counterId, status: "OPEN" },
    include: { salesperson: true, register: true },
  });

  return {
    ...counter,
    registerId: currentSession?.register?.id ?? null,
    registerName: currentSession?.register?.name ?? null,
    currentSession: currentSession
      ? {
          id: currentSession.id,
          salesperson: currentSession.salesperson?.name || "Unknown",
          register: currentSession.register?.name || "Unknown",
          openedAt: currentSession.openedAt,
          openingCash: currentSession.openingCash,
        }
      : null,
  };
}

/**
 * Auto-create "Counter 1" for shops that don't have any counters yet (for backward compatibility)
 */
export async function ensureDefaultCounterExists(shopId: string): Promise<CounterDocument> {
  // Check if shop already has any counters
  const existingCounters = await db.counter.findMany({ where: { shopId } });

  if (existingCounters.length > 0) {
    return existingCounters[0]; // Return first counter
  }

  // Create default Counter 1
  const defaultCounter = await db.counter.create({
    data: {
      shopId,
      name: "Counter 1",
      code: "C01",
      status: "ACTIVE",
    },
  });

  // Link all existing registerSessions (if any) to this counter
  await db.registerSession.updateMany({
    where: { shopId, counterId: null },
    data: { counterId: defaultCounter.id },
  });

  return defaultCounter;
}
