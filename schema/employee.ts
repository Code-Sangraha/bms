import { z } from "zod";

const uuidSchema = z.string().uuid("Must be a valid UUID");

export const createEmployeeSchema = z.object({
  employeeId: z
    .string()
    .min(1, "Employee ID is required")
    .max(100, "Employee ID is too long"),
  iot: z
    .string()
    .min(1, "IOT is required")
    .max(100, "IOT is too long"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name is too long"),
  departmentId: uuidSchema,
  outletId: uuidSchema,
  roleId: uuidSchema,
  status: z.enum(["Active", "Inactive"]),
  contact: z
    .string()
    .min(1, "Contact is required")
    .max(50, "Contact is too long"),
});

export type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;
