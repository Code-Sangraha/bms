import { z } from "zod";

export const createProductTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Product type name is required")
    .max(200, "Product type name is too long"),
  status: z.enum(["Active", "Inactive"]),
});

export type CreateProductTypeFormValues = z.infer<
  typeof createProductTypeSchema
>;
