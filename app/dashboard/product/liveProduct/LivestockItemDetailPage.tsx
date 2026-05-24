"use client";

import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MdAddCircleOutline, MdRemoveCircleOutline } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getLivestockCategories,
  getLivestockItemsByProduct,
  resolveLivestockItemId,
  type LivestockItem,
} from "@/handlers/product";
import InventoryDetailHistoryPanel from "@/app/dashboard/product/components/InventoryDetailHistoryPanel";
import type { LivestockDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import LivestockConsumptionDetailModal from "./LivestockConsumptionDetailModal";
import LivestockRestockDetailModal from "./LivestockRestockDetailModal";
import "../inventoryDetailPage.scss";
import "./liveProduct.scss";
import "./livestockDetailShell.scss";

const LIVESTOCK_CATEGORY_QUERY_KEY = ["livestockCategories"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];

export default function LivestockItemDetailPage() {
  const { productId: productIdParam, itemId: itemIdParam } = useParams<{
    productId: string;
    itemId: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [openRestockModal, setOpenRestockModal] = useState(false);
  const [openConsumptionModal, setOpenConsumptionModal] = useState(false);

  const productId = productIdParam ? decodeURIComponent(productIdParam) : "";
  const lineItemId = itemIdParam ? decodeURIComponent(itemIdParam) : "";

  const snapshot = (location.state as LivestockDetailLocationState | null)?.itemSnapshot;

  const {
    data: livestockCategories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useQuery({
    queryKey: LIVESTOCK_CATEGORY_QUERY_KEY,
    retry: 0,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await getLivestockCategories();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: livestockItems = [],
    isLoading: itemsLoading,
    isError: itemsError,
  } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, productId],
    enabled: Boolean(productId),
    retry: 0,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await getLivestockItemsByProduct(productId);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const item: LivestockItem | null = useMemo(() => {
    const fromApi = livestockItems.find((i) => i.itemId === lineItemId);
    if (fromApi) return fromApi;
    if (
      snapshot &&
      snapshot.productId === productId &&
      snapshot.itemId === lineItemId
    ) {
      return snapshot;
    }
    return null;
  }, [livestockItems, lineItemId, productId, snapshot]);

  const categoryName =
    livestockCategories.find((c) => c.id === productId)?.name ?? productId;

  const loading = categoriesLoading || (Boolean(productId) && itemsLoading);
  const notFound =
    !loading &&
    Boolean(productId) &&
    Boolean(lineItemId) &&
    item == null &&
    !categoriesError;

  const invalidParams = !productId || !lineItemId;

  const livestockRowId = item ? resolveLivestockItemId(item) : null;
  const canMutate = Boolean(livestockRowId);

  return (
    <section className="inventoryDetailPage liveProductPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <Link to="/dashboard/product/liveProduct" className="breadcrumbLink">
          {t("Live Stock Inventory")}
        </Link>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Live stock details")}</span>
      </div>

      {invalidParams && (
        <div className="inventoryDetailNotFound" role="alert">
          {t("Live stock item not found.")}
        </div>
      )}

      {!invalidParams && loading && (
        <p className="productsMessage">{t("Loading…")}</p>
      )}

      {!invalidParams && notFound && (
        <div className="inventoryDetailNotFound" role="alert">
          {t("Live stock item not found.")}
        </div>
      )}

      {!invalidParams && item != null && (
        <>
          {itemsError && snapshot && (
            <p className="pageSubtitle" role="status">
              {t("Showing cached row; could not verify with server.")}
            </p>
          )}

          <div className="livestockDetailCard">
            <div className="livestockDetailShellTop">
              <div className="livestockDetailFacts">
                <h1 className="livestockDetailName">{item.name}</h1>
                <dl className="livestockDetailDl">
                  <div className="livestockDetailDlRow">
                    <dt>{t("Product Category")}</dt>
                    <dd>{categoryName}</dd>
                  </div>
                  <div className="livestockDetailDlRow">
                    <dt>{t("Item ID")}</dt>
                    <dd>{item.itemId}</dd>
                  </div>
                  <div className="livestockDetailDlRow">
                    <dt>{t("Quantity")}</dt>
                    <dd>
                      {typeof item.quantity === "number" && Number.isFinite(item.quantity)
                        ? item.quantity
                        : "\u2014"}
                    </dd>
                  </div>
                  <div className="livestockDetailDlRow">
                    <dt>{t("Buying price")}</dt>
                    <dd>
                      {item.buyingPrice != null && Number.isFinite(item.buyingPrice)
                        ? item.buyingPrice.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "\u2014"}
                    </dd>
                  </div>
                  <div className="livestockDetailDlRow">
                    <dt>{t("Selling price")}</dt>
                    <dd>
                      {item.sellingPrice != null && Number.isFinite(item.sellingPrice)
                        ? item.sellingPrice.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "\u2014"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="livestockDetailActions">
                <button
                  type="button"
                  className="livestockDetailBtnGhost"
                  disabled={!canMutate}
                  onClick={() => setOpenRestockModal(true)}
                >
                  <MdAddCircleOutline aria-hidden />
                  {t("Restock Storage")}
                </button>
                <button
                  type="button"
                  className="livestockDetailBtnGhost livestockDetailBtnReduce"
                  disabled={!canMutate}
                  onClick={() => setOpenConsumptionModal(true)}
                >
                  <MdRemoveCircleOutline aria-hidden />
                  {t("Reduce Storage")}
                </button>
              </div>
            </div>
          </div>

          <InventoryDetailHistoryPanel
            variant="livestock"
            wasteHistoryId={livestockRowId}
            livestockItemId={livestockRowId}
            dateFilterAffectsStorage={false}
            productShellStyle
            storagePriceFallback={
              item.sellingPrice != null && Number.isFinite(item.sellingPrice) ? item.sellingPrice : undefined
            }
          />

          {openRestockModal && canMutate && livestockRowId && (
            <LivestockRestockDetailModal
              isOpen
              item={item}
              livestockItemId={livestockRowId}
              onClose={() => setOpenRestockModal(false)}
            />
          )}

          {openConsumptionModal && canMutate && livestockRowId && (
            <LivestockConsumptionDetailModal
              isOpen
              item={item}
              livestockItemId={livestockRowId}
              onClose={() => setOpenConsumptionModal(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
