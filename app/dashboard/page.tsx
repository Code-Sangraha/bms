"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getDashboardSales,
  type DashboardSalesData,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import "./dashboard.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];

const STATIC_ATTENDANCE_PREVIEW = [
  { name: "John Smith", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "Maria Garcia", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "David Chen", clockIn: "—", clockOut: "—", status: "Absent" as const },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const { data: salesResponse, isLoading: salesLoading, isError: salesError, error: salesErrorDetail } = useQuery({
    queryKey: DASHBOARD_SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getDashboardSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const salesData: DashboardSalesData | undefined = salesResponse?.data;
  const totalRevenue = salesData?.totalRevenue ?? 0;
  const totalTransactions = salesData?.totalTransactions ?? 0;
  const totalWeight = salesData?.totalWeight ?? 0;
  const totalQuantity = salesData?.totalQuantity ?? 0;
  const salesByOutlet = (salesData?.salesByOutlet ?? []).slice(0, 5);
  const salesByProduct = (salesData?.salesByProduct ?? []).slice(0, 5);
  const salesByCustomer = (salesData?.salesByCustomer ?? []).slice(0, 5);

  const maxOutletAmount = Math.max(...salesByOutlet.map((o) => o.totalAmount ?? 0), 1);

  return (
    <section className="dashboardOverview">
      <div className="dashboardHero">
        <h1 className="dashboardTitle">{t("Dashboard")}</h1>
        <p className="dashboardSubtitle">{t("Sales, billing and attendance at a glance.")}</p>
      </div>

      {/* Sales & Billing */}
      <div className="dashboardSection dashboardSectionSales">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Sales & Billing")}</h2>
          <Link to="/dashboard/invoices" className="dashboardSectionLink">
            {t("View full analytics")} →
          </Link>
        </div>

        {salesLoading && (
          <div className="dashboardBlock dashboardMessage">{t("Loading sales…")}</div>
        )}
        {salesError && (
          <div className="dashboardBlock dashboardMessage dashboardError">
            {salesErrorDetail instanceof Error ? salesErrorDetail.message : t("Failed to load sales")}
          </div>
        )}

        {!salesLoading && !salesError && (
          <>
            <div className="dashboardCards">
              <div className="dashboardCard dashboardCardRevenue">
                <span className="dashboardCardLabel">{t("Total Revenue")}</span>
                <span className="dashboardCardValue">
                  Rs.{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="dashboardCard dashboardCardTransactions">
                <span className="dashboardCardLabel">{t("Transactions")}</span>
                <span className="dashboardCardValue">{totalTransactions}</span>
              </div>
              <div className="dashboardCard dashboardCardWeight">
                <span className="dashboardCardLabel">{t("Weight Sold")}</span>
                <span className="dashboardCardValue">{totalWeight} kg</span>
              </div>
              <div className="dashboardCard dashboardCardQuantity">
                <span className="dashboardCardLabel">{t("Quantity Sold")}</span>
                <span className="dashboardCardValue">{totalQuantity}</span>
              </div>
            </div>

            {(salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0) && (
              <div className="dashboardCharts">
                {salesByOutlet.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top outlets")}</h3>
                    <div className="dashboardOutletBars">
                      {salesByOutlet.map((row: SalesByOutletItem) => {
                        const amount = row.totalAmount ?? 0;
                        const pct = (amount / maxOutletAmount) * 100;
                        return (
                          <div key={row.outletId} className="dashboardBarRow">
                            <span className="dashboardBarLabel">{row.outletName}</span>
                            <div className="dashboardBarTrack">
                              <div className="dashboardBarFill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="dashboardBarValue">Rs.{amount.toLocaleString("en-IN")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {salesByProduct.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top products")}</h3>
                    <div className="dashboardProductList">
                      {salesByProduct.map((row: SalesByProductItem) => (
                        <div key={row.productId} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.productName}</span>
                          <span className="dashboardProductAmount">
                            Rs.{(row.totalAmount ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {salesByCustomer.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top customers")}</h3>
                    <div className="dashboardProductList">
                      {salesByCustomer.map((row: SalesByCustomerItem, idx: number) => (
                        <div key={idx} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.customerName}</span>
                          <span className="dashboardProductAmount">
                            Rs.{(row.totalAmount ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {totalTransactions === 0 && salesByOutlet.length === 0 && salesByProduct.length === 0 && salesByCustomer.length === 0 && (
              <div className="dashboardBlock dashboardMessage">{t("No sales data yet.")}</div>
            )}
          </>
        )}
      </div>

      {/* Attendance */}
      <div className="dashboardSection dashboardSectionAttendance">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Attendance")}</h2>
          <Link to="/dashboard/accounts/analytics" className="dashboardSectionLink">
            {t("View full analytics")} →
          </Link>
        </div>
        <div className="dashboardCards dashboardCardsAttendance">
          <div className="dashboardCard dashboardCardStaff">
            <span className="dashboardCardLabel">{t("Total Staff")}</span>
            <span className="dashboardCardValue">32</span>
            <span className="dashboardCardSub">{t("4 departments")}</span>
          </div>
          <div className="dashboardCard dashboardCardPresent">
            <span className="dashboardCardLabel">{t("Present Today")}</span>
            <span className="dashboardCardValue">20</span>
            <span className="dashboardCardSub">{t("70% present")}</span>
          </div>
        </div>
        <div className="dashboardChartBlock">
          <h3 className="dashboardChartTitle">{t("Daily attendance")}</h3>
          <div className="dashboardAttendanceTableWrap">
            <table className="dashboardAttendanceTable">
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Clock In")}</th>
                  <th>{t("Clock Out")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {STATIC_ATTENDANCE_PREVIEW.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.name}</td>
                    <td>{row.clockIn}</td>
                    <td>{row.clockOut}</td>
                    <td>
                      <span className={`dashboardPill dashboardPill${row.status}`}>{t(row.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
