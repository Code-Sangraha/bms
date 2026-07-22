"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { useAuth } from "@/app/providers/AuthProvider";
import { useOutletScope } from "@/app/providers/OutletScopeProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { createLoyaltyRule, getLoyaltyAnalytics, getLoyaltyRule } from "@/handlers/sale";
import { getProducts } from "@/handlers/product";
import {
  LOYALTY_RULE_QUERY_KEY,
  type SessionLoyaltyRule,
} from "@/lib/loyalty";
import { validateLoyaltyRule } from "@/schema/loyalty";
import "./loyalty-rules.scss";

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatRule(rule: SessionLoyaltyRule): string {
  return rule.rewardKg != null ? `${rule.rewardKg} kg reward per ${rule.minPurchaseKg} kg purchased` : `${rule.minPurchaseKg} kg purchase threshold`;
}

export default function LoyaltyRulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { authUserId } = useAuth();
  const { scopedOutletId } = useOutletScope();
  const [minPurchaseKgInput, setMinPurchaseKgInput] = useState("10");
  const [rewardKgInput, setRewardKgInput] = useState("1");
  const [rewardType, setRewardType] = useState<"PROCESSED_QUANTITY" | "CASH">("PROCESSED_QUANTITY");
  const [cashRewardInput, setCashRewardInput] = useState("250");
  const [rewardProductId, setRewardProductId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: sessionRule = null } = useQuery<SessionLoyaltyRule | null>({
    queryKey: LOYALTY_RULE_QUERY_KEY,
    queryFn: async () => {
      const result = await getLoyaltyRule();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: Infinity,
  });

  const { data: rewardProducts = [] } = useQuery({
    queryKey: ["products", "loyalty-rewards", scopedOutletId ?? "all"],
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) throw new Error(result.error);
      return result.data.filter((product) => product.status && (!scopedOutletId || product.outletId === scopedOutletId));
    },
  });
  const { data: analytics } = useQuery({
    queryKey: ["loyalty", "analytics", scopedOutletId ?? "all"],
    queryFn: async () => {
      const result = await getLoyaltyAnalytics(scopedOutletId ?? undefined);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  useEffect(() => {
    if (!sessionRule) return;
    setMinPurchaseKgInput(String(sessionRule.minPurchaseKg));
    setRewardKgInput(String(sessionRule.rewardKg ?? 1));
  }, [sessionRule]);

  const previewRule = useMemo(() => {
    const minPurchaseKg = parsePositiveNumber(minPurchaseKgInput);
    const rewardKg = parsePositiveNumber(rewardKgInput);
    if (minPurchaseKg == null || rewardKg == null) return null;
    return { minPurchaseKg, rewardKg };
  }, [minPurchaseKgInput, rewardKgInput]);

  const mutation = useMutation({
    mutationFn: async () => {
      const minPurchaseKg = parsePositiveNumber(minPurchaseKgInput);
      const rewardKg = parsePositiveNumber(rewardKgInput);
      const validation = validateLoyaltyRule({ minPurchaseKg, outletId: scopedOutletId || undefined, rewardType, rewardValue: rewardType === "CASH" ? parsePositiveNumber(cashRewardInput) ?? 0 : undefined, rewardOptions: rewardType === "PROCESSED_QUANTITY" ? [{ productId: rewardProductId, rewardKg: rewardKg ?? 0 }] : undefined });
      if (!validation.ok) {
        return { ok: false as const, error: validation.error, status: 400 };
      }
      if (!authUserId) {
        return { ok: false as const, error: t("Could not identify the current user."), status: 400 };
      }
      return createLoyaltyRule({
        outletId: validation.data.outletId ?? scopedOutletId ?? "",
        minPurchaseKg: validation.data.minPurchaseKg,
        rewardType: validation.data.rewardType,
        rewardOptions: validation.data.rewardOptions,
        rewardValue: validation.data.rewardValue,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        setFormError(result.error);
        setSuccessMessage(null);
        showToast(result.error, "error");
        return;
      }
      const message =
        typeof result.data.message === "string" && result.data.message.trim()
          ? result.data.message.trim()
          : t("Loyalty rule created successfully");
      void queryClient.invalidateQueries({ queryKey: LOYALTY_RULE_QUERY_KEY });
      setFormError(null);
      setSuccessMessage(message);
      showToast(message);
    },
    onError: () => {
      const message = t("Something went wrong. Please try again.");
      setFormError(message);
      setSuccessMessage(null);
      showToast(message, "error");
    },
  });

  return (
    <section className="loyaltyRulesPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> <span>&gt;</span> {t("Loyalty Rules")}
      </div>

      <div className="loyaltyRulesHeader">
        <div>
          <h1 className="pageTitle">{t("Loyalty Rules")}</h1>
          <p className="pageSubtitle">
            {t("Configure purchase-to-reward rules for processed sales.")}
          </p>
        </div>
      </div>

      {analytics ? (
        <div className="loyaltyAnalyticsGrid">
          <div><span>{t("Loyalty customers")}</span><strong>{analytics.totalCustomers}</strong></div>
          <div><span>{t("Pending rewards")}</span><strong>{analytics.totalPointsPending}</strong></div>
          <div><span>{t("Redeemed points")}</span><strong>{analytics.totalPointsRedeemed}</strong></div>
          <div><span>{t("Reward provided")}</span><strong>{analytics.totalRewardKgProvided.toLocaleString()} kg</strong></div>
        </div>
      ) : null}
      <div className="loyaltyRulesGrid">
        <Card className="shadow-sm">
          <CardHeader className="loyaltyRulesCardHeader">
            <div className="loyaltyRulesIcon" aria-hidden>
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h2 className="loyaltyRulesCardTitle">{t("Create rule")}</h2>
              <p className="loyaltyRulesCardSubtitle">
                {t("This creates a backend loyalty rule and refreshes the newest configured rule.")}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="loyaltyRulesForm"
              onSubmit={(event) => {
                event.preventDefault();
                setFormError(null);
                setSuccessMessage(null);
                mutation.mutate();
              }}
            >
              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
              {successMessage ? (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              ) : null}

              <FormField id="loyalty-reward-type" label={t("Reward type")} required>
                <select id="loyalty-reward-type" className="loyaltyRulesNativeSelect" value={rewardType} onChange={(event) => setRewardType(event.target.value as "PROCESSED_QUANTITY" | "CASH")}>
                  <option value="PROCESSED_QUANTITY">{t("Processed product")}</option>
                  <option value="CASH">{t("Cash")}</option>
                </select>
              </FormField>              <div className="loyaltyRulesFields">
                <FormField id="loyalty-min-purchase" label={t("Minimum purchase (kg)")} required>
                  <Input
                    id="loyalty-min-purchase"
                    type="number"
                    min={0}
                    step="any"
                    value={minPurchaseKgInput}
                    onChange={(event) => setMinPurchaseKgInput(event.target.value)}
                  />
                </FormField>
                {rewardType === "PROCESSED_QUANTITY" ? <FormField id="loyalty-reward-product" label={t("Reward product")} required><select id="loyalty-reward-product" className="loyaltyRulesNativeSelect" value={rewardProductId} onChange={(event) => setRewardProductId(event.target.value)}><option value="">{t("Select product")}</option>{rewardProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></FormField> : <FormField id="loyalty-cash-reward" label={t("Cash reward (NPR)")} required><Input id="loyalty-cash-reward" type="number" min={0} value={cashRewardInput} onChange={(event) => setCashRewardInput(event.target.value)} /></FormField>}
                <FormField id="loyalty-reward" label={t("Reward (kg)")} required>
                  <Input
                    id="loyalty-reward"
                    type="number"
                    min={0}
                    step="any"
                    value={rewardKgInput}
                    onChange={(event) => setRewardKgInput(event.target.value)}
                  />
                </FormField>
              </div>

              <div className="loyaltyRulesPreview" aria-live="polite">
                {previewRule
                  ? t("Preview: {{reward}} kg reward per {{purchase}} kg purchased")
                      .replace("{{reward}}", String(previewRule.rewardKg))
                      .replace("{{purchase}}", String(previewRule.minPurchaseKg))
                  : t("Enter positive values to preview the rule.")}
              </div>

              <Button type="submit" disabled={mutation.isPending} className="loyaltyRulesSubmit">
                {mutation.isPending ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : (
                  <Save data-icon="inline-start" aria-hidden />
                )}
                {mutation.isPending ? t("Saving...") : t("Save rule")}
              </Button>
            </form>
          </CardContent>
        </Card>

    
      </div>
    </section>
  );
}
