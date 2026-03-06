"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import Modal from "../../../components/Modal/Modal";
import {
  updateOutlet,
  type Outlet,
} from "@/handlers/outlet";

type OutletEditModalProps = {
  isOpen: boolean;
  outlet: Outlet;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function OutletEditModal({
  isOpen,
  outlet,
  onClose,
  onSuccess,
}: OutletEditModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(outlet.name);
  const [contact, setContact] = useState(outlet.contact);
  const [status, setStatus] = useState(outlet.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(outlet.name);
      setContact(outlet.contact);
      setStatus(outlet.status);
      setError(null);
    }
  }, [isOpen, outlet.id, outlet.name, outlet.contact, outlet.status]);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateOutlet({
      id: outlet.id,
      name: name.trim(),
      contact: contact.trim(),
      status,
    });
    setIsSubmitting(false);
    if (result.ok) {
      onSuccess?.();
      onClose();
    } else {
      setError(result.error ?? t("Failed to update outlet"));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t("Manage Outlet")}
      subtitle={outlet.id}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button modalButton" onClick={onClose}>
            {t("Discard")}
          </button>
          <button
            type="button"
            className="button buttonPrimary modalButton"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("Saving…") : t("Save")}
          </button>
        </>
      }
    >
      {error && (
        <p className="modalError" role="alert">
          {error}
        </p>
      )}
      <label className="modalField">
        <span className="label">{t("Outlet")}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="modalField">
        <span className="label">{t("Manager ID")}</span>
        <input className="input" value={outlet.managerId} readOnly disabled />
      </label>

      <label className="modalField">
        <span className="label">{t("Status")}</span>
        <select
          className="select"
          value={status ? "Active" : "Inactive"}
          onChange={(e) => setStatus(e.target.value === "Active")}
        >
          <option value="Active">{t("Active")}</option>
          <option value="Inactive">{t("Inactive")}</option>
        </select>
      </label>

      <label className="modalField">
        <span className="label">{t("Contact")}</span>
        <input
          className="input"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>
    </Modal>
  );
}

