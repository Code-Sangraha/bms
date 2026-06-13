"use client";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { getWasteProducts, WASTE_PRODUCTS_QUERY_KEY } from "@/handlers/product";
import { logWasteProductsDebug } from "@/lib/wasteProductsDebug";

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

  return (
    <div className="livestockDetailModalField">
      <label className="livestockDetailModalLabel" htmlFor={id}>
        {t("Waste product")}
      </label>
      <select
        id={id}
        className="livestockDetailModalSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading}
      >
        <option value="">{t("Select waste product")}</option>
        {wasteProducts.map((product) => {
          const stock =
            typeof product.weight === "number" && Number.isFinite(product.weight)
              ? product.weight
              : product.quantity;
          const stockLabel =
            typeof stock === "number" && Number.isFinite(stock) ? ` (${stock} kg)` : "";
          return (
            <option key={product.id} value={product.id}>
              {`${product.name}${stockLabel}`}
            </option>
          );
        })}
      </select>
      {error && (
        <p className="livestockDetailModalError" role="alert">{error}</p>
      )}
      {!isLoading && wasteProducts.length === 0 && (
        <p className="livestockDetailModalHint">
          {t("No waste products available.")}{" "}
          <Link to="/dashboard/product/wasteProduct">{t("Create waste products first")}</Link>
        </p>
      )}
    </div>
  );
}
