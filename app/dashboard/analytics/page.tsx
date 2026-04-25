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
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { getDashboardSales } from "@/handlers/sale";
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

function filterRowsByRowOutletId<T>(rows: T[] | undefined, rowFilterOutletId: string | null, isScoped: boolean): T[] {
  if (!isScoped || !rowFilterOutletId || !Array.isArray(rows) || rows.length === 0) {
    return Array.isArray(rows) ? rows : [];
  }
  return rows.filter((row) => {
    if (row == null || typeof row !== "object" || !("outletId" in row)) return false;
    const id = (row as { outletId: unknown }).outletId;
    return typeof id === "string" && id === rowFilterOutletId;
  });
}

export default function DashboardAnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
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

  const salesByOutletAll = useMemo(
    () => (Array.isArray(data.salesByOutlet) ? data.salesByOutlet : []),
    [data.salesByOutlet]
  );
  const matchedOutletRow = useMemo(() => {
    if (!isScoped || !rowFilterOutletId) return null;
    return salesByOutletAll.find(
      (o) => isPlainObject(o) && (o as { outletId?: string }).outletId === rowFilterOutletId
    ) as Record<string, unknown> | null | undefined;
  }, [isScoped, rowFilterOutletId, salesByOutletAll]);

  const salesByOutlet = useMemo(() => {
    if (isScoped && rowFilterOutletId) {
      return matchedOutletRow != null && isPlainObject(matchedOutletRow) ? [matchedOutletRow] : [];
    }
    return salesByOutletAll.slice(0, 3) as unknown[];
  }, [isScoped, rowFilterOutletId, matchedOutletRow, salesByOutletAll]);

  const productRowsFull = useMemo(
    () => (Array.isArray(data.salesByProduct) ? data.salesByProduct : []),
    [data.salesByProduct]
  );
  const customerRowsFull = useMemo(
    () => (Array.isArray(data.salesByCustomer) ? data.salesByCustomer : []),
    [data.salesByCustomer]
  );

  const salesByProduct = useMemo(
    () =>
      (isScoped && rowFilterOutletId
        ? filterRowsByRowOutletId(productRowsFull, rowFilterOutletId, isScoped)
        : productRowsFull
      ).slice(0, 3),
    [isScoped, rowFilterOutletId, productRowsFull]
  );
  const salesByCustomer = useMemo(
    () =>
      (isScoped && rowFilterOutletId
        ? filterRowsByRowOutletId(customerRowsFull, rowFilterOutletId, isScoped)
        : customerRowsFull
      ).slice(0, 3),
    [isScoped, rowFilterOutletId, customerRowsFull]
  );

  const orgTotalSales = data.totalSales ?? data.totalOrders ?? data.totalTransactions;
  const orgTotalRevenue = data.totalRevenue ?? data.revenue;

  /** When scoped, prefer per-outlet row; top-level totals are org-wide. */
  const totalSales = (() => {
    if (!isScoped || !rowFilterOutletId) return orgTotalSales;
    if (matchedOutletRow == null) return undefined;
    const tx = (matchedOutletRow as Record<string, unknown>).totalTransactions;
    if (typeof tx === "number") return tx;
    return undefined;
  })();

  const totalRevenue = (() => {
    if (!isScoped || !rowFilterOutletId) return orgTotalRevenue;
    if (matchedOutletRow == null) return undefined;
    const a = (matchedOutletRow as Record<string, unknown>).totalAmount;
    return typeof a === "number" ? a : undefined;
  })();

  const viewData = useMemo((): Record<string, unknown> => {
    if (!isScoped) return { ...data };
    return {
      ...data,
      totalRevenue,
      totalSales,
      salesByOutlet: matchedOutletRow != null && isPlainObject(matchedOutletRow) ? [matchedOutletRow] : [],
      salesByProduct: filterRowsByRowOutletId(
        productRowsFull as unknown[],
        rowFilterOutletId,
        isScoped
      ),
      salesByCustomer: filterRowsByRowOutletId(
        customerRowsFull as unknown[],
        rowFilterOutletId,
        isScoped
      ),
    };
  }, [
    data,
    isScoped,
    totalRevenue,
    totalSales,
    matchedOutletRow,
    productRowsFull,
    customerRowsFull,
    rowFilterOutletId,
  ]);

  const dataForDisplay = isScoped ? viewData : data;

  const dataEntries = useMemo(
    () => Object.entries(dataForDisplay),
    [dataForDisplay]
  );
  const featuredStats = useMemo(
    () =>
      isScoped && rowFilterOutletId
        ? []
        : dataEntries
            .filter(
              ([key, value]) =>
                !["totalSales", "totalOrders", "totalTransactions", "totalRevenue", "revenue", "_orgTotalRevenue"].includes(
                  key
                )
            )
            .filter(([, value]) => !Array.isArray(value) && !isPlainObject(value))
            .slice(0, 4),
    [isScoped, rowFilterOutletId, dataEntries]
  );
  const collectionStats = useMemo(
    () =>
      dataEntries
        .filter(([, value]) => Array.isArray(value) || isPlainObject(value))
        .map(([key, value]) => ({
          key,
          count: Array.isArray(value) ? value.length : Object.keys(value as object).length,
        }))
        .slice(0, 4),
    [dataEntries]
  );

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
          {isPlainObject(dataForDisplay) && Object.keys(dataForDisplay).length > 0 && (
            <div className="dashboardAnalyticsData">
              <h2 className="dashboardAnalyticsDataTitle">{t("Dashboard data")}</h2>
              <dl className="dashboardAnalyticsDataList">
                {Object.entries(dataForDisplay).map(([key, value]) => (
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
          {(!isPlainObject(dataForDisplay) || Object.keys(dataForDisplay).length === 0) &&
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
