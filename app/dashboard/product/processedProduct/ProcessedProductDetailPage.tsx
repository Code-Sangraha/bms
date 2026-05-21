"use client";

import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MdAddCircleOutline, MdRemoveCircleOutline } from "react-icons/md";
import { useAuth } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { getProducts, type Product } from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import ProcessedProductDetailContent from "@/app/dashboard/product/components/ProcessedProductDetailContent";
import InventoryDetailHistoryPanel from "@/app/dashboard/product/components/InventoryDetailHistoryPanel";
import type { ProcessedDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import ProcessedProductRestockDetailModal from "./ProcessedProductRestockDetailModal";
import ProcessedProductReduceDetailModal from "./ProcessedProductReduceDetailModal";
import "../inventoryDetailPage.scss";
import "../liveProduct/livestockDetailShell.scss";
import "./processedProduct.scss";

const PRODUCT_TYPE_NAME = "Processed";
const PRODUCTS_QUERY_KEY = ["products"];

export default function ProcessedProductDetailPage() {
  const { productId: productIdParam } = useParams<{ productId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { capabilities } = useAuth();
  const [openRestockModal, setOpenRestockModal] = useState(false);
  const [openReduceModal, setOpenReduceModal] = useState(false);

  const productId = productIdParam ? decodeURIComponent(productIdParam) : "";
  const snapshot = (location.state as ProcessedDetailLocationState | null)?.productSnapshot;

  const { data: products = [], isLoading: productsLoading, isError: productsError } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: productTypes = [],
    isLoading: productTypesLoading,
  } = useQuery({
    queryKey: ["productTypes"],
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const processedTypeId = useMemo(
    () => productTypes.find((pt) => pt.name.toLowerCase() === PRODUCT_TYPE_NAME.toLowerCase())?.id ?? null,
    [productTypes]
  );

  const product: Product | null = useMemo(() => {
    if (!productId) return null;
    if (processedTypeId) {
      const fromApi = products.find(
        (p) => p.id === productId && p.productTypeId === processedTypeId
      );
      if (fromApi) return fromApi;
      if (
        snapshot?.id === productId &&
        snapshot.productTypeId === processedTypeId
      ) {
        return snapshot;
      }
      return null;
    }
    return snapshot?.id === productId ? snapshot : null;
  }, [productId, processedTypeId, products, snapshot]);

  const getTypeName = (typeId: string) =>
    productTypes.find((pt) => pt.id === typeId)?.name ?? typeId;
  const getOutletName = (outletId: string) =>
    outlets.find((o) => o.id === outletId)?.name ?? outletId;

  const loading = productsLoading || productTypesLoading;
  const notFound =
    !loading &&
    Boolean(productId) &&
    processedTypeId != null &&
    product == null;

  const invalidParams = !productId;

  const canMutate =
    product != null &&
    Boolean(product.id?.trim()) &&
    Boolean(product.outletId?.trim());
  const canRestockStorage = canMutate && capabilities.canRestockProcessedInventory;
  const canReduceStorage = canMutate && capabilities.canDeductProcessedInventory;

  return (
    <section className="inventoryDetailPage processedProductPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <Link
          to={{
            pathname: "/dashboard/product/processedProduct",
            search: location.search || "",
          }}
          className="breadcrumbLink"
        >
          {t("Processed Inventory")}
        </Link>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Processed product details")}</span>
      </div>

  

      {invalidParams && (
        <div className="inventoryDetailNotFound" role="alert">
          {t("Processed product not found.")}
        </div>
      )}

      {!invalidParams && loading && (
        <p className="productsMessage">{t("Loading…")}</p>
      )}

      {!invalidParams && processedTypeId == null && !productsLoading && (
        <div className="inventoryDetailNotFound" role="alert">
          {t('No product type named "Processed" found.')}
        </div>
      )}

      {!invalidParams && notFound && (
        <div className="inventoryDetailNotFound" role="alert">
          {t("Processed product not found.")}
        </div>
      )}

      {!invalidParams && product != null && (
        <>
          <header className="inventoryDetailHeader">
            <h1 className="inventoryDetailTitle">{t("Processed product details")}</h1>
            {productsError && snapshot && (
              <p className="pageSubtitle" role="status">
                {t("Showing cached row; could not verify with server.")}
              </p>
            )}
          </header>

          <div className="livestockDetailCard">
            <div className="livestockDetailShellTop">
              <div className="livestockDetailFacts">
                <h1 className="livestockDetailName">{product.name}</h1>
                <ProcessedProductDetailContent
                  product={product}
                  typeName={getTypeName(product.productTypeId)}
                  outletName={getOutletName(product.outletId)}
                />
              </div>
              {(capabilities.canRestockProcessedInventory || capabilities.canDeductProcessedInventory) && (
                <div className="livestockDetailActions">
                  {capabilities.canRestockProcessedInventory && (
                    <button
                      type="button"
                      className="livestockDetailBtnGhost"
                      disabled={!canRestockStorage}
                      onClick={() => setOpenRestockModal(true)}
                    >
                      <MdAddCircleOutline aria-hidden />
                      {t("Restock Storage")}
                    </button>
                  )}
                  {capabilities.canDeductProcessedInventory && (
                    <button
                      type="button"
                      className="livestockDetailBtnGhost livestockDetailBtnReduce"
                      disabled={!canReduceStorage}
                      onClick={() => setOpenReduceModal(true)}
                    >
                      <MdRemoveCircleOutline aria-hidden />
                      {t("Reduce Storage")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <InventoryDetailHistoryPanel
            variant="processed"
            wasteHistoryId={product.id?.trim() ? product.id : null}
            currentStockWeightKg={
              product.weight != null && Number.isFinite(Number(product.weight))
                ? Number(product.weight)
                : null
            }
          />

          {openRestockModal && canRestockStorage && (
            <ProcessedProductRestockDetailModal
              isOpen
              product={product}
              onClose={() => setOpenRestockModal(false)}
            />
          )}

          {openReduceModal && canReduceStorage && (
            <ProcessedProductReduceDetailModal
              isOpen
              product={product}
              onClose={() => setOpenReduceModal(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
