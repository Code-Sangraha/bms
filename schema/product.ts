import { z } from "zod";

const uuidSchema = z.string().uuid("Must be a valid UUID");

export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, "Product name is required")
    .max(200, "Product name is too long"),
  productTypeId: z
    .string()
    .min(1, "Product type is required")
    .pipe(uuidSchema),
  outletId: z
    .string()
    .min(1, "Outlet is required")
    .pipe(uuidSchema),
  quantity: z
    .number()
    .min(0, "Quantity must be 0 or greater"),
  status: z.enum(["Active", "Inactive"]),
  createdBy: z.union([z.literal(""), uuidSchema]).optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
