/**
 * BitacoraModal.tsx
 * Modal de auditoría reutilizable para cualquier entidad del módulo TI.
 * Muestra el historial de creaciones, ediciones y eliminaciones.
 */
import { useEffect, useState } from "react";
import { History, Loader2, Plus, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import { apiGetBitacora, TIBitacoraEntry } from "../../../lib/api_ti";

const ACCION_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CREAR:    { label: "Creado",    color: "bg-green-100 text-green-700 border-green-300",  icon: <Plus  size={14} /> },
  EDITAR:   { label: "Editado",   color: "bg-blue-100  text-blue-700  border-blue-300",   icon: <Edit  size={14} /> },
  ELIMINAR: { label: "Eliminado", color: "bg-red-100   text-red-700   border-red-300",    icon: <Trash2 size={14} /> },
};

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function CambiosRow({ entry }: { entry: TIBitacoraEntry }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(entry.cambios ?? {});
  if (keys.length === 0) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {keys.length} campo(s) modificado(s)
      </button>
      {open && (
        <div className="mt-1 rounded-md border bg-gray-50 text-xs divide-y">
          {keys.map((k) => (
            <div key={k} className="flex items-start gap-2 px-3 py-1.5">
              <span className="font-medium text-gray-600 w-36 shrink-0">{k}</span>
              <span className="text-red-500 line-through break-all">{entry.cambios[k].antes ?? "—"}</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="text-green-600 break-all">{entry.cambios[k].despues ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BitacoraModal({
  open,
  onClose,
  modelo,
  objetoId,
  titulo,
}: {
  open: boolean;
  onClose: () => void;
  modelo: string;
  objetoId: string;
  titulo?: string;
}) {
  const [entries, setEntries] = useState<TIBitacoraEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open || !objetoId) return;
    setLoading(true);
    setError(null);
    apiGetBitacora(modelo, objetoId)
      .then(setEntries)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, modelo, objetoId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} className="text-blue-600" />
            Bitácora de cambios
            {titulo && <span className="text-muted-foreground font-normal text-sm ml-1">— {titulo}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin registros en la bitácora.</p>
        )}
        {!loading && entries.length > 0 && (
          <div className="space-y-3 mt-1">
            {entries.map((e) => {
              const cfg = ACCION_CFG[e.accion] ?? ACCION_CFG.EDITAR;
              return (
                <div key={e.id} className="rounded-lg border p-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${cfg.color} text-xs flex items-center gap-1`}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">{e.objeto_repr}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{fmtDate(e.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Por: <span className="font-medium text-gray-700">{e.usuario_nombre || "Sistema"}</span>
                  </p>
                  <CambiosRow entry={e} />
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
