"use client";

import { useI18n } from "@/app/providers/I18nProvider";
import { type Product } from "@/handlers/product";

type ProcessedProductDetailContentProps = {
  product: Product;
  typeName: string;
  outletName: string;
};

export default function ProcessedProductDetailContent({
  product,
  typeName,
  outletName,
}: ProcessedProductDetailContentProps) {
  const { t } = useI18n();

  const weightDisplay =
    product.weight != null && Number.isFinite(Number(product.weight))
      ? String(product.weight)
      : product.quantity != null && Number.isFinite(Number(product.quantity))
        ? String(product.quantity)
        : "—";
  const wasteDisplay =
    product.wasteWeight != null && Number.isFinite(Number(product.wasteWeight))
      ? String(product.wasteWeight)
      : "—";

  return (
    <div className="processedProductViewModalBody">
      <dl className="processedProductViewDl">
        {/* <div className="processedProductViewDlRow">
          <dt>{t("Name")}</dt>
          <dd>{product.name}</dd>
        </div> */}
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
          <dd>{weightDisplay}</dd>
        </div>
        <div className="processedProductViewDlRow">
          <dt>{t("Waste Weight")}</dt>
          <dd>{wasteDisplay}</dd>
        </div>
      </dl>
    </div>
  );
}
