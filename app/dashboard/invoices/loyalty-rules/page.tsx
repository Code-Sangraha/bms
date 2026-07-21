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
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { createLoyaltyRule, getLoyaltyRule } from "@/handlers/sale";
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
  return `${rule.rewardKg} kg reward per ${rule.minPurchaseKg} kg purchased`;
}

export default function LoyaltyRulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { authUserId } = useAuth();
  const [minPurchaseKgInput, setMinPurchaseKgInput] = useState("10");
  const [rewardKgInput, setRewardKgInput] = useState("1");
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

  useEffect(() => {
    if (!sessionRule) return;
    setMinPurchaseKgInput(String(sessionRule.minPurchaseKg));
    setRewardKgInput(String(sessionRule.rewardKg));
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
      const validation = validateLoyaltyRule({ minPurchaseKg, rewardKg });
      if (!validation.ok) {
        return { ok: false as const, error: validation.error, status: 400 };
      }
      if (!authUserId) {
        return { ok: false as const, error: t("Could not identify the current user."), status: 400 };
      }
      return createLoyaltyRule({
        minPurchaseKg: validation.data.minPurchaseKg,
        rewardKg: validation.data.rewardKg,
        createdBy: authUserId,
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

              <div className="loyaltyRulesFields">
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

        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="loyaltyRulesCardTitle">{t("Newest configured rule")}</h2>
            {/* <p className="loyaltyRulesCardSubtitle">
              {t("The API does not expose existing rules yet, so this panel only shows the latest rule created during this browser session.")}
            </p> */}
          </CardHeader>
          <CardContent>
            {sessionRule ? (
              <div className="loyaltyRulesSessionRule">
                <span className="loyaltyRulesSessionValue">{formatRule(sessionRule)}</span>
                <span className="loyaltyRulesSessionMeta">
                  {t("This is the newest configured rule; sales may use a different rule until the backend lookup is ordered.")}
                </span>
                {sessionRule.createdAt ? (
                  <span className="loyaltyRulesSessionMeta">
                    {new Date(sessionRule.createdAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertDescription>
                  {t("No loyalty rule is configured in the backend yet.")}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
