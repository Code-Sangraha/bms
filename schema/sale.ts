import { z } from "zod";
import { SALE_PAYMENT_METHOD_OPTIONS } from "@/lib/salePaymentMethods";

const salePaymentMethodSchema = z.enum(
  SALE_PAYMENT_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]]
);

export const processedSaleLineSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  contact: z.string().trim().min(1, "Customer contact is required"),
  customerTypeId: z.string().min(1, "Customer type is required"),
  productId: z.string().min(1, "Product is required"),
  outletId: z.string().min(1, "Outlet is required"),
  weight: z.number().positive("Weight must be greater than 0"),
  amount: z.number().positive("Line amount must be greater than 0"),
  discountAmount: z.number().min(0, "Discount cannot be negative").default(0),
  paymentMethod: salePaymentMethodSchema,
});

export const processedSaleCreateSchema = z
  .array(processedSaleLineSchema)
  .min(1, "Add at least one product line");

export type ProcessedSaleLineInput = z.infer<typeof processedSaleLineSchema>;
export type ProcessedSaleCreateInput = z.infer<typeof processedSaleCreateSchema>;

export function validateProcessedSaleCreate(items: unknown):
  | { ok: true; data: ProcessedSaleCreateInput }
  | { ok: false; error: string } {
  const result = processedSaleCreateSchema.safeParse(items);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "Invalid sale data." };
}
