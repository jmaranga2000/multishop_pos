import { z } from "zod";

export const deviceAccessSchema = z.object({
  deviceId: z.string().min(1),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
});
