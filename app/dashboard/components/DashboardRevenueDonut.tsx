import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatDashboardMoney } from "../utils/dashboardFormatting";

export type RevenueBreakdownData = {
  processed: number;
  livestock: number;
  expenses: number;
};

type DashboardRevenueDonutProps = {
  data: RevenueBreakdownData;
  t: (key: string) => string;
};

const COLORS = ["#02955a", "#2cb673", "#d97706"]; // brand-500, brand-400, warning

export default function DashboardRevenueDonut({ data, t }: DashboardRevenueDonutProps) {
  const chartData = [
    { name: t("Processed"), value: data.processed },
    { name: t("Livestock"), value: data.livestock },
    { name: t("Expenses"), value: data.expenses },
  ].filter((d) => d.value > 0);

  const total = data.processed + data.livestock;

  if (chartData.length === 0) {
    return (
      <div className="dashboardChartCard">
        <h3 className="dashboardChartTitle">{t("Revenue Breakdown")}</h3>
        <div className="dashboardChartEmpty">
          <p>{t("No revenue data yet")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboardChartCard">
      <h3 className="dashboardChartTitle">{t("Revenue Breakdown")}</h3>
      <div className="dashboardDonutContainer">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatDashboardMoney(value)}
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="dashboardDonutCenter">
          <p className="dashboardDonutLabel">{t("Total Revenue")}</p>
          <p className="dashboardDonutValue">{formatDashboardMoney(total)}</p>
        </div>
      </div>
      <div className="dashboardDonutLegend">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="dashboardDonutLegendItem">
            <span className="dashboardDonutLegendDot" style={{ backgroundColor: COLORS[index] }} />
            <span className="dashboardDonutLegendLabel">{entry.name}</span>
            <span className="dashboardDonutLegendValue">{formatDashboardMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
