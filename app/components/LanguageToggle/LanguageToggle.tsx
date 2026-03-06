"use client";

import { LuLanguages } from "react-icons/lu";
import { useI18n } from "@/app/providers/I18nProvider";

type LanguageToggleProps = {
  className?: string;
};

export default function LanguageToggle({
  className = "",
}: LanguageToggleProps) {
  const { locale, toggleLocale, t } = useI18n();

  return (
    <button
      type="button"
      className={className}
      onClick={toggleLocale}
      aria-label={locale === "en" ? t("Switch to Nepali") : t("Switch to English")}
      title={locale === "en" ? "EN / नेपाली" : "NEP / English"}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          lineHeight: 1,
        }}
      >
        <LuLanguages size={18} />
        <span style={{ fontSize: "0.6rem", fontWeight: 700 }}>
          {locale === "en" ? "EN" : "NEP"}
        </span>
      </span>
    </button>
  );
}
