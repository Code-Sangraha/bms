import { z } from "zod";

export const loyaltyRuleSchema = z.object({
  minPurchaseKg: z.number().positive("Minimum purchase must be greater than 0"),
  outletId: z.string().trim().min(1).optional(),
  rewardType: z.enum(["PROCESSED_QUANTITY", "CASH"]),
  rewardOptions: z.array(z.object({ productId: z.string().trim().min(1), rewardKg: z.number().positive() })).optional(),
  rewardValue: z.number().positive().optional(),
});

export type LoyaltyRuleFormValues = z.infer<typeof loyaltyRuleSchema>;

export function validateLoyaltyRule(body: unknown):
  | { ok: true; data: LoyaltyRuleFormValues }
  | { ok: false; error: string } {
  const result = loyaltyRuleSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "Invalid loyalty rule data." };
}
export const redeemRewardsSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  contact: z.string().trim().optional().nullable(),
  outletId: z.string().trim().min(1, "Outlet is required"),
  rewardProductId: z.string().trim().min(1, "Reward product is required"),
  loyaltyPoints: z.number().int("Loyalty points must be a whole number").positive("Loyalty points must be greater than 0").default(1),
});

export type RedeemRewardsInput = z.infer<typeof redeemRewardsSchema>;

export function validateRedeemRewards(body: unknown):
  | { ok: true; data: RedeemRewardsInput }
  | { ok: false; error: string } {
  const result = redeemRewardsSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "Invalid redeem data." };
}
