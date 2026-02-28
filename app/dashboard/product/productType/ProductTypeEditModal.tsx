"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../../components/Modal/Modal";
import type { ProductType } from "@/handlers/productType";
import {
  createProductTypeSchema,
  type CreateProductTypeFormValues,
} from "@/schema/productType";

type ProductTypeEditModalProps = {
  isOpen: boolean;
  productType: ProductType;
  onClose: () => void;
  onSave: (values: CreateProductTypeFormValues) => void;
  loading?: boolean;
};

function toFormValues(pt: ProductType): CreateProductTypeFormValues {
  return {
    name: pt.name,
    status: pt.status ? "Active" : "Inactive",
  };
}

export default function ProductTypeEditModal({
  isOpen,
  productType,
  onClose,
  onSave,
  loading = false,
}: ProductTypeEditModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProductTypeFormValues>({
    resolver: zodResolver(createProductTypeSchema),
    defaultValues: toFormValues(productType),
  });

  useEffect(() => {
    if (isOpen) reset(toFormValues(productType));
  }, [isOpen, productType, reset]);

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Product Type"
      subtitle={productType.id}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button modalButton" onClick={onClose}>
            Discard
          </button>
          <button
            type="submit"
            form="edit-product-type-form"
            className="button buttonPrimary modalButton"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="edit-product-type-form"
        onSubmit={handleSubmit(onSave)}
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
  );
}
