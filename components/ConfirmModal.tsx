"use client";

import { useState } from "react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-pokedex-gray-dark w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 animate-pop-in">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-pokedex-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 rounded-lg px-4 py-2 font-semibold text-sm transition-colors ${
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "btn-pokedex"
            }`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
