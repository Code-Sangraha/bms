"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatDashboardMoney } from "../utils/dashboardFormatting";

type MobileRevenueDonutProps = {
  processedRevenue: number;
  livestockRevenue: number;
  totalExpenses: number;
  t: (key: string) => string;
};

export default function MobileRevenueDonut({
  processedRevenue,
  livestockRevenue,
  totalExpenses,
  t,
}: MobileRevenueDonutProps) {
  const data = [
    { name: t("Processed"), value: processedRevenue, color: "#02955a" },
    { name: t("Livestock"), value: livestockRevenue, color: "#2cb673" },
    { name: t("Expenses"), value: totalExpenses, color: "#d97706" },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="mobileRevenueDonut">
      <h3 className="mobileRevenueDonut__title">{t("Revenue Breakdown")}</h3>
      <div className="mobileRevenueDonut__content">
        <div className="mobileRevenueDonut__chart">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mobileRevenueDonut__legend">
          {data.map((item, index) => (
            <div key={index} className="mobileRevenueDonut__legendItem">
              <span
                className="mobileRevenueDonut__legendDot"
                style={{ backgroundColor: item.color }}
              />
              <span className="mobileRevenueDonut__legendLabel">{item.name}</span>
              <span className="mobileRevenueDonut__legendValue">
                {formatDashboardMoney(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
