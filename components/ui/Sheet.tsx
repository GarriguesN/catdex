"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the sheet panel */
  className?: string;
}

/** Bottom sheet: dark scrim + rounded white panel sliding from below. */
export function Sheet({ open, onClose, children, className }: SheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative w-full sm:max-w-md bg-catdex-surface rounded-t-3xl shadow-float animate-sheet-up",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-catdex-gray-light/40" />
        {children}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centered confirmation dialog. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-catdex-surface rounded-3xl p-6 shadow-float animate-pop-in text-center">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-catdex-text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className={clsx(
              "w-full rounded-full py-3 font-semibold text-[0.9375rem] text-white transition-transform active:scale-[0.97]",
              destructive ? "bg-catdex-red" : "bg-catdex-orange"
            )}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="btn-ghost w-full">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
