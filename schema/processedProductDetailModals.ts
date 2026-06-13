import { z } from "zod";

export const processedRestockWeightSchema = z.object({
  weight: z.coerce
    .number({ errorMap: () => ({ message: "Weight is required" }) })
    .refine((n) => Number.isFinite(n) && n > 0, "Weight must be greater than 0"),
});

export const processedReduceWeightSchema = z.object({
  weight: z.coerce
    .number({ errorMap: () => ({ message: "Weight is required" }) })
    .refine((n) => Number.isFinite(n) && n > 0, "Weight must be greater than 0"),
  wasteProductId: z.string().trim().min(1, "Waste product is required"),
});

export type ProcessedRestockWeightFormValues = z.infer<typeof processedRestockWeightSchema>;
export type ProcessedReduceWeightFormValues = z.infer<typeof processedReduceWeightSchema>;
