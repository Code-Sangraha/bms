import { z } from "zod";

export const createOutletSchema = z.object({
  name: z
    .string()
    .min(1, "Outlet name is required")
    .max(200, "Outlet name is too long"),
  managerId: z
    .string()
    .min(1, "Manager must be selected"),
  contact: z
    .string()
    .min(1, "Contact is required")
    .max(50, "Contact is too long"),
  status: z.enum(["Active", "Inactive"]),
});

export type CreateOutletFormValues = z.infer<typeof createOutletSchema>;
