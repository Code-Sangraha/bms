"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";
import { useI18n } from "@/app/providers/I18nProvider";

/**
 * Top-left back control for dashboard sub-routes. Uses browser history; falls back to overview.
 */
export default function PageBackBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const isDashboardSubRoute =
    pathname.startsWith("/dashboard") && pathname !== "/dashboard";

  if (!isDashboardSubRoute) {
    return null;
  }

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="pageBackBar">
      <button
        type="button"
        className="pageBackButton"
        onClick={handleBack}
        aria-label={t("Back")}
      >
        <LuArrowLeft size={18} className="pageBackIcon" aria-hidden />
        <span>{t("Back")}</span>
      </button>
    </div>
  );
}
