"use client";

import { useMemo } from "react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { useI18n } from "@/app/providers/I18nProvider";
import type { SalesByCustomerItem } from "@/handlers/sale";
import {
  computeEarnedRewardKg,
  findSalesByCustomerRow,
} from "@/lib/loyalty";

type LoyaltySaleHintsProps = {
  customerName: string;
  saleOutletId: string;
  jwtOutletId: string | null;
  salesByCustomer?: SalesByCustomerItem[];
};

export function LoyaltySaleHints({
  customerName,
  saleOutletId,
  jwtOutletId,
  salesByCustomer = [],
}: LoyaltySaleHintsProps) {
  const { t } = useI18n();

  const trimmedName = customerName.trim();
  const saleOutlet = saleOutletId.trim();
  const jwtOutlet = jwtOutletId?.trim() ?? "";

  const outletsMatch =
    saleOutlet.length > 0 && jwtOutlet.length > 0 && saleOutlet === jwtOutlet;

  const outletMismatch =
    saleOutlet.length > 0 && jwtOutlet.length > 0 && saleOutlet !== jwtOutlet;

  const matchedRow = useMemo(
    () =>
      trimmedName && outletsMatch
        ? findSalesByCustomerRow(salesByCustomer, trimmedName)
        : undefined,
    [trimmedName, outletsMatch, salesByCustomer]
  );

  const earnedKg =
    matchedRow != null ? computeEarnedRewardKg(matchedRow.totalWeight) : null;

  return (
    <Alert className="mt-3 border-border bg-muted/40">
      <AlertDescription className="space-y-1 text-sm">
        <p>{t("Earns 1 kg reward per 20 kg purchased.")}</p>
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
        {trimmedName && outletMismatch ? (
          <p className="text-muted-foreground">
            {t(
              "Earned reward preview is based on dashboard data for your logged-in outlet, not necessarily the outlet selected for this sale."
            )}
          </p>
        ) : null}
        {trimmedName && outletsMatch && earnedKg != null ? (
          <p>
            {t("Earned rewards (approx., from sales totals):")}{" "}
            <strong>{earnedKg} kg</strong>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
