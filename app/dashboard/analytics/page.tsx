"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  LuBadgeDollarSign,
  LuChartColumnBig,
  LuCircleDollarSign,
  LuLayoutGrid,
  LuPackageSearch,
  LuReceiptText,
  LuStore,
  LuUsers,
} from "react-icons/lu";
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

function formatMetricLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
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
  const dataEntries = useMemo(() => Object.entries(data), [data]);
  const featuredStats = useMemo(
    () =>
      dataEntries
        .filter(([key, value]) => !["totalSales", "totalOrders", "totalTransactions", "totalRevenue", "revenue"].includes(key))
        .filter(([, value]) => !Array.isArray(value) && !isPlainObject(value))
        .slice(0, 4),
    [dataEntries]
  );
  const collectionStats = useMemo(
    () =>
      dataEntries
        .filter(([, value]) => Array.isArray(value) || isPlainObject(value))
        .map(([key, value]) => ({
          key,
          count: Array.isArray(value) ? value.length : Object.keys(value).length,
        }))
        .slice(0, 4),
    [dataEntries]
  );
  const salesByOutlet = Array.isArray(data.salesByOutlet) ? data.salesByOutlet.slice(0, 3) : [];
  const salesByProduct = Array.isArray(data.salesByProduct) ? data.salesByProduct.slice(0, 3) : [];
  const salesByCustomer = Array.isArray(data.salesByCustomer) ? data.salesByCustomer.slice(0, 3) : [];

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
          {(totalSales != null || totalRevenue != null || featuredStats.length > 0) && (
            <div className="dashboardAnalyticsMobile">
              <div className="dashboardAnalyticsMobileCards">
                {totalSales != null && (
                  <div className="dashboardAnalyticsMobileCard">
                    <div className="dashboardAnalyticsMobileCardTop">
                      <div className="dashboardAnalyticsCardLabel">{t("Total Sales")}</div>
                      <span className="dashboardAnalyticsMobileIcon" aria-hidden="true">
                        <LuReceiptText />
                      </span>
                    </div>
                    <div className="dashboardAnalyticsMobileValue">
                      {formatValue(totalSales, t)}
                    </div>
                  </div>
                )}
                {totalRevenue != null && (
                  <div className="dashboardAnalyticsMobileCard dashboardAnalyticsMobileCardRevenue">
                    <div className="dashboardAnalyticsMobileCardTop">
                      <div className="dashboardAnalyticsCardLabel">{t("Total Revenue")}</div>
                      <span className="dashboardAnalyticsMobileIcon" aria-hidden="true">
                        <LuBadgeDollarSign />
                      </span>
                    </div>
                    <div className="dashboardAnalyticsMobileValue">
                      {typeof totalRevenue === "number"
                        ? `Rs.${totalRevenue.toFixed(2)}`
                        : formatValue(totalRevenue, t)}
                    </div>
                  </div>
                )}
              </div>

              {featuredStats.length > 0 && (
                <section className="dashboardAnalyticsMobileSection">
                  <div className="dashboardAnalyticsMobileSectionHead">
                    <h2>{t("Highlights")}</h2>
                    <span className="dashboardAnalyticsMobileSectionIcon" aria-hidden="true">
                      <LuChartColumnBig />
                    </span>
                  </div>
                  <div className="dashboardAnalyticsMobileStatList">
                    {featuredStats.map(([key, value]) => (
                      <div key={key} className="dashboardAnalyticsMobileStatRow">
                        <span>{t(formatMetricLabel(key))}</span>
                        <strong>{formatValue(value, t)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {collectionStats.length > 0 && (
                <section className="dashboardAnalyticsMobileSection">
                  <div className="dashboardAnalyticsMobileSectionHead">
                    <h2>{t("Collections")}</h2>
                    <span className="dashboardAnalyticsMobileSectionIcon" aria-hidden="true">
                      <LuLayoutGrid />
                    </span>
                  </div>
                  <div className="dashboardAnalyticsMobilePills">
                    {collectionStats.map((entry) => (
                      <div key={entry.key} className="dashboardAnalyticsMobilePill">
                        <span>{t(formatMetricLabel(entry.key))}</span>
                        <strong>{entry.count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0) && (
                <section className="dashboardAnalyticsMobileSection">
                  <div className="dashboardAnalyticsMobileSectionHead">
                    <h2>{t("Top snapshots")}</h2>
                    <span className="dashboardAnalyticsMobileSectionIcon" aria-hidden="true">
                      <LuCircleDollarSign />
                    </span>
                  </div>
                  <div className="dashboardAnalyticsMobileStacks">
                    {salesByOutlet.length > 0 && (
                      <div className="dashboardAnalyticsMobileStack">
                        <div className="dashboardAnalyticsMobileStackTitle">
                          <LuStore aria-hidden="true" />
                          <span>{t("Outlets")}</span>
                        </div>
                        {salesByOutlet.map((row, index) => {
                          const item = row as Record<string, unknown>;
                          const amount = typeof item.totalAmount === "number" ? item.totalAmount : 0;
                          const name = typeof item.outletName === "string" ? item.outletName : `${t("Outlet")} ${index + 1}`;
                          return (
                            <div key={`${name}-${index}`} className="dashboardAnalyticsMobileStackRow">
                              <span>{name}</span>
                              <strong>Rs.{amount.toLocaleString("en-IN")}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {salesByProduct.length > 0 && (
                      <div className="dashboardAnalyticsMobileStack">
                        <div className="dashboardAnalyticsMobileStackTitle">
                          <LuPackageSearch aria-hidden="true" />
                          <span>{t("Products")}</span>
                        </div>
                        {salesByProduct.map((row, index) => {
                          const item = row as Record<string, unknown>;
                          const amount = typeof item.totalAmount === "number" ? item.totalAmount : 0;
                          const name = typeof item.productName === "string" ? item.productName : `${t("Product")} ${index + 1}`;
                          return (
                            <div key={`${name}-${index}`} className="dashboardAnalyticsMobileStackRow">
                              <span>{name}</span>
                              <strong>Rs.{amount.toLocaleString("en-IN")}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {salesByCustomer.length > 0 && (
                      <div className="dashboardAnalyticsMobileStack">
                        <div className="dashboardAnalyticsMobileStackTitle">
                          <LuUsers aria-hidden="true" />
                          <span>{t("Customers")}</span>
                        </div>
                        {salesByCustomer.map((row, index) => {
                          const item = row as Record<string, unknown>;
                          const amount = typeof item.totalAmount === "number" ? item.totalAmount : 0;
                          const name = typeof item.customerName === "string" ? item.customerName : `${t("Customer")} ${index + 1}`;
                          return (
                            <div key={`${name}-${index}`} className="dashboardAnalyticsMobileStackRow">
                              <span>{name}</span>
                              <strong>Rs.{amount.toLocaleString("en-IN")}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {(totalSales != null || totalRevenue != null) && (
            <div className="dashboardAnalyticsCards">
              {totalSales != null && (
                <div className="dashboardAnalyticsCard">
                  <div className="dashboardAnalyticsCardTop">
                    <div className="dashboardAnalyticsCardLabel">{t("Total Sales")}</div>
                    <span className="dashboardAnalyticsCardIcon" aria-hidden="true">
                      <LuReceiptText />
                    </span>
                  </div>
                  <div className="dashboardAnalyticsCardValue">{formatValue(totalSales, t)}</div>
                </div>
              )}
              {totalRevenue != null && (
                <div className="dashboardAnalyticsCard dashboardAnalyticsCardRevenue">
                  <div className="dashboardAnalyticsCardTop">
                    <div className="dashboardAnalyticsCardLabel">{t("Total Revenue")}</div>
                    <span className="dashboardAnalyticsCardIcon" aria-hidden="true">
                      <LuBadgeDollarSign />
                    </span>
                  </div>
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
