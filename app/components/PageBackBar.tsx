"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useI18n } from "@/app/providers/I18nProvider";
import { useOptionalOutletAccess } from "@/app/providers/OutletAccessProvider";
import { Button } from "@/app/components/ui/button";

/**
 * Top-left back control for dashboard sub-routes. Uses browser history; falls
 * back to overview. Hidden on the dashboard root and for outlet-staff who do
 * not have a hierarchy to navigate up.
 */
export default function PageBackBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const outletAccess = useOptionalOutletAccess();

  const isDashboardSubRoute =
    pathname.startsWith("/dashboard") && pathname !== "/dashboard";

  if (outletAccess?.accessTier === "outlet_staff") return null;
  if (!isDashboardSubRoute) return null;

  return (
    <div className="mb-3 w-full self-stretch">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(-1)}
        aria-label={t("Back")}
        className="group bg-card text-foreground hover:border-brand-200 hover:bg-muted hover:text-brand-700"
      >
        <ArrowLeft
          className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
          aria-hidden
        />
        <span>{t("Back")}</span>
      </Button>
    </div>
  );
}
