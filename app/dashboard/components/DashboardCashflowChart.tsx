import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CashflowDay } from "../hooks/useDashboardData";
import { formatDashboardMoney } from "../utils/dashboardFormatting";

type DashboardCashflowChartProps = {
  data: CashflowDay[];
  t: (key: string) => string;
};

export default function DashboardCashflowChart({ data, t }: DashboardCashflowChartProps) {
  if (data.length === 0 || data.every((d) => d.moneyIn === 0 && d.moneyOut === 0)) {
    return (
      <div className="dashboardChartCard">
        <h3 className="dashboardChartTitle">{t("Cashflow (Last 7 Days)")}</h3>
        <div className="dashboardChartEmpty">
          <p>{t("No cashflow data yet")}</p>
        </div>
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    label: d.label.split(" ")[0], // Just the day number for x-axis
  }));

  return (
    <div className="dashboardChartCard">
      <h3 className="dashboardChartTitle">{t("Cashflow (Last 7 Days)")}</h3>
      <div className="dashboardAreaChartContainer">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorMoneyIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#02955a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#02955a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMoneyOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `Rs.${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatDashboardMoney(value),
                name === "moneyIn" ? t("Money In") : t("Money Out"),
              ]}
              labelFormatter={(label) => `${t("Day")} ${label}`}
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
            <Area
              type="monotone"
              dataKey="moneyIn"
              stroke="#02955a"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMoneyIn)"
            />
            <Area
              type="monotone"
              dataKey="moneyOut"
              stroke="#d97706"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMoneyOut)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="dashboardChartLegend">
        <div className="dashboardChartLegendItem">
          <span className="dashboardChartLegendDot" style={{ backgroundColor: "#02955a" }} />
          <span>{t("Money In")}</span>
        </div>
        <div className="dashboardChartLegendItem">
          <span className="dashboardChartLegendDot" style={{ backgroundColor: "#d97706" }} />
          <span>{t("Money Out")}</span>
        </div>
      </div>
    </div>
  );
}
