"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/app/providers/I18nProvider";
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
    quantity: p.weight ?? p.quantity,
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
  const { t } = useI18n();
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
      title={t("Edit Product")}
      subtitle={product.id}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button modalButton" onClick={onClose}>
            {t("Discard")}
          </button>
          <button
            type="submit"
            form="edit-product-form"
            className="button buttonPrimary modalButton"
            disabled={loading}
          >
            {loading ? t("Saving…") : t("Save")}
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
          <span className="label">{t("Product name")}</span>
          <input
            className="input"
            placeholder={t("e.g. Pork")}
            {...register("name")}
          />
          {errors.name && (
            <span className="productFieldError">{errors.name.message}</span>
          )}
        </label>
        <label className="modalField">
          <span className="label">{t("Product Type")}</span>
          <select className="select" {...register("productTypeId")}>
            <option value="">{t("Select product type")}</option>
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
          <span className="label">{t("Outlet")}</span>
          <select className="select" {...register("outletId")}>
            <option value="">{t("Select outlet")}</option>
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
          <span className="label">{t("Quantity")}</span>
          <input
            className="input"
            type="number"
            step="any"
            min={0}
            placeholder={t("e.g. 45.2")}
            {...register("quantity", { valueAsNumber: true })}
          />
          {errors.quantity && (
            <span className="productFieldError">
              {errors.quantity.message}
            </span>
          )}
        </label>
        <label className="modalField">
          <span className="label">{t("Status")}</span>
          <select className="select" {...register("status")}>
            <option value="Active">{t("Active")}</option>
            <option value="Inactive">{t("Inactive")}</option>
          </select>
        </label>
        <label className="modalField">
          <span className="label">{t("Created by (optional, user UUID)")}</span>
          <input
            className="input"
            placeholder={t("e.g. 601756be-54be-4623-8e97-7ff891e43081")}
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
