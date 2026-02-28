"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createProductType as createProductTypeApi,
  deleteProductType as deleteProductTypeApi,
  getProductTypes,
  type ProductType,
  updateProductType as updateProductTypeApi,
} from "@/handlers/productType";
import {
  createProductTypeSchema,
  type CreateProductTypeFormValues,
} from "@/schema/productType";
import "./productType.scss";
import ProductTypeEditModal from "./ProductTypeEditModal";

const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];

const defaultAddFormValues: CreateProductTypeFormValues = {
  name: "",
  status: "Active",
};

export default function ProductTypePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<
    string | null
  >(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productTypeToDelete, setProductTypeToDelete] =
    useState<ProductType | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const {
    data: productTypes = [],
    isLoading: productTypesLoading,
    isError: productTypesError,
    error: productTypesErrorDetail,
  } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const selectedProductType = productTypes.find(
    (pt) => pt.id === selectedProductTypeId
  );
  const closeEditModal = () => setSelectedProductTypeId(null);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(productTypes.length, { defaultPageSize: 10 });
  const paginatedProductTypes = useMemo(
    () => paginate(productTypes, startIndex, endIndex),
    [productTypes, startIndex, endIndex]
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductTypeFormValues>({
    resolver: zodResolver(createProductTypeSchema),
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductTypeApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setProductTypeToDelete(null);
        queryClient.invalidateQueries({ queryKey: PRODUCT_TYPES_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const handleConfirmDelete = () => {
    if (productTypeToDelete) {
      deleteMutation.mutate(productTypeToDelete.id);
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: CreateProductTypeFormValues;
    }) => updateProductTypeApi(id, values),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setSelectedProductTypeId(null);
        queryClient.setQueryData<ProductType[]>(
          PRODUCT_TYPES_QUERY_KEY,
          (old) => {
            if (!old) return old;
            return old.map((pt) =>
              pt.id === variables.id
                ? {
                    ...pt,
                    name: variables.values.name,
                    status: variables.values.status === "Active",
                  }
                : pt
            );
          }
        );
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const onEditSave = (values: CreateProductTypeFormValues) => {
    if (selectedProductType) {
      updateMutation.mutate({ id: selectedProductType.id, values });
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: CreateProductTypeFormValues) =>
      createProductTypeApi({
        name: values.name,
        status: values.status,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        queryClient.invalidateQueries({
          queryKey: PRODUCT_TYPES_QUERY_KEY,
        });
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

  const onAddSubmit = (data: CreateProductTypeFormValues) => {
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

  return (
    <section className="productTypePage">
      <div className="breadcrumb">
        <span>Product</span> {"›"} Product Type
      </div>

      <div className="productTypeHeader">
        <div className="productTypeHeaderText">
          <h1 className="pageTitle">Product Type</h1>
          <p className="pageSubtitle">
            Manage product types such as processed, raw, and packaged
          </p>
        </div>
        <button
          type="button"
          className="button buttonPrimary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Product Type
        </button>
      </div>

      <div className="cardList">
        {productTypesLoading && (
          <p className="productTypePageMessage">Loading product types…</p>
        )}
        {productTypesError && (
          <p className="productTypePageMessage productTypePageError">
            {productTypesErrorDetail instanceof Error
              ? productTypesErrorDetail.message
              : "Failed to load product types"}
          </p>
        )}
        {!productTypesLoading &&
          !productTypesError &&
          productTypes.length === 0 && (
            <p className="productTypePageMessage">
              No product types yet. Add one to get started.
            </p>
          )}
        {!productTypesLoading &&
          !productTypesError &&
          paginatedProductTypes.map((productType) => (
            <article key={productType.id} className="card">
              <div className="cardTop">
                <div className="cardTitleBlock">
                  <h2 className="cardTitle">{productType.name}</h2>
                  <span className="cardId">{productType.id}</span>
                </div>
                <div className="badgeGroup">
                  <span
                    className={
                      productType.status ? "badge badgeActive" : "badge"
                    }
                  >
                    {productType.status ? "Active" : "Inactive"}
                  </span>
                  <div
                    className="cardMenuWrap"
                    ref={
                      openMenuId === productType.id ? menuButtonRef : undefined
                    }
                  >
                    <button
                      type="button"
                      className="cardMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) =>
                          id === productType.id ? null : productType.id
                        )
                      }
                      aria-label="More options"
                      aria-expanded={openMenuId === productType.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === productType.id && (
                      <div className="cardMenuDropdown">
                        <button
                          type="button"
                          className="cardMenuItem cardMenuItemDanger"
                          onClick={() => {
                            setProductTypeToDelete(productType);
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
                  <span className="label">Name</span>
                  <input
                    className="input"
                    value={productType.name}
                    readOnly
                  />
                </label>

                <label className="field">
                  <span className="label">Status</span>
                  <select
                    className="select"
                    value={productType.status ? "Active" : "Inactive"}
                    disabled
                    aria-readonly="true"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="cardActions">
                <button
                  type="button"
                  className="button buttonPrimary"
                  onClick={() => setSelectedProductTypeId(productType.id)}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
      </div>

      {!productTypesLoading && !productTypesError && productTypes.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={productTypes.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      {selectedProductType && (
        <ProductTypeEditModal
          isOpen={Boolean(selectedProductTypeId)}
          productType={selectedProductType}
          onClose={closeEditModal}
          onSave={onEditSave}
          loading={updateMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={!!productTypeToDelete}
        title="Delete product type"
        message={
          productTypeToDelete
            ? `Are you sure you want to delete "${productTypeToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setProductTypeToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={isAddModalOpen}
        title="Add Product Type"
        subtitle="Add a new product type (e.g. processed, raw, packaged)"
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
              form="add-product-type-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-product-type-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="productTypeAddForm"
        >
          {errors.root?.message && (
            <p className="productTypeFormError">{errors.root.message}</p>
          )}
          <label className="modalField">
            <span className="label">Name</span>
            <input
              className="input"
              placeholder="e.g. processed"
              {...register("name")}
            />
            {errors.name && (
              <span className="productTypeFieldError">
                {errors.name.message}
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
        </form>
      </Modal>
    </section>
  );
}
