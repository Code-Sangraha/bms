"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CircleCheck,
  CreditCard,
  PackageCheck,
  Scale,
  UserRound,
} from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import WasteProductSelect from "@/app/dashboard/product/wasteProduct/WasteProductSelect";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import { SaleFormSection } from "@/app/dashboard/invoices/components/SaleFormSection";
import { SalePageLayout } from "@/app/dashboard/invoices/components/SalePageLayout";
import { getCustomerTypes } from "@/handlers/customerType";
import { getWasteProducts, WASTE_PRODUCTS_QUERY_KEY } from "@/handlers/product";
import { getProcessedStockWeight } from "@/app/dashboard/product/processedProduct/lib/processedStockWeight";
import { createWasteSale } from "@/handlers/sale";
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
    <SalePageLayout
      sectionLabel={t("Sales & Billing")}
      pageTitle={t("Waste Sales")}
      subtitle={t("Record a sale of processed waste by weight and amount.")}
      actions={
        <Badge variant="success" className="gap-1.5 px-3 py-1.5 text-xs font-semibold">
          <PackageCheck className="size-3.5" aria-hidden />
          {t("Waste sale")}
        </Badge>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="border-b pb-5">
            <CardTitle>{t("Waste sale details")}</CardTitle>
            <CardDescription>
              {t("Enter customer information, select a waste product, and set weight and amount.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form
              id="waste-sale-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleCheckout();
              }}
            >
              <SaleFormSection
                divided={false}
                id="waste-section-customer"
                title={t("Customer")}
                icon={<UserRound className="size-4" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="waste-customer-name" label={t("Customer Details")}>
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
                  <FormField
                    id="waste-customer-type"
                    label={t("Customer Type")}
                    className="sm:col-span-2"
                  >
                    <select
                      id="waste-customer-type"
                      className="saleSelect"
                      value={customerTypeId}
                      onChange={(e) => {
                        setCustomerTypeId(e.target.value);
                        clearError();
                      }}
                    >
                      <option value="">{t("Select customer type")}</option>
                      {customerTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </SaleFormSection>

              <SaleFormSection
                id="waste-section-sale"
                title={t("Sale details")}
                icon={<Scale className="size-4" />}
                description={t("Choose the waste product and enter weight and line amount.")}
              >
                <div className="space-y-4">
                  <WasteProductSelect
                    id="waste-sale-product"
                    value={wasteProductId}
                    onChange={(value) => {
                      setWasteProductId(value);
                      setError(null);
                    }}
                  />
                  {selectedWasteProduct ? (
                    <div
                      className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm"
                      role="status"
                    >
                      <PackageCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-muted-foreground">{t("Available waste stock")}</span>
                      <strong className="ml-auto font-semibold text-primary">{stockDisplay}</strong>
                    </div>
                  ) : null}
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
                id="waste-section-payment"
                title={t("Payment")}
                icon={<CreditCard className="size-4" />}
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
                <Alert variant="destructive" className="mt-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </form>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 pt-6 lg:hidden">
            <Button
              type="submit"
              form="waste-sale-form"
              className="h-11 w-full gap-2 rounded-full text-base font-semibold"
              disabled={createWasteSaleMutation.isPending}
            >
              <CircleCheck className="size-4" aria-hidden />
              {createWasteSaleMutation.isPending ? t("Processing...") : t("Checkout")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("Order summary")}</CardTitle>
              <CardDescription>{t("Review before checkout")}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="saleSummaryPanel">
                <div className="saleSummaryRow">
                  <dt>{t("Product")}</dt>
                  <dd>{selectedProductName}</dd>
                </div>
                <div className="saleSummaryRow">
                  <dt>{t("Stock")}</dt>
                  <dd>{stockDisplay}</dd>
                </div>
                <div className="saleSummaryRow">
                  <dt>{t("Weight")}</dt>
                  <dd>{weightDisplay}</dd>
                </div>
                <div className="saleSummaryRow">
                  <dt>{t("Payment")}</dt>
                  <dd>{paymentDisplay}</dd>
                </div>
                <div className="saleSummaryTotal" aria-live="polite">
                  <span>{t("Total due")}</span>
                  <strong>{totalDueDisplay}</strong>
                </div>
              </dl>
            </CardContent>
            <CardFooter className="hidden flex-col gap-2 pt-0 lg:flex">
              <Button
                type="submit"
                form="waste-sale-form"
                className="h-11 w-full gap-2 rounded-full text-base font-semibold"
                disabled={createWasteSaleMutation.isPending}
              >
                <CircleCheck className="size-4" aria-hidden />
                {createWasteSaleMutation.isPending ? t("Processing...") : t("Checkout")}
                <ArrowRight className="size-4" aria-hidden />
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
