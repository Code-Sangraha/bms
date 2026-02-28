import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, "Department name is required")
    .max(200, "Department name is too long"),
  status: z.enum(["Active", "Inactive"]),
});

export type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>;
