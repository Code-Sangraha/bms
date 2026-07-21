import { z } from "zod";

export const creditorSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name is too long"),
  address: z
    .string()
    .min(1, "Address is required")
    .max(300, "Address is too long"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(30, "Phone is too long"),
});

export type CreditorFormValues = z.infer<typeof creditorSchema>;
