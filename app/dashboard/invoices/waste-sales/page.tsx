"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Loader2, ArrowRight } from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import WasteProductSelect from "@/app/dashboard/product/wasteProduct/WasteProductSelect";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import { SaleFormSection } from "@/app/dashboard/invoices/components/SaleSharedComponents";
import { SalePageLayout } from "@/app/dashboard/invoices/components/SalePageLayout";
import { SaleSelect } from "@/app/dashboard/invoices/components/SaleSelect";
import { SaleSummary } from "@/app/dashboard/invoices/components/SaleSharedComponents";
import { getCustomerTypes } from "@/handlers/customerType";
import { getWasteProducts, WASTE_PRODUCTS_QUERY_KEY } from "@/handlers/product";
import { getProcessedStockWeight } from "@/app/dashboard/product/processedProduct/lib/processedStockWeight";
import { createWasteSale, type WasteSaleItemPayload } from "@/handlers/sale";
import { formatSaleAmount } from "@/lib/saleCalculations";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  paymentMethodLabel,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { validateWasteSaleCreate } from "@/schema/sale";
import "../components/sale-entry.scss";

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
        paymentMethod: paymentMethod as SalePaymentMethod,
        wasteSales: true as const,
        discountAmount: 0,
      };

      const validation = validateWasteSaleCreate(payload);
      if (!validation.ok) {
        return { saleOk: false as const, error: validation.error, status: 400 };
      }

      const saleResult = await createWasteSale(validation.data as WasteSaleItemPayload);
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
      paymentMethod: paymentMethod as SalePaymentMethod,
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

  const summaryRows = [
    { label: t("Product"), value: selectedProductName },
    ...(selectedWasteProduct ? [{ label: t("Stock"), value: stockDisplay }] : []),
    ...(parsedWeight != null ? [{ label: t("Weight"), value: formatWasteWeight(parsedWeight) }] : []),
    { label: t("Payment"), value: paymentDisplay },
  ];

  return (
    <SalePageLayout
      sectionLabel={t("Sales & Billing")}
      pageTitle={t("Waste Sales")}
      subtitle={t("Record a sale of processed waste by weight and amount.")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <Card className="min-w-0 shadow-sm">
          <CardContent className="pt-4">
            <form
              id="waste-sale-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleCheckout();
              }}
            >
              <SaleFormSection
                divided={false}
                compact
                id="waste-section-customer"
                title={t("Customer")}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="waste-customer-name" label={t("Name")}>
                    <Input
                      id="waste-customer-name"
                      placeholder={t("Customer name")}
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        clearError();
                      }}
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField id="waste-customer-contact" label={t("Contact")}>
                    <Input
                      id="waste-customer-contact"
                      placeholder={t("Phone or email")}
                      value={customerContact}
                      onChange={(e) => {
                        setCustomerContact(e.target.value);
                        clearError();
                      }}
                      autoComplete="tel"
                    />
                  </FormField>
                  <FormField id="waste-customer-type" label={t("Customer Type")}>
                    <SaleSelect
                      id="waste-customer-type"
                      value={customerTypeId}
                      onChange={(value) => {
                        setCustomerTypeId(value);
                        clearError();
                      }}
                      placeholder={t("Select customer type")}
                      options={customerTypes.map((ct) => ({
                        value: ct.id,
                        label: ct.name,
                      }))}
                    />
                  </FormField>
                </div>
              </SaleFormSection>

              <SaleFormSection
                compact
                id="waste-section-sale"
                title={t("Sale details")}
              >
                <div className="flex flex-col gap-4">
                  <WasteProductSelect
                    id="waste-sale-product"
                    value={wasteProductId}
                    onChange={(value) => {
                      setWasteProductId(value);
                      setError(null);
                    }}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="waste-sale-weight" label={t("Weight (kg)")}>
                      <Input
                        id="waste-sale-weight"
                        type="number"
                        min={0}
                        step="any"
                        value={weightInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          setWeightInput(e.target.value);
                          clearError();
                        }}
                        inputMode="decimal"
                      />
                    </FormField>
                    <FormField id="waste-sale-amount" label={t("Line amount (Rs.)")}>
                      <Input
                        id="waste-sale-amount"
                        type="number"
                        min={0}
                        step="any"
                        value={amountInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          clearError();
                        }}
                        inputMode="decimal"
                      />
                    </FormField>
                  </div>
                </div>
              </SaleFormSection>

              <SaleFormSection
                compact
                id="waste-section-payment"
                title={t("Payment")}
              >
                <FormField id="waste-payment-method" label={t("Payment method")}>
                  <PaymentMethodPicker
                    labelId="waste-payment-method"
                    value={paymentMethod}
                    onChange={(value) => {
                      setPaymentMethod(value);
                      clearError();
                    }}
                    t={t}
                  />
                </FormField>
              </SaleFormSection>

              {error ? (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </form>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 pt-4 lg:hidden">
            <Button
              type="submit"
              form="waste-sale-form"
              size="xl"
              className="w-full text-base font-semibold"
              disabled={createWasteSaleMutation.isPending}
            >
              {createWasteSaleMutation.isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <CircleCheck data-icon="inline-start" aria-hidden />
              )}
              {createWasteSaleMutation.isPending ? t("Processing...") : t("Checkout")}
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-3 lg:sticky lg:top-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <h3 className="text-sm font-semibold">{t("Order summary")}</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <SaleSummary
                rows={summaryRows}
                totalLabel={t("Total due")}
                totalValue={totalDueDisplay}
              />
            </CardContent>
            <CardFooter className="hidden flex-col gap-2 pt-0 lg:flex">
              <Button
                type="submit"
                form="waste-sale-form"
                size="xl"
                className="w-full text-base font-semibold"
                disabled={createWasteSaleMutation.isPending}
              >
                {createWasteSaleMutation.isPending ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : (
                  <CircleCheck data-icon="inline-start" aria-hidden />
                )}
                {createWasteSaleMutation.isPending ? t("Processing...") : t("Checkout")}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </CardFooter>
          </Card>
        </div>
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
    </SalePageLayout>
  );
}
