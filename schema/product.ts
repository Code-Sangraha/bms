import { z } from "zod";

const uuidSchema = z.string().uuid("Must be a valid UUID");

export const createProductSchema = z.discriminatedUnion("productType", [
  // Processed product schema
  z.object({
    productType: z.literal("processed"),
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
    // Optional quantity for legacy flows (e.g. restock), but
    // not required when creating a processed product
    quantity: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error("Quantity must be a valid number");
        return num;
      })
      .refine((val) => val >= 0, {
        message: "Quantity must be 0 or greater",
      })
      .optional(),
    // Weight is what the backend expects when creating
    // a processed product
    weight: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error("Weight must be a valid number");
        return num;
      })
      .refine((val) => val >= 0, {
        message: "Weight must be 0 or greater",
      }),
    status: z.enum(["Active", "Inactive"]),
    createdBy: z
      .union([z.literal(""), z.string().uuid()])
      .optional(),
  }),
  // Livestock item schema
  z.object({
    productType: z.literal("live"),
    name: z
      .string()
      .min(1, "Product name is required")
      .max(200, "Product name is too long"),
    productTypeId: z
      .string()
      .min(1, "Product category is required")
      .pipe(uuidSchema), // This is the product category ID
    itemId: z
      .string()
      .min(1, "Item ID is required"),
    outletId: z
      .string()
      .optional(), // Make outletId optional for livestock
    weight: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error("Weight must be a valid number");
        return num;
      })
      .refine((val) => val > 0.1, {
        message: "Weight must be greater than 0.1",
      }),
    price: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) throw new Error("Price must be a valid number");
        return num;
      })
      .refine((val) => val > 0, {
        message: "Price must be greater than 0",
      }),
    status: z.enum(["Active", "Inactive"]),
    createdBy: z
      .union([z.literal(""), z.string().uuid()])
      .optional(),
  }),
]);

export type CreateProductFormValues = z.infer<typeof createProductSchema>;