"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { getProcessedProductWasteHistory, type Product } from "@/handlers/product";

type ProcessedProductViewModalProps = {
  isOpen: boolean;
  product: Product | null;
  typeName: string;
  outletName: string;
  onClose: () => void;
};

export default function ProcessedProductViewModal({
  isOpen,
  product,
  typeName,
  outletName,
  onClose,
}: ProcessedProductViewModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const productId = product?.id?.trim() ? product.id : null;

  const {
    data: wasteEntries = [],
    isPending: wastePending,
    isError: wasteError,
    error: wasteErrorDetail,
  } = useQuery({
    queryKey: ["processedProductWasteHistory", productId],
    enabled: isOpen && Boolean(productId),
    staleTime: 30_000,
    queryFn: async () => {
      const result = await getProcessedProductWasteHistory(productId!);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const wasteHistoryFieldValue = useMemo(() => {
    if (!productId) {
      return t("Unable to load waste history: missing product ID.");
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
  }, [productId, wastePending, wasteError, wasteErrorDetail, wasteEntries, t]);

  if (!product) return null;

  const stockDisplay = product.weight ?? product.quantity ?? "—";

  return (
    <Modal
      isOpen={isOpen}
      title={t("Processed product details")}
      subtitle={product.name}
      onClose={onClose}
      footer={
        <button type="button" className="productActionModalCancel" onClick={onClose}>
          {t("Close")}
        </button>
      }
    >
      <div className="processedProductViewModalBody">
        <dl className="processedProductViewDl">
          <div className="processedProductViewDlRow">
            <dt>{t("Name")}</dt>
            <dd>{product.name}</dd>
          </div>
          <div className="processedProductViewDlRow">
            <dt>{t("Product Type")}</dt>
            <dd>{typeName}</dd>
          </div>
          <div className="processedProductViewDlRow">
            <dt>{t("Outlet")}</dt>
            <dd>{outletName}</dd>
          </div>
          <div className="processedProductViewDlRow">
            <dt>{t("Weight")}</dt>
            <dd>{stockDisplay}</dd>
          </div>
          <div className="processedProductViewDlRow">
            <dt>{t("Status")}</dt>
            <dd>{product.status ? t("Active") : t("Inactive")}</dd>
          </div>
          <div className="processedProductViewDlRow">
            <dt>{t("Product ID")}</dt>
            <dd className="processedProductViewMono">{product.id}</dd>
          </div>
        </dl>

        <div className="processedProductViewWasteSection">
          <label className="processedProductViewWasteLabel" htmlFor="processed-waste-history-field">
            {t("Waste history")}
          </label>
          <textarea
            id="processed-waste-history-field"
            className="processedProductViewWasteField"
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
