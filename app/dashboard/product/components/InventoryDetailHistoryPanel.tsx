"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getLivestockWasteHistory,
  getProcessedProductWasteHistory,
  type LivestockWasteHistoryEntry,
} from "@/handlers/product";
import {
  DUMMY_CONSUMPTION_ROWS,
  DUMMY_STORAGE_ROWS,
  DUMMY_WASTE_TABLE_ROWS,
  SHOW_DUMMY_WASTE_WHEN_EMPTY,
} from "@/app/dashboard/product/lib/inventoryDetailMocks";
import {
  isDateInRange,
  toIsoDateLocal,
} from "@/app/dashboard/product/lib/inventoryDetailDateRange";

export type InventoryDetailHistoryVariant = "livestock" | "processed";

type InventoryDetailHistoryPanelProps = {
  variant: InventoryDetailHistoryVariant;
  /** Livestock record id or processed product id for waste API. */
  wasteHistoryId: string | null;
};

type HistoryTabId = "storage" | "consumed" | "waste";

export default function InventoryDetailHistoryPanel({
  variant,
  wasteHistoryId,
}: InventoryDetailHistoryPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

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

  const storageRows = useMemo(
    () =>
      DUMMY_STORAGE_ROWS.filter((row) =>
        isDateInRange(row.date, appliedFrom, appliedTo)
      ),
    [appliedFrom, appliedTo]
  );

  const consumedRows = useMemo(
    () =>
      DUMMY_CONSUMPTION_ROWS.filter(
        (row) =>
          row.type === "Consumed" &&
          isDateInRange(row.date, appliedFrom, appliedTo)
      ),
    [appliedFrom, appliedTo]
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

  const tabs: { id: HistoryTabId; label: string }[] = [
    { id: "storage", label: t("Storage history") },
    { id: "consumed", label: t("Consumed history") },
    { id: "waste", label: t("Waste history") },
  ];

  return (
    <div className="inventoryDetailHistoryPanel">
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
          {t("Filter")}
        </button>
      </div>
      {rangeInvalid && (
        <p className="inventoryDetailRangeError" role="alert">
          {t("End date must be on or after start date.")}
        </p>
      )}

      <div className="inventoryDetailTabs" role="tablist" aria-label={t("History tabs")}>
        {tabs.map((tab) => (
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
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "storage" && (
        <div
          id="inv-panel-storage"
          role="tabpanel"
          aria-labelledby="inv-tab-storage"
          className="inventoryDetailTabPanel"
        >
          <p className="inventoryDetailSampleBanner" role="status">
            {t("Sample data (API pending)")}
          </p>
          {storageRows.length === 0 ? (
            <p className="inventoryDetailEmptyTab">{t("No rows in this date range.")}</p>
          ) : (
            <div className="inventoryDetailSampleTableWrap">
              <table className="inventoryDetailSampleTable">
                <thead>
                  <tr>
                    <th>{t("Column date")}</th>
                    <th>{t("Column quantity")}</th>
                    <th>{t("Column note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {storageRows.map((row) => (
                    <tr key={row.date + row.note}>
                      <td>{row.date}</td>
                      <td>{row.quantity}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <p className="inventoryDetailSampleBanner" role="status">
            {t("Sample data (API pending)")}
          </p>
          {consumedRows.length === 0 ? (
            <p className="inventoryDetailEmptyTab">{t("No rows in this date range.")}</p>
          ) : (
            <div className="inventoryDetailSampleTableWrap">
              <table className="inventoryDetailSampleTable">
                <thead>
                  <tr>
                    <th>{t("Column date")}</th>
                    <th>{t("Column quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {consumedRows.map((row) => (
                    <tr key={row.date + row.type}>
                      <td>{row.date}</td>
                      <td>{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <p className="inventoryDetailEmptyTab">{t("No waste history records.")}</p>
          ) : (
            <>
              {(wasteError || (wasteEntriesFiltered.length === 0 && SHOW_DUMMY_WASTE_WHEN_EMPTY)) && (
                <p className="inventoryDetailSampleBanner" role="status">
                  {wasteError
                    ? t("Waste history is not available yet.")
                    : t("Sample waste entries shown until API returns data.")}
                </p>
              )}
              <div className="inventoryDetailSampleTableWrap">
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
                      <tr key={row.id}>
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
