import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name is too long"),
  contact: z
    .string()
    .min(1, "Contact is required")
    .max(50, "Contact is too long"),
  outletId: z.string().min(1, "Outlet is required"),
  customerTypeId: z.string().min(1, "Customer type is required"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
