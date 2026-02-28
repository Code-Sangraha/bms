"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Pagination from "../../components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createProduct as createProductApi,
  deleteProduct as deleteProductApi,
  getProducts,
  updateProduct as updateProductApi,
  type Product,
} from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "@/schema/product";
import "./product.scss";
import ProductEditModal from "./ProductEditModal";

const PRODUCTS_QUERY_KEY = ["products"];

const defaultAddFormValues: CreateProductFormValues = {
  name: "",
  productTypeId: "",
  outletId: "",
  quantity: 0,
  status: "Active",
  createdBy: "",
};

export default function ProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    error: productsErrorDetail,
  } = useQuery({
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

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: defaultAddFormValues,
  });

  useEffect(() => {
    if (!isAddModalOpen) reset(defaultAddFormValues);
  }, [isAddModalOpen, reset]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const closeEditModal = () => setSelectedProductId(null);

  const getProductTypeName = (p: Product) =>
    (typeof p.productType === "object" && p.productType?.name) ||
    productTypes.find((pt) => pt.id === p.productTypeId)?.name ||
    p.productTypeId;
  const getOutletName = (p: Product) =>
    (typeof p.outlet === "object" && p.outlet?.name) ||
    outlets.find((o) => o.id === p.outletId)?.name ||
    p.outletId;

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(products.length, { defaultPageSize: 10 });
  const paginatedProducts = paginate(products, startIndex, endIndex);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setProductToDelete(null);
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const handleConfirmDelete = () => {
    if (productToDelete) deleteMutation.mutate(productToDelete.id);
  };

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: CreateProductFormValues;
    }) => updateProductApi(id, values),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setSelectedProductId(null);
        queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === variables.id
              ? {
                  ...p,
                  name: variables.values.name,
                  productTypeId: variables.values.productTypeId,
                  outletId: variables.values.outletId,
                  quantity: variables.values.quantity,
                  status: variables.values.status === "Active",
                }
              : p
          );
        });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const onEditSave = (values: CreateProductFormValues) => {
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, values });
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: CreateProductFormValues) =>
      createProductApi({
        name: values.name,
        productTypeId: values.productTypeId,
        outletId: values.outletId,
        quantity: values.quantity,
        status: values.status,
        createdBy: values.createdBy || undefined,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      } else {
        if (result.status === 401) {
          router.push("/login");
          return;
        }
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", {
        message: "Something went wrong. Please try again.",
      });
    },
  });

  const onAddSubmit = (data: CreateProductFormValues) => {
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

  return (
    <section className="productPage">
      <div className="breadcrumb">
        <span>Product</span> {"›"} Products
      </div>

      <div className="productHeader">
        <div className="productHeaderText">
          <h1 className="pageTitle">Products</h1>
          <p className="pageSubtitle">
            Create and manage products by type and outlet
          </p>
        </div>
        <button
          type="button"
          className="button buttonPrimary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Product
        </button>
      </div>

      <div className="cardList">
        {productsLoading && (
          <p className="productPageMessage">Loading products…</p>
        )}
        {productsError && (
          <p className="productPageMessage productPageError">
            {productsErrorDetail instanceof Error
              ? productsErrorDetail.message
              : "Failed to load products"}
          </p>
        )}
        {!productsLoading && !productsError && products.length === 0 && (
          <p className="productPageMessage">
            No products yet. Add one to get started.
          </p>
        )}
        {!productsLoading &&
          !productsError &&
          paginatedProducts.map((product: Product) => (
            <article key={product.id} className="card">
              <div className="cardTop">
                <div className="cardTitleBlock">
                  <h2 className="cardTitle">{product.name}</h2>
                  <span className="cardId">{product.id}</span>
                </div>
                <div className="badgeGroup">
                  <span
                    className={
                      product.status ? "badge badgeActive" : "badge"
                    }
                  >
                    {product.status ? "Active" : "Inactive"}
                  </span>
                  <div
                    className="cardMenuWrap"
                    ref={openMenuId === product.id ? menuButtonRef : undefined}
                  >
                    <button
                      type="button"
                      className="cardMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) =>
                          id === product.id ? null : product.id
                        )
                      }
                      aria-label="More options"
                      aria-expanded={openMenuId === product.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === product.id && (
                      <div className="cardMenuDropdown">
                        <button
                          type="button"
                          className="cardMenuItem cardMenuItemDanger"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProductToDelete(product);
                            setOpenMenuId(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="cardBody">
                <label className="field">
                  <span className="label">Product Type</span>
                  <input
                    className="input"
                    value={getProductTypeName(product)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="label">Outlet</span>
                  <input
                    className="input"
                    value={getOutletName(product)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="label">Quantity</span>
                  <input
                    className="input"
                    type="text"
                    value={product.quantity}
                    readOnly
                  />
                </label>
              </div>

              <div className="cardActions">
                <button
                  type="button"
                  className="button buttonPrimary"
                  onClick={() => setSelectedProductId(product.id)}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
      </div>

      {!productsLoading && !productsError && products.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={products.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      {selectedProduct && (
        <ProductEditModal
          isOpen={Boolean(selectedProductId)}
          product={selectedProduct}
          productTypes={productTypes}
          outlets={outlets}
          onClose={closeEditModal}
          onSave={onEditSave}
          loading={updateMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={!!productToDelete}
        title="Delete product"
        message={
          productToDelete
            ? `Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={isAddModalOpen}
        title="Add Product"
        subtitle="Create a new product with type, outlet, and quantity"
        onClose={() => setIsAddModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsAddModalOpen(false)}
            >
              Discard
            </button>
            <button
              type="submit"
              form="add-product-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-product-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="productAddForm"
        >
          {errors.root?.message && (
            <p className="productFormError">{errors.root.message}</p>
          )}
          <label className="modalField">
            <span className="label">Product name</span>
            <input
              className="input"
              placeholder="e.g. Pork"
              {...register("name")}
            />
            {errors.name && (
              <span className="productFieldError">{errors.name.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Product Type</span>
            <select className="select" {...register("productTypeId")}>
              <option value="">Select product type</option>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
            {errors.productTypeId && (
              <span className="productFieldError">
                {errors.productTypeId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Outlet</span>
            <select className="select" {...register("outletId")}>
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {errors.outletId && (
              <span className="productFieldError">
                {errors.outletId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Quantity</span>
            <input
              className="input"
              type="number"
              step="any"
              min={0}
              placeholder="e.g. 45.2"
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && (
              <span className="productFieldError">
                {errors.quantity.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Status</span>
            <select className="select" {...register("status")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <label className="modalField">
            <span className="label">Created by (optional, user UUID)</span>
            <input
              className="input"
              placeholder="e.g. 601756be-54be-4623-8e97-7ff891e43081"
              {...register("createdBy")}
            />
            {errors.createdBy && (
              <span className="productFieldError">
                {errors.createdBy.message}
              </span>
            )}
          </label>
        </form>
      </Modal>
    </section>
  );
}
