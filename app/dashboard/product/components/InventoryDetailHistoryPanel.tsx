"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MdInventory2,
  MdRemoveCircleOutline,
  MdSearch,
  MdTrendingDown,
} from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  formatLivestockHistoryAmount,
  getLivestockInventoryHistory,
  getLivestockWasteHistory,
  getProcessedProductWasteHistory,
  type LivestockInventoryHistoryEntry,
  type LivestockWasteHistoryEntry,
} from "@/handlers/product";
import { getSalesByProductId, type SaleTransaction } from "@/handlers/sale";
import { DUMMY_WASTE_TABLE_ROWS, SHOW_DUMMY_WASTE_WHEN_EMPTY } from "@/app/dashboard/product/lib/inventoryDetailMocks";
import {
  isDateInRange,
  toIsoDateLocal,
} from "@/app/dashboard/product/lib/inventoryDetailDateRange";

export type InventoryDetailHistoryVariant = "livestock" | "processed";

type InventoryDetailHistoryPanelProps = {
  variant: InventoryDetailHistoryVariant;
  /** Livestock record id or processed product id for waste API. */
  wasteHistoryId: string | null;
  /**
   * When false (live stock detail shell), Storage history omits fromDate/toDate on the API;
   * Consumed and Waste still use the date filter.
   * @default true
   */
  dateFilterAffectsStorage?: boolean;
  /** Product-detail-style: tab icons, scrollable tables, 4-col storage, filter hint. */
  productShellStyle?: boolean;
  /** Shown in storage “selling price” column when a row has no sellingPrice from the API. */
  storagePriceFallback?: number;
  /** Cumulative waste weight from GET products when the backend exposes it. */
  processedCumulativeWasteKg?: number | null;
};

type HistoryTabId = "storage" | "consumed" | "waste";

type TabDef = { id: HistoryTabId; label: string; Icon?: typeof MdInventory2 };

function formatHistoryDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString();
}

function formatPriceCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function localCalendarDayFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    const s = iso.trim();
    return s.length >= 10 ? s.slice(0, 10) : "";
  }
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function saleCalendarDay(tx: SaleTransaction): string {
  return localCalendarDayFromIso(tx.createdAt ?? tx.date ?? "");
}

function transactionWeightKg(tx: SaleTransaction): number {
  const items = tx.items;
  if (!Array.isArray(items) || items.length === 0) return 0;
  let sum = 0;
  for (const i of items) {
    const w = i.weight;
    if (typeof w === "number" && Number.isFinite(w)) sum += w;
  }
  return sum;
}

function saleCustomerTypeLabel(tx: SaleTransaction): string {
  if (typeof tx.type === "string" && tx.type.trim()) return tx.type.trim();
  if (tx.type && typeof tx.type === "object" && "name" in tx.type) {
    const n = (tx.type as { name?: string }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  const ct = tx.customerType;
  if (typeof ct === "string" && ct.trim()) return ct.trim();
  if (ct && typeof ct === "object" && "name" in ct) {
    const n = (ct as { name?: string }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return typeof tx.name === "string" && tx.name.trim() ? tx.name.trim() : "\u2014";
}

export default function InventoryDetailHistoryPanel({
  variant,
  wasteHistoryId,
  dateFilterAffectsStorage = true,
  productShellStyle = false,
  storagePriceFallback,
  processedCumulativeWasteKg = null,
}: InventoryDetailHistoryPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isLivestock = variant === "livestock";

  const defaultTo = useMemo(() => toIsoDateLocal(new Date()), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toIsoDateLocal(d);
  }, []);

  const [fromInput, setFromInput] = useState(defaultFrom);
  const [toInput, setToInput] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);
  const [activeTab, setActiveTab] = useState<HistoryTabId>("storage");
  const [rangeInvalid, setRangeInvalid] = useState(false);

  const storageUsesDateRange = !isLivestock || dateFilterAffectsStorage;
  const storageDateKey = storageUsesDateRange ? `${appliedFrom}_${appliedTo}` : "all";

  const {
    data: restockHistory = [],
    isPending: restockHistoryPending,
    isError: restockHistoryError,
  } = useQuery({
    queryKey: ["livestockInventoryHistory", "RESTOCK", wasteHistoryId, storageDateKey],
    enabled: isLivestock,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getLivestockInventoryHistory({
        livestockItemId: wasteHistoryId ?? undefined,
        type: "RESTOCK",
        ...(storageUsesDateRange
          ? { fromDate: appliedFrom, toDate: appliedTo }
          : {}),
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: deductHistory = [],
    isPending: deductHistoryPending,
    isError: deductHistoryError,
  } = useQuery({
    queryKey: ["livestockInventoryHistory", "DEDUCT", wasteHistoryId, appliedFrom, appliedTo],
    enabled: isLivestock,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getLivestockInventoryHistory({
        livestockItemId: wasteHistoryId ?? undefined,
        type: "DEDUCT",
        fromDate: appliedFrom,
        toDate: appliedTo,
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const processedPanelEnabled = !isLivestock && Boolean(wasteHistoryId);

  const {
    data: processedSalesByProduct = [],
    isPending: processedSalesPending,
    isError: processedSalesError,
  } = useQuery({
    queryKey: ["salesByProductId", "inventoryDetail", wasteHistoryId],
    enabled: processedPanelEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getSalesByProductId(wasteHistoryId!);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: wasteEntriesRaw = [],
    isPending: wastePending,
    isError: wasteError,
  } = useQuery({
    queryKey: [
      "inventoryDetailWasteHistory",
      variant,
      wasteHistoryId,
      appliedFrom,
      appliedTo,
    ],
    enabled: Boolean(wasteHistoryId) && isLivestock,
    staleTime: 30_000,
    queryFn: async () => {
      const range = { from: appliedFrom, to: appliedTo };
      if (variant === "livestock") {
        const result = await getLivestockWasteHistory(wasteHistoryId!, range);
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        return result.data;
      }
      const result = await getProcessedProductWasteHistory(wasteHistoryId!, range);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const wasteEntriesFiltered = useMemo(
    () =>
      wasteEntriesRaw.filter((row) =>
        isDateInRange(row.date, appliedFrom, appliedTo)
      ),
    [wasteEntriesRaw, appliedFrom, appliedTo]
  );

  const processedSalesInDateRange = useMemo(
    () =>
      processedSalesByProduct.filter((tx) => {
        const day = saleCalendarDay(tx);
        return day && day >= appliedFrom && day <= appliedTo;
      }),
    [processedSalesByProduct, appliedFrom, appliedTo]
  );

  const wasteTableRows: LivestockWasteHistoryEntry[] = useMemo(() => {
    if (!isLivestock) return [];
    if (wastePending) return [];
    const mapDummy = (): LivestockWasteHistoryEntry[] =>
      DUMMY_WASTE_TABLE_ROWS.map((r, i) => ({
        id: `dummy-waste-${i}`,
        date: r.date,
        quantity: r.quantity,
        remarks: r.remarks,
      }));
    const dummyInRange = () =>
      mapDummy().filter((row) => isDateInRange(row.date, appliedFrom, appliedTo));
    if (wasteError) {
      const filtered = dummyInRange();
      return filtered.length > 0 ? filtered : mapDummy();
    }
    if (wasteEntriesFiltered.length > 0) return wasteEntriesFiltered;
    if (SHOW_DUMMY_WASTE_WHEN_EMPTY) {
      const filtered = dummyInRange();
      return filtered.length > 0 ? filtered : mapDummy();
    }
    return [];
  }, [
    wastePending,
    wasteError,
    wasteEntriesFiltered,
    appliedFrom,
    appliedTo,
    isLivestock,
  ]);

  const handleApplyFilter = () => {
    if (fromInput > toInput) {
      setRangeInvalid(true);
      return;
    }
    setRangeInvalid(false);
    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
  };

  const tabs: TabDef[] = useMemo(
    () => [
      {
        id: "storage",
        label: t("Storage History"),
        Icon: productShellStyle ? MdInventory2 : undefined,
      },
      {
        id: "consumed",
        label: t("Consumed History"),
        Icon: productShellStyle ? MdTrendingDown : undefined,
      },
      {
        id: "waste",
        label: t("Waste History"),
        Icon: productShellStyle ? MdRemoveCircleOutline : undefined,
      },
    ],
    [t, productShellStyle]
  );

  const renderLivestockMovementRows = (rows: LivestockInventoryHistoryEntry[]) =>
    rows.map((row) => {
      const amt = formatLivestockHistoryAmount(row);
      return (
        <tr key={row.id}>
          <td>{formatHistoryDateTime(row.createdAt)}</td>
          <td>
            <span
              className={
                row.type === "RESTOCK"
                  ? "inventoryDetailTypeBadge inventoryDetailTypeBadgeRestock"
                  : "inventoryDetailTypeBadge inventoryDetailTypeBadgeDeduct"
              }
            >
              {row.type === "RESTOCK" ? t("Restock") : t("Deduct")}
            </span>
          </td>
          <td>{row.livestockItem.name}</td>
          <td>{amt.display}</td>
        </tr>
      );
    });

  const renderLivestockStorageProductShellRows = (rows: LivestockInventoryHistoryEntry[]) =>
    rows.map((row) => {
      const amt = formatLivestockHistoryAmount(row);
      const selling =
        row.sellingPrice != null && Number.isFinite(row.sellingPrice)
          ? row.sellingPrice
          : storagePriceFallback;
      return (
        <tr key={row.id} className="inventoryDetailTableRowFixed">
          <td>{formatHistoryDateTime(row.createdAt)}</td>
          <td>{amt.display}</td>
          <td>{formatPriceCell(row.buyingPrice)}</td>
          <td>{formatPriceCell(selling ?? null)}</td>
        </tr>
      );
    });

  const tableScrollClass =
    productShellStyle && isLivestock ? "inventoryDetailTableScroll" : "";

  const storageEmptyMessage =
    isLivestock && productShellStyle && !storageUsesDateRange
      ? t("No storage history records.")
      : t("No stock history in this range.");

  const panelClass = [
    "inventoryDetailHistoryPanel",
    productShellStyle && isLivestock ? "inventoryDetailHistoryPanelProductShell" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClass}>
      {productShellStyle && isLivestock && !dateFilterAffectsStorage && (
        <p className="inventoryDetailDateScopeHint" role="note">
          {t("Date range applies to Consumed and Waste history only.")}
        </p>
      )}
      {!isLivestock && (
        <p className="inventoryDetailDateScopeHint" role="note">
          {t("Date range applies to consumed (sales) history. Storage and waste tabs summarize API limits.")}
        </p>
      )}
      <div className="inventoryDetailDateRow">
        <div className="inventoryDetailDateField">
          <label className="inventoryDetailDateLabel" htmlFor="inv-detail-from">
            {t("Date from")}
          </label>
          <input
            id="inv-detail-from"
            type="date"
            className="inventoryDetailDateInput"
            value={fromInput}
            onChange={(e) => {
              setFromInput(e.target.value);
              setRangeInvalid(false);
            }}
          />
        </div>
        <div className="inventoryDetailDateField">
          <label className="inventoryDetailDateLabel" htmlFor="inv-detail-to">
            {t("Date to")}
          </label>
          <input
            id="inv-detail-to"
            type="date"
            className="inventoryDetailDateInput"
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              setRangeInvalid(false);
            }}
          />
        </div>
        <button
          type="button"
          className="inventoryDetailFilterBtn"
          onClick={handleApplyFilter}
        >
          {productShellStyle && isLivestock ? (
            <span className="inventoryDetailFilterBtnInner">
              <MdSearch className="inventoryDetailFilterIcon" aria-hidden />
              {t("Filter")}
            </span>
          ) : (
            t("Filter")
          )}
        </button>
      </div>
      {rangeInvalid && (
        <p className="inventoryDetailRangeError" role="alert">
          {t("End date must be on or after start date.")}
        </p>
      )}

      <div
        className={
          productShellStyle && isLivestock
            ? "inventoryDetailTabs inventoryDetailTabsProductShell"
            : "inventoryDetailTabs"
        }
        role="tablist"
        aria-label={t("History tabs")}
      >
        {tabs.map((tab) => {
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`inv-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`inv-panel-${tab.id}`}
              className={
                activeTab === tab.id
                  ? "inventoryDetailTab inventoryDetailTabActive"
                  : "inventoryDetailTab"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {Icon && <Icon className="inventoryDetailTabIcon" aria-hidden />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "storage" && (
        <div
          id="inv-panel-storage"
          role="tabpanel"
          aria-labelledby="inv-tab-storage"
          className="inventoryDetailTabPanel"
        >
          {isLivestock ? (
            restockHistoryPending ? (
              <p className="productsMessage">{t("Loading stock history…")}</p>
            ) : restockHistoryError ? (
              <p className="inventoryDetailRangeError" role="alert">
                {t("Failed to load stock history")}
              </p>
            ) : restockHistory.length === 0 ? (
              productShellStyle ? (
                <div className="inventoryDetailEmptyWithIcon" role="status">
                  <MdInventory2 className="inventoryDetailEmptyIcon" aria-hidden />
                  <p className="inventoryDetailEmptyTab">{storageEmptyMessage}</p>
                </div>
              ) : (
                <p className="inventoryDetailEmptyTab">{storageEmptyMessage}</p>
              )
            ) : (
              <div className={`inventoryDetailSampleTableWrap ${tableScrollClass}`.trim()}>
                <table className="inventoryDetailSampleTable">
                  <thead>
                    <tr>
                      {productShellStyle ? (
                        <>
                          <th>{t("Column date")}</th>
                          <th>{t("Column quantity")}</th>
                          <th>{t("Buying price")}</th>
                          <th>{t("Selling price")}</th>
                        </>
                      ) : (
                        <>
                          <th>{t("Column date")}</th>
                          <th>{t("Column type")}</th>
                          <th>{t("Column item")}</th>
                          <th>{t("Column amount")}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {productShellStyle
                      ? renderLivestockStorageProductShellRows(restockHistory)
                      : renderLivestockMovementRows(restockHistory)}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <>
              <p className="inventoryDetailSampleBanner" role="status">
                {t(
                  "There is no API to list storage-in events for processed products. Restocks only update current weight; processing completions are stored in the database but are not exposed as rows here."
                )}
              </p>
              <p className="inventoryDetailEmptyTab">{t("No storage history records.")}</p>
            </>
          )}
        </div>
      )}

      {activeTab === "consumed" && (
        <div
          id="inv-panel-consumed"
          role="tabpanel"
          aria-labelledby="inv-tab-consumed"
          className="inventoryDetailTabPanel"
        >
          {isLivestock ? (
            deductHistoryPending ? (
              <p className="productsMessage">{t("Loading stock history…")}</p>
            ) : deductHistoryError ? (
              <p className="inventoryDetailRangeError" role="alert">
                {t("Failed to load stock history")}
              </p>
            ) : deductHistory.length === 0 ? (
              productShellStyle ? (
                <div className="inventoryDetailEmptyWithIcon" role="status">
                  <MdTrendingDown className="inventoryDetailEmptyIcon" aria-hidden />
                  <p className="inventoryDetailEmptyTab">{t("No stock history in this range.")}</p>
                </div>
              ) : (
                <p className="inventoryDetailEmptyTab">{t("No stock history in this range.")}</p>
              )
            ) : (
              <div className={`inventoryDetailSampleTableWrap ${tableScrollClass}`.trim()}>
                <table className="inventoryDetailSampleTable">
                  <thead>
                    <tr>
                      <th>{t("Column date")}</th>
                      <th>{t("Column type")}</th>
                      <th>{t("Column item")}</th>
                      <th>{t("Column amount")}</th>
                    </tr>
                  </thead>
                  <tbody>{renderLivestockMovementRows(deductHistory)}</tbody>
                </table>
              </div>
            )
          ) : (
            <>
              <p className="inventoryDetailSampleBanner" role="status">
                {t(
                  "Consumed history lists sales for this product in the selected date range. Manual product deducts are not included."
                )}
              </p>
              {processedSalesPending ? (
                <p className="productsMessage">{t("Loading stock history…")}</p>
              ) : processedSalesError ? (
                <p className="inventoryDetailRangeError" role="alert">
                  {t("Failed to load sales for this product.")}
                </p>
              ) : processedSalesInDateRange.length === 0 ? (
                <p className="inventoryDetailEmptyTab">{t("No sales in this date range.")}</p>
              ) : (
                <div className="inventoryDetailSampleTableWrap">
                  <table className="inventoryDetailSampleTable">
                    <thead>
                      <tr>
                        <th>{t("Column date")}</th>
                        <th>{t("Column type")}</th>
                        <th>{t("Column item")}</th>
                        <th>{t("Weight (kg)")}</th>
                        <th>{t("Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedSalesInDateRange.map((tx) => {
                        const iso = tx.createdAt ?? tx.date ?? "";
                        const wkg = transactionWeightKg(tx);
                        const amt = tx.totalAmount ?? tx.amount ?? tx.total;
                        return (
                          <tr key={tx.id || tx.transactionId || iso}>
                            <td>{iso ? formatHistoryDateTime(iso) : "\u2014"}</td>
                            <td>
                              <span className="inventoryDetailTypeBadge inventoryDetailTypeBadgeDeduct">
                                {t("Sale")}
                              </span>
                            </td>
                            <td>{saleCustomerTypeLabel(tx)}</td>
                            <td>{wkg > 0 ? String(wkg) : "\u2014"}</td>
                            <td>{formatPriceCell(typeof amt === "number" ? amt : null)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "waste" && (
        <div
          id="inv-panel-waste"
          role="tabpanel"
          aria-labelledby="inv-tab-waste"
          className="inventoryDetailTabPanel"
        >
          {!wasteHistoryId ? (
            <p className="inventoryDetailEmptyTab">
              {variant === "processed"
                ? t("Unable to load waste history: missing product ID.")
                : t("Unable to load waste history: missing item record ID from API.")}
            </p>
          ) : variant === "processed" ? (
            <>
              <p className="inventoryDetailSampleBanner" role="status">
                {t(
                  "There is no API for per-date processing waste. Cumulative waste on the product (when returned by GET products) is shown below when available."
                )}
              </p>
              {processedCumulativeWasteKg != null && Number.isFinite(processedCumulativeWasteKg) ? (
                <p className="inventoryDetailEmptyTab">
                  <strong>{t("Cumulative waste (on product)")}:</strong>{" "}
                  {String(processedCumulativeWasteKg)} kg
                </p>
              ) : (
                <p className="inventoryDetailEmptyTab">{t("No waste history records.")}</p>
              )}
            </>
          ) : wastePending ? (
            <p className="productsMessage">{t("Loading waste history…")}</p>
          ) : wasteTableRows.length === 0 ? (
            productShellStyle && isLivestock ? (
              <div className="inventoryDetailEmptyWithIcon" role="status">
                <MdRemoveCircleOutline className="inventoryDetailEmptyIcon inventoryDetailEmptyIconWaste" aria-hidden />
                <p className="inventoryDetailEmptyTab">{t("No waste history records.")}</p>
              </div>
            ) : (
              <p className="inventoryDetailEmptyTab">{t("No waste history records.")}</p>
            )
          ) : (
            <>
              {(wasteError || (wasteEntriesFiltered.length === 0 && SHOW_DUMMY_WASTE_WHEN_EMPTY)) && (
                <p className="inventoryDetailSampleBanner" role="status">
                  {wasteError
                    ? t("Waste history is not available yet.")
                    : t("Sample waste entries shown until API returns data.")}
                </p>
              )}
              <div className={`inventoryDetailSampleTableWrap ${tableScrollClass}`.trim()}>
                <table className="inventoryDetailSampleTable">
                  <thead>
                    <tr>
                      <th>{t("Column date")}</th>
                      <th>{t("Column quantity")}</th>
                      <th>{t("Remarks")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasteTableRows.map((row) => (
                      <tr key={row.id} className="inventoryDetailTableRowFixed">
                        <td>{row.date}</td>
                        <td>{row.quantity}</td>
                        <td>{row.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
