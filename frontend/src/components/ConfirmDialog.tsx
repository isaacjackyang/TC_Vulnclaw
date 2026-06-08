import { useEffect, useRef } from "react";
import { uiText, useUiLanguage } from "../utils/i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  copy: string;
  tone?: "primary" | "danger";
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, copy, tone = "primary", confirmLabel = "Confirm", onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const language = useUiLanguage();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) cancelButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-copy" onMouseDown={(event) => event.stopPropagation()}>
        <span className="dialog-kicker">{uiText(language, "Confirmation required", "需要確認")}</span>
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-copy" className="confirm-copy">{copy}</p>
        <div className="button-row compact-row">
          <button ref={cancelButtonRef} type="button" className="secondary-btn" onClick={onCancel}>
            {uiText(language, "Cancel", "取消")}
          </button>
          <button type="button" className={tone === "danger" ? "danger-btn" : "primary-btn"} onClick={onConfirm}>
            {confirmLabel === "Confirm" ? uiText(language, "Confirm", "確認") : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
