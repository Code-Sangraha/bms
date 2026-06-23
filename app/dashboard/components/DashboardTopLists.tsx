import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesByOutletItem, SalesByProductItem, SalesByCustomerItem } from "@/handlers/sale";
import { formatDashboardMoney } from "../utils/dashboardFormatting";

type DashboardTopListsProps = {
  salesByOutlet: SalesByOutletItem[];
  salesByProduct: SalesByProductItem[];
  salesByCustomer: SalesByCustomerItem[];
  showTopOutlets: boolean;
  t: (key: string) => string;
};

export default function DashboardTopLists({
  salesByOutlet,
  salesByProduct,
  salesByCustomer,
  showTopOutlets,
  t,
}: DashboardTopListsProps) {
  const hasData = salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0;

  if (!hasData) {
    return (
      <div className="dashboardChartCard">
        <h3 className="dashboardChartTitle">{t("Top Performers")}</h3>
        <div className="dashboardChartEmpty">
          <p>{t("No data available yet")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboardTopListsGrid">
      {showTopOutlets && salesByOutlet.length > 0 && (
        <div className="dashboardChartCard">
          <h3 className="dashboardChartTitle">{t("Top Outlets")}</h3>
          <div className="dashboardBarChartContainer">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesByOutlet} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickFormatter={(value) => `Rs.${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="outletName"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={100}
                  tick={{ textAnchor: "end" }}
                />
                <Tooltip
                  formatter={(value: number) => formatDashboardMoney(value)}
                  labelFormatter={(label) => `${t("Outlet")}: ${label}`}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="totalAmount" fill="#02955a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {salesByProduct.length > 0 && (
        <div className="dashboardChartCard">
          <h3 className="dashboardChartTitle">{t("Top Products")}</h3>
          <div className="dashboardBarChartContainer">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesByProduct} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickFormatter={(value) => `Rs.${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={100}
                  tick={{ textAnchor: "end" }}
                />
                <Tooltip
                  formatter={(value: number) => formatDashboardMoney(value)}
                  labelFormatter={(label) => `${t("Product")}: ${label}`}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="totalAmount" fill="#2cb673" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {salesByCustomer.length > 0 && (
        <div className="dashboardChartCard">
          <h3 className="dashboardChartTitle">{t("Top Customers")}</h3>
          <div className="dashboardBarChartContainer">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesByCustomer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickFormatter={(value) => `Rs.${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="customerName"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={100}
                  tick={{ textAnchor: "end" }}
                />
                <Tooltip
                  formatter={(value: number) => formatDashboardMoney(value)}
                  labelFormatter={(label) => `${t("Customer")}: ${label}`}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="totalAmount" fill="#93e0b8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
