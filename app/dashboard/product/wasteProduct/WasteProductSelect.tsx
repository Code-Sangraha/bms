"use client";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { getWasteProducts, WASTE_PRODUCTS_QUERY_KEY } from "@/handlers/product";
import { logWasteProductsDebug } from "@/lib/wasteProductsDebug";
import { FormField } from "@/app/components/ui-ext/FormField";
import { SaleSelect } from "@/app/dashboard/invoices/components/SaleSelect";

type WasteProductSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export default function WasteProductSelect({
  id = "waste-product-select",
  value,
  onChange,
  disabled,
  error,
}: WasteProductSelectProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const { data: wasteProducts = [], isLoading } = useQuery({
    queryKey: WASTE_PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      logWasteProductsDebug("WasteProductSelect: queryFn start");
      const result = await getWasteProducts();
      if (!result.ok) {
        logWasteProductsDebug("WasteProductSelect: queryFn failed", {
          status: result.status,
          error: result.error,
        });
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      logWasteProductsDebug("WasteProductSelect: queryFn success", {
        count: result.data.length,
        options: result.data.map((p) => ({ id: p.id, name: p.name, outletId: p.outletId })),
      });
      return result.data;
    },
  });

  const options = wasteProducts.map((product) => {
    const stock =
      typeof product.weight === "number" && Number.isFinite(product.weight)
        ? product.weight
        : product.quantity;
    const stockLabel =
      typeof stock === "number" && Number.isFinite(stock) ? ` (${stock} kg)` : "";
    return {
      value: product.id,
      label: `${product.name}${stockLabel}`,
    };
  });

  return (
    <FormField
      id={id}
      label={t("Waste product")}
      error={error}
      description={
        !isLoading && wasteProducts.length === 0 ? (
          <>
            {t("No waste products available.")}{" "}
            <Link to="/dashboard/product/wasteProduct">{t("Create waste products first")}</Link>
          </>
        ) : undefined
      }
    >
      <SaleSelect
        id={id}
        value={value}
        onChange={onChange}
        placeholder={t("Select waste product")}
        options={options}
        disabled={disabled || isLoading}
        aria-invalid={Boolean(error)}
      />
    </FormField>
  );
}
