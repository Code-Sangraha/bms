"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { restockLivestockItem, type LivestockItem } from "@/handlers/product";
import {
  livestockRestockDetailSchema,
  type LivestockRestockDetailFormValues,
} from "@/schema/livestockDetailModals";
import "./livestockDetailShell.scss";

type LivestockRestockDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: LivestockItem;
  livestockItemId: string;
  onSuccess?: () => void;
};

export default function LivestockRestockDetailModal({
  isOpen,
  onClose,
  item,
  livestockItemId,
  onSuccess,
}: LivestockRestockDetailModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LivestockRestockDetailFormValues>({
    resolver: zodResolver(livestockRestockDetailSchema),
    defaultValues: {
      quantity: 1,
      buyingPrice: undefined,
      sellingPrice: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: LivestockRestockDetailFormValues) =>
      restockLivestockItem({
        livestockItemId,
        amount: Math.floor(values.quantity),
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Failed to restock livestock item."), "error");
        return;
      }
      showToast(t("Restock completed successfully."), "success");
      reset({ quantity: 1, buyingPrice: undefined, sellingPrice: undefined });
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["livestockItemsByProduct"] });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: LivestockRestockDetailFormValues) => {
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("Restock live stock")}
      subtitle={t("Add quantity to this line item.")}
      modalClassName="modalWide"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="livestockDetailModalForm space-y-3">
        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="livestock-restock-qty">
            {t("Quantity")}
          </label>
          <input
            id="livestock-restock-qty"
            type="number"
            min={1}
            step={1}
            className="livestockDetailModalInput"
            disabled={isPending}
            {...register("quantity", { valueAsNumber: true })}
          />
          {errors.quantity?.message && (
            <p className="livestockDetailModalError" role="alert">
              {errors.quantity.message}
            </p>
          )}
        </div>

        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="livestock-restock-buy">
            {t("Buying price")}
          </label>
          <input
            id="livestock-restock-buy"
            type="number"
            min={0}
            step="0.01"
            className="livestockDetailModalInput"
            disabled={isPending}
            {...register("buyingPrice")}
          />
          {errors.buyingPrice?.message && (
            <p className="livestockDetailModalError" role="alert">
              {errors.buyingPrice.message}
            </p>
          )}
        </div>

        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="livestock-restock-sell">
            {t("Selling price")}
          </label>
          <input
            id="livestock-restock-sell"
            type="number"
            min={0}
            step="0.01"
            className="livestockDetailModalInput"
            disabled={isPending}
            {...register("sellingPrice")}
          />
          {errors.sellingPrice?.message && (
            <p className="livestockDetailModalError" role="alert">
              {errors.sellingPrice.message}
            </p>
          )}
        </div>

        {/* <p className="livestockDetailModalHint" role="note">
          {t("Only the quantity is submitted to the server; buying and selling prices are optional local notes.")}
        </p> */}

        <div className="livestockDetailModalFooter">
          <button
            type="button"
            className="livestockDetailModalBtn"
            disabled={isPending}
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
          <button type="submit" className="livestockDetailModalBtn livestockDetailModalBtnPrimary" disabled={isPending}>
            {isPending ? t("Loading…") : t("Restock")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
