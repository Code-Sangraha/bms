"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/app/providers/AuthProvider";
import { canRecordExpensePayment } from "@/lib/billing/expensePaymentUi";
import ExpenseRecordPaymentButton from "@/app/dashboard/shared/ExpenseRecordPaymentButton";
import {
  MdInventory2,
  MdPayments,
  MdRemoveCircleOutline,
  MdSearch,
  MdTrendingDown,
} from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  formatLivestockHistoryAmount,
  formatProcessedHistoryAmount,
  getLivestockExpenseHistory,
  getLivestockInventoryHistory,
  getLivestockWasteHistory,
  getProcessedInventoryHistory,
  getProcessedWasteHistory,
  type LivestockExpenseHistoryEntry,
  type LivestockInventoryHistoryEntry,
  type LivestockWasteHistoryEntry,
  type ProcessedInventoryHistoryEntry,
  type PaymentStatus,
} from "@/handlers/product";
import { DUMMY_WASTE_TABLE_ROWS, SHOW_DUMMY_WASTE_WHEN_EMPTY } from "@/app/dashboard/product/lib/inventoryDetailMocks";
import {
  isDateInRange,
  toIsoDateLocal,
} from "@/app/dashboard/product/lib/inventoryDetailDateRange";
import {
  livestockMovementLabel,
  processedMovementLabel,
} from "@/app/dashboard/product/lib/inventoryMovementAdapter";

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
  /** Shown in storage selling price column when a row has no sellingPrice from the API. */
  storagePriceFallback?: number;
  /** Current `Product.weight` (kg) for this outlet SKU, shown on processed storage tab per inventory doc. */
  currentStockWeightKg?: number | null;
  /** Livestock item id for expense history tab; defaults to `wasteHistoryId`. */
  livestockItemId?: string | null;
};

type HistoryTabId = "storage" | "consumed" | "waste" | "expense";

type TabDef = { id: HistoryTabId; label: string; Icon?: typeof MdInventory2 };

const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  ADVANCE: "livestockDetailModalBadge livestockDetailModalBadgeAdvance",
  PARTIAL: "livestockDetailModalBadge livestockDetailModalBadgePartial",
  FULL: "livestockDetailModalBadge livestockDetailModalBadgeFull",
};

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

function processedHistoryProductName(row: ProcessedInventoryHistoryEntry): string {
  return row.product?.name?.trim() ? row.product.name : "\u2014";
}

function processedHistoryCalendarDay(row: ProcessedInventoryHistoryEntry): string {
  return localCalendarDayFromIso(row.createdAt);
}

export default function InventoryDetailHistoryPanel({
  variant,
  wasteHistoryId,
  dateFilterAffectsStorage = true,
  productShellStyle = false,
  storagePriceFallback,
  currentStockWeightKg = null,
  livestockItemId: livestockItemIdProp = null,
}: InventoryDetailHistoryPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { capabilities } = usePermissions();
  const canRecordPayment = capabilities.canRestockLivestockInventory;
  const [expenseToPay, setExpenseToPay] = useState<LivestockExpenseHistoryEntry | null>(null);
  const isLivestock = variant === "livestock";
  const expenseItemId = livestockItemIdProp ?? wasteHistoryId;

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
    queryKey: ["livestockInventoryHistory", "CONSUMED", wasteHistoryId, appliedFrom, appliedTo],
    enabled: isLivestock,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getLivestockInventoryHistory({
        livestockItemId: wasteHistoryId ?? undefined,
        type: "CONSUMED",
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

  const {
    data: expenseHistory = [],
    isPending: expenseHistoryPending,
    isError: expenseHistoryError,
  } = useQuery({
    queryKey: [
      "livestockExpenseHistory",
      expenseItemId,
      appliedFrom,
      appliedTo,
    ],
    enabled: isLivestock && Boolean(expenseItemId),
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getLivestockExpenseHistory({
        livestockItemId: expenseItemId ?? undefined,
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
    data: processedStorageInRows = [],
    isPending: processedStoragePending,
    isError: processedStorageError,
  } = useQuery({
    queryKey: [
      "processedInventoryHistory",
      "RESTOCK",
      wasteHistoryId,
      appliedFrom,
      appliedTo,
    ],
    enabled: processedPanelEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getProcessedInventoryHistory({
        productId: wasteHistoryId!,
        type: "RESTOCK",
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

  const {
    data: processedConsumedRows = [],
    isPending: processedConsumedPending,
    isError: processedConsumedError,
  } = useQuery({
    queryKey: [
      "processedInventoryHistory",
      "SALE",
      wasteHistoryId,
      appliedFrom,
      appliedTo,
    ],
    enabled: processedPanelEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getProcessedInventoryHistory({
        productId: wasteHistoryId!,
        type: "SALE",
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
    enabled: Boolean(wasteHistoryId),
    staleTime: 30_000,
    queryFn: async () => {
      const range = { from: appliedFrom, to: appliedTo };
      const result =
        variant === "processed"
          ? await getProcessedWasteHistory(wasteHistoryId!, range)
          : await getLivestockWasteHistory(wasteHistoryId!, range);
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

  const wasteTableRows: LivestockWasteHistoryEntry[] = useMemo(() => {
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
    () => {
      const base: TabDef[] = [
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
      ];
      base.push({
        id: "waste",
        label: t("Waste History"),
        Icon: productShellStyle ? MdRemoveCircleOutline : undefined,
      });
      if (isLivestock) {
        base.push({
          id: "expense",
          label: t("Expense"),
          Icon: productShellStyle ? MdPayments : undefined,
        });
      }
      return base;
    },
    [t, productShellStyle, isLivestock]
  );

  const paymentStatusLabel: Record<PaymentStatus, string> = {
    ADVANCE: t("Advance"),
    PARTIAL: t("Partial"),
    FULL: t("Full"),
  };

  const renderExpenseRows = (rows: LivestockExpenseHistoryEntry[]) =>
    rows.map((row) => (
      <tr key={row.id} className="inventoryDetailTableRowFixed">
        <td>{formatHistoryDateTime(row.createdAt)}</td>
        <td>{row.supplierName}</td>
        <td>{row.supplierContact ?? "\u2014"}</td>
        <td>{formatPriceCell(row.totalAmount)}</td>
        <td>{formatPriceCell(row.paidAmount)}</td>
        <td>{formatPriceCell(row.dueAmount)}</td>
        <td>
          <span className={PAYMENT_STATUS_BADGE_CLASS[row.paymentStatus]}>
            {paymentStatusLabel[row.paymentStatus]}
          </span>
        </td>
        <td>{row.remarks ?? "\u2014"}</td>
        <td>
          {canRecordPayment && canRecordExpensePayment(row.paymentStatus) ? (
            <ExpenseRecordPaymentButton compact onClick={() => setExpenseToPay(row)} />
          ) : (
            "\u2014"
          )}
        </td>
      </tr>
    ));

  const renderLivestockMovementRows = (rows: LivestockInventoryHistoryEntry[]) =>
    rows.map((row) => {
      const amt = formatLivestockHistoryAmount(row);
      const isInbound = row.type === "RESTOCK";
      return (
        <tr key={row.id}>
          <td>{formatHistoryDateTime(row.createdAt)}</td>
          <td>
            <span
              className={
                isInbound
                  ? "inventoryDetailTypeBadge inventoryDetailTypeBadgeRestock"
                  : "inventoryDetailTypeBadge inventoryDetailTypeBadgeDeduct"
              }
            >
              {t(livestockMovementLabel(row.type))}
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
    <>
    <div className={panelClass}>
      {productShellStyle && isLivestock && !dateFilterAffectsStorage && (
        <p className="inventoryDetailDateScopeHint" role="note">
          {t("Date range applies to Consumed, Waste, and Expense history only.")}
        </p>
      )}
      {!isLivestock && (
        <p className="inventoryDetailDateScopeHint" role="note">
          {t(
            "Date range filters the selected processed product history: RESTOCK for storage, SALE for consumed, and adapted movement rows for waste."
          )}
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
              <p className="productsMessage">{t("Loading stock history")}</p>
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
                {t("Processed storage history note")}
              </p>
              {currentStockWeightKg != null && Number.isFinite(Number(currentStockWeightKg)) ? (
                <p className="inventoryDetailDateScopeHint" role="status">
                  <strong>{t("Current stock (kg)")}:</strong> {String(currentStockWeightKg)}
                </p>
              ) : null}
              {processedStoragePending ? (
                <p className="productsMessage">{t("Loading stock history")}</p>
              ) : processedStorageError ? (
                <p className="inventoryDetailRangeError" role="alert">
                  {t("Failed to load processed storage history.")}
                </p>
              ) : processedStorageInRows.length === 0 ? (
                <p className="inventoryDetailEmptyTab">{t("No storage history records.")}</p>
              ) : (
                <div className="inventoryDetailSampleTableWrap">
                  <table className="inventoryDetailSampleTable">
                    <thead>
                      <tr>
                        <th>{t("Column date")}</th>
                        <th>{t("Column type")}</th>
                        <th>{t("Column item")}</th>
                        <th>{t("Weight (kg)")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedStorageInRows.map((row) => {
                        const amt = formatProcessedHistoryAmount(row);
                        return (
                          <tr key={row.id}>
                            <td>{formatHistoryDateTime(row.createdAt)}</td>
                            <td>
                              <span className="inventoryDetailTypeBadge inventoryDetailTypeBadgeRestock">
                                {t(processedMovementLabel(row.type))}
                              </span>
                            </td>
                            <td>{processedHistoryProductName(row)}</td>
                            <td>{amt.display}</td>
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

      {activeTab === "consumed" && (
        <div
          id="inv-panel-consumed"
          role="tabpanel"
          aria-labelledby="inv-tab-consumed"
          className="inventoryDetailTabPanel"
        >
          {isLivestock ? (
            deductHistoryPending ? (
              <p className="productsMessage">{t("Loading stock history")}</p>
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
                {t("Processed consumed history note")}
              </p>
              {processedConsumedPending ? (
                <p className="productsMessage">{t("Loading stock history")}</p>
              ) : processedConsumedError ? (
                <p className="inventoryDetailRangeError" role="alert">
                  {t("Failed to load consumed history.")}
                </p>
              ) : processedConsumedRows.length === 0 ? (
                <p className="inventoryDetailEmptyTab">{t("No consumed movements in this date range.")}</p>
              ) : (
                <div className="inventoryDetailSampleTableWrap">
                  <table className="inventoryDetailSampleTable">
                    <thead>
                      <tr>
                        <th>{t("Column date")}</th>
                        <th>{t("Column type")}</th>
                        <th>{t("Column item")}</th>
                        <th>{t("Weight (kg)")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedConsumedRows.map((row) => {
                        const amt = formatProcessedHistoryAmount(row);
                        return (
                          <tr key={row.id}>
                            <td>{formatHistoryDateTime(row.createdAt)}</td>
                            <td>
                              <span className="inventoryDetailTypeBadge inventoryDetailTypeBadgeDeduct">
                                {t(processedMovementLabel(row.type))}
                              </span>
                            </td>
                            <td>{processedHistoryProductName(row)}</td>
                            <td>{amt.display}</td>
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
              {variant === "processed" && !wasteError && (
                <p className="inventoryDetailSampleBanner" role="note">
                  {t("Processed waste history shows DEDUCT movements on this product only until a dedicated waste API exists.")}
                </p>
              )}
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

      {activeTab === "expense" && isLivestock && (
        <div
          id="inv-panel-expense"
          role="tabpanel"
          aria-labelledby="inv-tab-expense"
          className="inventoryDetailTabPanel"
        >
          {!expenseItemId ? (
            <p className="inventoryDetailEmptyTab">
              {t("Unable to load expense history: missing item record ID from API.")}
            </p>
          ) : expenseHistoryPending ? (
            <p className="productsMessage">{t("Loading expense history…")}</p>
          ) : expenseHistoryError ? (
            <p className="inventoryDetailRangeError" role="alert">
              {t("Failed to load expense history")}
            </p>
          ) : expenseHistory.length === 0 ? (
            productShellStyle ? (
              <div className="inventoryDetailEmptyWithIcon" role="status">
                <MdPayments className="inventoryDetailEmptyIcon" aria-hidden />
                <p className="inventoryDetailEmptyTab">{t("No expense history in this range.")}</p>
              </div>
            ) : (
              <p className="inventoryDetailEmptyTab">{t("No expense history in this range.")}</p>
            )
          ) : (
            <div className={`inventoryDetailSampleTableWrap ${tableScrollClass}`.trim()}>
              <table className="inventoryDetailSampleTable">
                <thead>
                  <tr>
                    <th>{t("Column date")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Contact")}</th>
                    <th>{t("Total")}</th>
                    <th>{t("Paid")}</th>
                    <th>{t("Due")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Remarks")}</th>
                    <th>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>{renderExpenseRows(expenseHistory)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    <LivestockCompletePartialPaymentModal
      isOpen={Boolean(expenseToPay)}
      expense={expenseToPay}
      onClose={() => setExpenseToPay(null)}
      onSuccess={() => setExpenseToPay(null)}
    />
    </>
  );
}
