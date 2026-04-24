"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { restockProduct, type Product } from "@/handlers/product";
import {
  processedRestockWeightSchema,
  type ProcessedRestockWeightFormValues,
} from "@/schema/processedProductDetailModals";
import "../liveProduct/livestockDetailShell.scss";

const PRODUCTS_QUERY_KEY = ["products"];

type ProcessedProductRestockDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSuccess?: () => void;
};

export default function ProcessedProductRestockDetailModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProcessedProductRestockDetailModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProcessedRestockWeightFormValues>({
    resolver: zodResolver(processedRestockWeightSchema),
    defaultValues: { weight: undefined },
  });

  const mutation = useMutation({
    mutationFn: (values: ProcessedRestockWeightFormValues) =>
      restockProduct({
        id: product.id,
        outletId: product.outletId,
        weight: values.weight,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Restock failed"), "error");
        return;
      }
      showToast(t("Restock completed successfully."), "success");
      reset();
      onClose();
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: ProcessedRestockWeightFormValues) => {
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("Restock processed product")}
      subtitle={product.name}
      modalClassName="modalWide"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="livestockDetailModalForm space-y-3">
        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="processed-restock-weight">
            {t("Weight")}
          </label>
          <input
            id="processed-restock-weight"
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
            {isPending ? t("Loading…") : t("Restock")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
