/**
 * TelefonosList.tsx — Lista de teléfonos corporativos. CRUD + bitácora.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Phone, Plus, X, Pencil, Trash2, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { apiGetTelefonos, apiCreateTelefono, apiUpdateTelefono, apiDeleteTelefono, TelefonoCorporativo } from "../../../lib/api_ti";
import { apiListDependencies, Dependency } from "../../../lib/api";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

const ESTADO_COLOR: Record<string, string> = {
  BUENO: "bg-green-100 text-green-700", REGULAR: "bg-yellow-100 text-yellow-700",
  MALO: "bg-red-100 text-red-700", EN_REPARACION: "bg-orange-100 text-orange-700",
  DE_BAJA: "bg-gray-200 text-gray-600",
};
const EMPTY_FORM = {
  dependency: "", tipo: "FIJO", numero: "", asignado_a: "",
  marca: "", modelo: "", imei: "", estado: "BUENO", observaciones: "",
};

export function TelefonosList() {
  const [items, setItems]   = useState<TelefonoCorporativo[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<TelefonoCorporativo | null>(null);
  const [deps, setDeps]           = useState<Dependency[]>([]);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<TelefonoCorporativo | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [bitacora, setBitacora]   = useState<{ id: string; repr: string } | null>(null);

  const load = useCallback(() => {
    setLoad(true);
    apiGetTelefonos().then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoad(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const ensureDeps = () => { if (deps.length === 0) apiListDependencies(true).then(r => setDeps(r.results ?? [])); };
  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(null); ensureDeps(); setOpen(true); };
  const openEdit = (t: TelefonoCorporativo) => {
    setEditing(t);
    setForm({ dependency: t.dependency ?? "", tipo: t.tipo, numero: t.numero ?? "",
      asignado_a: t.asignado_a ?? "", marca: t.marca ?? "", modelo: t.modelo ?? "",
      imei: t.imei ?? "", estado: t.estado, observaciones: t.observaciones ?? "" });
    setFormError(null); ensureDeps(); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdateTelefono(editing.id, form);
      else         await apiCreateTelefono(form);
      setOpen(false); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return; setDeleting(true);
    try { await apiDeleteTelefono(delTarget.id); setDelTarget(null); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setDeleting(false); }
  };

  const F = ({ label, k, placeholder }: { label: string; k: keyof typeof form; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={form[k] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder} className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone size={22} className="text-orange-600" />
          <h1 className="text-xl font-bold">Teléfonos Corporativos</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700">
          <Plus size={16} /> Nuevo teléfono
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-orange-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No hay teléfonos registrados.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Número</th>
                <th className="text-left px-4 py-3">Asignado a</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-left px-4 py-3">Marca / Modelo</th>
                <th className="text-left px-4 py-3">IMEI</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-2 text-xs">{t.tipo_display}</td>
                  <td className="px-4 py-2 font-mono">{t.numero || "—"}</td>
                  <td className="px-4 py-2">{t.asignado_a || "—"}</td>
                  <td className="px-4 py-2 text-xs">{t.dependency_nombre}</td>
                  <td className="px-4 py-2 text-xs">{t.marca} {t.modelo}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.imei || "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${ESTADO_COLOR[t.estado] ?? "bg-gray-100"}`}>
                      {t.estado_display}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Editar" onClick={() => openEdit(t)} className="p-1 rounded hover:bg-orange-50 text-orange-600">
                        <Pencil size={14} />
                      </button>
                      <button title="Bitácora" onClick={() => setBitacora({ id: t.id, repr: t.numero || t.imei || t.id.slice(0,8) })}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <History size={14} />
                      </button>
                      <button title="Eliminar" onClick={() => setDelTarget(t)} className="p-1 rounded hover:bg-red-50 text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-right">{items.length} teléfono(s)</p>

      {/* Modal Crear / Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Phone size={18} /> {editing ? "Editar Teléfono" : "Nuevo Teléfono Corporativo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center justify-between">
                {formError} <button type="button" onClick={() => setFormError(null)}><X size={14} /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Área</label>
                <select value={form.dependency} onChange={e => setForm(f => ({ ...f, dependency: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  <option value="">— seleccionar —</option>
                  {deps.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["FIJO","Fijo"],["MOVIL","Móvil"],["VOIP","VoIP"],["SATELITAL","Satelital"],["OTRO","Otro"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Número" k="numero" placeholder="3001234567" />
              <F label="Asignado a" k="asignado_a" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Marca" k="marca" />
              <F label="Modelo" k="modelo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="IMEI" k="imei" />
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["BUENO","Bueno"],["REGULAR","Regular"],["MALO","Malo"],["EN_REPARACION","En reparación"],["DE_BAJA","Dado de baja"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <F label="Observaciones" k="observaciones" />
            {editing && (
              <TIMovimientosPanel modelo="TelefonoCorporativo" objetoId={editing.id} />
            )}
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!delTarget} onOpenChange={() => setDelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={18} /> Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">¿Eliminar <strong>{delTarget?.numero || delTarget?.imei || "este teléfono"}</strong>?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDelTarget(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
              {deleting && <Loader2 size={14} className="animate-spin" />} Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <BitacoraModal open={!!bitacora} onClose={() => setBitacora(null)}
        modelo="TelefonoCorporativo" objetoId={bitacora?.id ?? ""} titulo={bitacora?.repr} />
    </div>
  );
}
