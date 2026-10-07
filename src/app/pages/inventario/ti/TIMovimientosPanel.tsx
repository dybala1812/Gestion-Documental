/**
 * TIMovimientosPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel embebible para el historial de movimientos manuales de un equipo TI.
 * Muestra los movimientos existentes (mantenimiento, transferencia, etc.)
 * y permite añadir nuevos sin salir del modal.
 *
 * Uso:
 *   <TIMovimientosPanel modelo="EquipoComputo" objetoId={eq.id} />
 */
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList, Plus, Trash2, Loader2,
  Wrench, ArrowRightLeft, Stethoscope, Eye, XCircle, HelpCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import {
  TIMovimiento,
  TIMovimientoCreate,
  apiGetMovimientos,
  apiCreateMovimiento,
  apiDeleteMovimiento,
} from "../../../lib/api_ti";

// ── Configuración visual por tipo ─────────────────────────────────────────────
const TIPO_CFG: Record<
  TIMovimiento["tipo"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  MANTENIMIENTO: { label: "Mantenimiento", color: "bg-blue-100 text-blue-700 border-blue-300",    icon: <Wrench         size={12} /> },
  TRANSFERENCIA: { label: "Transferencia", color: "bg-purple-100 text-purple-700 border-purple-300", icon: <ArrowRightLeft size={12} /> },
  REPARACION:    { label: "Reparación",    color: "bg-orange-100 text-orange-700 border-orange-300", icon: <Stethoscope    size={12} /> },
  INSPECCION:    { label: "Inspección",    color: "bg-teal-100 text-teal-700 border-teal-300",    icon: <Eye            size={12} /> },
  BAJA:          { label: "Baja",          color: "bg-red-100 text-red-700 border-red-300",        icon: <XCircle        size={12} /> },
  OTRO:          { label: "Otro",          color: "bg-gray-100 text-gray-600 border-gray-300",     icon: <HelpCircle     size={12} /> },
};

const TIPOS = Object.entries(TIPO_CFG).map(([value, cfg]) => ({ value, label: cfg.label }));

function fmtFecha(d: string) {
  // d = "YYYY-MM-DD"
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Componente ────────────────────────────────────────────────────────────────
export function TIMovimientosPanel({
  modelo,
  objetoId,
}: {
  modelo: string;
  objetoId: string;
}) {
  const [items,   setItems]   = useState<TIMovimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Formulario inline
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<TIMovimientoCreate, "modelo" | "objeto_id">>({
    tipo: "MANTENIMIENTO",
    descripcion: "",
    fecha: today(),
  });
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmación de borrado
  const [delId,     setDelId]     = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  // Expandir / colapsar lista
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(() => {
    if (!objetoId) return;
    setLoading(true);
    setError(null);
    apiGetMovimientos(modelo, objetoId)
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [modelo, objetoId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim()) { setFormError("La descripción es obligatoria."); return; }
    setSaving(true);
    setFormError(null);
    try {
      await apiCreateMovimiento({ modelo, objeto_id: objetoId, ...form });
      setForm({ tipo: "MANTENIMIENTO", descripcion: "", fecha: today() });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiDeleteMovimiento(id);
      setDelId(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const cfg = (tipo: TIMovimiento["tipo"]) => TIPO_CFG[tipo] ?? TIPO_CFG.OTRO;

  return (
    <section className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
        <ClipboardList size={15} className="text-gray-500 shrink-0" />
        <h3 className="text-sm font-semibold flex-1">
          Historial de movimientos
          {items.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({items.length})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => { setShowForm((s) => !s); setFormError(null); }}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 shrink-0"
        >
          <Plus size={12} /> Añadir
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="px-4 py-3 border-b bg-blue-50/50">
          <form onSubmit={handleSubmit} className="space-y-2">
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-2 text-red-700 text-xs">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-0.5">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TIMovimiento["tipo"] }))}
                  className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                >
                  {TIPOS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-0.5">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-0.5">
                Descripción <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Limpieza interna, cambio de pasta térmica, reemplazo de teclado…"
                className="w-full rounded-md border px-2.5 py-1.5 text-xs resize-none"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {!collapsed && (
        <>
          {loading && (
            <div className="flex justify-center py-5">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          )}
          {error && (
            <div className="p-3 text-xs text-red-600">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-5">
              Sin movimientos registrados.
            </p>
          )}
          {!loading && items.length > 0 && (
            <ul className="divide-y text-xs">
              {items.map((item) => {
                const c = cfg(item.tipo);
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20">
                    {/* badge tipo */}
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${c.color}`}
                    >
                      {c.icon} {c.label}
                    </span>
                    {/* contenido */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug break-words">{item.descripcion}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {fmtFecha(item.fecha)}
                        {item.usuario_nombre && (
                          <> · <span className="font-medium">{item.usuario_nombre}</span></>
                        )}
                        <span className="ml-1 text-[10px] text-gray-400">({fmtTs(item.created_at)})</span>
                      </p>
                    </div>
                    {/* borrado */}
                    {delId === item.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-red-600">¿Eliminar?</span>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => handleDelete(item.id)}
                          className="rounded px-2 py-1 bg-red-600 text-white text-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? <Loader2 size={11} className="animate-spin" /> : "Sí"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDelId(null)}
                          className="rounded px-2 py-1 border text-xs hover:bg-muted"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDelId(item.id)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0 mt-0.5"
                        title="Eliminar movimiento"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
