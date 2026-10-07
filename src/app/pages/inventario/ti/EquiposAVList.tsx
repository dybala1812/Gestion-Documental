/**
 * EquiposAVList.tsx — Lista de equipos audiovisuales por área. CRUD completo + bitácora.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Loader2, Tv2, Plus, Search, X, Pencil, Trash2, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { apiGetEquiposAV, apiCreateEquipoAV, apiUpdateEquipoAV, apiDeleteEquipoAV, EquipoAV } from "../../../lib/api_ti";
import { apiListDependencies, Dependency } from "../../../lib/api";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

const ESTADO_COLOR: Record<string, string> = {
  BUENO: "bg-green-100 text-green-700", REGULAR: "bg-yellow-100 text-yellow-700",
  MALO: "bg-red-100 text-red-700", EN_REPARACION: "bg-orange-100 text-orange-700",
  DE_BAJA: "bg-gray-200 text-gray-600",
};
const EMPTY_FORM = {
  dependency: "", tipo_av: "TV", elemento: "", serial: "",
  marca: "", modelo: "", ubicacion: "", estado: "BUENO",
  cantidad: 1, descripcion: "", observaciones: "",
};

export function EquiposAVList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems]   = useState<EquipoAV[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<EquipoAV | null>(null);
  const [deps, setDeps]           = useState<Dependency[]>([]);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [delTarget, setDelTarget] = useState<EquipoAV | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [bitacora, setBitacora]   = useState<{ id: string; repr: string } | null>(null);

  const load = useCallback(() => {
    setLoad(true);
    const params: Record<string, string> = {};
    const depId = searchParams.get("dependency_id");
    if (depId) params.dependency_id = depId;
    if (search) params.search = search;
    apiGetEquiposAV(params).then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoad(false));
  }, [searchParams, search]);

  useEffect(() => { load(); }, [load]);

  const ensureDeps = () => {
    if (deps.length === 0) apiListDependencies(true).then(r => setDeps(r.results ?? []));
  };

  const openCreate = () => {
    setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(null); ensureDeps(); setOpen(true);
  };

  const openEdit = (item: EquipoAV) => {
    setEditing(item);
    setForm({
      dependency: item.dependency, tipo_av: item.tipo_av, elemento: item.elemento ?? "",
      serial: item.serial ?? "", marca: item.marca ?? "", modelo: item.modelo ?? "",
      ubicacion: item.ubicacion ?? "", estado: item.estado, cantidad: item.cantidad,
      descripcion: "", observaciones: item.observaciones ?? "",
    });
    setFormError(null); ensureDeps(); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdateEquipoAV(editing.id, form);
      else         await apiCreateEquipoAV(form);
      setOpen(false); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try { await apiDeleteEquipoAV(delTarget.id); setDelTarget(null); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Error al eliminar"); }
    finally { setDeleting(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (search) p.set("search", search); else p.delete("search");
    setSearchParams(p);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv2 size={22} className="text-purple-600" />
          <h1 className="text-xl font-bold">Equipos Audiovisuales</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700">
          <Plus size={16} /> Nuevo equipo AV
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por elemento, serial, marca, ubicación…"
            className="w-full rounded-md border px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Buscar</button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-purple-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No se encontraron equipos AV.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Elemento</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-left px-4 py-3">Marca</th>
                <th className="text-left px-4 py-3">Ubicación</th>
                <th className="text-center px-4 py-3">Cant.</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{item.tipo_av_display}</td>
                  <td className="px-4 py-2 font-medium">{item.elemento || "—"}</td>
                  <td className="px-4 py-2 text-xs">{item.dependency_nombre}</td>
                  <td className="px-4 py-2 text-xs">{item.marca || "—"}</td>
                  <td className="px-4 py-2 text-xs">{item.ubicacion || "—"}</td>
                  <td className="px-4 py-2 text-center">{item.cantidad}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${ESTADO_COLOR[item.estado] ?? "bg-gray-100"}`}>
                      {item.estado_display}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Editar" onClick={() => openEdit(item)} className="p-1 rounded hover:bg-purple-50 text-purple-600">
                        <Pencil size={14} />
                      </button>
                      <button title="Bitácora" onClick={() => setBitacora({ id: item.id, repr: item.elemento || item.id.slice(0,8) })}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <History size={14} />
                      </button>
                      <button title="Eliminar" onClick={() => setDelTarget(item)} className="p-1 rounded hover:bg-red-50 text-red-500">
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
      <p className="text-xs text-muted-foreground text-right">{items.length} elemento(s)</p>

      {/* ── Modal Crear / Editar ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Tv2 size={18} /> {editing ? "Editar Equipo AV" : "Nuevo Equipo AV"}
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
                <label className="block text-xs font-medium text-muted-foreground">Área <span className="text-red-500">*</span></label>
                <select required value={form.dependency} onChange={e => setForm(f => ({ ...f, dependency: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  <option value="">— seleccionar —</option>
                  {deps.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo AV <span className="text-red-500">*</span></label>
                <select required value={form.tipo_av} onChange={e => setForm(f => ({ ...f, tipo_av: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["TV","Televisor"],["VIDEOBEAM","Video Beam"],["AMPLIFICADOR","Amplificador"],
                    ["MICROFONO","Micrófono"],["CAMARA","Cámara"],["PARLANTE","Parlante"],
                    ["MIXER","Mixer"],["IMPRESORA","Impresora"],["UPS","UPS"],
                    ["TABLET","Tablet"],["TELEFONO","Teléfono corp."],["OTRO","Otro"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Elemento / Nombre <span className="text-red-500">*</span></label>
                <input required value={form.elemento} onChange={e => setForm(f => ({ ...f, elemento: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["BUENO","Bueno"],["REGULAR","Regular"],["MALO","Malo"],
                    ["EN_REPARACION","En reparación"],["BAJA","Dado de baja"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Marca</label>
                <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Modelo</label>
                <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Cantidad</label>
                <input type="number" min={1} value={form.cantidad}
                  onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Ubicación</label>
              <input value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Observaciones</label>
              <textarea rows={2} value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
            {editing && (
              <TIMovimientosPanel modelo="EquipoAV" objetoId={editing.id} />
            )}
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminación ── */}
      <Dialog open={!!delTarget} onOpenChange={() => setDelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={18} /> Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            ¿Eliminar <strong>{delTarget?.elemento || delTarget?.id.slice(0,8)}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDelTarget(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bitácora ── */}
      <BitacoraModal
        open={!!bitacora} onClose={() => setBitacora(null)}
        modelo="EquipoAV" objetoId={bitacora?.id ?? ""} titulo={bitacora?.repr}
      />
    </div>
  );
}
