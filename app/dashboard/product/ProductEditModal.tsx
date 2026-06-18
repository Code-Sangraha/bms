"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { useI18n } from "@/app/providers/I18nProvider";
import Modal from "../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { FormField } from "@/app/components/ui-ext/FormField";
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
    control,
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
      modalClassName="modalCompact"
      title={t("Edit Product")}
      subtitle={product.id}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("Discard")}
          </Button>
          <Button
            type="submit"
            form="edit-product-form"
            disabled={loading}
          >
            {loading ? t("Saving…") : t("Save")}
          </Button>
        </>
      }
    >
      <form
        id="edit-product-form"
        onSubmit={handleSubmit(onSave)}
        className="flex flex-col gap-4"
      >
        {errors.root?.message && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <FormField
          id="edit-product-name"
          label={t("Product name")}
          required
          error={errors.name?.message}
        >
          <Input
            id="edit-product-name"
            placeholder={t("e.g. Pork")}
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
        </FormField>

        <FormField
          id="edit-product-type"
          label={t("Product Type")}
          required
          error={errors.productTypeId?.message}
        >
          <Controller
            control={control}
            name="productTypeId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="edit-product-type"
                  aria-invalid={Boolean(errors.productTypeId)}
                >
                  <SelectValue placeholder={t("Select product type")} />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          id="edit-product-outlet"
          label={t("Outlet")}
          required
          error={errors.outletId?.message}
        >
          <Controller
            control={control}
            name="outletId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="edit-product-outlet"
                  aria-invalid={Boolean(errors.outletId)}
                >
                  <SelectValue placeholder={t("Select outlet")} />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          id="edit-product-quantity"
          label={t("Weight")}
          error={errors.quantity?.message}
        >
          <Input
            id="edit-product-quantity"
            type="number"
            step="any"
            min={0}
            placeholder={t("e.g. 45.2")}
            aria-invalid={Boolean(errors.quantity)}
            {...register("quantity", { valueAsNumber: true })}
          />
        </FormField>

        <FormField id="edit-product-status" label={t("Status")}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="edit-product-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t("Active")}</SelectItem>
                  <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          id="edit-product-created-by"
          label={t("Created by (optional, user UUID)")}
          error={errors.createdBy?.message}
        >
          <Input
            id="edit-product-created-by"
            placeholder={t("e.g. 601756be-54be-4623-8e97-7ff891e43081")}
            aria-invalid={Boolean(errors.createdBy)}
            {...register("createdBy")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
