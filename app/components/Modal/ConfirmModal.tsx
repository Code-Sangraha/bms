"use client";

import "./Modal.scss";

type ConfirmModalVariant = "danger" | "default";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div className="modalOverlay" onClick={onClose} aria-hidden="true">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 id="confirm-modal-title" className="modalTitle">
            {title}
          </h2>
          <button
            type="button"
            className="modalClose"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modalBody">
          <p className="confirmModalMessage">{message}</p>
        </div>
        <div className="modalActions">
          <button
            type="button"
            className="button modalButton"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{ backgroundColor: isDanger ? "#D92D20" : "#000000", color: isDanger ? "#ffffff" : "#ffffff" }}
            className={`button modalButton ${isDanger ? "buttonDanger" : "buttonPrimary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
