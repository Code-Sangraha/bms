import { z } from "zod";

export const dualPricingSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  wholesalePrice: z.coerce.number().min(0, "Must be 0 or more"),
  retailPrice: z.coerce.number().min(0, "Must be 0 or more"),
  outletId: z.string().min(1, "Outlet is required"),
  status: z.enum(["Active", "Inactive"]),
});

export type DualPricingFormValues = z.infer<typeof dualPricingSchema>;
