"use client";

import { useState } from "react";
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import type { OpeningStockData } from "@/handlers/product";
import { formatStockDateLabel, qtyWithUnit } from "./openingClosingStockFormat";

type ClosingStockTableProps = {
  from: string;
  to: string;
  openingStockData: OpeningStockData | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string | null;
};

function formatConsumedCell(quantity: number, unit: string): string {
  const base = qtyWithUnit(quantity, unit);
  return quantity > 0 ? `−${base}` : base;
}

function dashNum(value: number | null): string {
  return value === null ? "\u2014" : String(value);
}

export default function ClosingStockTable({
  from,
  to,
  openingStockData,
  isPending,
  isError,
  errorMessage,
}: ClosingStockTableProps) {
  const { t } = useI18n();
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const periodFrom = openingStockData?.from || from;
  const periodTo = openingStockData?.to || to;
  const days = openingStockData?.openingStockByDate ?? [];
  const hasRows = days.length > 0;

  return (
    <div className="openingClosingStockCard">
      <h2 className="openingClosingStockCardTitle">{t("Closing Stock Details")}</h2>

      <div className="openingClosingStockPeriod">
        <p className="openingClosingStockPeriodLabel">{t("Period")}</p>
        <p className="openingClosingStockPeriodValue">
          {formatStockDateLabel(periodFrom)} – {formatStockDateLabel(periodTo)}
        </p>
      </div>

      {isError && errorMessage && (
        <div className="openingClosingStockBanner openingClosingStockBannerError" role="alert">
          {errorMessage}
        </div>
      )}

      {isPending && (
        <div className="openingClosingStockLoader" aria-busy="true">
          <div className="openingClosingStockSpinner" />
        </div>
      )}

      {!isPending && !isError && !hasRows && (
        <div className="openingClosingStockEmpty">
          <span className="openingClosingStockEmptyIcon" aria-hidden>
            📦
          </span>
          <p>{t("No closing stock data for this period")}</p>
        </div>
      )}

      {!isPending && hasRows && (
        <div>
          {days.map((dayData) => (
            <div key={dayData.date} className="openingClosingStockDay">
              <button
                type="button"
                className="openingClosingStockDayHeader"
                onClick={() => toggleDate(dayData.date)}
                aria-expanded={expandedDates.includes(dayData.date)}
              >
                <div className="openingClosingStockDayHeaderTop">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="openingClosingStockDayDate">
                      {formatStockDateLabel(dayData.date)}
                    </span>
                    <span className="openingClosingStockDayBadge">
                      {dayData.items.length} {t("items")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="openingClosingStockDayTotals">
                      <span className="openingClosingStockTotalOpening">
                        <strong>{t("Opening")}:</strong> {dashNum(dayData.totalOpening)}
                      </span>
                      <span className="openingClosingStockTotalAdded">
                        <strong>{t("Added")}:</strong> {dayData.totalAdded}
                      </span>
                      <span className="openingClosingStockTotalConsumed">
                        <strong>{t("Consumed")}:</strong> {dayData.totalConsumed}
                      </span>
                      <span className="openingClosingStockTotalClosing">
                        <strong>{t("Closing")}:</strong> {dashNum(dayData.totalClosing)}
                      </span>
                    </div>
                    <span className="openingClosingStockChevron" aria-hidden>
                      {expandedDates.includes(dayData.date) ? (
                        <MdKeyboardArrowUp size={22} />
                      ) : (
                        <MdKeyboardArrowDown size={22} />
                      )}
                    </span>
                  </div>
                </div>
                <div className="openingClosingStockDayTotalsMobile">
                  <span className="openingClosingStockTotalOpening">
                    {t("Opening")}: {dashNum(dayData.totalOpening)}
                  </span>
                  <span className="openingClosingStockTotalAdded">
                    {t("Added")}: {dayData.totalAdded}
                  </span>
                  <span className="openingClosingStockTotalConsumed">
                    {t("Consumed")}: {dayData.totalConsumed}
                  </span>
                  <span className="openingClosingStockTotalClosing">
                    {t("Closing")}: {dashNum(dayData.totalClosing)}
                  </span>
                </div>
              </button>
              {expandedDates.includes(dayData.date) && (
                <div className="openingClosingStockTableWrap">
                  <table className="openingClosingStockTable">
                    <thead>
                      <tr>
                        <th scope="col">{t("Product")}</th>
                        <th scope="col">{t("Product #")}</th>
                        <th scope="col" className="openingClosingStockThNumeric">
                          {t("Consumed")}
                        </th>
                        <th scope="col" className="openingClosingStockThNumeric">
                          {t("Closing")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayData.items.map((item, index) => (
                        <tr key={`${item.inventoryId}-${index}`}>
                          <td>{item.productName}</td>
                          <td>{item.productNumber || "—"}</td>
                          <td className="openingClosingStockTdNumeric openingClosingStockTotalConsumed">
                            {formatConsumedCell(item.consumedQuantity, item.unit)}
                          </td>
                          <td className="openingClosingStockTdNumeric">
                            {qtyWithUnit(item.closingQuantity, item.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
