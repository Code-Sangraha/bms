"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { deductLivestockItem, type LivestockItem } from "@/handlers/product";
import {
  livestockConsumptionDetailSchema,
  livestockConsumptionTypes,
  type LivestockConsumptionDetailFormValues,
} from "@/schema/livestockDetailModals";
import "./livestockDetailShell.scss";

type LivestockConsumptionDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: LivestockItem;
  livestockItemId: string;
  onSuccess?: () => void;
};

export default function LivestockConsumptionDetailModal({
  isOpen,
  onClose,
  item,
  livestockItemId,
  onSuccess,
}: LivestockConsumptionDetailModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LivestockConsumptionDetailFormValues>({
    resolver: zodResolver(livestockConsumptionDetailSchema),
    defaultValues: {
      quantity: 1,
      consumptionType: "Waste",
      remarks: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: LivestockConsumptionDetailFormValues) =>
      deductLivestockItem({
        livestockItemId,
        quantity: values.quantity,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Failed to deduct livestock item."), "error");
        return;
      }
      showToast(t("Consumption recorded successfully."), "success");
      reset({ quantity: 1, consumptionType: "Waste", remarks: "" });
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventoryDetailWasteHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["livestockItemsByProduct"] });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: LivestockConsumptionDetailFormValues) => {
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("Confirm Consumption")}
      subtitle={t("Reduce stored quantity for this line item.")}
      modalClassName="modalWide"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="livestockDetailModalForm">
        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="livestock-consume-qty">
            {t("Quantity")}
          </label>
          <input
            id="livestock-consume-qty"
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
          <label className="livestockDetailModalLabel" htmlFor="livestock-consume-type">
            {t("Consumption type")}
          </label>
          <select
            id="livestock-consume-type"
            className="livestockDetailModalSelect"
            disabled={isPending}
            {...register("consumptionType")}
          >
            {livestockConsumptionTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.consumptionType?.message && (
            <p className="livestockDetailModalError" role="alert">
              {errors.consumptionType.message}
            </p>
          )}
        </div>

        <div className="livestockDetailModalField">
          <label className="livestockDetailModalLabel" htmlFor="livestock-consume-remarks">
            {t("Remarks")}
          </label>
          <textarea
            id="livestock-consume-remarks"
            className="livestockDetailModalTextarea"
            disabled={isPending}
            {...register("remarks")}
          />
        </div>

        <p className="livestockDetailModalHint" role="note">
          {t("Only the quantity is submitted to the server; remarks are optional local notes.")}
        </p>

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
            {isPending ? t("Loading…") : t("Confirm Consumption")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
