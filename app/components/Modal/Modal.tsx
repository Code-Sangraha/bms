"use client";

import "./Modal.scss";

type ModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modalOverlay" onClick={onClose} aria-hidden="true">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <h2 id="modal-title" className="modalTitle">
              {title}
            </h2>
            {subtitle && <p className="modalSubtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modalClose"
            aria-label="Close modal"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer && <div className="modalActions">{footer}</div>}
      </div>
    </div>
  );
}

