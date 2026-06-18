"use client";

import ConfirmDialog from "@/app/components/ui-ext/ConfirmDialog";

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

/**
 * Backwards-compatible ConfirmModal that now renders the shadcn-based
 * ConfirmDialog. Same prop surface so every existing caller keeps working.
 */
export default function ConfirmModal(props: ConfirmModalProps) {
  return <ConfirmDialog {...props} />;
}
