"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/Modal/Modal";
import type { Product } from "@/handlers/product";
import type { Outlet } from "@/handlers/outlet";
import type { ProductType } from "@/handlers/productType";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "@/schema/product";

type ProductEditModalProps = {
  isOpen: boolean;
  product: Product;
  productTypes: ProductType[];
  outlets: Outlet[];
  onClose: () => void;
  onSave: (values: CreateProductFormValues) => void;
  loading?: boolean;
};

function toFormValues(p: Product): CreateProductFormValues {
  return {
    name: p.name,
    productTypeId: p.productTypeId,
    outletId: p.outletId,
    quantity: p.quantity,
    status: p.status ? "Active" : "Inactive",
    createdBy: p.createdBy ?? "",
  };
}

export default function ProductEditModal({
  isOpen,
  product,
  productTypes,
  outlets,
  onClose,
  onSave,
  loading = false,
}: ProductEditModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: toFormValues(product),
  });

  useEffect(() => {
    if (isOpen) reset(toFormValues(product));
  }, [isOpen, product, reset]);

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Product"
      subtitle={product.id}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button modalButton" onClick={onClose}>
            Discard
          </button>
          <button
            type="submit"
            form="edit-product-form"
            className="button buttonPrimary modalButton"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="edit-product-form"
        onSubmit={handleSubmit(onSave)}
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
  );
}
