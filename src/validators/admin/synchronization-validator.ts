import { z } from "zod";

export const resolveSyncConflictSchema = z.object({ conflictId: z.string().min(1) });
