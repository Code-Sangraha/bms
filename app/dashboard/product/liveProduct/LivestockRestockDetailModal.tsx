"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { getSuppliers } from "@/handlers/supplier";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  restockLivestockItem,
  type LivestockItem,
  type LivestockRestockPayload,
  type PaymentStatus,
} from "@/handlers/product";
import {
  livestockRestockDetailSchema,
  type LivestockRestockDetailFormValues,
} from "@/schema/livestockDetailModals";
import { computeDueAmount, derivePaymentStatus } from "@/lib/billing/paymentStatus";
import "./livestockDetailShell.scss";
import SupplierPicker from "./SupplierPicker";

type LivestockRestockDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: LivestockItem;
  livestockItemId: string;
  onSuccess?: () => void;
};

const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  ADVANCE: "livestockDetailModalBadge livestockDetailModalBadgeAdvance",
  PARTIAL: "livestockDetailModalBadge livestockDetailModalBadgePartial",
  FULL: "livestockDetailModalBadge livestockDetailModalBadgeFull",
};

const DEFAULT_VALUES: LivestockRestockDetailFormValues = {
  quantity: 1,
  buyingPrice: undefined,
  sellingPrice: undefined,
  supplierName: "",
  supplierContact: undefined,
  totalAmount: 0,
  paidAmount: 0,
  remarks: undefined,
};

export default function LivestockRestockDetailModal({
  isOpen,
  onClose,
  item,
  livestockItemId,
  onSuccess,
}: LivestockRestockDetailModalProps) {
  const rawOutletId = (item as LivestockItem & { outletId?: unknown }).outletId;
  const restockOutletId = typeof rawOutletId === "string" && rawOutletId.trim() ? rawOutletId.trim() : null;
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<LivestockRestockDetailFormValues>({
    resolver: zodResolver(livestockRestockDetailSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", restockOutletId ?? "none"],
    enabled: isOpen && Boolean(restockOutletId),
    queryFn: async () => {
      const result = await getSuppliers(restockOutletId);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  useEffect(() => {
    if (!isOpen) setSelectedSupplierId("");
  }, [isOpen]);

  const totalAmountWatch = useWatch({ control, name: "totalAmount" });
  const paidAmountWatch = useWatch({ control, name: "paidAmount" });
  const totalNum = Number(totalAmountWatch) || 0;
  const paidNum = Number(paidAmountWatch) || 0;
  const dueAmount = computeDueAmount(totalNum, paidNum);
  const paymentStatus = derivePaymentStatus(totalNum, paidNum);

  const paymentStatusLabel: Record<PaymentStatus, string> = {
    ADVANCE: t("Advance"),
    PARTIAL: t("Partial"),
    FULL: t("Full"),
  };

  const mutation = useMutation({
    mutationFn: (values: LivestockRestockDetailFormValues) => {
      const qty = Math.floor(values.quantity);
      const total = Number(values.totalAmount) || 0;
      const paid = Number(values.paidAmount) || 0;
      const body: LivestockRestockPayload = {
        livestockItemId,
        quantity: qty,
        supplierName: values.supplierName.trim(),
        supplierId: selectedSupplierId || undefined,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: computeDueAmount(total, paid),
        paymentStatus: derivePaymentStatus(total, paid),
      };
      if (values.buyingPrice != null && Number.isFinite(values.buyingPrice)) {
        body.buyingPrice = values.buyingPrice;
      }
      if (values.sellingPrice != null && Number.isFinite(values.sellingPrice)) {
        body.sellingPrice = values.sellingPrice;
      }
      if (values.supplierContact) body.supplierContact = values.supplierContact;
      if (values.remarks) body.remarks = values.remarks;
      return restockLivestockItem(body);
    },
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Failed to restock livestock item."), "error");
        return;
      }
      showToast(t("Restock completed successfully."), "success");
      reset(DEFAULT_VALUES);
      setSelectedSupplierId("");
      setSelectedSupplierId("");
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["livestockExpenseHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["livestockItemsByProduct"] });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: LivestockRestockDetailFormValues) => {
    if (!selectedSupplierId) {
      showToast(t("Select or create a supplier."), "error");
      return;
    }
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

        <div className="livestockDetailModalSection">
          <h4 className="livestockDetailModalSectionTitle">{t("Supplier & Payment")}</h4>
          <SupplierPicker
            outletId={restockOutletId}
            selectedSupplierId={selectedSupplierId}
            disabled={isPending}
            onSelect={(supplier) => {
              setSelectedSupplierId(supplier.id);
              setValue("supplierName", supplier.name, { shouldValidate: true });
              setValue("supplierContact", supplier.contact ?? undefined);
            }}
          />

          {false && restockOutletId && (suppliersQuery.data?.length || suppliersQuery.isLoading) ? (
            <div className="livestockDetailModalField">
              <label className="livestockDetailModalLabel" htmlFor="livestock-restock-supplier-select">
                {t("Saved supplier")}
              </label>
              <select
                id="livestock-restock-supplier-select"
                className="livestockDetailModalSelect"
                value={selectedSupplierId}
                disabled={isPending || suppliersQuery.isLoading}
                onChange={(event) => {
                  const supplierId = event.target.value;
                  if (supplierId === "__new__") { navigate("/dashboard/product/suppliers"); return; }
                  setSelectedSupplierId(supplierId);
                  const supplier = suppliersQuery.data?.find((row) => row.id === supplierId);
                  if (!supplier) return;
                  setValue("supplierName", supplier.name, { shouldValidate: true });
                  setValue("supplierContact", supplier.contact ?? undefined);
                }}
              >
                <option value="">{t("Select saved supplier")}</option>
                <option value="__new__">{t("Add new supplier")}</option>
                {(suppliersQuery.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}{supplier.contact ? " — " + supplier.contact : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="livestock-restock-supplier">
              {t("Supplier name")}
            </label>
            <input
              id="livestock-restock-supplier"
              type="text"
              className="livestockDetailModalInput"
              disabled={isPending}
              readOnly
              {...register("supplierName")}
            />
            {errors.supplierName?.message && (
              <p className="livestockDetailModalError" role="alert">
                {errors.supplierName.message}
              </p>
            )}
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="livestock-restock-contact">
              {t("Supplier contact")}
            </label>
            <input
              id="livestock-restock-contact"
              type="text"
              className="livestockDetailModalInput"
              disabled={isPending}
              readOnly
              {...register("supplierContact")}
            />
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="livestock-restock-total">
              {t("Total amount")}
            </label>
            <input
              id="livestock-restock-total"
              type="number"
              min={0}
              step="0.01"
              className="livestockDetailModalInput"
              disabled={isPending}
              {...register("totalAmount")}
            />
            {errors.totalAmount?.message && (
              <p className="livestockDetailModalError" role="alert">
                {errors.totalAmount.message}
              </p>
            )}
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="livestock-restock-paid">
              {t("Paid amount")}
            </label>
            <input
              id="livestock-restock-paid"
              type="number"
              min={0}
              step="0.01"
              className="livestockDetailModalInput"
              disabled={isPending}
              {...register("paidAmount")}
            />
            {errors.paidAmount?.message && (
              <p className="livestockDetailModalError" role="alert">
                {errors.paidAmount.message}
              </p>
            )}
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel">{t("Due amount")}</label>
            <input
              type="number"
              className="livestockDetailModalInput"
              value={dueAmount}
              readOnly
              tabIndex={-1}
            />
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel">{t("Payment status")}</label>
            <div>
              <span className={PAYMENT_STATUS_BADGE_CLASS[paymentStatus]}>
                {paymentStatusLabel[paymentStatus]}
              </span>
            </div>
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="livestock-restock-remarks">
              {t("Remarks")}
            </label>
            <textarea
              id="livestock-restock-remarks"
              rows={2}
              className="livestockDetailModalInput"
              disabled={isPending}
              {...register("remarks")}
            />
          </div>
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
          <button type="submit" className="livestockDetailModalBtn livestockDetailModalBtnPrimary" disabled={isPending}>
            {isPending ? t("Loading…") : t("Restock")}
          </button>
        </div>
      </form>
    </Modal>
  );
}


