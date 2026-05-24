import { z } from "zod";

function optionalNonNegativeNumber() {
  return z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().min(0).optional());
}

function requiredNonNegativeNumber(message: string) {
  return z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }, z.number({ errorMap: () => ({ message }) }).min(0, message));
}

export const livestockRestockDetailSchema = z.object({
  quantity: z.coerce
    .number({ errorMap: () => ({ message: "Quantity is required" }) })
    .refine((n) => Number.isFinite(n) && n >= 1, "Quantity must be at least 1"),
  buyingPrice: optionalNonNegativeNumber(),
  sellingPrice: optionalNonNegativeNumber(),
  supplierName: z
    .string({ errorMap: () => ({ message: "Supplier name is required" }) })
    .trim()
    .min(1, "Supplier name is required"),
  supplierContact: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  totalAmount: requiredNonNegativeNumber("Total amount is required"),
  paidAmount: requiredNonNegativeNumber("Paid amount is required"),
  remarks: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
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
