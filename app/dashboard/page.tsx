"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getLivestockItemsByProduct,
  getProducts,
  type LivestockItem,
  type Product,
} from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import {
  getDashboardSales,
  getLivestockSales,
  type DashboardSalesData,
  type LivestockSale,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import "./dashboard.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const LIVESTOCK_SALES_QUERY_KEY = ["livestockSales"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];

const STATIC_ATTENDANCE_PREVIEW = [
  { name: "John Smith", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "Maria Garcia", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "David Chen", clockIn: "—", clockOut: "—", status: "Absent" as const },
];

function resolveLivestockItemId(item: LivestockItem): string | null {
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof (item as { _id?: unknown })._id === "string"
    ? (((item as unknown) as { _id: string })._id)
    : null;
  const fromLivestockItemId =
    typeof (item as { livestockItemId?: unknown }).livestockItemId === "string"
      ? (((item as unknown) as { livestockItemId: string }).livestockItemId)
      : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

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

  const {
    data: livestockSales = [],
    isLoading: livestockSalesLoading,
    isError: livestockSalesError,
    error: livestockSalesErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: productTypes = [] } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const liveTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (LIVE_PRODUCT_TYPE_NAMES.includes(pt.name.toLowerCase())) ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const liveStockProducts = useMemo(
    () =>
      products.filter((p: Product) => {
        const productTypeName =
          typeof p.productType === "object" && typeof p.productType?.name === "string"
            ? p.productType.name.toLowerCase()
            : "";
        return liveTypeIds.has(p.productTypeId) || LIVE_PRODUCT_TYPE_NAMES.includes(productTypeName);
      }),
    [products, liveTypeIds]
  );

  const liveStockProductIds = useMemo(
    () => liveStockProducts.map((product) => product.id).sort(),
    [liveStockProducts]
  );

  const { data: livestockItems = [] } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
    enabled: liveStockProductIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        liveStockProductIds.map((productId) => getLivestockItemsByProduct(productId))
      );
      const merged: LivestockItem[] = [];
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        merged.push(...result.data);
      }
      const seen = new Set<string>();
      return merged.filter((item) => {
        const id = resolveLivestockItemId(item) ?? `${item.productId}-${item.itemId}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
  });

  const salesData: DashboardSalesData | undefined = salesResponse?.data;
  const apiTotalRevenue = salesData?.totalRevenue ?? 0;
  const apiTotalTransactions = salesData?.totalTransactions ?? 0;
  const apiTotalWeight = salesData?.totalWeight ?? 0;
  const apiTotalQuantity = salesData?.totalQuantity ?? 0;
  const salesByOutlet = (salesData?.salesByOutlet ?? []).slice(0, 5);
  const salesByProduct = (salesData?.salesByProduct ?? []).slice(0, 5);
  const salesByCustomer = (salesData?.salesByCustomer ?? []).slice(0, 5);

  const livestockOptions = useMemo(() => {
    return livestockItems
      .map((item) => {
        const id = resolveLivestockItemId(item);
        if (!id) return null;
        return {
          value: id,
          label: `${item.itemId} - ${item.name}`,
        };
      })
      .filter((option): option is { value: string; label: string } => option != null);
  }, [livestockItems]);

  const livestockOptionMap = useMemo(
    () => new Map(livestockOptions.map((option) => [option.value, option.label])),
    [livestockOptions]
  );

  const getLivestockDisplay = (sale: LivestockSale): string => {
    const id = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
    if (id && livestockOptionMap.has(id)) return livestockOptionMap.get(id) ?? id;

    const firstItem =
      Array.isArray(sale.items) && sale.items.length > 0 && typeof sale.items[0] === "object"
        ? (sale.items[0] as Record<string, unknown>)
        : null;
    const livestockItemObj =
      firstItem && typeof firstItem.livestockItem === "object"
        ? (firstItem.livestockItem as Record<string, unknown>)
        : null;
    const itemId =
      (typeof livestockItemObj?.itemId === "string" && livestockItemObj.itemId) ||
      (typeof firstItem?.itemId === "string" && firstItem.itemId) ||
      "";
    const itemName =
      (typeof livestockItemObj?.name === "string" && livestockItemObj.name) ||
      (typeof firstItem?.name === "string" && firstItem.name) ||
      "";

    if (itemId || itemName) return [itemId, itemName].filter(Boolean).join(" - ");
    return id || "-";
  };

  const livestockRevenue = livestockSales.reduce(
    (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
    0
  );
  const livestockWeight = livestockSales.reduce(
    (sum, row) => sum + (typeof row.weight === "number" ? row.weight : 0),
    0
  );
  const livestockQuantity = livestockSales.length;
  const livestockTransactions = livestockSales.length;

  const totalRevenue = apiTotalRevenue + livestockRevenue;
  const totalTransactions = apiTotalTransactions + livestockTransactions;
  const totalWeight = apiTotalWeight + livestockWeight;
  const totalQuantity = apiTotalQuantity + livestockQuantity;

  const livestockSalesRows = [...livestockSales]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

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

            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Live Stock Sale Details")}</h3>
              {livestockSalesLoading && (
                <div className="dashboardBlock dashboardMessage dashboardMessageInline">
                  {t("Loading sales…")}
                </div>
              )}
              {livestockSalesError && (
                <div className="dashboardBlock dashboardMessage dashboardError dashboardMessageInline">
                  {livestockSalesErrorDetail instanceof Error
                    ? livestockSalesErrorDetail.message
                    : t("Failed to load sales")}
                </div>
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length === 0 && (
                <div className="dashboardBlock dashboardMessage dashboardMessageInline">
                  {t("No live stock sales yet.")}
                </div>
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length > 0 && (
                <div className="dashboardSalesTableWrap">
                  <table className="dashboardSalesTable">
                    <thead>
                      <tr>
                        <th>{t("Name")}</th>
                        <th>{t("Contact")}</th>
                        <th>{t("Livestock Item")}</th>
                        <th>{t("Weight")}</th>
                        <th>{t("Amount")}</th>
                        <th>{t("Date")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {livestockSalesRows.map((row: LivestockSale, index) => {
                        const rowDate = row.createdAt ?? row.date;
                        return (
                          <tr key={`${row.id ?? row.transactionId ?? "ls"}-${index}`}>
                            <td>{row.name ?? "-"}</td>
                            <td>{row.contact ?? "-"}</td>
                            <td>{getLivestockDisplay(row)}</td>
                            <td>{row.weight ?? "-"}</td>
                            <td>
                              {typeof row.amount === "number"
                                ? `Rs.${row.amount.toLocaleString("en-IN")}`
                                : "-"}
                            </td>
                            <td>{rowDate ? new Date(rowDate).toLocaleString() : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
