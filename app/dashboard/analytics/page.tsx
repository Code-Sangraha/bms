"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { getDashboardSales, type DashboardSalesResponse } from "@/handlers/sale";
import "./analytics.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(v: unknown, t: (text: string) => string): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `${v.length} ${t("items")}`;
  if (isPlainObject(v)) return Object.keys(v).length ? "..." : "—";
  return String(v);
}

export default function DashboardAnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
        if (result.status === 401) navigate("/login");
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
        <span>{t("Dashboard")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Analytics")}</span>
      </div>

      <div className="dashboardAnalyticsHeader">
        <div className="dashboardAnalyticsHeaderText">
          <h1 className="pageTitle">{t("Analytics")}</h1>
          <p className="pageSubtitle">
            {t("Sales and revenue overview from dashboard.")}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="dashboardAnalyticsMessage">
          {t("Loading dashboard sales…")}
        </div>
      )}
      {isError && (
        <div className="dashboardAnalyticsMessage dashboardAnalyticsError">
          {error instanceof Error
            ? error.message
            : t("Failed to load dashboard sales")}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {(totalSales != null || totalRevenue != null) && (
            <div className="dashboardAnalyticsCards">
              {totalSales != null && (
                <div className="dashboardAnalyticsCard">
                  <div className="dashboardAnalyticsCardLabel">{t("Total Sales")}</div>
                  <div className="dashboardAnalyticsCardValue">
                    {formatValue(totalSales, t)}
                  </div>
                </div>
              )}
              {totalRevenue != null && (
                <div className="dashboardAnalyticsCard dashboardAnalyticsCardRevenue">
                  <div className="dashboardAnalyticsCardLabel">{t("Total Revenue")}</div>
                  <div className="dashboardAnalyticsCardValue">
                    {typeof totalRevenue === "number"
                      ? `Rs.${totalRevenue.toFixed(2)}`
                      : formatValue(totalRevenue, t)}
                  </div>
                </div>
              )}
            </div>
          )}
          {isPlainObject(data) && Object.keys(data).length > 0 && (
            <div className="dashboardAnalyticsData">
              <h2 className="dashboardAnalyticsDataTitle">{t("Dashboard data")}</h2>
              <dl className="dashboardAnalyticsDataList">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="dashboardAnalyticsDataRow">
                    <dt>{key}</dt>
                    <dd>
                      {isPlainObject(value) || Array.isArray(value)
                        ? JSON.stringify(value)
                        : formatValue(value, t)}
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
                {t("No dashboard sales data available.")}
              </div>
            )}
        </>
      )}
    </section>
  );
}
