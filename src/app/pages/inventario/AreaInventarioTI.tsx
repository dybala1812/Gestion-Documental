/**
 * AreaInventarioTI.tsx
 * ====================
 * Vista de inventario TI para usuarios de área.
 * Muestra los equipos de cómputo y AV asignados a la dependencia del usuario,
 * con la posibilidad de validarlos o reportar discrepancias.
 *
 * Acceso: cualquier usuario autenticado con dependency asignada.
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Monitor, Tv, CheckCircle2, AlertTriangle, Clock, HardDrive,
  RefreshCw, ChevronLeft, ChevronDown, ChevronUp, Search, X,
  Package, Cpu, MemoryStick, Globe, User, BarChart2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export interface AreaInventarioTIProps {
  /** Cuando es true, omite el header de página y el fondo min-h-screen.
   *  Útsalo al embeber el componente dentro de otro panel. */
  embedded?: boolean;
}
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { API_BASE, tokens } from "../../lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Periferico {
  id: string;
  tipo: string;
  tipo_display: string;
  serial: string;
  marca: string;
  modelo: string;
}

interface EquipoComputo {
  id: string;
  empleado_nombre: string;
  perfil_laboral: string;
  hostname: string;
  tipo: string;
  tipo_display: string;
  nivel_display: string;
  serial: string;
  marca: string;
  no_activo: string;
  procesador: string;
  disco_duro: string;
  memoria_ram: string;
  sistema_operativo: string;
  direccion_ip: string;
  estado_backup: string;
  activo: boolean;
  perifericos: Periferico[];
  validacion: "PENDIENTE" | "VALIDADO" | "DISCREPANCIA";
  validacion_display: string;
  validado_por: string | null;
  validado_por_nombre: string | null;
  validado_at: string | null;
  comentario_validacion: string;
  updated_at: string;
}

interface EquipoAV {
  id: string;
  tipo_av: string;
  tipo_av_display: string;
  elemento: string;
  descripcion: string;
  cantidad: number;
  serial: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  estado: string;
  estado_display: string;
  validacion: "PENDIENTE" | "VALIDADO" | "DISCREPANCIA";
  validacion_display: string;
  validado_por: string | null;
  validado_por_nombre: string | null;
  validado_at: string | null;
  comentario_validacion: string;
  updated_at: string;
}

interface Stats {
  total_equipos: number;
  validados: number;
  pendientes: number;
  discrepancias: number;
  total_av: number;
  av_validados: number;
  av_pendientes: number;
  av_discrepancias: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = `${API_BASE}/api/pqrs/ti`;

async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const token = tokens.getAccess();
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Error ${res.status}`);
  }
  return res.json();
}

// ─── Colores de validación ────────────────────────────────────────────────────

const valStyle: Record<string, string> = {
  PENDIENTE:    "bg-amber-50  text-amber-700  border-amber-200",
  VALIDADO:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISCREPANCIA: "bg-red-50     text-red-700     border-red-200",
};

const valIcon = {
  PENDIENTE:    <Clock    className="w-3.5 h-3.5" />,
  VALIDADO:     <CheckCircle2  className="w-3.5 h-3.5" />,
  DISCREPANCIA: <AlertTriangle className="w-3.5 h-3.5" />,
};

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// ─── Modal de validación ─────────────────────────────────────────────────────

interface ValidarModalProps {
  tipo: "equipo" | "av";
  id: string;
  nombre: string;
  current: "PENDIENTE" | "VALIDADO" | "DISCREPANCIA";
  onClose: () => void;
  onSaved: (id: string, validacion: string, comentario: string, nombre_usuario: string, at: string) => void;
}

function ValidarModal({ tipo, id, nombre, current, onClose, onSaved }: ValidarModalProps) {
  const { usuario } = useAuth();
  const [val, setVal] = useState<"VALIDADO" | "DISCREPANCIA">(current === "DISCREPANCIA" ? "DISCREPANCIA" : "VALIDADO");
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const url = tipo === "equipo"
        ? `${API}/equipos/${id}/validar/`
        : `${API}/av/${id}/validar/`;
      await apiFetch(url, {
        method: "PATCH",
        body: JSON.stringify({ validacion: val, comentario_validacion: comentario }),
      });
      const nombre_usuario = `${usuario?.nombre ?? ""} ${usuario?.apellido ?? ""}`.trim();
      onSaved(id, val, comentario, nombre_usuario, new Date().toISOString());
      toast.success(val === "VALIDADO" ? "Equipo validado correctamente" : "Discrepancia reportada a TI");
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Validar equipo</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5 truncate max-w-[22rem]">{nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setVal("VALIDADO")}
              className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                val === "VALIDADO"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar existencia
            </button>
            <button
              onClick={() => setVal("DISCREPANCIA")}
              className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                val === "DISCREPANCIA"
                  ? "bg-red-600 text-white border-red-600 shadow-md"
                  : "bg-red-50 text-red-700 border-red-200 hover:border-red-400"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Reportar discrepancia
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              {val === "DISCREPANCIA" ? "Descripción de la discrepancia *" : "Observaciones (opcional)"}
            </label>
            <textarea
              rows={3}
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder={
                val === "DISCREPANCIA"
                  ? "Ej: El equipo no está en el área, el serial no coincide, está en mal estado..."
                  : "Ej: Equipo presente y funcionando correctamente"
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            size="sm"
            disabled={saving || (val === "DISCREPANCIA" && !comentario.trim())}
            onClick={submit}
            className={val === "DISCREPANCIA" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
          >
            {saving ? "Guardando..." : val === "VALIDADO" ? "Confirmar validación" : "Reportar discrepancia"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de equipo de cómputo ────────────────────────────────────────────────

function EquipoRow({ eq, onValidar }: { eq: EquipoComputo; onValidar: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-shadow ${
      eq.validacion === "DISCREPANCIA" ? "border-red-200 bg-red-50/30" :
      eq.validacion === "VALIDADO"     ? "border-emerald-200 bg-emerald-50/20" :
      "border-gray-200 bg-white"
    }`}>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-800 truncate">
              {eq.hostname || eq.serial || "Sin hostname"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {eq.tipo_display}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${valStyle[eq.validacion]}`}>
              {valIcon[eq.validacion]} {eq.validacion_display}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            {eq.empleado_nombre && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" /> {eq.empleado_nombre}
              </span>
            )}
            {eq.marca && (
              <span className="text-xs text-gray-500">{eq.marca}</span>
            )}
            {eq.serial && (
              <span className="text-xs text-gray-400">S/N: {eq.serial}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onValidar}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            {eq.validacion === "PENDIENTE" ? "Validar" : "Actualizar"}
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/60 rounded-b-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Procesador", eq.procesador, <Cpu key="c" className="w-3 h-3"/>],
              ["RAM",        eq.memoria_ram, <MemoryStick key="r" className="w-3 h-3"/>],
              ["Disco",      eq.disco_duro, <HardDrive key="d" className="w-3 h-3"/>],
              ["S.O.",       eq.sistema_operativo, <Monitor key="m" className="w-3 h-3"/>],
              ["IP",         eq.direccion_ip, <Globe key="g" className="w-3 h-3"/>],
              ["No. Activo", eq.no_activo, <Package key="p" className="w-3 h-3"/>],
            ].filter(([, v]) => v).map(([lbl, val, icon]) => (
              <div key={lbl as string} className="flex items-start gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                <span className="text-gray-400 mt-0.5">{icon}</span>
                <div>
                  <p className="text-gray-400 font-medium">{lbl as string}</p>
                  <p className="text-gray-700 font-semibold">{val as string}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Periféricos */}
          {eq.perifericos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Periféricos</p>
              <div className="flex flex-wrap gap-1.5">
                {eq.perifericos.map(p => (
                  <span key={p.id} className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-600">
                    {p.tipo_display}{p.marca ? ` · ${p.marca}` : ""}{p.serial ? ` · ${p.serial}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comentario de validación */}
          {eq.comentario_validacion && (
            <div className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-gray-500">Comentario: </span>
              <span className="text-gray-700">{eq.comentario_validacion}</span>
              {eq.validado_por_nombre && (
                <span className="text-gray-400 ml-2">— {eq.validado_por_nombre}, {formatDate(eq.validado_at)}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fila de equipo AV ────────────────────────────────────────────────────────

function AVRow({ av, onValidar }: { av: EquipoAV; onValidar: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-shadow ${
      av.validacion === "DISCREPANCIA" ? "border-red-200 bg-red-50/30" :
      av.validacion === "VALIDADO"     ? "border-emerald-200 bg-emerald-50/20" :
      "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-800 truncate">{av.elemento}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              {av.tipo_av_display}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${valStyle[av.validacion]}`}>
              {valIcon[av.validacion]} {av.validacion_display}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            {av.cantidad > 1 && <span className="text-xs text-gray-500">Cant: {av.cantidad}</span>}
            {av.marca && <span className="text-xs text-gray-500">{av.marca}</span>}
            {av.ubicacion && <span className="text-xs text-gray-400">{av.ubicacion}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onValidar}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            {av.validacion === "PENDIENTE" ? "Validar" : "Actualizar"}
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 rounded-b-xl space-y-2 text-xs">
          {av.descripcion && <p className="text-gray-600">{av.descripcion}</p>}
          <div className="flex flex-wrap gap-2">
            {av.serial && (
              <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-1">S/N: {av.serial}</span>
            )}
            {av.modelo && (
              <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-1">{av.modelo}</span>
            )}
            {av.estado_display && (
              <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-1">Estado: {av.estado_display}</span>
            )}
          </div>
          {av.comentario_validacion && (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-gray-500">Comentario: </span>
              <span className="text-gray-700">{av.comentario_validacion}</span>
              {av.validado_por_nombre && (
                <span className="text-gray-400 ml-2">— {av.validado_por_nombre}, {formatDate(av.validado_at)}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AreaInventarioTI({ embedded = false }: AreaInventarioTIProps = {}) {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [loading,   setLoading]   = useState(true);
  const [depNombre, setDepNombre] = useState("");
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [equipos,   setEquipos]   = useState<EquipoComputo[]>([]);
  const [av,        setAV]        = useState<EquipoAV[]>([]);
  const [tab,       setTab]       = useState<"equipos" | "av">("equipos");
  const [query,     setQuery]     = useState("");
  const [modal,     setModal]     = useState<{ tipo: "equipo" | "av"; item: EquipoComputo | EquipoAV } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        dependency_id: string;
        dependency_nombre: string;
        stats: Stats;
        equipos: EquipoComputo[];
        av: EquipoAV[];
      }>(`${API}/mi-inventario/`);
      setDepNombre(data.dependency_nombre);
      setStats(data.stats);
      setEquipos(data.equipos);
      setAV(data.av);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredEquipos = useMemo(() =>
    equipos.filter(eq =>
      !query ||
      eq.hostname?.toLowerCase().includes(query.toLowerCase()) ||
      eq.empleado_nombre?.toLowerCase().includes(query.toLowerCase()) ||
      eq.serial?.toLowerCase().includes(query.toLowerCase()) ||
      eq.marca?.toLowerCase().includes(query.toLowerCase())
    ), [equipos, query]);

  const filteredAV = useMemo(() =>
    av.filter(item =>
      !query ||
      item.elemento?.toLowerCase().includes(query.toLowerCase()) ||
      item.tipo_av_display?.toLowerCase().includes(query.toLowerCase()) ||
      item.ubicacion?.toLowerCase().includes(query.toLowerCase())
    ), [av, query]);

  const onEquipoSaved = (id: string, validacion: string, comentario: string, nombre: string, at: string) => {
    setEquipos(prev => prev.map(eq => eq.id === id
      ? { ...eq, validacion: validacion as EquipoComputo["validacion"], comentario_validacion: comentario,
          validado_por_nombre: nombre, validado_at: at }
      : eq
    ));
    setStats(s => {
      if (!s) return s;
      const old = equipos.find(e => e.id === id)?.validacion ?? "PENDIENTE";
      const upd = { ...s };
      if (old === "PENDIENTE")    upd.pendientes    = Math.max(0, upd.pendientes    - 1);
      if (old === "VALIDADO")     upd.validados     = Math.max(0, upd.validados     - 1);
      if (old === "DISCREPANCIA") upd.discrepancias = Math.max(0, upd.discrepancias - 1);
      if (validacion === "PENDIENTE")    upd.pendientes++;
      if (validacion === "VALIDADO")     upd.validados++;
      if (validacion === "DISCREPANCIA") upd.discrepancias++;
      return upd;
    });
  };

  const onAVSaved = (id: string, validacion: string, comentario: string, nombre: string, at: string) => {
    setAV(prev => prev.map(item => item.id === id
      ? { ...item, validacion: validacion as EquipoAV["validacion"], comentario_validacion: comentario,
          validado_por_nombre: nombre, validado_at: at }
      : item
    ));
    setStats(s => {
      if (!s) return s;
      const old = av.find(e => e.id === id)?.validacion ?? "PENDIENTE";
      const upd = { ...s };
      if (old === "PENDIENTE")    upd.av_pendientes    = Math.max(0, upd.av_pendientes    - 1);
      if (old === "VALIDADO")     upd.av_validados     = Math.max(0, upd.av_validados     - 1);
      if (old === "DISCREPANCIA") upd.av_discrepancias = Math.max(0, upd.av_discrepancias - 1);
      if (validacion === "PENDIENTE")    upd.av_pendientes++;
      if (validacion === "VALIDADO")     upd.av_validados++;
      if (validacion === "DISCREPANCIA") upd.av_discrepancias++;
      return upd;
    });
  };

  const pct = stats ? Math.round(((stats.validados + stats.discrepancias) / Math.max(stats.total_equipos, 1)) * 100) : 0;

  const content = (
    <div className="space-y-5">
      {/* ── Refresh inline (solo en modo embedded) ── */}
      {embedded && (
        <div className="flex justify-end">
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {/* ── Stats ── */}

      {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Equipos totales", value: stats.total_equipos, icon: <Monitor className="w-4 h-4"/>, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Validados",       value: stats.validados,     icon: <CheckCircle2 className="w-4 h-4"/>, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Pendientes",      value: stats.pendientes,    icon: <Clock className="w-4 h-4"/>,      color: "text-amber-600",   bg: "bg-amber-50" },
              { label: "Discrepancias",   value: stats.discrepancias, icon: <AlertTriangle className="w-4 h-4"/>, color: "text-red-600", bg: "bg-red-50" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`${s.bg} ${s.color} p-2.5 rounded-xl`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso de validación */}
        {stats && stats.total_equipos > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Progreso de validación — Equipos</span>
              </div>
              <span className="text-sm font-bold text-gray-800">{pct}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="text-emerald-600 font-medium">{stats.validados} validados</span>
              <span className="text-red-500 font-medium">{stats.discrepancias} discrepancias</span>
              <span className="text-amber-500 font-medium">{stats.pendientes} pendientes</span>
            </div>
          </div>
        )}

        {/* ── Tabs + búsqueda ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setTab("equipos")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === "equipos"
                  ? "bg-cyan-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Cómputo
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === "equipos" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>{equipos.length}</span>
            </button>
            <button
              onClick={() => setTab("av")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-l border-gray-200 transition-colors ${
                tab === "av"
                  ? "bg-purple-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Tv className="w-4 h-4" />
              AV / Audiovisual
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === "av" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>{av.length}</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar equipo, empleado, serial..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
          </div>
        ) : tab === "equipos" ? (
          <div className="space-y-2">
            {filteredEquipos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron equipos</p>
              </div>
            ) : filteredEquipos.map(eq => (
              <EquipoRow
                key={eq.id}
                eq={eq}
                onValidar={() => setModal({ tipo: "equipo", item: eq })}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAV.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Tv className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron equipos AV</p>
              </div>
            ) : filteredAV.map(item => (
              <AVRow
                key={item.id}
                av={item}
                onValidar={() => setModal({ tipo: "av", item })}
              />
            ))}
          </div>
        )}

      {/* ── Modal de validación ── */}
      {modal && (
        <ValidarModal
          tipo={modal.tipo}
          id={modal.item.id}
          nombre={
            modal.tipo === "equipo"
              ? (modal.item as EquipoComputo).hostname || (modal.item as EquipoComputo).serial || "Equipo"
              : (modal.item as EquipoAV).elemento
          }
          current={modal.item.validacion}
          onClose={() => setModal(null)}
          onSaved={modal.tipo === "equipo" ? onEquipoSaved : onAVSaved}
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/area")}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-cyan-600 shrink-0" />
              <h1 className="text-base font-bold text-gray-900 truncate">Inventario TI del Área</h1>
            </div>
            {depNombre && (
              <p className="text-xs text-gray-500 mt-0.5">{depNombre} — {usuario?.nombre} {usuario?.apellido}</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-5">
        {content}
      </div>
    </div>
  );
}
