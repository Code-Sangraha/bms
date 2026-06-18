"use client";

import { useState } from "react";

import Modal from "@/app/components/Modal/Modal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { useI18n } from "@/app/providers/I18nProvider";
import { createDualPricing } from "@/handlers/dualPricing";

export type PricelistOutletTarget = {
  productId: string;
  outletId: string;
  productName: string;
  outletName: string;
};

type SetPricelistAfterCreateModalProps = {
  isOpen: boolean;
  targets: PricelistOutletTarget[];
  onClose: () => void;
  onSaved: () => void;
};

export default function SetPricelistAfterCreateModal({
  isOpen,
  targets,
  onClose,
  onSaved,
}: SetPricelistAfterCreateModalProps) {
  const { t } = useI18n();
  const [retailInput, setRetailInput] = useState("");
  const [wholesaleInput, setWholesaleInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setRetailInput("");
    setWholesaleInput("");
    setFormError(null);
    onClose();
  };

  const handleSave = async () => {
    const retail = Number(retailInput);
    const wholesale = Number(wholesaleInput);
    if (!Number.isFinite(retail) || retail <= 0) {
      setFormError(t("Retail price must be greater than 0."));
      return;
    }
    if (!Number.isFinite(wholesale) || wholesale <= 0) {
      setFormError(t("Wholesale price must be greater than 0."));
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const results = await Promise.all(
        targets.map((row) =>
          createDualPricing({
            productId: row.productId,
            outletId: row.outletId,
            retailPrice: retail,
            wholesalePrice: wholesale,
            status: "Active",
          })
        )
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setFormError(
          "error" in failed && typeof failed.error === "string"
            ? failed.error
            : t("Could not save all pricelist rows. Check Pricelist and try again.")
        );
        return;
      }
      const bodyFailed = results.some(
        (r) => r.ok && (r.data as { success?: boolean }).success === false
      );
      if (bodyFailed) {
        setFormError(t("Could not save all pricelist rows. Check Pricelist and try again."));
        return;
      }
      setRetailInput("");
      setWholesaleInput("");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || targets.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={t("Set Pricelist for new product")}
      subtitle={t(
        "These prices apply to every outlet row listed below. They are saved as Pricelist entries, not on the product."
      )}
      onClose={handleClose}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            {t("Skip for now")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? t("Saving pricelist…") : t("Save pricelist")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="pricelist-retail"
            label={t("Retail price per kg")}
            required
          >
            <Input
              id="pricelist-retail"
              type="number"
              min={0}
              step="any"
              value={retailInput}
              onChange={(e) => setRetailInput(e.target.value)}
              disabled={saving}
              inputMode="decimal"
            />
          </FormField>
          <FormField
            id="pricelist-wholesale"
            label={t("Wholesale price per kg")}
            required
          >
            <Input
              id="pricelist-wholesale"
              type="number"
              min={0}
              step="any"
              value={wholesaleInput}
              onChange={(e) => setWholesaleInput(e.target.value)}
              disabled={saving}
              inputMode="decimal"
            />
          </FormField>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Applies to")}
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {targets.map((row) => (
              <li
                key={`${row.productId}-${row.outletId}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {row.productName}
                </span>
                <span className="text-muted-foreground">{row.outletName}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
