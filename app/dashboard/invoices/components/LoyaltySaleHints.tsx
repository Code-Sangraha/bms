"use client";

import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { useI18n } from "@/app/providers/I18nProvider";
import type { SessionLoyaltyRule } from "@/lib/loyalty";

type LoyaltySaleHintsProps = {
  customerName: string;
  saleOutletId: string;
  sessionRule?: SessionLoyaltyRule | null;
};

export function LoyaltySaleHints({
  customerName,
  saleOutletId,
  sessionRule = null,
}: LoyaltySaleHintsProps) {
  const { t } = useI18n();
  const trimmedName = customerName.trim();
  const hasOutlet = saleOutletId.trim().length > 0;

  return (
    <Alert className="mt-3 border-border bg-muted/40">
      <AlertDescription className="space-y-1 text-sm">
        <p>{t("Loyalty is calculated by the backend loyalty rule.")}</p>
        {sessionRule ? (
          <p>
            {t("Current session rule:")} {" "}
            <strong>
              {t("{{reward}} kg reward per {{purchase}} kg purchased")
                .replace("{{reward}}", String(sessionRule.rewardKg))
                .replace("{{purchase}}", String(sessionRule.minPurchaseKg))}
            </strong>
          </p>
        ) : (
          <p className="text-amber-700">
            {t("No loyalty rule is known in this session. Sales may fail if the backend has no loyalty rule yet.")}
          </p>
        )}
        <p>
          {t(
            "Loyalty accrues when the sale includes a customer name and line weight (kg)."
          )}
        </p>
        <p>
          {t(
            "Use the exact same customer name (including capitalization) on every sale at this outlet so loyalty accumulates."
          )}
        </p>
        {trimmedName && !hasOutlet ? (
          <p className="text-muted-foreground">
            {t("Select an outlet before checkout so loyalty can be matched by customer name and outlet.")}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
