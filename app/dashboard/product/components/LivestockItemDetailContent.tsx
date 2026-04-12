"use client";

import { useI18n } from "@/app/providers/I18nProvider";
import { type LivestockItem } from "@/handlers/product";

type LivestockItemDetailContentProps = {
  item: LivestockItem;
  categoryName: string;
};

export default function LivestockItemDetailContent({
  item,
  categoryName,
}: LivestockItemDetailContentProps) {
  const { t } = useI18n();

  const quantityLabel = item.isBulk === true ? t("Head count (bulk)") : t("Quantity");

  return (
    <div className="livestockViewModalBody">
      <dl className="livestockViewDl">
        <div className="livestockViewDlRow">
          <dt>{t("Product Category")}</dt>
          <dd>{categoryName}</dd>
        </div>
        {/* <div className="livestockViewDlRow">
          <dt>{t("Name of Livestock Item")}</dt>
          <dd>{item.name}</dd>
        </div> */}
        <div className="livestockViewDlRow">
          <dt>{t("Item ID")}</dt>
          <dd>{item.itemId}</dd>
        </div>
        <div className="livestockViewDlRow">
          <dt>{quantityLabel}</dt>
          <dd>{item.weight}</dd>
        </div>
      </dl>
    </div>
  );
}
