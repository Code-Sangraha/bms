import { z } from "zod";

function optionalNonNegativeNumber() {
  return z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().min(0).optional());
}

export const livestockRestockDetailSchema = z.object({
  quantity: z.coerce
    .number({ errorMap: () => ({ message: "Quantity is required" }) })
    .refine((n) => Number.isFinite(n) && n >= 1, "Quantity must be at least 1"),
  buyingPrice: optionalNonNegativeNumber(),
  sellingPrice: optionalNonNegativeNumber(),
});

export type LivestockRestockDetailFormValues = z.infer<typeof livestockRestockDetailSchema>;

export const livestockConsumptionTypes = [{ value: "Waste", label: "Waste" }] as const;

export const livestockConsumptionDetailSchema = z.object({
  quantity: z.coerce
    .number({ errorMap: () => ({ message: "Quantity is required" }) })
    .refine((n) => Number.isFinite(n) && Number.isInteger(n) && n >= 1, "Quantity must be a whole number at least 1"),
  consumptionType: z.enum(["Waste"]),
  remarks: z.string().optional(),
});

export type LivestockConsumptionDetailFormValues = z.infer<typeof livestockConsumptionDetailSchema>;
