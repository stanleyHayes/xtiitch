import { z } from "zod";

export const ghsMinorUnitsSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("A Ghana Cedis amount represented in pesewas.");

export const tenantScopedIdSchema = z.string().uuid();

export const storeHandleSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);

