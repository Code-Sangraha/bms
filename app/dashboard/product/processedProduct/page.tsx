"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { getProducts, restockProduct, deductProduct, type Product } from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import "./processedProduct.scss";

const PRODUCT_TYPE_NAME = "Processed";
const PRODUCTS_QUERY_KEY = ["products"];

type ActionType = "restock" | "deduct";

export default function ProcessedProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionModal, setActionModal] = useState<{
    product: Product;
    action: ActionType;
  } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorDetail } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: productTypes = [] } = useQuery({
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

  const filteredProducts = useMemo(() => {
    let list: Product[] = processedTypeId
      ? products.filter((p) => p.productTypeId === processedTypeId)
      : [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const outletNames = new Map(outlets.map((o) => [o.id, o.name.toLowerCase()]));
      const typeNames = new Map(productTypes.map((pt) => [pt.id, pt.name.toLowerCase()]));
      list = list.filter((p) => {
        const name = p.name.toLowerCase();
        const outletName = outletNames.get(p.outletId) ?? "";
        const typeName = typeNames.get(p.productTypeId) ?? "";
        return name.includes(q) || outletName.includes(q) || typeName.includes(q);
      });
    }
    return list;
  }, [products, processedTypeId, searchQuery, outlets, productTypes]);

  const getOutletName = (outletId: string) => outlets.find((o) => o.id === outletId)?.name ?? outletId;
  const getTypeName = (typeId: string) => productTypes.find((pt) => pt.id === typeId)?.name ?? typeId;

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredProducts.length, { defaultPageSize: 10 });
  const paginatedProducts = useMemo(
    () => paginate(filteredProducts, startIndex, endIndex),
    [filteredProducts, startIndex, endIndex]
  );

  const restockMutation = useMutation({
    mutationFn: restockProduct,
    onSuccess: (result) => {
      setActionError(null);
      if (result.ok) {
        setActionModal(null);
        setQuantity("");
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      } else {
        setActionError(result.error ?? "Restock failed");
      }
    },
  });
  const deductMutation = useMutation({
    mutationFn: deductProduct,
    onSuccess: (result) => {
      setActionError(null);
      if (result.ok) {
        setActionModal(null);
        setQuantity("");
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      } else {
        setActionError(result.error ?? "Deduct failed");
      }
    },
  });

  const handleOpenAction = (product: Product, action: ActionType) => {
    setActionModal({ product, action });
    setQuantity("");
    setActionError(null);
  };
  const handleSubmitAction = () => {
    if (!actionModal) return;
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) return;
    const payload = {
      id: actionModal.product.id,
      productTypeId: actionModal.product.productTypeId,
      outletId: actionModal.product.outletId,
      quantity: q,
    };
    if (actionModal.action === "restock") restockMutation.mutate(payload);
    else deductMutation.mutate(payload);
  };

  return (
    <section className="processedProductPage">
      <div className="breadcrumb">
        <span>Product</span> {"›"} Processed
      </div>

      <div className="processedProductHeader">
        <div className="processedProductHeaderText">
          <h1 className="pageTitle">Processed Products</h1>
          <p className="pageSubtitle">Products of type Processed</p>
        </div>
        <div className="processedProductSearch">
          <span className="searchIcon">🔍</span>
          <input
            className="searchInput"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search processed products"
          />
        </div>
      </div>

      <div className="productsTable">
        <div className="productsRow productsRowHeader">
          <span>Name</span>
          <span>Product Type</span>
          <span>Outlet</span>
          <span>Quantity</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {productsLoading && (
          <div className="productsRow">
            <span className="productsMessage">Loading…</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {productsError && (
          <div className="productsRow">
            <span className="productsMessage productsError">
              {productsErrorDetail instanceof Error
                ? productsErrorDetail.message
                : "Failed to load products"}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!productsLoading && !productsError && !processedTypeId && productTypes.length > 0 && (
          <div className="productsRow">
            <span className="productsMessage">No product type named &quot;Processed&quot; found.</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!productsLoading &&
          !productsError &&
          processedTypeId &&
          filteredProducts.length === 0 && (
            <div className="productsRow">
              <span className="productsMessage">
                {searchQuery.trim()
                  ? `No processed products match "${searchQuery.trim()}".`
                  : "No processed products yet."}
              </span>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!productsLoading &&
          !productsError &&
          filteredProducts.length > 0 &&
          paginatedProducts.map((product) => (
            <div key={product.id} className="productsRow">
              <span>{product.name}</span>
              <span>{getTypeName(product.productTypeId)}</span>
              <span>{getOutletName(product.outletId)}</span>
              <span>{product.quantity}</span>
              <span>
                <span className={product.status ? "badge badgeActive" : "badge"}>
                  {product.status ? "Active" : "Inactive"}
                </span>
              </span>
              <span className="productsRowActions">
                <button
                  type="button"
                  className="productActionBtn productActionRestock"
                  onClick={() => handleOpenAction(product, "restock")}
                >
                  Restock
                </button>
                <button
                  type="button"
                  className="productActionBtn productActionDeduct"
                  onClick={() => handleOpenAction(product, "deduct")}
                >
                  Deduct
                </button>
              </span>
            </div>
          ))}
      </div>

      {!productsLoading && !productsError && filteredProducts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <Modal
        isOpen={!!actionModal}
        title={actionModal ? (actionModal.action === "restock" ? "Restock" : "Deduct") : ""}
        subtitle={actionModal ? actionModal.product.name : ""}
        onClose={() => {
          setActionModal(null);
          setQuantity("");
        }}
        footer={
          actionModal ? (
            <div className="productActionModalFooter">
              <button
                type="button"
                className="productActionModalCancel"
                onClick={() => {
                  setActionModal(null);
                  setQuantity("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="productActionModalSubmit"
                onClick={handleSubmitAction}
                disabled={
                  !quantity ||
                  !Number.isInteger(Number(quantity)) ||
                  Number(quantity) <= 0 ||
                  restockMutation.isPending ||
                  deductMutation.isPending
                }
              >
                {restockMutation.isPending || deductMutation.isPending
                  ? "Saving…"
                  : actionModal.action === "restock"
                    ? "Restock"
                    : "Deduct"}
              </button>
            </div>
          ) : null
        }
      >
        {actionModal && (
          <div className="productActionModalBody">
            {actionError && <p className="productActionModalError">{actionError}</p>}
            <label className="productActionModalLabel">
              Quantity
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="productActionModalInput"
                placeholder="Enter quantity"
              />
            </label>
          </div>
        )}
      </Modal>
    </section>
  );
}
