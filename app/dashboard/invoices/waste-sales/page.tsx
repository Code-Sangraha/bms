"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuArrowRight,
  LuCircleCheck,
  LuCreditCard,
  LuPackageCheck,
  LuScale,
  LuUserRound,
} from "react-icons/lu";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import WasteProductSelect from "@/app/dashboard/product/wasteProduct/WasteProductSelect";
import { getCustomerTypes } from "@/handlers/customerType";
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
import "./waste-sales.scss";

const SALES_QUERY_KEY = ["sales"];
const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const PRODUCTS_QUERY_KEY = ["products"];
const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];
const WEIGHT_FORMATTER = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function formatWasteWeight(value: number | null): string {
  return value != null && Number.isFinite(value)
    ? `${WEIGHT_FORMATTER.format(value)} kg`
    : "-";
}

export default function WasteSalesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { userOutletId } = useAuth();
  const { rowFilterOutletId } = useRowFilterOutletId();

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerTypeId, setCustomerTypeId] = useState("");
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

  const { data: customerTypes = [] } = useQuery({
    queryKey: CUSTOMER_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getCustomerTypes();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  useEffect(() => {
    if (!customerTypeId && customerTypes.length > 0) {
      setCustomerTypeId(customerTypes[0].id);
    }
  }, [customerTypeId, customerTypes]);

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

  const parsedWeight = useMemo(() => {
    const value = Number(weightInput);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [weightInput]);

  const totalDueDisplay =
    parsedAmount != null ? formatSaleAmount(parsedAmount) : "-";
  const weightDisplay = parsedWeight != null ? formatWasteWeight(parsedWeight) : "-";
  const stockDisplay = formatWasteWeight(selectedWasteStock);
  const selectedProductName = selectedWasteProduct?.name ?? t("Not selected");
  const paymentDisplay = t(paymentMethodLabel(paymentMethod));

  const clearError = () => {
    if (error) setError(null);
  };

  const checkoutConfirmMessage = useMemo(() => {
    const paymentLabel = t(paymentMethodLabel(paymentMethod));
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
        customerTypeId: customerTypeId.trim(),
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
      setCustomerTypeId(customerTypes[0]?.id ?? "");
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
    if (!customerTypeId.trim()) {
      setError(t("Customer type is required"));
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
      customerTypeId: customerTypeId.trim(),
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
    <section className="wasteSalesPage">
      <div className="wasteSalesBreadcrumb">
        <span>{t("Sales & Billing")}</span> {" > "} {t("Waste Sales")}
      </div>

      <header className="wasteSalesHeader">
        <div className="wasteSalesHeaderText">
          <h1 className="wasteSalesTitle">{t("Waste Sales")}</h1>
          <p className="wasteSalesSubtitle">
            {t("Record a sale of processed waste by weight and amount.")}
          </p>
        </div>
        <div className="wasteSalesHeaderBadge">
          <LuPackageCheck aria-hidden />
          <span>{t("Waste sale")}</span>
        </div>
      </header>

      <div className="wasteSalesLayout">
        <form
          className="wasteSalesFormPanel"
          onSubmit={(event) => {
            event.preventDefault();
            handleCheckout();
          }}
        >
          <header className="wasteSalesFormHeader">
            <div>
              <span className="wasteSalesFormKicker">{t("Invoice form")}</span>
              <h2 className="wasteSalesFormTitle">{t("Waste sale details")}</h2>
            </div>
            <div className="wasteSalesFormTotal" aria-live="polite">
              <span>{t("Total due")}</span>
              <strong>{totalDueDisplay}</strong>
            </div>
          </header>

          <dl className="wasteSalesInlineSummary" aria-label={t("Waste sale details")}>
            <div>
              <dt>{t("Product")}</dt>
              <dd>{selectedProductName}</dd>
            </div>
            <div>
              <dt>{t("Stock")}</dt>
              <dd>{stockDisplay}</dd>
            </div>
            <div>
              <dt>{t("Weight")}</dt>
              <dd>{weightDisplay}</dd>
            </div>
            <div>
              <dt>{t("Payment")}</dt>
              <dd>{paymentDisplay}</dd>
            </div>
          </dl>

          <section className="wasteSalesSection" aria-labelledby="waste-section-customer">
            <div className="wasteSalesSectionHead">
              <span className="wasteSalesSectionIcon" aria-hidden>
                <LuUserRound />
              </span>
              <h3 id="waste-section-customer" className="wasteSalesSectionTitle">
                {t("Customer")}
              </h3>
            </div>
            <div className="wasteSalesGrid wasteSalesGrid--customer">
              <label className="wasteSalesField" htmlFor="waste-customer-name">
                <span className="wasteSalesLabel">{t("Customer Details")}</span>
                <input
                  id="waste-customer-name"
                  className="wasteSalesInput"
                  placeholder={t("Customer name")}
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    clearError();
                  }}
                  aria-label={t("Customer Details")}
                  autoComplete="name"
                />
              </label>
              <label className="wasteSalesField" htmlFor="waste-customer-contact">
                <span className="wasteSalesLabel">{t("Contact")}</span>
                <input
                  id="waste-customer-contact"
                  className="wasteSalesInput"
                  placeholder={t("Phone or email")}
                  value={customerContact}
                  onChange={(e) => {
                    setCustomerContact(e.target.value);
                    clearError();
                  }}
                  aria-label={t("Customer contact")}
                  autoComplete="tel"
                />
              </label>
              <label className="wasteSalesField" htmlFor="waste-customer-type">
                <span className="wasteSalesLabel">{t("Customer Type")}</span>
                <select
                  id="waste-customer-type"
                  className="wasteSalesInput wasteSalesSelect"
                  value={customerTypeId}
                  onChange={(e) => {
                    setCustomerTypeId(e.target.value);
                    clearError();
                  }}
                  aria-label={t("Customer Type")}
                >
                  <option value="">{t("Select customer type")}</option>
                  {customerTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="wasteSalesSection" aria-labelledby="waste-section-sale">
            <div className="wasteSalesSectionHead">
              <span className="wasteSalesSectionIcon" aria-hidden>
                <LuScale />
              </span>
              <h3 id="waste-section-sale" className="wasteSalesSectionTitle">
                {t("Sale details")}
              </h3>
            </div>
            <div className="wasteSalesGrid wasteSalesGrid--product">
              <div className="wasteSalesProductControl">
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
                <div className="wasteSalesStockStrip" role="status">
                  <LuPackageCheck aria-hidden />
                  <span>{t("Available waste stock")}</span>
                  <strong>{stockDisplay}</strong>
                </div>
              )}
            </div>
            <div className="wasteSalesGrid wasteSalesGrid--amounts">
              <label className="wasteSalesField" htmlFor="waste-sale-weight">
                <span className="wasteSalesLabel">{t("Weight (kg)")}</span>
                <input
                  id="waste-sale-weight"
                  className="wasteSalesInput"
                  type="number"
                  min={0}
                  step="any"
                  value={weightInput}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    setWeightInput(e.target.value);
                    clearError();
                  }}
                  aria-label={t("Weight (kg)")}
                  inputMode="decimal"
                />
              </label>
              <label className="wasteSalesField" htmlFor="waste-sale-amount">
                <span className="wasteSalesLabel">{t("Line amount (Rs.)")}</span>
                <input
                  id="waste-sale-amount"
                  className="wasteSalesInput"
                  type="number"
                  min={0}
                  step="any"
                  value={amountInput}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    clearError();
                  }}
                  aria-label={t("Line amount")}
                  inputMode="decimal"
                />
              </label>
            </div>
          </section>

          <section className="wasteSalesSection" aria-labelledby="waste-section-payment">
            <div className="wasteSalesSectionHead">
              <span className="wasteSalesSectionIcon" aria-hidden>
                <LuCreditCard />
              </span>
              <h3 id="waste-section-payment" className="wasteSalesSectionTitle">
                {t("Payment")}
              </h3>
            </div>
            <div className="wasteSalesPaymentRow">
              <div className="wasteSalesField wasteSalesField--segment">
                <span className="wasteSalesLabel" id="waste-payment-method-label">
                  {t("Payment method")}
                </span>
                <div
                  className="wasteSalesSegment"
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
                        className={`wasteSalesSegmentBtn${
                          selected ? " wasteSalesSegmentBtn--active" : ""
                        }`}
                        onClick={() => {
                          setPaymentMethod(opt.value);
                          clearError();
                        }}
                      >
                        {t(opt.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="wasteSalesErrorBlock" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="wasteSalesCheckoutBtn"
            disabled={createWasteSaleMutation.isPending}
          >
            <LuCircleCheck aria-hidden />
            <span>
              {createWasteSaleMutation.isPending ? t("Processing...") : t("Checkout")}
            </span>
            <LuArrowRight className="wasteSalesCheckoutArrow" aria-hidden />
          </button>
        </form>
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
