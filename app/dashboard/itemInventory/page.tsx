"use client";

import { Navigate } from "react-router-dom";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useI18n } from "@/app/providers/I18nProvider";
import { useMainOutletInventoryAccess } from "@/app/hooks/useMainOutletInventoryAccess";
import InventoryTab from "./InventoryTab";
import MovementsTab from "./MovementsTab";
import OpeningClosingTab from "./OpeningClosingTab";
import SetupTab from "./SetupTab";

export default function ItemInventoryPage() {
  const { t } = useI18n();
  const access = useMainOutletInventoryAccess();
  if (access.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label={t("Loading")} />;
  if (!access.isAllowed) return <Navigate to="/dashboard" replace />;

  return (
    <section className="space-y-5 pb-8">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" />{t("Item Inventory")}</span>}
        subtitle={t("Track outlet stock, movements, daily balances, categories, and units.")}
        breadcrumb={<p className="text-xs text-muted-foreground">{t("Dashboard")} / {t("Item Inventory")}</p>}
      />
      <Tabs defaultValue="inventory" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="inventory">{t("Inventory")}</TabsTrigger>
            <TabsTrigger value="movements">{t("Movements")}</TabsTrigger>
            <TabsTrigger value="opening-closing">{t("Opening & Closing")}</TabsTrigger>
            <TabsTrigger value="setup">{t("Setup")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="inventory" className="mt-4"><InventoryTab /></TabsContent>
        <TabsContent value="movements" className="mt-4"><MovementsTab /></TabsContent>
        <TabsContent value="opening-closing" className="mt-4"><OpeningClosingTab /></TabsContent>
        <TabsContent value="setup" className="mt-4"><SetupTab /></TabsContent>
      </Tabs>
    </section>
  );
}