import { z } from "zod";

export const createCustomerTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Customer type name is required")
    .max(200, "Customer type name is too long"),
  status: z.enum(["Active", "Inactive"]),
});

export type CreateCustomerTypeFormValues = z.infer<
  typeof createCustomerTypeSchema
>;
