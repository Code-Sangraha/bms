"use client";

import { formatDashboardMoney, formatDashboardDecimal } from "../utils/dashboardFormatting";

type MobileKPIGridProps = {
  totalTransactions: number;
  totalWeight: number;
  totalQuantity: number;
  totalRevenue: number;
  t: (key: string) => string;
};

export default function MobileKPIGrid({
  totalTransactions,
  totalWeight,
  totalQuantity,
  totalRevenue,
  t,
}: MobileKPIGridProps) {
  return (
    <div className="mobileKPIGrid">
      <div className="mobileKPICard">
        <span className="mobileKPILabel">{t("Transactions")}</span>
        <span className="mobileKPIValue">{totalTransactions}</span>
      </div>
      <div className="mobileKPICard">
        <span className="mobileKPILabel">{t("Weight Sold")}</span>
        <span className="mobileKPIValue">{formatDashboardDecimal(totalWeight)} kg</span>
      </div>
      <div className="mobileKPICard">
        <span className="mobileKPILabel">{t("Quantity")}</span>
        <span className="mobileKPIValue">{formatDashboardDecimal(totalQuantity)}</span>
      </div>
      <div className="mobileKPICard">
        <span className="mobileKPILabel">{t("Revenue")}</span>
        <span className="mobileKPIValue">{formatDashboardMoney(totalRevenue)}</span>
      </div>
    </div>
  );
}
