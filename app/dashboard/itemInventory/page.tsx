"use client";

import { Navigate } from "react-router-dom";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useI18n } from "@/app/providers/I18nProvider";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import InventoryTab from "./InventoryTab";
import MovementsTab from "./MovementsTab";
import OpeningClosingTab from "./OpeningClosingTab";
import SetupTab from "./SetupTab";
import SalesTab from "./SalesTab";
import { InventoryScopeProvider, useInventoryScope } from "./InventoryScope";

function ItemInventoryContent() {
  const { t } = useI18n();
  const scope = useInventoryScope();
  if (scope.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label={t("Loading")} />;
  if (!scope.permissions.read) return <Navigate to="/dashboard" replace />;

  return (
    <section className="space-y-5 pb-8">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" />{t("Item Inventory")}</span>}
        subtitle={t("Track outlet stock, movements, daily balances, categories, and units.")}
        breadcrumb={<p className="text-xs text-muted-foreground">{t("Dashboard")} / {t("Item Inventory")}</p>}
        actions={scope.permissions.allOutlets ? (
          <select
            className="h-10 min-w-52 rounded-md border border-input bg-background px-3 text-sm"
            value={scope.outletId}
            onChange={(event) => scope.selectOutlet(event.target.value)}
            aria-label={t("Outlet")}
          >
            {scope.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} · {outlet.itemCount} {t("items")}
              </option>
            ))}
          </select>
        ) : null}
      />
      {scope.error ? <Alert variant="destructive"><AlertDescription>{scope.error}</AlertDescription></Alert> : null}
      {!scope.outletId ? null : (
      <Tabs defaultValue="inventory" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="inventory">{t("Inventory")}</TabsTrigger>
            <TabsTrigger value="movements">{t("Movements")}</TabsTrigger>
            <TabsTrigger value="opening-closing">{t("Opening & Closing")}</TabsTrigger>
            <TabsTrigger value="sales">{t("Sales")}</TabsTrigger>
            {scope.permissions.create || scope.permissions.update || scope.permissions.delete ? <TabsTrigger value="setup">{t("Setup")}</TabsTrigger> : null}
          </TabsList>
        </div>
        <TabsContent value="inventory" className="mt-4"><InventoryTab /></TabsContent>
        <TabsContent value="movements" className="mt-4"><MovementsTab /></TabsContent>
        <TabsContent value="opening-closing" className="mt-4"><OpeningClosingTab /></TabsContent>
        <TabsContent value="sales" className="mt-4"><SalesTab /></TabsContent>
        {scope.permissions.create || scope.permissions.update || scope.permissions.delete ? <TabsContent value="setup" className="mt-4"><SetupTab /></TabsContent> : null}
      </Tabs>
      )}
    </section>
  );
}

export default function ItemInventoryPage() {
  return <InventoryScopeProvider><ItemInventoryContent /></InventoryScopeProvider>;
}
