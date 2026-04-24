"use client";

import { useState } from "react";
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import type { OpeningStockData } from "@/handlers/product";
import { formatStockDateLabel, qtyWithUnit } from "./openingClosingStockFormat";

type OpeningStockTableProps = {
  from: string;
  to: string;
  openingStockData: OpeningStockData | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string | null;
  /** Shown under the table when set (e.g. livestock reconciled-mode disclaimer). */
  footnote?: string | null;
};

function dashNum(value: number | null): string {
  return value === null ? "\u2014" : String(value);
}

export default function OpeningStockTable({
  from,
  to,
  openingStockData,
  isPending,
  isError,
  errorMessage,
  footnote,
}: OpeningStockTableProps) {
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
      <h2 className="openingClosingStockCardTitle">{t("Opening Stock Details")}</h2>

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
          <p>{t("No opening stock data for this period")}</p>
        </div>
      )}

      {!isPending && hasRows && (
        <div>
          {days.map((dayData) => {
            const totalOpeningPlusAdded =
              dayData.totalOpening !== null ? dayData.totalOpening + dayData.totalAdded : null;
            return (
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
                          <strong>{t("Total (O+A)")}:</strong> {dashNum(totalOpeningPlusAdded)}
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
                      {t("Total (O+A)")}: {dashNum(totalOpeningPlusAdded)}
                    </span>
                  </div>
                </button>
                {expandedDates.includes(dayData.date) && (
                  <div className="openingClosingStockTableWrap">
                    <table className="openingClosingStockTable">
                      <thead>
                        <tr>
                          <th scope="col">{t("Product")}</th>
                          <th scope="col" className="openingClosingStockThNumeric">
                            {t("Opening")}
                          </th>
                          <th scope="col" className="openingClosingStockThNumeric">
                            {t("Added")}
                          </th>
                          <th scope="col" className="openingClosingStockThNumeric">
                            {t("Total (O+A)")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayData.items.map((item, index) => {
                          const rowTotal =
                            item.openingQuantity !== null ? item.openingQuantity + item.addedQuantity : null;
                          return (
                            <tr key={`${item.inventoryId}-${index}`}>
                              <td>{item.productName}</td>
                              <td className="openingClosingStockTdNumeric">
                                {qtyWithUnit(item.openingQuantity, item.unit)}
                              </td>
                              <td className="openingClosingStockTdNumeric">
                                {item.addedQuantity > 0
                                  ? `+${qtyWithUnit(item.addedQuantity, item.unit)}`
                                  : qtyWithUnit(item.addedQuantity, item.unit)}
                              </td>
                              <td className="openingClosingStockTdNumeric">
                                {qtyWithUnit(rowTotal, item.unit)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {footnote ? (
            <p className="openingClosingStockFootnote" role="note">
              {footnote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
