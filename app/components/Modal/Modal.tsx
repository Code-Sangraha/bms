"use client";

import type { ReactNode } from "react";
import ResponsiveOverlay from "@/app/components/ui-ext/ResponsiveOverlay";

type ModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra class on the inner dialog (e.g. wider forms). */
  modalClassName?: string;
};

/**
 * Backwards-compatible Modal. Same prop surface as the legacy SCSS-based
 * modal; renders as a bottom Sheet on mobile and centered Dialog on desktop.
 */
export default function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
  modalClassName,
}: ModalProps) {
  return (
    <ResponsiveOverlay
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      className={modalClassName}
    >
      {children}
    </ResponsiveOverlay>
  );
}
