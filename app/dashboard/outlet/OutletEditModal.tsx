"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Modal from "../../components/Modal/Modal";
import { updateOutlet, type Outlet } from "@/handlers/outlet";
import { getUsers, updateUser, type User } from "@/handlers/user";

type OutletEditModalProps = {
  isOpen: boolean;
  outlet: Outlet;
  onClose: () => void;
  onSuccess?: () => void;
};

const USERS_QUERY_KEY = ["users"];

function roleNameLower(user: User): string {
  const r = user.role;
  if (r != null) {
    if (typeof r === "string") return r.toLowerCase();
    if (typeof r === "object" && "name" in r && typeof r.name === "string")
      return r.name.toLowerCase();
  }
  return "";
}

export default function OutletEditModal({
  isOpen,
  outlet,
  onClose,
  onSuccess,
}: OutletEditModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [name, setName] = useState(outlet.name);
  const [contact, setContact] = useState(outlet.contact);
  const [status, setStatus] = useState(outlet.status);
  const [managerId, setManagerId] = useState(outlet.managerId);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: USERS_QUERY_KEY,
    enabled: isOpen,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const managers = useMemo(
    () => users.filter((u) => roleNameLower(u) === "manager"),
    [users]
  );

  useEffect(() => {
    if (isOpen) {
      setName(outlet.name);
      setContact(outlet.contact);
      setStatus(outlet.status);
      setManagerId(outlet.managerId);
      setError(null);
    }
  }, [isOpen, outlet.id, outlet.name, outlet.contact, outlet.status, outlet.managerId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedManager = managerId.trim();
      if (!trimmedManager) {
        return { ok: false as const, error: t("Please select a manager.") };
      }

      const previousManagerId = outlet.managerId.trim();
      const managerChanged = trimmedManager !== previousManagerId;

      const outletPayload = {
        id: outlet.id,
        name: name.trim(),
        contact: contact.trim(),
        status,
        managerId: trimmedManager,
      };
      const outletRes = await updateOutlet(outletPayload);
      if (!outletRes.ok) {
        return { ok: false as const, error: outletRes.error };
      }

      if (managerChanged) {
        const newManager = users.find((u) => u.id === trimmedManager);
        if (!newManager) {
          return {
            ok: false as const,
            error: t("Selected manager was not found. Refresh users and try again."),
          };
        }

        /*
         * Outlet update alone only changes outlet.managerId; sync User.outletId for JWT/auth scope.
         * Previous manager's user.outletId is not cleared here — adjust via Users screen if needed.
         */
        const userRes = await updateUser({
          id: newManager.id,
          fullName: newManager.fullName,
          email: newManager.email,
          roleId: newManager.roleId,
          status: newManager.status,
          contact:
            typeof newManager.contact === "string" && newManager.contact.trim()
              ? newManager.contact.trim()
              : undefined,
          outletId: outlet.id,
        });
        if (!userRes.ok) {
          return { ok: false as const, error: userRes.error };
        }
      }

      return { ok: true as const };
    },
    onSuccess: (data) => {
      if (!data.ok) {
        setError(data.error ?? t("Failed to update outlet"));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["outlets"] });
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast(
        t(
          "Outlet saved. The manager may need to sign in again for outlet scope to update."
        )
      );
      onSuccess?.();
      onClose();
    },
    onError: () => {
      setError(t("Something went wrong. Please try again."));
    },
  });

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
            onClick={() => {
              setError(null);
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? t("Saving…") : t("Save")}
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
        <span className="label">{t("Manager")}</span>
        <select
          className="select"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
        >
          <option value="">{t("Select manager")}</option>
          {managers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName?.trim() || u.email || u.id}
            </option>
          ))}
        </select>
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
