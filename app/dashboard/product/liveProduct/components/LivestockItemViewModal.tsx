"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getLivestockWasteHistory,
  resolveLivestockItemId,
  type LivestockItem,
} from "@/handlers/product";

type LivestockItemViewModalProps = {
  isOpen: boolean;
  item: LivestockItem | null;
  categoryName: string;
  onClose: () => void;
};

export default function LivestockItemViewModal({
  isOpen,
  item,
  categoryName,
  onClose,
}: LivestockItemViewModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const recordId = item ? resolveLivestockItemId(item) : null;

  const {
    data: wasteEntries = [],
    isPending: wastePending,
    isError: wasteError,
    error: wasteErrorDetail,
  } = useQuery({
    queryKey: ["livestockWasteHistory", recordId],
    enabled: isOpen && Boolean(recordId),
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getLivestockWasteHistory(recordId!);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const wasteHistoryFieldValue = useMemo(() => {
    if (!recordId) {
      return t("Unable to load waste history: missing item record ID from API.");
    }
    if (wastePending) return t("Loading waste history…");
    if (wasteError) {
      return wasteErrorDetail instanceof Error && wasteErrorDetail.message.trim()
        ? wasteErrorDetail.message
        : t("Waste history is not available yet.");
    }
    if (wasteEntries.length === 0) return t("No waste history records.");
    return wasteEntries
      .map((row) => {
        const remarkPart = row.remarks === "—" ? "" : ` · ${row.remarks}`;
        return `${row.date} · ${row.quantity}${remarkPart}`;
      })
      .join("\n");
  }, [recordId, wastePending, wasteError, wasteErrorDetail, wasteEntries, t]);

  if (!item) return null;

  const quantityLabel = item.isBulk === true ? t("Head count (bulk)") : t("Quantity");

  return (
    <Modal
      isOpen={isOpen}
      title={t("Live stock details")}
      subtitle={item.name}
      onClose={onClose}
      footer={
        <button type="button" className="productActionModalCancel" onClick={onClose}>
          {t("Close")}
        </button>
      }
    >
      <div className="livestockViewModalBody">
        <dl className="livestockViewDl">
          <div className="livestockViewDlRow">
            <dt>{t("Product Category")}</dt>
            <dd>{categoryName}</dd>
          </div>
          <div className="livestockViewDlRow">
            <dt>{t("Name of Livestock Item")}</dt>
            <dd>{item.name}</dd>
          </div>
          <div className="livestockViewDlRow">
            <dt>{t("Item ID")}</dt>
            <dd>{item.itemId}</dd>
          </div>
          <div className="livestockViewDlRow">
            <dt>{quantityLabel}</dt>
            <dd>{item.weight}</dd>
          </div>
          {/* <div className="livestockViewDlRow">
            <dt>{t("Price")}</dt>
            <dd>{item.price}</dd>
          </div>
          <div className="livestockViewDlRow">
            <dt>{t("Status")}</dt>
            <dd>{item.status ? t("Active") : t("Inactive")}</dd>
          </div>
          {recordId && (
            <div className="livestockViewDlRow">
              <dt>{t("Record ID")}</dt>
              <dd className="livestockViewMono">{recordId}</dd>
            </div>
          )} */}
        </dl>

        <div className="livestockViewWasteSection">
          <label className="livestockViewWasteLabel" htmlFor="livestock-waste-history-field">
            {t("Waste history")}
          </label>
          <textarea
            id="livestock-waste-history-field"
            className="livestockViewWasteField"
            readOnly
            rows={8}
            value={wasteHistoryFieldValue}
            aria-label={t("Waste history")}
          />
        </div>
      </div>
    </Modal>
  );
}
