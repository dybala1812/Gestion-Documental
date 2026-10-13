/**
 * @file Inicio.tsx
 * @description Archivo Central › General › Inicio (Panel general).
 * Indicadores, notificaciones y dependencias que faltan por transferir (regla de los dos años).
 * Mismo estilo que Comunicaciones › Bandeja. Los datos son de EJEMPLO: se reemplazan por la API.
 */
import { useState } from "react";
import {
  AlertTriangle, Building2, ChevronRight, Clock3, GraduationCap, Inbox, Truck, Upload,
} from "lucide-react";

/** Secciones a las que puede llevar el panel (son claves de ArchivoCentralArea). */
export type DestinoInicio = "centro-cargas" | "transferencias" | "por-clasificar";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIO_MAX = ANIO_ACTUAL - 2; // regla de los dos años

/* ───────────────────────── Datos de ejemplo ───────────────────────── */
const INDICADORES = [
  { label: "Documentos por clasificar", valor: 8, icon: Inbox, cls: "bg-blue-50 text-blue-600 border-blue-100", iconBg: "bg-blue-100" },
  { label: "Transferencias en proceso", valor: 2, icon: Truck, cls: "bg-amber-50 text-amber-600 border-amber-100", iconBg: "bg-amber-100" },
  { label: "Historias cargadas", valor: 51, icon: GraduationCap, cls: "bg-violet-50 text-violet-600 border-violet-100", iconBg: "bg-violet-100" },
  { label: "Alertas", valor: 4, icon: AlertTriangle, cls: "bg-red-50 text-red-600 border-red-100", iconBg: "bg-red-100" },
];

interface Notificacion {
  id: string;
  tipo: "clasificar" | "transferir";
  texto: string;
  detalle: string;
  destino: DestinoInicio;
}

const NOTIFICACIONES: Notificacion[] = [
  { id: "n1", tipo: "clasificar", texto: "TR-2025-002 · Mercadeo (2023) tiene 5 documentos sin asunto, año ni ubicación", detalle: "Recibida el 18 feb 2025", destino: "por-clasificar" },
  { id: "n2", tipo: "clasificar", texto: "TR-2025-003 · Secretaría General (2023) tiene 3 documentos sin asunto, año ni ubicación", detalle: "Recibida el 25 feb 2025", destino: "por-clasificar" },
  ...["Dirección Administrativa", "Gestión Documental", "Talento Humano", "Financiera"].map((dep, i): Notificacion => ({
    id: `n${i + 3}`, tipo: "transferir", destino: "transferencias",
    texto: `${dep} debe transferir los documentos de ${ANIO_MAX} (regla de los dos años: ${ANIO_ACTUAL} − 2).`,
    detalle: `Plazo: 31 mar ${ANIO_ACTUAL} · vencido`,
  })),
];

const TOTAL_DEPENDENCIAS = 8;
const PENDIENTES = ["Dirección Administrativa", "Gestión Documental", "Talento Humano", "Financiera"];

const EYEBROW: Record<Notificacion["tipo"], { texto: string; icon: React.ElementType; caja: string }> = {
  clasificar: { texto: "Por clasificar", icon: Inbox, caja: "bg-blue-50 text-[#1e3a5f]" },
  transferir: { texto: "Le toca transferir", icon: Clock3, caja: "bg-[#f3ede1] text-[#e8740e]" },
};

const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

/* ───────────────────────── Componente ───────────────────────── */
export function Inicio({ onIrA }: { onIrA: (destino: DestinoInicio) => void }) {
  const [leidas, setLeidas] = useState<Set<string>>(new Set());
  const nuevas = NOTIFICACIONES.filter(n => !leidas.has(n.id)).length;
  const porcentajePendiente = Math.round((PENDIENTES.length / TOTAL_DEPENDENCIAS) * 100);

  const abrir = (n: Notificacion) => {
    setLeidas(prev => new Set(prev).add(n.id));
    onIrA(n.destino);
  };

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Panel general</p>
          <h2 className="text-xl font-bold text-[#1e3a5f]">Inicio</h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">
            Lo que necesita atención: transferencias recibidas, documentos sin clasificar y oficinas que aún no entregan.
          </p>
        </div>
        <button
          onClick={() => onIrA("centro-cargas")}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Upload className="h-4 w-4" /> Cargar lote
        </button>
      </div>

      {/* ── Indicadores ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {INDICADORES.map(({ label, valor, icon: Icon, cls, iconBg }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${cls}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none">{valor}</p>
              <p className="mt-1 text-xs font-bold">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,0.9fr)]">
        {/* ── Notificaciones ────────────────────────────────────────────── */}
        <section aria-labelledby="notificaciones">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id="notificaciones" className="flex items-center gap-2 text-base font-bold text-[#1e3a5f]">
              Notificaciones
              {nuevas > 0 && (
                <span className="rounded-full bg-[#e8740e] px-2 py-0.5 text-[10px] font-bold text-white">{nuevas} nuevas</span>
              )}
            </h3>
            <button
              disabled={nuevas === 0}
              onClick={() => setLeidas(new Set(NOTIFICACIONES.map(n => n.id)))}
              className="rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm transition-colors hover:bg-[#f3ede1] hover:text-[#1e3a5f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar todas como leídas
            </button>
          </div>

          <ul className={`${panel} divide-y divide-[rgba(30,58,95,0.09)] overflow-hidden`}>
            {NOTIFICACIONES.map(n => {
              const e = EYEBROW[n.tipo];
              const Icono = e.icon;
              const sinLeer = !leidas.has(n.id);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => abrir(n)}
                    className={`flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-[#f3ede1]/50 ${
                      sinLeer ? "border-l-[#e8740e]" : "border-l-transparent"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${e.caja}`}>
                      <Icono className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
                        {e.texto}
                        {sinLeer && <span className="h-1.5 w-1.5 rounded-full bg-[#e8740e]" aria-label="Sin leer" />}
                      </span>
                      <span className={`mt-0.5 block text-sm ${sinLeer ? "font-semibold text-[#2c3e50]" : "text-[#2c3e50]"}`}>{n.texto}</span>
                      <span className="mt-0.5 block text-xs text-[#6b7a8d]">{n.detalle}</span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#6b7a8d]" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Faltan por transferir ─────────────────────────────────────── */}
        <section aria-labelledby="faltan">
          <h3 id="faltan" className="text-base font-bold text-[#1e3a5f]">Faltan por transferir este año</h3>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">
            {PENDIENTES.length} de {TOTAL_DEPENDENCIAS} dependencias deben entregar los documentos de {ANIO_MAX} (año actual − 2).
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[#ede6d8]"
            role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentajePendiente}
            aria-label="Dependencias pendientes"
          >
            <div className="h-full rounded-full bg-[#e8740e]" style={{ width: `${porcentajePendiente}%` }} />
          </div>

          <ul className={`${panel} mt-4 divide-y divide-[rgba(30,58,95,0.09)] overflow-hidden`}>
            {PENDIENTES.map(dep => (
              <li key={dep}>
                <button
                  onClick={() => onIrA("transferencias")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f3ede1]/50"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-[#6b7a8d]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#2c3e50]">{dep}</span>
                  <span className="hidden text-xs text-[#6b7a8d] sm:inline">Le corresponde {ANIO_MAX}</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Pendiente
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}