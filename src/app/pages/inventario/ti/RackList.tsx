/**
 * RackList.tsx — Lista de puertos de rack / patch panel. CRUD + bitácora.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Network, Plus, X, Pencil, Trash2, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { apiGetRack, apiCreatePuerto, apiUpdatePuerto, apiDeletePuerto, PuertoRack } from "../../../lib/api_ti";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: "bg-green-100 text-green-700", INACTIVO: "bg-red-100 text-red-700", LIBRE: "bg-gray-100 text-gray-600",
};
const EMPTY_FORM = {
  rack_id: "", piso: "", patch_panel_id: "", puerto_numero: "",
  ubicacion: "", usuario_asignado: "", estado: "LIBRE", observaciones: "",
};

export function RackList() {
  const [puertos, setPuertos] = useState<PuertoRack[]>([]);
  const [loading, setLoad]    = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [pisoFiltro, setPiso] = useState("");
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<PuertoRack | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<PuertoRack | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [bitacora, setBitacora]   = useState<{ id: string; repr: string } | null>(null);

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (pisoFiltro) params.piso = pisoFiltro;
    setLoad(true);
    apiGetRack(params).then(setPuertos).catch((e: Error) => setError(e.message)).finally(() => setLoad(false));
  }, [pisoFiltro]);
  useEffect(() => { load(); }, [load]);

  const pisos = [...new Set(puertos.map((p) => p.piso).filter(Boolean))].sort();

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(null); setOpen(true); };
  const openEdit = (p: PuertoRack) => {
    setEditing(p);
    setForm({ rack_id: p.rack_id ?? "", piso: p.piso ?? "", patch_panel_id: p.patch_panel_id ?? "",
      puerto_numero: String(p.puerto_numero ?? ""), ubicacion: p.ubicacion ?? "",
      usuario_asignado: p.usuario_asignado ?? "", estado: p.estado, observaciones: p.observaciones ?? "" });
    setFormError(null); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdatePuerto(editing.id, form);
      else         await apiCreatePuerto(form);
      setOpen(false); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return; setDeleting(true);
    try { await apiDeletePuerto(delTarget.id); setDelTarget(null); load(); }
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
          <Network size={22} className="text-teal-600" />
          <h1 className="text-xl font-bold">Rack / Patch Panel</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700">
          <Plus size={16} /> Nuevo puerto
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">Piso:</label>
        <select value={pisoFiltro} onChange={(e) => setPiso(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm">
          <option value="">Todos</option>
          {pisos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-teal-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : puertos.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No hay puertos registrados.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3">Rack</th>
                <th className="text-left px-4 py-3">Piso</th>
                <th className="text-left px-4 py-3">Patch Panel</th>
                <th className="text-center px-4 py-3">Puerto</th>
                <th className="text-left px-4 py-3">Ubicación</th>
                <th className="text-left px-4 py-3">Asignado a</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {puertos.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-2 font-mono text-xs">{p.rack_id}</td>
                  <td className="px-4 py-2 text-xs">{p.piso}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.patch_panel_id}</td>
                  <td className="px-4 py-2 text-center">{p.puerto_numero}</td>
                  <td className="px-4 py-2 text-xs">{p.ubicacion || "—"}</td>
                  <td className="px-4 py-2 text-xs">{p.usuario_asignado || "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${ESTADO_COLOR[p.estado] ?? "bg-gray-100"}`}>
                      {p.estado_display}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Editar" onClick={() => openEdit(p)} className="p-1 rounded hover:bg-teal-50 text-teal-600">
                        <Pencil size={14} />
                      </button>
                      <button title="Bitácora" onClick={() => setBitacora({ id: p.id, repr: `${p.rack_id}-P${p.puerto_numero}` })}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <History size={14} />
                      </button>
                      <button title="Eliminar" onClick={() => setDelTarget(p)} className="p-1 rounded hover:bg-red-50 text-red-500">
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
      <p className="text-xs text-muted-foreground text-right">{puertos.length} puerto(s)</p>

      {/* Modal Crear / Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Network size={18} /> {editing ? "Editar Puerto" : "Nuevo Puerto de Rack"}
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
              <F label="Rack ID" k="rack_id" placeholder="RACK-01" />
              <F label="Piso" k="piso" placeholder="Piso 2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Patch Panel ID" k="patch_panel_id" placeholder="PP-01" />
              <F label="N° Puerto" k="puerto_numero" placeholder="1" />
            </div>
            <F label="Ubicación" k="ubicacion" />
            <F label="Usuario asignado" k="usuario_asignado" />
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                {[["LIBRE","Libre"],["ACTIVO","Activo"],["INACTIVO","Inactivo"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <F label="Observaciones" k="observaciones" />
            {editing && (
              <TIMovimientosPanel modelo="PuertoRack" objetoId={editing.id} />
            )}
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50">
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
          <p className="text-sm text-gray-600 mt-2">¿Eliminar puerto <strong>{delTarget?.rack_id}-P{delTarget?.puerto_numero}</strong>?</p>
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
        modelo="PuertoRack" objetoId={bitacora?.id ?? ""} titulo={bitacora?.repr} />
    </div>
  );
}
