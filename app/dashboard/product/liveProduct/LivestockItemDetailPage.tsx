"use client";

import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getLivestockCategories,
  getLivestockItemsByProduct,
  resolveLivestockItemId,
  type LivestockItem,
} from "@/handlers/product";
import LivestockItemDetailContent from "@/app/dashboard/product/components/LivestockItemDetailContent";
import InventoryDetailHistoryPanel from "@/app/dashboard/product/components/InventoryDetailHistoryPanel";
import type { LivestockDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import "../inventoryDetailPage.scss";
import "./liveProduct.scss";

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

      {/* <Link to="/dashboard/product/liveProduct" className="inventoryDetailBackLink">
        {t("Back to live inventory")}
      </Link> */}

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
          <header className="inventoryDetailHeader">
            <h1 className="inventoryDetailTitle">{t("Live stock details")}</h1>
            <p className="inventoryDetailSubtitle">{item.name}</p>
            {itemsError && snapshot && (
              <p className="pageSubtitle" role="status">
                {t("Showing cached row; could not verify with server.")}
              </p>
            )}
          </header>

          <LivestockItemDetailContent item={item} categoryName={categoryName} />

          <InventoryDetailHistoryPanel
            variant="livestock"
            wasteHistoryId={resolveLivestockItemId(item)}
          />
        </>
      )}
    </section>
  );
}
