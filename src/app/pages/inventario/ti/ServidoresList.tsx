/**
 * ServidoresList.tsx — Lista de servidores físicos. CRUD completo + bitácora.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, Server, Plus, X, Pencil, Trash2, History, Eye, Cpu, HardDrive, MemoryStick, Globe, MapPin, User, Terminal, CheckCircle2, XCircle, Monitor } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import {
  apiGetServidores, apiGetServidor, apiCreateServidor, apiUpdateServidor, apiDeleteServidor,
  apiGetVMs, apiCreateVM, apiUpdateVM, apiDeleteVM,
  ServidorFisicoListItem, ServidorFisico, ServidorVirtual,
} from "../../../lib/api_ti";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

// ── VM Form Modal ─────────────────────────────────────────────────────────────
interface VMForm {
  vm_id: string; vm_name: string; direccion_ip: string; mac_address: string;
  vcpu: string; vram: string; vstorage: string; tipo: string; status: string;
  url_acceso: string; descripcion: string; observaciones: string;
}
const EMPTY_VM: VMForm = {
  vm_id: "", vm_name: "", direccion_ip: "", mac_address: "",
  vcpu: "1", vram: "1024", vstorage: "20", tipo: "KVM", status: "STOPPED",
  url_acceso: "", descripcion: "", observaciones: "",
};

function VMFormModal({ servidorId, vm, onClose, onSaved }: {
  servidorId: string; vm: ServidorVirtual | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<VMForm>(vm ? {
    vm_id: String(vm.vm_id), vm_name: vm.vm_name, direccion_ip: vm.direccion_ip ?? "",
    mac_address: vm.mac_address ?? "", vcpu: String(vm.vcpu), vram: String(vm.vram),
    vstorage: String(vm.vstorage), tipo: vm.tipo ?? "KVM", status: vm.status ?? "STOPPED",
    url_acceso: vm.url_acceso ?? "", descripcion: vm.descripcion ?? "", observaciones: vm.observaciones ?? "",
  } : EMPTY_VM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const payload = { ...form, vm_id: Number(form.vm_id), vcpu: Number(form.vcpu) };
      if (vm) await apiUpdateVM(vm.id, payload);
      else     await apiCreateVM(servidorId, payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const cls = "mt-1 w-full rounded-md border px-3 py-1.5 text-sm";
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor size={16} /> {vm ? "Editar Máquina Virtual" : "Nueva Máquina Virtual"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center justify-between">
                {error} <button type="button" onClick={() => setError(null)}><X size={14} /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">VM ID <span className="text-red-500">*</span></label>
                <input name="vm_id" value={form.vm_id} onChange={handleChange} required type="number" min="100" className={cls} placeholder="100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Nombre <span className="text-red-500">*</span></label>
                <input name="vm_name" value={form.vm_name} onChange={handleChange} required className={cls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Dirección IP</label>
                <input name="direccion_ip" value={form.direccion_ip} onChange={handleChange} className={cls} placeholder="192.168.1.x" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">MAC Address</label>
                <input name="mac_address" value={form.mac_address} onChange={handleChange} className={cls} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">vCPU</label>
                <input name="vcpu" value={form.vcpu} onChange={handleChange} type="number" min="1" className={cls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">vRAM</label>
                <input name="vram" value={form.vram} onChange={handleChange} className={cls} placeholder="12GB" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">vStorage</label>
                <input name="vstorage" value={form.vstorage} onChange={handleChange} className={cls} placeholder="125GB" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} className={cls}>
                  <option value="KVM">KVM</option>
                  <option value="LXC">LXC (Contenedor)</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Estado</label>
                <select name="status" value={form.status} onChange={handleChange} className={cls}>
                  <option value="RUNNING">Running</option>
                  <option value="STOPPED">Stopped</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">URL de acceso</label>
              <input name="url_acceso" value={form.url_acceso} onChange={handleChange} className={cls} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Descripción</label>
              <input name="descripcion" value={form.descripcion} onChange={handleChange} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={2} className={cls} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1 rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {vm ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal detalle de servidor ────────────────────────────────────────────────
function ServidorDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [sv, setSv] = useState<ServidorFisico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vmOpen, setVmOpen] = useState(false);
  const [vmEditing, setVmEditing] = useState<ServidorVirtual | null>(null);
  const [vmDelTarget, setVmDelTarget] = useState<ServidorVirtual | null>(null);
  const [vmDeleting, setVmDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGetServidor(id)
      .then(setSv)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openNewVM = () => { setVmEditing(null); setVmOpen(true); };
  const openEditVM = (vm: ServidorVirtual) => { setVmEditing(vm); setVmOpen(true); };

  const handleVMDelete = async () => {
    if (!vmDelTarget) return; setVmDeleting(true);
    try { await apiDeleteVM(vmDelTarget.id); setVmDelTarget(null); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Error al eliminar"); }
    finally { setVmDeleting(false); }
  };

  const statusColor = (s: string) =>
    s === "RUNNING" ? "bg-green-100 text-green-700" :
    s === "STOPPED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700";

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Server size={18} />
            {sv ? sv.node_id : "Cargando…"}
            {sv && (
              <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                sv.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {sv.activo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {sv.activo ? "Activo" : "Inactivo"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
        )}
        {sv && (
          <div className="space-y-5 mt-2">
            {/* Información general */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Información general</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {sv.marca && (
                  <div className="flex items-start gap-2">
                    <Server size={14} className="mt-0.5 text-gray-400 shrink-0" />
                    <span><span className="text-muted-foreground">Marca / Modelo: </span>{sv.marca} {sv.modelo}</span>
                  </div>
                )}
                {sv.ubicacion && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 text-gray-400 shrink-0" />
                    <span><span className="text-muted-foreground">Ubicación: </span>{sv.ubicacion}</span>
                  </div>
                )}
                {sv.responsable && (
                  <div className="flex items-start gap-2">
                    <User size={14} className="mt-0.5 text-gray-400 shrink-0" />
                    <span><span className="text-muted-foreground">Responsable: </span>{sv.responsable}</span>
                  </div>
                )}
                {sv.url_gestion && (
                  <div className="flex items-start gap-2">
                    <Globe size={14} className="mt-0.5 text-gray-400 shrink-0" />
                    <a href={sv.url_gestion} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline truncate">{sv.url_gestion}</a>
                  </div>
                )}
              </div>
            </section>

            {/* Recursos */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recursos de hardware</h3>
              <div className="grid grid-cols-3 gap-3">
                {[{ icon: Cpu, label: "CPU", val: sv.procesador },
                  { icon: MemoryStick, label: "RAM", val: sv.memoria_ram },
                  { icon: HardDrive, label: "Almacenamiento", val: sv.almacenamiento }]
                  .map(({ icon: Icon, label, val }) => val ? (
                    <div key={label} className="rounded-lg border bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Icon size={13} />{label}
                      </div>
                      <p className="text-sm font-medium leading-snug">{val}</p>
                    </div>
                  ) : null)}
              </div>
            </section>

            {/* Sistema */}
            {(sv.kernel || sv.pve_version || sv.boot_mode || sv.repositorio) && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sistema / Proxmox</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {sv.pve_version && <div><span className="text-muted-foreground">PVE Manager: </span>{sv.pve_version}</div>}
                  {sv.kernel && (
                    <div className="flex items-start gap-1">
                      <Terminal size={13} className="mt-0.5 text-gray-400 shrink-0" />
                      <span><span className="text-muted-foreground">Kernel: </span>{sv.kernel}</span>
                    </div>
                  )}
                  {sv.boot_mode && <div><span className="text-muted-foreground">Boot Mode: </span>{sv.boot_mode}</div>}
                  {sv.repositorio && <div><span className="text-muted-foreground">Repositorio: </span>{sv.repositorio}</div>}
                </div>
              </section>
            )}

            {/* VMs */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Máquinas Virtuales ({sv.vms?.length ?? 0})
                </h3>
                <button onClick={openNewVM}
                  className="flex items-center gap-1 rounded-md border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                  <Plus size={12} /> Nueva VM
                </button>
              </div>

              {(!sv.vms || sv.vms.length === 0) ? (
                <p className="text-sm text-muted-foreground">Sin VMs registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {sv.vms.map((vm, i) => (
                    <div key={vm.id}
                      className={`rounded-lg border px-3 py-2.5 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      {/* Fila 1: ID · nombre · estado · acciones */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                          #{vm.vm_id}
                        </span>
                        <span className="text-sm font-medium truncate flex-1 min-w-0">{vm.vm_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusColor(vm.status)}`}>
                          {vm.status_display || vm.status}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          <button title="Editar VM" onClick={() => openEditVM(vm)}
                            className="rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button title="Eliminar VM" onClick={() => setVmDelTarget(vm)}
                            className="rounded p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {/* Fila 2: IP · recursos · tipo */}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{vm.direccion_ip || "Sin IP"}</span>
                        <span><span className="font-medium text-foreground">{vm.vcpu}</span> vCPU</span>
                        <span><span className="font-medium text-foreground">{vm.vram}</span> RAM</span>
                        <span><span className="font-medium text-foreground">{vm.vstorage}</span> GB</span>
                        {vm.tipo && <span className="uppercase tracking-wide">{vm.tipo}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {sv.observaciones && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observaciones</h3>
                <p className="text-sm whitespace-pre-wrap">{sv.observaciones}</p>
              </section>
            )}

            <TIMovimientosPanel modelo="ServidorFisico" objetoId={sv.id} />
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── VM Form ── */}
    {vmOpen && sv && (
      <VMFormModal
        servidorId={sv.id}
        vm={vmEditing}
        onClose={() => setVmOpen(false)}
        onSaved={() => { setVmOpen(false); load(); }}
      />
    )}

    {/* ── Confirmar eliminación VM ── */}
    <Dialog open={!!vmDelTarget} onOpenChange={() => setVmDelTarget(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={18} /> Eliminar VM</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mt-2">
          ¿Eliminar la VM <strong>{vmDelTarget?.vm_name}</strong> (ID: {vmDelTarget?.vm_id})? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setVmDelTarget(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
          <button onClick={handleVMDelete} disabled={vmDeleting}
            className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
            {vmDeleting && <Loader2 size={14} className="animate-spin" />} Eliminar
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

interface ServidorForm {
  node_id: string; marca: string; modelo: string; ubicacion: string; responsable: string;
  url_gestion: string; procesador: string; memoria_ram: string; almacenamiento: string;
  pve_version: string; activo: boolean; observaciones: string;
}
const EMPTY: ServidorForm = {
  node_id: "", marca: "", modelo: "", ubicacion: "", responsable: "",
  url_gestion: "", procesador: "", memoria_ram: "", almacenamiento: "",
  pve_version: "", activo: true, observaciones: "",
};

function Field({ label, name, value, onChange, required, placeholder, textarea }: {
  label: string; name: keyof ServidorForm; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean; placeholder?: string; textarea?: boolean;
}) {
  const cls = "mt-1 w-full rounded-md border px-3 py-1.5 text-sm";
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {textarea ? <textarea name={name} value={value} onChange={onChange} rows={2} placeholder={placeholder} className={cls} />
        : <input name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} className={cls} />}
    </div>
  );
}

export function ServidoresList() {
  const [servidores, setServidores] = useState<ServidorFisicoListItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [open, setOpen]             = useState(false);
  const [editing, setEditing]       = useState<ServidorFisicoListItem | null>(null);
  const [form, setForm]             = useState<ServidorForm>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [delTarget, setDelTarget]   = useState<ServidorFisicoListItem | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [bitacora, setBitacora]     = useState<{ id: string; repr: string } | null>(null);
  const [detail, setDetail]         = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiGetServidores().then(setServidores).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(null); setOpen(true); };
  const openEdit = (sv: ServidorFisicoListItem) => {
    const full = sv as unknown as ServidorFisico;
    setEditing(sv);
    setForm({ node_id: sv.node_id, marca: sv.marca ?? "", modelo: sv.modelo ?? "",
      ubicacion: sv.ubicacion ?? "", responsable: full.responsable ?? "", url_gestion: full.url_gestion ?? "",
      procesador: sv.procesador ?? "", memoria_ram: sv.memoria_ram ?? "", almacenamiento: sv.almacenamiento ?? "",
      pve_version: sv.pve_version ?? "", activo: sv.activo, observaciones: full.observaciones ?? "" });
    setFormError(null); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdateServidor(editing.id, form);
      else         await apiCreateServidor(form);
      setOpen(false); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return; setDeleting(true);
    try { await apiDeleteServidor(delTarget.id); setDelTarget(null); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Error al eliminar"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={22} className="text-gray-700" />
          <h1 className="text-xl font-bold">Servidores Físicos</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800">
          <Plus size={16} /> Nuevo servidor
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-gray-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : servidores.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No hay servidores registrados.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3">Node ID</th>
                <th className="text-left px-4 py-3">Marca / Modelo</th>
                <th className="text-left px-4 py-3">Ubicación</th>
                <th className="text-left px-4 py-3">Recursos</th>
                <th className="text-left px-4 py-3">PVE</th>
                <th className="text-left px-4 py-3">VMs</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {servidores.map((sv, i) => (
                <tr key={sv.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-2 font-mono font-medium">{sv.node_id}</td>
                  <td className="px-4 py-2">{sv.marca} {sv.modelo}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{sv.ubicacion || "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    <div>{sv.procesador}</div>
                    <div className="text-muted-foreground">{sv.memoria_ram} RAM · {sv.almacenamiento} Disco</div>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">{sv.pve_version || "—"}</td>
                  <td className="px-4 py-2 text-center font-medium">{sv.vms_count}</td>
                  <td className="px-4 py-2">
                    <Badge variant={sv.activo ? "default" : "secondary"}>{sv.activo ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Ver detalle" onClick={() => setDetail(sv.id)}
                        className="p-1 rounded hover:bg-blue-50 text-blue-600">
                        <Eye size={14} />
                      </button>
                      <button title="Editar" onClick={() => openEdit(sv)} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                        <Pencil size={14} />
                      </button>
                      <button title="Bitácora" onClick={() => setBitacora({ id: sv.id, repr: sv.node_id })}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <History size={14} />
                      </button>
                      <button title="Eliminar" onClick={() => setDelTarget(sv)} className="p-1 rounded hover:bg-red-50 text-red-500">
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

      {/* ── Modal Crear / Editar ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server size={18} /> {editing ? "Editar Servidor Físico" : "Nuevo Servidor Físico"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center justify-between">
                {formError} <button type="button" onClick={() => setFormError(null)}><X size={14} /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Node ID (ej: pve1)" name="node_id" value={form.node_id} onChange={handleChange} required placeholder="pve1" />
              <Field label="Responsable" name="responsable" value={form.responsable} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca" name="marca" value={form.marca} onChange={handleChange} placeholder="Dell, HP…" />
              <Field label="Modelo" name="modelo" value={form.modelo} onChange={handleChange} placeholder="PowerEdge R740…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ubicación física" name="ubicacion" value={form.ubicacion} onChange={handleChange} />
              <Field label="URL de gestión" name="url_gestion" value={form.url_gestion} onChange={handleChange} placeholder="https://192.168.x.x:8006" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Procesador" name="procesador" value={form.procesador} onChange={handleChange} />
              <Field label="RAM total" name="memoria_ram" value={form.memoria_ram} onChange={handleChange} placeholder="256 GB" />
              <Field label="Almacenamiento" name="almacenamiento" value={form.almacenamiento} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Versión PVE" name="pve_version" value={form.pve_version} onChange={handleChange} placeholder="8.2.2" />
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="activo_chk" name="activo" checked={form.activo} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
                <label htmlFor="activo_chk" className="text-sm">Activo</label>
              </div>
            </div>
            <Field label="Observaciones" name="observaciones" value={form.observaciones} onChange={handleChange} textarea />
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Detalle ── */}
      {detail && <ServidorDetailModal id={detail} onClose={() => setDetail(null)} />}

      {/* ── Confirmar eliminación ── */}
      <Dialog open={!!delTarget} onOpenChange={() => setDelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={18} /> Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">¿Eliminar servidor <strong>{delTarget?.node_id}</strong>? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDelTarget(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
              {deleting && <Loader2 size={14} className="animate-spin" />} Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bitácora ── */}
      <BitacoraModal open={!!bitacora} onClose={() => setBitacora(null)}
        modelo="ServidorFisico" objetoId={bitacora?.id ?? ""} titulo={bitacora?.repr} />
    </div>
  );
}
