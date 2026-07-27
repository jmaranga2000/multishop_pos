import { z } from "zod";

export const receiveTransferSchema = z.object({ transferId: z.string().min(1) });
