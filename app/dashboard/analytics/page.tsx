"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  LuBadgeDollarSign,
  LuBoxes,
  LuPackageSearch,
  LuReceiptText,
  LuScale,
  LuStore,
  LuUsers,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  getDashboardSales,
  type DashboardSalesData,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import "./analytics.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];

function formatRs(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKg(weight: number | null | undefined): string {
  if (weight == null || !Number.isFinite(weight)) return "—";
  return `${weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function filterRowsByRowOutletId<T extends { outletId?: string }>(
  rows: T[],
  rowFilterOutletId: string | null,
  isScoped: boolean
): T[] {
  if (!isScoped || !rowFilterOutletId) return rows;
  return rows.filter((row) => row.outletId === rowFilterOutletId);
}

function normalizeDashboardData(raw: unknown): DashboardSalesData {
  if (raw == null || typeof raw !== "object") return {};
  const envelope = raw as Record<string, unknown>;
  const inner =
    envelope.data != null && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? (envelope.data as DashboardSalesData)
      : (envelope as DashboardSalesData);
  return inner;
}

type MetricCard = {
  key: string;
  label: string;
  value: string;
  toneClassName: string;
  Icon: typeof LuReceiptText;
};

type BreakdownTableProps = {
  title: string;
  icon: typeof LuStore;
  emptyMessage: string;
  columns: { key: string; label: string; align?: "right" }[];
  rows: Record<string, string>[];
};

function BreakdownTable({ title, icon: Icon, emptyMessage, columns, rows }: BreakdownTableProps) {
  return (
    <section className="dashboardAnalyticsTableSection">
      <div className="dashboardAnalyticsTableSectionHead">
        <Icon className="dashboardAnalyticsTableSectionIcon" aria-hidden />
        <h2 className="dashboardAnalyticsTableSectionTitle">{title}</h2>
      </div>
      <div className="dashboardAnalyticsTableWrap">
        <table className="dashboardAnalyticsTable">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.align === "right" ? "dashboardAnalyticsTableThRight" : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="dashboardAnalyticsTableEmpty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._key}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.align === "right" ? "dashboardAnalyticsTableTdRight" : undefined}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashboardAnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();

  const {
    data: dashboardRaw,
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

  const data = useMemo(() => normalizeDashboardData(dashboardRaw), [dashboardRaw]);

  const salesByOutletAll = data.salesByOutlet ?? [];
  const productRowsFull = data.salesByProduct ?? [];
  const customerRowsFull = data.salesByCustomer ?? [];

  const matchedOutletRow = useMemo(() => {
    if (!isScoped || !rowFilterOutletId) return null;
    return salesByOutletAll.find((o) => o.outletId === rowFilterOutletId) ?? null;
  }, [isScoped, rowFilterOutletId, salesByOutletAll]);

  const salesByOutlet = useMemo((): SalesByOutletItem[] => {
    if (isScoped && rowFilterOutletId) {
      return matchedOutletRow ? [matchedOutletRow] : [];
    }
    return salesByOutletAll;
  }, [isScoped, rowFilterOutletId, matchedOutletRow, salesByOutletAll]);

  const salesByProduct = useMemo(
    () =>
      filterRowsByRowOutletId(
        productRowsFull as Array<SalesByProductItem & { outletId?: string }>,
        rowFilterOutletId,
        isScoped
      ),
    [isScoped, rowFilterOutletId, productRowsFull]
  );

  const salesByCustomer = useMemo(
    () =>
      filterRowsByRowOutletId(
        customerRowsFull as Array<SalesByCustomerItem & { outletId?: string }>,
        rowFilterOutletId,
        isScoped
      ),
    [isScoped, rowFilterOutletId, customerRowsFull]
  );

  const totalTransactions = useMemo(() => {
    if (isScoped && rowFilterOutletId) return undefined;
    return data.totalTransactions;
  }, [data.totalTransactions, isScoped, rowFilterOutletId]);

  const totalRevenue = useMemo(() => {
    if (isScoped && rowFilterOutletId) return matchedOutletRow?.totalAmount;
    return data.totalRevenue;
  }, [data.totalRevenue, isScoped, matchedOutletRow, rowFilterOutletId]);

  const totalWeight = data.totalWeight;
  const totalQuantity = data.totalQuantity;

  const metricCards = useMemo((): MetricCard[] => {
    const cards: MetricCard[] = [];
    if (totalRevenue != null) {
      cards.push({
        key: "revenue",
        label: t("Total Revenue"),
        value: formatRs(totalRevenue),
        toneClassName: "dashboardAnalyticsCardRevenue",
        Icon: LuBadgeDollarSign,
      });
    }
    if (totalTransactions != null) {
      cards.push({
        key: "transactions",
        label: t("Transactions"),
        value: String(totalTransactions),
        toneClassName: "dashboardAnalyticsCardTransactions",
        Icon: LuReceiptText,
      });
    }
    if (totalWeight != null) {
      cards.push({
        key: "weight",
        label: t("Weight Sold"),
        value: formatKg(totalWeight),
        toneClassName: "dashboardAnalyticsCardWeight",
        Icon: LuScale,
      });
    }
    if (totalQuantity != null) {
      cards.push({
        key: "quantity",
        label: t("Quantity Sold"),
        value: String(totalQuantity),
        toneClassName: "dashboardAnalyticsCardQuantity",
        Icon: LuBoxes,
      });
    }
    return cards;
  }, [t, totalQuantity, totalRevenue, totalTransactions, totalWeight]);

  const maxOutletAmount = Math.max(...salesByOutlet.map((o) => o.totalAmount ?? 0), 1);
  const maxProductAmount = Math.max(...salesByProduct.map((p) => p.totalAmount ?? 0), 1);

  const productTableRows = salesByProduct.map((row) => ({
    _key: row.productId,
    name: row.productName,
    weight: formatKg(row.totalWeight),
    amount: formatRs(row.totalAmount),
  }));

  const outletTableRows = salesByOutlet.map((row) => ({
    _key: row.outletId,
    name: row.outletName,
    amount: formatRs(row.totalAmount),
  }));

  const customerTableRows = salesByCustomer.map((row, index) => ({
    _key: `${row.customerName}-${index}`,
    name: row.customerName,
    weight: formatKg(row.totalWeight),
    amount: formatRs(row.totalAmount),
  }));

  const hasBreakdown =
    salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0;

  const hasAnyData = metricCards.length > 0 || hasBreakdown;

  return (
    <section className="dashboardAnalyticsPage">
      <div className="breadcrumb">
        <span>{t("Dashboard")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Sales Dashboard")}</span>
      </div>

      <div className="dashboardAnalyticsHeader">
        <div className="dashboardAnalyticsHeaderText">
          <h1 className="pageTitle">{t("Sales Dashboard")}</h1>
          <p className="pageSubtitle">
            {t("Sales and revenue overview from dashboard.")}
          </p>
          {isScoped && rowFilterOutletId ? (
            <p className="dashboardAnalyticsScopeNote" role="status">
              {t("Showing data for the selected outlet scope.")}
            </p>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="dashboardAnalyticsMessage">{t("Loading dashboard sales…")}</div>
      ) : null}

      {isError ? (
        <div className="dashboardAnalyticsMessage dashboardAnalyticsError">
          {error instanceof Error ? error.message : t("Failed to load dashboard sales")}
        </div>
      ) : null}

      {!isLoading && !isError && (
        <>
          {metricCards.length > 0 ? (
            <div className="dashboardAnalyticsCards">
              {metricCards.map((card) => (
                <div
                  key={card.key}
                  className={`dashboardAnalyticsCard ${card.toneClassName}`}
                >
                  <div className="dashboardAnalyticsCardTop">
                    <div className="dashboardAnalyticsCardLabel">{card.label}</div>
                    <span className="dashboardAnalyticsCardIcon" aria-hidden="true">
                      <card.Icon />
                    </span>
                  </div>
                  <div className="dashboardAnalyticsCardValue">{card.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {salesByOutlet.length > 0 ? (
            <section className="dashboardAnalyticsBarSection">
              <div className="dashboardAnalyticsTableSectionHead">
                <LuStore className="dashboardAnalyticsTableSectionIcon" aria-hidden />
                <h2 className="dashboardAnalyticsTableSectionTitle">{t("Sales by outlet")}</h2>
              </div>
              <div className="dashboardAnalyticsBarList">
                {salesByOutlet.map((row) => {
                  const amount = row.totalAmount ?? 0;
                  const pct = (amount / maxOutletAmount) * 100;
                  return (
                    <div key={row.outletId} className="dashboardAnalyticsBarRow">
                      <span className="dashboardAnalyticsBarLabel">{row.outletName}</span>
                      <div className="dashboardAnalyticsBarTrack">
                        <div
                          className="dashboardAnalyticsBarFill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="dashboardAnalyticsBarValue">{formatRs(amount)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {salesByProduct.length > 0 ? (
            <section className="dashboardAnalyticsBarSection">
              <div className="dashboardAnalyticsTableSectionHead">
                <LuPackageSearch className="dashboardAnalyticsTableSectionIcon" aria-hidden />
                <h2 className="dashboardAnalyticsTableSectionTitle">{t("Sales by product")}</h2>
              </div>
              <div className="dashboardAnalyticsBarList">
                {salesByProduct.map((row) => {
                  const amount = row.totalAmount ?? 0;
                  const pct = (amount / maxProductAmount) * 100;
                  return (
                    <div key={row.productId} className="dashboardAnalyticsBarRow">
                      <span className="dashboardAnalyticsBarLabel">{row.productName}</span>
                      <div className="dashboardAnalyticsBarTrack">
                        <div
                          className="dashboardAnalyticsBarFill dashboardAnalyticsBarFillProduct"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="dashboardAnalyticsBarValue">{formatRs(amount)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="dashboardAnalyticsTablesGrid">
            <BreakdownTable
              title={t("Products breakdown")}
              icon={LuPackageSearch}
              emptyMessage={t("No product sales in this period.")}
              columns={[
                { key: "name", label: t("Product") },
                { key: "weight", label: t("Weight"), align: "right" },
                { key: "amount", label: t("Amount"), align: "right" },
              ]}
              rows={productTableRows}
            />
            <BreakdownTable
              title={t("Customers breakdown")}
              icon={LuUsers}
              emptyMessage={t("No customer sales in this period.")}
              columns={[
                { key: "name", label: t("Customer") },
                { key: "weight", label: t("Weight"), align: "right" },
                { key: "amount", label: t("Amount"), align: "right" },
              ]}
              rows={customerTableRows}
            />
          </div>

          {salesByOutlet.length > 0 ? (
            <BreakdownTable
              title={t("Outlets breakdown")}
              icon={LuStore}
              emptyMessage={t("No outlet sales in this period.")}
              columns={[
                { key: "name", label: t("Outlet") },
                { key: "amount", label: t("Amount"), align: "right" },
              ]}
              rows={outletTableRows}
            />
          ) : null}

          {!hasAnyData ? (
            <div className="dashboardAnalyticsMessage">
              {t("No dashboard sales data available.")}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
