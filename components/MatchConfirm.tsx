"use client";

import { CatAvatar } from "./CatAvatar";

interface MatchConfirmProps {
  status: "strong" | "weak" | "none";
  candidates: {
    catId: string;
    similarity: number;
    thumbBlobId: string;
    name?: string;
  }[];
  onConfirm: (catId?: string) => void;
  onCancel: () => void;
}

export function MatchConfirm({
  status,
  candidates,
  onConfirm,
  onCancel,
}: MatchConfirmProps) {
  if (status === "none") {
    return null; // caller handles directly
  }

  return (
    <div className="fixed inset-0 z-50 bg-pokedex-black/90 flex flex-col items-center justify-center p-6">
      {status === "strong" && candidates.length > 0 && (
        <div className="animate-pop-in text-center max-w-sm">
          <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4 border-2 border-pokedex-yellow">
            <CatAvatar
              blobId={candidates[0].thumbBlobId}
              size="sm"
              className="w-full h-full"
            />
          </div>
          <h2 className="text-xl font-bold mb-1">
            ¡Es {candidates[0].name || "este"}!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {Math.round(candidates[0].similarity)}% de coincidencia
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onConfirm(candidates[0].catId)}
              className="btn-pokedex flex-1"
            >
              ¡Sí, es!
            </button>
            <button
              onClick={() => onConfirm(undefined)}
              className="btn-pokedex-secondary flex-1"
            >
              Nuevo gato
            </button>
          </div>
        </div>
      )}

      {status === "weak" && (
        <div className="animate-pop-in text-center max-w-sm w-full">
          <h2 className="text-lg font-bold mb-2">¿Es uno de estos?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Elige o crea uno nuevo
          </p>
          <div className="flex gap-3 justify-center mb-6">
            {candidates.slice(0, 3).map((c) => (
              <button
                key={c.catId}
                onClick={() => onConfirm(c.catId)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border border-border">
                  <CatAvatar
                    blobId={c.thumbBlobId}
                    size="sm"
                    className="w-full h-full"
                  />
                </div>
                <span className="text-xs font-medium">{c.name || "Gato"}</span>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(c.similarity)}%
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => onConfirm(undefined)}
            className="btn-pokedex-secondary w-full"
          >
            Ninguno, ¡es nuevo!
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground mt-3 hover:text-pokedex-gray-light"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
