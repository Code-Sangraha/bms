import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(200, "Supplier name is too long"),
  contact: z.string().trim().min(1, "Contact is required").max(50, "Contact is too long"),
  outletId: z.string().trim().min(1, "Outlet is required"),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
