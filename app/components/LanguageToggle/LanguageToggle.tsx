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
      <span className="languageToggleContent">
        <LuLanguages size={18} />
        <span className="languageToggleLabel">
          {locale === "en" ? "EN" : "NEP"}
        </span>
      </span>
    </button>
  );
}
