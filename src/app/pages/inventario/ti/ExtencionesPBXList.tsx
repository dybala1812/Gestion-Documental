/**
 * ExtencionesPBXList.tsx — Lista de extensiones PBX. CRUD + bitácora.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, PhoneCall, Plus, X, Pencil, Trash2, History } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { apiGetExtensiones, apiCreateExtension, apiUpdateExtension, apiDeleteExtension, ExtensionPBX } from "../../../lib/api_ti";
import { apiListDependencies, Dependency } from "../../../lib/api";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

const EMPTY_FORM = {
  dependency: "", extension: "", nombre: "", email: "",
  tipo: "USUARIO", pin: "", activo: true, observaciones: "",
};

export function ExtencionesPBXList() {
  const [items, setItems]   = useState<ExtensionPBX[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<ExtensionPBX | null>(null);
  const [deps, setDeps]           = useState<Dependency[]>([]);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<ExtensionPBX | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [bitacora, setBitacora]   = useState<{ id: string; repr: string } | null>(null);

  const load = useCallback(() => {
    setLoad(true);
    apiGetExtensiones().then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoad(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const ensureDeps = () => { if (deps.length === 0) apiListDependencies(true).then(r => setDeps(r.results ?? [])); };
  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(null); ensureDeps(); setOpen(true); };
  const openEdit = (ext: ExtensionPBX) => {
    setEditing(ext);
    setForm({ dependency: ext.dependency ?? "", extension: ext.extension, nombre: ext.nombre ?? "",
      email: ext.email ?? "", tipo: ext.tipo ?? "USUARIO", pin: "",
      activo: ext.activo, observaciones: ext.observaciones ?? "" });
    setFormError(null); ensureDeps(); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdateExtension(editing.id, form);
      else         await apiCreateExtension(form);
      setOpen(false); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return; setDeleting(true);
    try { await apiDeleteExtension(delTarget.id); setDelTarget(null); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setDeleting(false); }
  };

  const F = ({ label, k, placeholder, type }: { label: string; k: keyof typeof form; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type ?? "text"} value={form[k] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder} className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneCall size={22} className="text-amber-600" />
          <h1 className="text-xl font-bold">Extensiones PBX / 3CX</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700">
          <Plus size={16} /> Nueva extensión
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-amber-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No hay extensiones registradas.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3">Extensión</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ext, i) => (
                <tr key={ext.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-2 font-mono font-bold">{ext.extension}</td>
                  <td className="px-4 py-2">{ext.nombre || "—"}</td>
                  <td className="px-4 py-2 text-xs">{ext.dependency_nombre}</td>
                  <td className="px-4 py-2 text-xs">{ext.tipo || "—"}</td>
                  <td className="px-4 py-2 text-xs">{ext.email || "—"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={ext.activo ? "default" : "secondary"}>{ext.activo ? "Activa" : "Inactiva"}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Editar" onClick={() => openEdit(ext)} className="p-1 rounded hover:bg-amber-50 text-amber-600">
                        <Pencil size={14} />
                      </button>
                      <button title="Bitácora" onClick={() => setBitacora({ id: ext.id, repr: ext.extension })}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <History size={14} />
                      </button>
                      <button title="Eliminar" onClick={() => setDelTarget(ext)} className="p-1 rounded hover:bg-red-50 text-red-500">
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
      <p className="text-xs text-muted-foreground text-right">{items.length} extensión(es)</p>

      {/* Modal Crear / Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall size={18} /> {editing ? "Editar Extensión" : "Nueva Extensión PBX"}
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
              <F label="N° Extensión *" k="extension" placeholder="1001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre" k="nombre" />
              <F label="Email" k="email" type="email" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["USUARIO","Usuario"],["SALA","Sala"],["IVR","IVR"],["GRUPO","Grupo"],["OTRO","Otro"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <F label="PIN" k="pin" type="password" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ext_activo" checked={form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="ext_activo" className="text-sm">Activa</label>
            </div>
            <F label="Observaciones" k="observaciones" />
            {editing && (
              <TIMovimientosPanel modelo="ExtensionPBX" objetoId={editing.id} />
            )}
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50">
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
          <p className="text-sm text-gray-600 mt-2">¿Eliminar extensión <strong>{delTarget?.extension}</strong>?</p>
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
        modelo="ExtensionPBX" objetoId={bitacora?.id ?? ""} titulo={bitacora?.repr} />
    </div>
  );
}
