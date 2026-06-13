"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import WasteProductSelect from "@/app/dashboard/product/wasteProduct/WasteProductSelect";
import { getWasteProducts, WASTE_PRODUCTS_QUERY_KEY } from "@/handlers/product";
import { getProcessedStockWeight } from "@/app/dashboard/product/processedProduct/lib/processedStockWeight";
import { createWasteSale } from "@/handlers/sale";
import { formatSaleAmount } from "@/lib/saleCalculations";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  paymentMethodLabel,
  SALE_PAYMENT_METHOD_OPTIONS,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { validateWasteSaleCreate } from "@/schema/sale";
import "../new/pos.scss";

const SALES_QUERY_KEY = ["sales"];
const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const PRODUCTS_QUERY_KEY = ["products"];

export default function WasteSalesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { userOutletId } = useAuth();
  const { rowFilterOutletId } = useRowFilterOutletId();

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [wasteProductId, setWasteProductId] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>(
    DEFAULT_SALE_PAYMENT_METHOD
  );
  const [error, setError] = useState<string | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);

  const { data: wasteProducts = [] } = useQuery({
    queryKey: WASTE_PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getWasteProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const selectedWasteProduct = useMemo(
    () => wasteProducts.find((product) => product.id === wasteProductId) ?? null,
    [wasteProducts, wasteProductId]
  );

  const saleOutletId = useMemo(() => {
    if (selectedWasteProduct?.outletId) return selectedWasteProduct.outletId;
    return rowFilterOutletId ?? userOutletId ?? "";
  }, [selectedWasteProduct, rowFilterOutletId, userOutletId]);

  const selectedWasteStock = selectedWasteProduct
    ? getProcessedStockWeight(selectedWasteProduct)
    : null;

  const parsedAmount = useMemo(() => {
    const value = Number(amountInput);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [amountInput]);

  const checkoutConfirmMessage = useMemo(() => {
    const paymentLabel = paymentMethodLabel(paymentMethod);
    return [
      t("Total due: Rs.{{amount}}").replace(
        "{{amount}}",
        formatSaleAmount(parsedAmount ?? 0)
      ),
      t("Payment: {{method}}").replace("{{method}}", paymentLabel),
      t("Complete this waste sale and add it to transactions?"),
    ].join("\n");
  }, [parsedAmount, paymentMethod, t]);

  const createWasteSaleMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = customerName.trim();
      const trimmedContact = customerContact.trim();
      const weight = Number(weightInput);
      const amount = Number(amountInput);

      const payload = {
        name: trimmedName,
        contact: trimmedContact,
        productId: wasteProductId.trim(),
        outletId: saleOutletId.trim(),
        weight,
        amount,
        paymentMethod,
        wasteSales: true as const,
        discountAmount: 0,
      };

      const validation = validateWasteSaleCreate(payload);
      if (!validation.ok) {
        return { saleOk: false as const, error: validation.error, status: 400 };
      }

      const saleResult = await createWasteSale(validation.data);
      if (!saleResult.ok) {
        return {
          saleOk: false as const,
          error: saleResult.error,
          status: saleResult.status,
        };
      }

      return { saleOk: true as const };
    },
    onSuccess: (result) => {
      if (!result.saleOk) {
        if (result.status === 401) navigate("/login");
        else {
          setError(result.error);
          showToast(result.error, "error");
        }
        return;
      }

      setCustomerName("");
      setCustomerContact("");
      setWasteProductId("");
      setWeightInput("");
      setAmountInput("");
      setPaymentMethod(DEFAULT_SALE_PAYMENT_METHOD);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_SALES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: WASTE_PRODUCTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      navigate("/dashboard/invoices/transaction");
    },
    onError: () => {
      const message = t("Something went wrong. Please try again.");
      setError(message);
      showToast(message, "error");
    },
  });

  const doCheckout = () => {
    createWasteSaleMutation.mutate();
    setCheckoutConfirmOpen(false);
  };

  const handleCheckout = () => {
    if (!customerName.trim()) {
      setError(t("Enter customer details."));
      return;
    }
    if (!customerContact.trim()) {
      setError(t("Enter customer contact."));
      return;
    }
    if (!wasteProductId.trim()) {
      setError(t("Waste product is required when deducting weight."));
      return;
    }
    if (!saleOutletId.trim()) {
      setError(t("Outlet is required for waste sales."));
      return;
    }
    const weight = Number(weightInput);
    if (!Number.isFinite(weight) || weight <= 0) {
      setError(t("Weight must be greater than 0."));
      return;
    }
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("Line amount must be greater than 0"));
      return;
    }

    if (
      selectedWasteStock != null &&
      Number.isFinite(selectedWasteStock) &&
      weight > selectedWasteStock
    ) {
      setError(t("Sale weight cannot exceed waste product stock."));
      return;
    }

    const validation = validateWasteSaleCreate({
      name: customerName.trim(),
      contact: customerContact.trim(),
      productId: wasteProductId.trim(),
      outletId: saleOutletId.trim(),
      weight,
      amount,
      paymentMethod,
      wasteSales: true,
      discountAmount: 0,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError(null);
    setCheckoutConfirmOpen(true);
  };

  return (
    <section className="posPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {" > "} {t("Waste Sales")}
      </div>

      <div className="posHeader">
        <div className="posHeaderText">
          <h1 className="pageTitle">{t("Waste Sales")}</h1>
          <p className="pageSubtitle">
            {t("Record a sale of processed waste by weight and amount.")}
          </p>
        </div>
      </div>

      <div className="posCard posCard--primary">
        <header className="posCardHeader">
          <h2 className="posCardTitle">{t("Waste sale")}</h2>
          <p className="posCardDescription">
            {t("Select a waste product; stock is deducted from that product when the sale is recorded.")}
          </p>
        </header>

        <section className="posSection" aria-labelledby="waste-section-customer">
          <h3 id="waste-section-customer" className="posSectionTitle">
            {t("Customer")}
          </h3>
          <div className="posFormRow posFormRow--customer">
            <label className="posField posField--customerName" htmlFor="waste-customer-name">
              <span className="posLabel">{t("Customer Details")}</span>
              <input
                id="waste-customer-name"
                className="posInput"
                placeholder={t("Customer name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                aria-label={t("Customer Details")}
                autoComplete="name"
              />
            </label>
            <label className="posField posField--contact">
              <span className="posLabel">{t("Contact")}</span>
              <input
                className="posInput"
                placeholder={t("Phone or email")}
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                aria-label={t("Customer contact")}
                autoComplete="tel"
              />
            </label>
          </div>
        </section>

        <section className="posSection" aria-labelledby="waste-section-sale">
          <h3 id="waste-section-sale" className="posSectionTitle">
            {t("Sale details")}
          </h3>
          <div className="posLineForm__pricingGrid posLineForm__pricingGrid--wasteProduct">
            <WasteProductSelect
              id="waste-sale-product"
              value={wasteProductId}
              onChange={(value) => {
                setWasteProductId(value);
                setError(null);
              }}
            />
          </div>
          {selectedWasteProduct && (
            <p className="posFieldHint" role="status">
              {t("Available waste stock")}:{" "}
              {selectedWasteStock != null && Number.isFinite(selectedWasteStock)
                ? `${selectedWasteStock} kg`
                : "—"}
            </p>
          )}
          <div className="posLineForm__pricingGrid">
            <label className="posField">
              <span className="posLabel">{t("Weight (kg)")}</span>
              <input
                className="posInput"
                type="number"
                min={0}
                step="any"
                value={weightInput}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setWeightInput(e.target.value)}
                aria-label={t("Weight (kg)")}
              />
            </label>
            <label className="posField">
              <span className="posLabel">{t("Line amount (Rs.)")}</span>
              <input
                className="posInput"
                type="number"
                min={0}
                step="any"
                value={amountInput}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-label={t("Line amount")}
              />
            </label>
          </div>
        </section>

        <section className="posSection" aria-labelledby="waste-section-payment">
          <h3 id="waste-section-payment" className="posSectionTitle">
            {t("Payment")}
          </h3>
          <div className="posFormRow posFormRow--outletPayment">
            <div className="posField posField--segment posField--payment">
              <span className="posLabel" id="waste-payment-method-label">
                {t("Payment method")}
              </span>
              <div
                className="posSegment"
                role="radiogroup"
                aria-labelledby="waste-payment-method-label"
              >
                {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => {
                  const selected = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`posSegment__btn${selected ? " posSegment__btn--active" : ""}`}
                      onClick={() => setPaymentMethod(opt.value)}
                    >
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="posField posField--summary">
              <span className="posLabel">{t("Total due")}</span>
              <div className="posLineTotal" aria-live="polite">
                {parsedAmount != null ? formatSaleAmount(parsedAmount) : "—"}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="posErrorBlock" role="alert">
            <p className="posError">{error}</p>
          </div>
        )}

        <button
          type="button"
          className="posCheckoutBtn"
          onClick={handleCheckout}
          disabled={createWasteSaleMutation.isPending}
        >
          {createWasteSaleMutation.isPending ? t("Processing…") : t("Checkout")}
        </button>
      </div>

   

      <ConfirmModal
        isOpen={checkoutConfirmOpen}
        title={t("Confirm checkout")}
        message={checkoutConfirmMessage}
        confirmLabel={t("Checkout")}
        cancelLabel={t("Cancel")}
        loading={createWasteSaleMutation.isPending}
        onClose={() => setCheckoutConfirmOpen(false)}
        onConfirm={doCheckout}
      />
    </section>
  );
}
