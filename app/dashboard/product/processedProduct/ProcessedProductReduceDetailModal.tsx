"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deductProduct,
  WASTE_PRODUCTS_QUERY_KEY,
  type Product,
} from "@/handlers/product";
import { getProcessedStockWeight } from "@/app/dashboard/product/processedProduct/lib/processedStockWeight";
import WasteProductSelect from "@/app/dashboard/product/wasteProduct/WasteProductSelect";
import {
  processedReduceWeightSchema,
  type ProcessedReduceWeightFormValues,
} from "@/schema/processedProductDetailModals";
import "../liveProduct/livestockDetailShell.scss";

const PRODUCTS_QUERY_KEY = ["products"];

type ProcessedProductReduceDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSuccess?: () => void;
};

export default function ProcessedProductReduceDetailModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProcessedProductReduceDetailModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProcessedReduceWeightFormValues>({
    resolver: zodResolver(processedReduceWeightSchema),
    defaultValues: { weight: undefined, wasteProductId: "" },
  });

  const wasteProductId = watch("wasteProductId");

  const mutation = useMutation({
    mutationFn: (values: ProcessedReduceWeightFormValues) =>
      deductProduct({
        id: product.id,
        outletId: product.outletId,
        weight: values.weight,
        productId: values.wasteProductId,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Deduct failed"), "error");
        return;
      }
      showToast(t("Storage reduced successfully."), "success");
      reset({ weight: undefined, wasteProductId: "" });
      onClose();
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: WASTE_PRODUCTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["processedInventoryHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventoryDetailWasteHistory"] });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: ProcessedReduceWeightFormValues) => {
    const cap = getProcessedStockWeight(product);
    if (data.weight > cap) {
      setError("weight", { type: "manual", message: t("Deduct amount cannot exceed current stock.") });
      return;
    }
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;
  const currentStock = getProcessedStockWeight(product);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("Deduct processed stock")}
      subtitle={product.name}
      modalClassName="modalWide"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="livestockDetailModalForm space-y-3">
        <p className="livestockDetailModalHint" role="status">
          {t("Current stock")} ({t("Weight")}): {Number.isFinite(currentStock) ? String(currentStock) : "—"}
        </p>

        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="processed-reduce-weight">
            {t("Weight")}
          </label>
          <input
            id="processed-reduce-weight"
            type="number"
            min={0}
            step="any"
            className="livestockDetailModalInput"
            disabled={isPending}
            {...register("weight", { valueAsNumber: true })}
          />
          {errors.weight?.message && (
            <p className="livestockDetailModalError" role="alert">
              {errors.weight.message}
            </p>
          )}
        </div>

        <WasteProductSelect
          id="processed-reduce-waste-product"
          value={wasteProductId}
          onChange={(value) => setValue("wasteProductId", value, { shouldValidate: true })}
          disabled={isPending}
          error={errors.wasteProductId?.message}
        />

        <div className="livestockDetailModalFooter">
          <button
            type="button"
            className="livestockDetailModalBtn"
            disabled={isPending}
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            className="livestockDetailModalBtn livestockDetailModalBtnPrimary"
            disabled={isPending}
          >
            {isPending ? t("Loading…") : t("Deduct")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
