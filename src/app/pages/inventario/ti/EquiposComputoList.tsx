/**
 * EquiposComputoList.tsx
 * CRUD completo + bitácora de cambios.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  Loader2, Search, Plus, Monitor, X, Pencil, Trash2, History, QrCode, Download,
  Cpu, MemoryStick, HardDrive, Tag, Hash, Calendar, Building2, Globe, User, Package,
  CheckCircle2, XCircle, Eye,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import {
  apiGetEquipos, apiGetEquipo, apiCreateEquipo, apiUpdateEquipo, apiDeleteEquipo,
  EquipoComputoListItem, EquipoComputo,
} from "../../../lib/api_ti";
import { apiListDependencies, Dependency } from "../../../lib/api";
import { BitacoraModal } from "./BitacoraModal";
import { TIMovimientosPanel } from "./TIMovimientosPanel";

const BACKUP_COLOR: Record<string, string> = {
  OK: "bg-green-100 text-green-700",
  PENDIENTE: "bg-yellow-100 text-yellow-700",
  SIN_BACKUP: "bg-red-100 text-red-700",
  "N/A": "bg-gray-100 text-gray-600",
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>
      <span><span className="text-muted-foreground">{label}: </span>{value}</span>
    </div>
  );
}

function EquipoDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [eq, setEq] = useState<EquipoComputo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGetEquipo(id)
      .then(setEq)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadQR = () => {
    const svg = document.getElementById("detail-qr-svg") as SVGElement | null;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `QR_${eq?.hostname || id.slice(0, 8)}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Monitor size={18} />
            {eq ? (eq.hostname || "Sin hostname") : "Cargando…"}
            {eq && (
              <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                eq.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {eq.activo ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {eq.activo ? "Activo" : "Inactivo"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading && <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>}
        {error && <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>}

        {eq && (
          <div className="space-y-4 mt-2">
            {/* Estado backup */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                BACKUP_COLOR[eq.estado_backup] ?? "bg-gray-100 text-gray-600"
              }`}>Backup: {eq.estado_backup_display || eq.estado_backup}</span>
              <button onClick={() => setShowQR(true)}
                className="ml-auto flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                <QrCode size={13} /> Ver QR
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <section className="rounded-lg border p-3 space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identificación</h3>
                <InfoRow icon={<Monitor size={13} />} label="Tipo" value={TIPO_LABEL[eq.tipo] ?? eq.tipo} />
                <InfoRow icon={<Tag size={13} />} label="Nivel" value={eq.nivel_display} />
                <InfoRow icon={<Hash size={13} />} label="Serial" value={eq.serial} />
                <InfoRow icon={<Hash size={13} />} label="N° Activo" value={eq.no_activo} />
                <InfoRow icon={<Tag size={13} />} label="Marca" value={eq.marca} />
                {eq.fecha_compra && <InfoRow icon={<Calendar size={13} />} label="Fecha compra" value={eq.fecha_compra} />}
              </section>
              <section className="rounded-lg border p-3 space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Asignación</h3>
                <InfoRow icon={<User size={13} />} label="Empleado" value={eq.empleado_nombre} />
                <InfoRow icon={<Tag size={13} />} label="Cargo" value={eq.perfil_laboral} />
                <InfoRow icon={<Building2 size={13} />} label="Área" value={eq.dependency_nombre} />
                <InfoRow icon={<Globe size={13} />} label="IP" value={eq.direccion_ip} />
              </section>
              <section className="rounded-lg border p-3 space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Especificaciones</h3>
                <InfoRow icon={<Cpu size={13} />} label="Procesador" value={eq.procesador} />
                <InfoRow icon={<MemoryStick size={13} />} label="RAM" value={eq.memoria_ram} />
                <InfoRow icon={<HardDrive size={13} />} label="Disco" value={eq.disco_duro} />
                <InfoRow icon={<Monitor size={13} />} label="S.O." value={eq.sistema_operativo} />
              </section>
              <section className="rounded-lg border p-3 space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Registro</h3>
                <InfoRow icon={<User size={13} />} label="Creado por" value={eq.created_by_nombre} />
                <InfoRow icon={<Calendar size={13} />} label="Creado" value={eq.created_at ? new Date(eq.created_at).toLocaleString("es-CO") : null} />
                <InfoRow icon={<Calendar size={13} />} label="Actualizado" value={eq.updated_at ? new Date(eq.updated_at).toLocaleString("es-CO") : null} />
                {eq.observaciones && <div className="text-sm"><span className="text-muted-foreground">Observaciones: </span>{eq.observaciones}</div>}
              </section>
            </div>

            {eq.perifericos.length > 0 && (
              <section className="rounded-lg border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b">
                  <Package size={14} className="text-gray-500" />
                  <h3 className="text-sm font-semibold">Periféricos ({eq.perifericos.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Tipo</th>
                        <th className="text-left px-3 py-2">Marca</th>
                        <th className="text-left px-3 py-2">Modelo</th>
                        <th className="text-left px-3 py-2">Serial</th>
                        <th className="text-left px-3 py-2">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eq.perifericos.map((p, i) => (
                        <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                          <td className="px-3 py-1.5">{p.tipo_display}</td>
                          <td className="px-3 py-1.5">{p.marca || "—"}</td>
                          <td className="px-3 py-1.5">{p.modelo || "—"}</td>
                          <td className="px-3 py-1.5 font-mono">{p.serial || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{p.observaciones || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <TIMovimientosPanel modelo="EquipoComputo" objetoId={eq.id} />
          </div>
        )}
        </div>

        {/* QR interno */}
        {showQR && eq && (
          <Dialog open onOpenChange={() => setShowQR(false)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><QrCode size={18} /> QR del Equipo</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-2">
                <QRCodeSVG
                  id="detail-qr-svg"
                  value={[`Hostname: ${eq.hostname||"—"}`,`Serial: ${eq.serial||"—"}`,`N° Activo: ${eq.no_activo||"—"}`,`Empleado: ${eq.empleado_nombre||"—"}`,`Área: ${eq.dependency_nombre||"—"}`,`Tipo: ${TIPO_LABEL[eq.tipo]??eq.tipo}`,`IP: ${eq.direccion_ip||"—"}`,`ID: ${eq.id}`].join("\n")}
                  size={220} level="M" includeMargin
                />
                <div className="text-center text-sm">
                  <p className="font-semibold">{eq.hostname || "Sin hostname"}</p>
                  <p className="text-xs text-muted-foreground">{eq.serial || "—"} · {eq.no_activo || "—"}</p>
                </div>
                <button onClick={downloadQR} className="flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-muted">
                  <Download size={14} /> Descargar PNG
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TIPO_LABEL: Record<string, string> = {
  TODO_EN_UNO: "Todo en uno", TORRE: "Torre", PORTATIL: "Portátil",
  LAPTOP: "Laptop", MINI_PC: "Mini PC", OTRO: "Otro",
};
const NIVEL_COLOR: Record<string, string> = {
  BASICO: "bg-gray-100 text-gray-700", INTERMEDIO: "bg-blue-100 text-blue-700",
  ESPECIALIZADO: "bg-purple-100 text-purple-700", SERVIDOR: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  dependency: "", empleado_nombre: "", perfil_laboral: "",
  hostname: "", tipo: "TODO_EN_UNO", nivel: "BASICO",
  serial: "", marca: "", no_activo: "", direccion_ip: "",
  procesador: "", disco_duro: "", memoria_ram: "", sistema_operativo: "",
  estado_backup: "PENDIENTE", activo: true, observaciones: "",
};

export function EquiposComputoList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipos, setEquipos]   = useState<EquipoComputoListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState(searchParams.get("search") ?? "");

  // Create / Edit modal
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<EquipoComputoListItem | null>(null);
  const [deps, setDeps]           = useState<Dependency[]>([]);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });

  // Delete confirm
  const [delTarget, setDelTarget] = useState<EquipoComputoListItem | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // Bitácora
  const [bitacora, setBitacora]   = useState<{ id: string; repr: string } | null>(null);

  // QR
  const [qrEquipo, setQrEquipo]   = useState<EquipoComputoListItem | null>(null);

  // Detalle
  const [detailId, setDetailId]   = useState<string | null>(null);

  const depId = searchParams.get("dependency_id") ?? undefined;

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (depId)  params.dependency_id = depId;
    if (search) params.search = search;
    apiGetEquipos(params)
      .then(setEquipos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [depId, search]);

  useEffect(() => { load(); }, [load]);

  const ensureDeps = () => {
    if (deps.length === 0)
      apiListDependencies(true).then(r => setDeps(r.results ?? []));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    ensureDeps();
    setOpen(true);
  };

  const openEdit = (eq: EquipoComputoListItem) => {
    setEditing(eq);
    setForm({
      dependency: eq.dependency,
      empleado_nombre: eq.empleado_nombre ?? "",
      perfil_laboral: eq.perfil_laboral ?? "",
      hostname: eq.hostname ?? "",
      tipo: eq.tipo,
      nivel: eq.nivel,
      serial: eq.serial ?? "",
      marca: eq.marca ?? "",
      no_activo: eq.no_activo ?? "",
      direccion_ip: eq.direccion_ip ?? "",
      procesador: "",
      disco_duro: "",
      memoria_ram: "",
      sistema_operativo: "",
      estado_backup: eq.estado_backup ?? "PENDIENTE",
      activo: eq.activo,
      observaciones: "",
    });
    setFormError(null);
    ensureDeps();
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      if (editing) await apiUpdateEquipo(editing.id, form);
      else         await apiCreateEquipo(form);
      setOpen(false); load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try { await apiDeleteEquipo(delTarget.id); setDelTarget(null); load(); }
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
          <Monitor size={22} className="text-blue-600" />
          <h1 className="text-xl font-bold">Equipos de Cómputo</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
          <Plus size={16} /> Nuevo equipo
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por hostname, serial, empleado, N° activo…"
            className="w-full rounded-md border px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Buscar</button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      ) : equipos.length === 0 ? (
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">No se encontraron equipos.</div>
      ) : (
        <>
          {/* ── Vista tarjetas (móvil) ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {equipos.map(eq => (
              <div key={eq.id} className="rounded-lg border bg-white p-3 space-y-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-sm">{eq.hostname || "—"}</p>
                    <p className="text-xs text-muted-foreground">{eq.empleado_nombre || "—"}</p>
                    {eq.perfil_laboral && <p className="text-xs text-muted-foreground">{eq.perfil_laboral}</p>}
                  </div>
                  <Badge variant={eq.activo ? "default" : "secondary"} className="shrink-0">
                    {eq.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span><span className="text-muted-foreground">Área: </span>{eq.dependency_nombre}</span>
                  <span><span className="text-muted-foreground">Tipo: </span>{TIPO_LABEL[eq.tipo] ?? eq.tipo}</span>
                  <span>
                    <span className="text-muted-foreground">Nivel: </span>
                    <span className={`inline-block rounded px-1.5 py-0.5 ${NIVEL_COLOR[eq.nivel] ?? "bg-gray-100"}`}>
                      {eq.nivel_display}
                    </span>
                  </span>
                  {eq.direccion_ip && <span className="font-mono"><span className="text-muted-foreground">IP: </span>{eq.direccion_ip}</span>}
                </div>
                <div className="flex items-center gap-1 pt-1 border-t">
                  <button onClick={() => setDetailId(eq.id)} className="flex items-center gap-1 text-blue-600 hover:underline text-xs px-1"><Eye size={13} /> Ver</button>
                  <button title="Editar" onClick={() => openEdit(eq)} className="p-1 rounded hover:bg-blue-50 text-blue-600"><Pencil size={14} /></button>
                  <button title="Ver QR" onClick={() => setQrEquipo(eq)} className="p-1 rounded hover:bg-cyan-50 text-cyan-600"><QrCode size={14} /></button>
                  <button title="Bitácora" onClick={() => setBitacora({ id: eq.id, repr: eq.hostname || eq.id.slice(0,8) })} className="p-1 rounded hover:bg-gray-100 text-gray-500"><History size={14} /></button>
                  <button title="Eliminar" onClick={() => setDelTarget(eq)} className="p-1 rounded hover:bg-red-50 text-red-500 ml-auto"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Vista tabla (desktop) ── */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Hostname</th>
                  <th className="text-left px-4 py-3">Empleado</th>
                  <th className="text-left px-4 py-3">Área</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Nivel</th>
                  <th className="text-left px-4 py-3">IP</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((eq, i) => (
                  <tr key={eq.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="px-4 py-2 font-mono font-medium">{eq.hostname || "—"}</td>
                    <td className="px-4 py-2">
                      <div>{eq.empleado_nombre || "—"}</div>
                      <div className="text-xs text-muted-foreground">{eq.perfil_laboral}</div>
                    </td>
                    <td className="px-4 py-2 text-xs">{eq.dependency_nombre}</td>
                    <td className="px-4 py-2">{TIPO_LABEL[eq.tipo] ?? eq.tipo}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${NIVEL_COLOR[eq.nivel] ?? "bg-gray-100"}`}>
                        {eq.nivel_display}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{eq.direccion_ip || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={eq.activo ? "default" : "secondary"}>
                        {eq.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Ver detalle" onClick={() => setDetailId(eq.id)} className="flex items-center gap-0.5 text-blue-600 hover:underline text-xs"><Eye size={13} /> Ver</button>
                        <button title="Editar" onClick={() => openEdit(eq)} className="p-1 rounded hover:bg-blue-50 text-blue-600">
                          <Pencil size={14} />
                        </button>
                        <button title="Ver QR" onClick={() => setQrEquipo(eq)}
                          className="p-1 rounded hover:bg-cyan-50 text-cyan-600">
                          <QrCode size={14} />
                        </button>
                        <button title="Bitácora" onClick={() => setBitacora({ id: eq.id, repr: eq.hostname || eq.id.slice(0,8) })}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500">
                          <History size={14} />
                        </button>
                        <button title="Eliminar" onClick={() => setDelTarget(eq)} className="p-1 rounded hover:bg-red-50 text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground text-right">{equipos.length} equipo(s) encontrado(s)</p>

      {/* ── Modal Crear / Editar ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Monitor size={18} /> {editing ? "Editar Equipo de Cómputo" : "Nuevo Equipo de Cómputo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center justify-between">
                {formError} <button type="button" onClick={() => setFormError(null)}><X size={14} /></button>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Área <span className="text-red-500">*</span></label>
              <select required value={form.dependency} onChange={e => setForm(f => ({ ...f, dependency: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                <option value="">— seleccionar —</option>
                {deps.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([["empleado_nombre","Nombre empleado"],["perfil_laboral","Perfil / Cargo"]] as const).map(([k,l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-muted-foreground">{l}</label>
                  <input value={(form as Record<string,unknown>)[k] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Hostname</label>
                <input value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["TODO_EN_UNO","Todo en Uno"],["TORRE","Torre"],["PORTATIL","Portátil"],["LAPTOP","Laptop"],["MINI_PC","Mini PC"],["OTRO","Otro"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Nivel</label>
                <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["BASICO","Básico"],["INTERMEDIO","Intermedio"],["ESPECIALIZADO","Especializado"],
                    ["BASICO_LAPTOP","Básico Laptop"],["INTERMEDIO_LAPTOP","Intermedio Laptop"],
                    ["ESPECIALIZADO_LAPTOP","Especializado Laptop"],["TABLET","Tablet"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([["serial","Serial"],["marca","Marca"],["no_activo","N° Activo (placa)"]] as const).map(([k,l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-muted-foreground">{l}</label>
                  <input value={(form as Record<string,unknown>)[k] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Dirección IP</label>
                <input value={form.direccion_ip} onChange={e => setForm(f => ({ ...f, direccion_ip: e.target.value }))}
                  placeholder="192.168.x.x" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Estado Backup</label>
                <select value={form.estado_backup} onChange={e => setForm(f => ({ ...f, estado_backup: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm">
                  {[["OK","OK"],["PENDIENTE","Pendiente"],["SIN_BACKUP","Sin backup"],["N/A","No aplica"]]
                    .map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">RAM</label>
                <input value={form.memoria_ram} onChange={e => setForm(f => ({ ...f, memoria_ram: e.target.value }))}
                  placeholder="8 GB" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Disco</label>
                <input value={form.disco_duro} onChange={e => setForm(f => ({ ...f, disco_duro: e.target.value }))}
                  placeholder="512 GB SSD" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Procesador</label>
                <input value={form.procesador} onChange={e => setForm(f => ({ ...f, procesador: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Sistema Operativo</label>
                <input value={form.sistema_operativo} onChange={e => setForm(f => ({ ...f, sistema_operativo: e.target.value }))}
                  placeholder="Windows 11 Pro" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ec_activo" checked={form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="ec_activo" className="text-sm">Activo / En servicio</label>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Observaciones</label>
              <textarea rows={2} value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
            </div>
            </div>{/* end scroll */}
            <div className="flex justify-end gap-2 pt-3 border-t mt-2 shrink-0">
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
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
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={18} /> Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            ¿Eliminar el equipo <strong>{delTarget?.hostname || delTarget?.id.slice(0,8)}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDelTarget(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal QR ── */}
      <Dialog open={!!qrEquipo} onOpenChange={() => setQrEquipo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode size={18} /> QR del Equipo
            </DialogTitle>
          </DialogHeader>
          {qrEquipo && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QRCodeSVG
                id="equipo-qr-svg"
                value={[
                  `Hostname: ${qrEquipo.hostname || "—"}`,
                  `Serial: ${qrEquipo.serial || "—"}`,
                  `N° Activo: ${qrEquipo.no_activo || "—"}`,
                  `Empleado: ${qrEquipo.empleado_nombre || "—"}`,
                  `Área: ${qrEquipo.dependency_nombre || "—"}`,
                  `Tipo: ${TIPO_LABEL[qrEquipo.tipo] ?? qrEquipo.tipo}`,
                  `IP: ${qrEquipo.direccion_ip || "—"}`,
                  `ID: ${qrEquipo.id}`,
                ].join("\n")}
                size={220}
                level="M"
                includeMargin
              />
              <div className="text-center text-sm text-muted-foreground">
                <p className="font-semibold text-gray-800">{qrEquipo.hostname || "Sin hostname"}</p>
                <p className="text-xs">{qrEquipo.serial || "—"} · {qrEquipo.no_activo || "—"}</p>
              </div>
              <button
                onClick={() => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 220; canvas.height = 220;
                  const ctx = canvas.getContext("2d");
                  const svg = document.getElementById("equipo-qr-svg") as SVGElement | null;
                  if (!svg || !ctx) return;
                  const xml = new XMLSerializer().serializeToString(svg);
                  const img = new Image();
                  img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    const a = document.createElement("a");
                    a.download = `QR_${qrEquipo.hostname || qrEquipo.id.slice(0,8)}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
                }}
                className="flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                <Download size={14} /> Descargar PNG
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bitácora ── */}
      <BitacoraModal
        open={!!bitacora}
        onClose={() => setBitacora(null)}
        modelo="EquipoComputo"
        objetoId={bitacora?.id ?? ""}
        titulo={bitacora?.repr}
      />

      {/* ── Detalle ── */}
      {detailId && <EquipoDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

