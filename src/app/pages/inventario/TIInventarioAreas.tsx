/**
 * @file TIInventarioAreas.tsx
 * @description Mapa visual de inventario de todas las áreas — solo TI_STAFF / Admin.
 *
 * Las tarjetas de área abren un modal responsive con el panel completo de
 * InventarioArea para que TI pueda inspeccionar o colaborar.
 */
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  Building2, Package, Monitor, AlertCircle, CheckCircle2,
  Clock, Loader2, Search, X, LayoutGrid, ArrowLeft,
  RefreshCw, AlertTriangle, Shield, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { API_BASE, tokens } from "../../lib/api";
import { InventarioArea } from "./InventarioArea";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AreaInventoryStats {
  dependency: { id: string; name: string; code: string };
  licenses:   { total: number; vigentes: number; por_vencer: number; vencidas: number };
  assets:     { total: number; bueno: number; regular: number; malo: number; en_reparacion: number };
  problems:   { total: number; abiertos: number; en_revision: number; resueltos: number };
  ti_equipos: { total: number; validados: number; pendientes: number; discrepancias: number };
}

type Health = "red" | "yellow" | "green" | "empty";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHealth(s: AreaInventoryStats): Health {
  const hasData =
    s.licenses.total > 0 || s.assets.total > 0 ||
    s.problems.total > 0 || s.ti_equipos.total > 0;
  if (!hasData) return "empty";
  if (
    s.licenses.vencidas > 0 ||
    s.ti_equipos.discrepancias > 0 ||
    s.problems.abiertos > 0 ||
    s.assets.malo > 0
  ) return "red";
  if (
    s.licenses.por_vencer > 0 ||
    s.problems.en_revision > 0 ||
    s.ti_equipos.pendientes > 0 ||
    s.assets.en_reparacion > 0
  ) return "yellow";
  return "green";
}

const HEALTH_CONFIG: Record<Health, { label: string; border: string; bg: string; dot: string; badge: string; headerBg: string }> = {
  red:    { label: "Crítico",   border: "border-red-300",    bg: "bg-red-50",    dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-300",      headerBg: "bg-red-50"    },
  yellow: { label: "Atención",  border: "border-amber-300",  bg: "bg-amber-50",  dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-300", headerBg: "bg-amber-50"  },
  green:  { label: "OK",        border: "border-green-300",  bg: "bg-green-50",  dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border-green-300",  headerBg: "bg-green-50"  },
  empty:  { label: "Sin datos", border: "border-gray-200",   bg: "bg-gray-50",   dot: "bg-gray-300",   badge: "bg-gray-100 text-gray-500 border-gray-200",     headerBg: "bg-gray-50"   },
};

async function fetchAreasMap(): Promise<AreaInventoryStats[]> {
  const token = tokens.getAccess();
  const res = await fetch(`${API_BASE}/api/pqrs/inventory/areas-map/`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function AreaModal({
  stat,
  onClose,
}: {
  stat: AreaInventoryStats;
  onClose: () => void;
}) {
  const health = getHealth(stat);
  const cfg    = HEALTH_CONFIG[health];

  // Bloquear scroll del body y cerrar con ESC
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel: bottom-sheet en móvil con márgenes, centrado en desktop */}
      <div className="relative z-10 w-full mx-3 sm:mx-6 max-w-5xl flex flex-col
                      bg-white rounded-2xl shadow-2xl
                      max-h-[92dvh] sm:max-h-[88vh] overflow-hidden">

        {/* Drag handle (solo móvil) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-gray-300/70" />

        {/* Cabecera del modal */}
        <div className={`shrink-0 flex items-center justify-between gap-3 px-4 pt-5 sm:pt-3 pb-3 border-b ${cfg.headerBg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 h-3 w-3 rounded-full ${cfg.dot}`} />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base truncate leading-tight">
                {stat.dependency.name}
              </p>
              <p className="text-xs text-gray-500 font-mono">{stat.dependency.code}</p>
            </div>
            <Badge variant="outline" className={`shrink-0 text-xs ${cfg.badge}`}>
              {cfg.label}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mini-stats rápidas bajo el título */}
        <div className={`shrink-0 grid grid-cols-4 gap-px border-b ${cfg.bg}`}>
          {[
            { icon: <Package size={12} />,     label: "Licencias",  value: stat.licenses.total,    alert: stat.licenses.vencidas > 0 ? "red" : stat.licenses.por_vencer > 0 ? "yellow" : null,          detail: stat.licenses.vencidas > 0 ? `${stat.licenses.vencidas} venc.` : stat.licenses.por_vencer > 0 ? `${stat.licenses.por_vencer} p/v` : null },
            { icon: <Building2 size={12} />,   label: "Activos",    value: stat.assets.total,      alert: stat.assets.malo > 0 ? "red" : stat.assets.en_reparacion > 0 ? "yellow" : null,               detail: stat.assets.malo > 0 ? `${stat.assets.malo} malo(s)` : stat.assets.en_reparacion > 0 ? `${stat.assets.en_reparacion} rep.` : null },
            { icon: <AlertCircle size={12} />, label: "Problemas",  value: stat.problems.total,    alert: stat.problems.abiertos > 0 ? "red" : stat.problems.en_revision > 0 ? "yellow" : null,         detail: stat.problems.abiertos > 0 ? `${stat.problems.abiertos} abierto(s)` : stat.problems.en_revision > 0 ? `${stat.problems.en_revision} rev.` : null },
            { icon: <Monitor size={12} />,     label: "Equipos TI", value: stat.ti_equipos.total,  alert: stat.ti_equipos.discrepancias > 0 ? "red" : stat.ti_equipos.pendientes > 0 ? "yellow" : null, detail: stat.ti_equipos.discrepancias > 0 ? `${stat.ti_equipos.discrepancias} disc.` : stat.ti_equipos.pendientes > 0 ? `${stat.ti_equipos.pendientes} pend.` : null },
          ].map(({ icon, label, value, alert, detail }) => {
            const ac = alert === "red" ? "text-red-600" : alert === "yellow" ? "text-amber-500" : "text-gray-400";
            return (
              <div key={label} className="flex flex-col items-center justify-center py-2 px-1 bg-white/70 text-center">
                <div className="flex items-center gap-0.5 text-gray-400 mb-0.5">{icon}<span className="text-[9px] uppercase tracking-wide hidden sm:inline ml-0.5">{label}</span></div>
                <span className="text-sm font-bold text-gray-800 leading-none">{value}</span>
                {detail && <span className={`text-[9px] font-medium mt-0.5 ${ac} leading-tight`}>{detail}</span>}
              </div>
            );
          })}
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
          <InventarioArea
            areaId={stat.dependency.id}
            areaNombre={stat.dependency.name}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Tarjeta de área ──────────────────────────────────────────────────────────

function AreaCard({
  stat,
  onOpen,
}: {
  stat: AreaInventoryStats;
  onOpen: () => void;
}) {
  const health = getHealth(stat);
  const cfg    = HEALTH_CONFIG[health];

  return (
    <button
      onClick={onOpen}
      className={`group w-full text-left rounded-xl border-2 ${cfg.border} overflow-hidden
                  transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`}
    >
      {/* Cabecera */}
      <div className={`${cfg.bg} px-3 pt-3 pb-2.5`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                {stat.dependency.name}
              </p>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{stat.dependency.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
              {cfg.label}
            </Badge>
            <ExternalLink size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* Mini-stats 2×2 en móvil, 4 columnas en sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-t border-gray-100">
        {[
          { icon: <Package size={11} />,     label: "Lic",  value: stat.licenses.total,   alert: stat.licenses.vencidas > 0 ? "red" : stat.licenses.por_vencer > 0 ? "yellow" : null },
          { icon: <Building2 size={11} />,   label: "Act",  value: stat.assets.total,     alert: stat.assets.malo > 0 ? "red" : stat.assets.en_reparacion > 0 ? "yellow" : null },
          { icon: <AlertCircle size={11} />, label: "Prob", value: stat.problems.total,   alert: stat.problems.abiertos > 0 ? "red" : stat.problems.en_revision > 0 ? "yellow" : null },
          { icon: <Monitor size={11} />,     label: "TI",   value: stat.ti_equipos.total, alert: stat.ti_equipos.discrepancias > 0 ? "red" : stat.ti_equipos.pendientes > 0 ? "yellow" : null },
        ].map(({ icon, label, value, alert }) => {
          const vc = alert === "red" ? "text-red-600 bg-red-50" : alert === "yellow" ? "text-amber-600 bg-amber-50" : "text-gray-600 bg-white";
          return (
            <div key={label} className={`flex flex-col items-center justify-center py-2.5 ${vc}`}>
              <div className="flex items-center gap-0.5 opacity-60 mb-0.5">
                {icon}
                <span className="text-[9px] uppercase tracking-wide font-medium">{label}</span>
              </div>
              <span className="text-base font-bold leading-none">{value}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function TIInventarioAreas() {
  const [data, setData]           = useState<AreaInventoryStats[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [modalStat, setModalStat] = useState<AreaInventoryStats | null>(null);
  const [filterHealth, setFilterHealth] = useState<Health | "all">("all");

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAreasMap()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Estadísticas globales ──
  const globalStats = useMemo(() => ({
    criticas:   data.filter(s => getHealth(s) === "red").length,
    atencion:   data.filter(s => getHealth(s) === "yellow").length,
    ok:         data.filter(s => getHealth(s) === "green").length,
    totalProbs: data.reduce((acc, s) => acc + s.problems.abiertos, 0),
    totalVenc:  data.reduce((acc, s) => acc + s.licenses.vencidas, 0),
    totalDisc:  data.reduce((acc, s) => acc + s.ti_equipos.discrepancias, 0),
  }), [data]);

  // ── Filtrado ──
  const filtered = useMemo(() => {
    let list = data;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.dependency.name.toLowerCase().includes(q) ||
        s.dependency.code.toLowerCase().includes(q),
      );
    }
    if (filterHealth !== "all") {
      list = list.filter(s => getHealth(s) === filterHealth);
    }
    return list;
  }, [data, search, filterHealth]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">

      {/* ── Cabecera ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Mapa de Inventario</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Vista consolidada de todas las áreas</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs sm:text-sm">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
            <Link to="/inventario/ti">
              <ArrowLeft size={13} className="mr-1" />
              <span className="hidden sm:inline">Panel TI</span>
              <span className="sm:hidden">TI</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Tarjetas globales ── */}
      {!loading && !error && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
          <GlobalStat label="Áreas"          value={data.length}             icon={<Building2 size={15} />}     color="text-blue-600"   bg="bg-blue-50" />
          <GlobalStat label="Críticas"        value={globalStats.criticas}    icon={<AlertCircle size={15} />}   color="text-red-600"    bg="bg-red-50"    onClick={() => setFilterHealth(p => p === "red"    ? "all" : "red")}    active={filterHealth === "red"} />
          <GlobalStat label="Atención"        value={globalStats.atencion}    icon={<Clock size={15} />}         color="text-amber-600"  bg="bg-amber-50"  onClick={() => setFilterHealth(p => p === "yellow" ? "all" : "yellow")} active={filterHealth === "yellow"} />
          <GlobalStat label="OK"              value={globalStats.ok}          icon={<CheckCircle2 size={15} />}  color="text-green-600"  bg="bg-green-50"  onClick={() => setFilterHealth(p => p === "green"  ? "all" : "green")}  active={filterHealth === "green"} />
          <GlobalStat label="Prob. abiertos"  value={globalStats.totalProbs}  icon={<AlertTriangle size={15} />} color="text-orange-600" bg="bg-orange-50" />
          <GlobalStat label="Lic. vencidas"   value={globalStats.totalVenc}   icon={<Package size={15} />}       color="text-red-600"    bg="bg-red-50" />
          <GlobalStat label="Disc. TI"        value={globalStats.totalDisc}   icon={<Shield size={15} />}        color="text-purple-600" bg="bg-purple-50" />
        </div>
      )}

      {/* ── Búsqueda + leyenda ── */}
      {!loading && !error && (
        <div className="flex flex-col gap-3 mb-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar área por nombre o código…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Leyenda / filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {(["red", "yellow", "green", "empty"] as Health[]).map(h => (
              <button
                key={h}
                onClick={() => setFilterHealth(p => p === h ? "all" : h)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                  filterHealth === h
                    ? HEALTH_CONFIG[h].badge + " font-semibold"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${HEALTH_CONFIG[h].dot}`} />
                {HEALTH_CONFIG[h].label}
              </button>
            ))}
            {filterHealth !== "all" && (
              <button onClick={() => setFilterHealth("all")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-1">
                <X size={11} /> limpiar
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} / {data.length}</span>
          </div>
        </div>
      )}

      {/* ── Estados ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Grid de tarjetas ── */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">
              No se encontraron áreas
            </div>
          ) : (
            filtered.map(stat => (
              <AreaCard
                key={stat.dependency.id}
                stat={stat}
                onOpen={() => setModalStat(stat)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {modalStat && (
        <AreaModal
          stat={modalStat}
          onClose={() => setModalStat(null)}
        />
      )}
    </div>
  );
}

// ─── Stat global ──────────────────────────────────────────────────────────────

function GlobalStat({
  label, value, icon, color, bg, onClick, active,
}: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card
      className={`transition-all ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${active ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md ${bg} flex items-center justify-center ${color} mb-1`}>
          {icon}
        </div>
        <p className="text-lg sm:text-xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
}
