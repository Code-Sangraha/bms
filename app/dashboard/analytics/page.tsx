"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getDashboardSales, type DashboardSalesResponse } from "@/handlers/sale";
import "./analytics.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `${v.length} items`;
  if (isPlainObject(v)) return Object.keys(v).length ? "..." : "—";
  return String(v);
}

export default function DashboardAnalyticsPage() {
  const router = useRouter();
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: DASHBOARD_SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getDashboardSales();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const raw = dashboardData ?? {};
  const data = isPlainObject(raw.data) ? (raw.data as Record<string, unknown>) : (raw as Record<string, unknown>);
  const totalSales = data.totalSales ?? data.totalOrders ?? data.totalTransactions;
  const totalRevenue = data.totalRevenue ?? data.revenue;

  return (
    <section className="dashboardAnalyticsPage">
      <div className="breadcrumb">
        <span>Dashboard</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>Analytics</span>
      </div>

      <div className="dashboardAnalyticsHeader">
        <div className="dashboardAnalyticsHeaderText">
          <h1 className="pageTitle">Analytics</h1>
          <p className="pageSubtitle">Sales and revenue overview from dashboard.</p>
        </div>
      </div>

      {isLoading && (
        <div className="dashboardAnalyticsMessage">Loading dashboard sales…</div>
      )}
      {isError && (
        <div className="dashboardAnalyticsMessage dashboardAnalyticsError">
          {error instanceof Error ? error.message : "Failed to load dashboard sales"}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {(totalSales != null || totalRevenue != null) && (
            <div className="dashboardAnalyticsCards">
              {totalSales != null && (
                <div className="dashboardAnalyticsCard">
                  <div className="dashboardAnalyticsCardLabel">Total Sales</div>
                  <div className="dashboardAnalyticsCardValue">{formatValue(totalSales)}</div>
                </div>
              )}
              {totalRevenue != null && (
                <div className="dashboardAnalyticsCard dashboardAnalyticsCardRevenue">
                  <div className="dashboardAnalyticsCardLabel">Total Revenue</div>
                  <div className="dashboardAnalyticsCardValue">
                    {typeof totalRevenue === "number"
                      ? `Rs.${totalRevenue.toFixed(2)}`
                      : formatValue(totalRevenue)}
                  </div>
                </div>
              )}
            </div>
          )}
          {isPlainObject(data) && Object.keys(data).length > 0 && (
            <div className="dashboardAnalyticsData">
              <h2 className="dashboardAnalyticsDataTitle">Dashboard data</h2>
              <dl className="dashboardAnalyticsDataList">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="dashboardAnalyticsDataRow">
                    <dt>{key}</dt>
                    <dd>
                      {isPlainObject(value) || Array.isArray(value)
                        ? JSON.stringify(value)
                        : formatValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {(!isPlainObject(data) || Object.keys(data).length === 0) &&
            totalSales == null &&
            totalRevenue == null && (
              <div className="dashboardAnalyticsMessage">
                No dashboard sales data available.
              </div>
            )}
        </>
      )}
    </section>
  );
}
