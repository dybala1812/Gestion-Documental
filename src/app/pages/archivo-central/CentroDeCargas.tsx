/**
 * @file CentroDeCargas.tsx
 * @description Sección "Ingreso › Centro de cargas" del módulo Archivo Central (SGD).
 * Mismo lenguaje visual que Comunicaciones › Bandeja: cabecera con eyebrow dorado,
 * tarjetas blancas redondeadas con sombra suave, tabla en panel blanco y píldoras de estado.
 * Se renderiza dentro de ArchivoCentralArea (que ya pone migas de pan, fondo y padding).
 */
import { useState } from "react";
import { alertaCarga } from "../../lib/alertasCarga";
import { NuevaCargaDocumento } from "./NuevaCargaDocumento";
import { NuevaCargaHistorias } from "./NuevaCargaHistorias";
import { NuevaCargaRegistro } from "./NuevaCargaRegistro";
import { LoteDetalle, type LoteData } from "./LoteDetalle";
import type { TipoEntrega } from "./Transferencias";
import {
  FileInput, Archive, Upload, GraduationCap, FileSpreadsheet, Smartphone,
} from "lucide-react";

type CargaId = "A" | "B" | "C" | "D" | "E" | "F";

interface Carga {
  id: CargaId;
  titulo: string;
  descripcion: string;
  quien: string;
  icono: React.ElementType;
}

/** Ocultas por ahora (pedido del usuario): A · Documento individual y E · Registro histórico (30/10/2026), F · App móvil (19/11/2026). */
const OCULTAS: string[] = ["A", "E", "F"];

const CARGAS: Carga[] = [
  { id: "A", titulo: "Documento individual", descripcion: "Un PDF o imagen con sus datos. Si faltan datos, queda por clasificar.", quien: "Archivo Central", icono: FileInput },
  { id: "B", titulo: "Transferencia física", descripcion: "Solo el acta o FUID de la dependencia. Las cajas no se escanean.", quien: "Archivo Central o la dependencia", icono: Archive },
  { id: "C", titulo: "Transferencia digital", descripcion: "El acta o FUID más todos los archivos, ya clasificados por asunto.", quien: "Dependencia o Archivo Central", icono: Upload },
  { id: "D", titulo: "Historias académicas masivas", descripcion: "Carpetas con historias escaneadas. Se procesa por lotes, con pausa.", quien: "Archivo Central; Registro Académico para las activas", icono: GraduationCap },
  { id: "E", titulo: "Registro histórico", descripcion: "Los Excel de comunicaciones por año. Repetible sin duplicar.", quien: "Archivo Central", icono: FileSpreadsheet },
  { id: "F", titulo: "App móvil", descripcion: "Escaneo con el celular y formulario. Es la carga A desde el teléfono.", quien: "Archivo Central", icono: Smartphone },
];

const PASOS = [
  { titulo: "Recepción", detalle: "Directo al almacenamiento" },
  { titulo: "Validación", detalle: "Formato, tamaño y daño" },
  { titulo: "Huella y duplicados", detalle: "SHA-256" },
  { titulo: "Registro", detalle: "Documento o inventario" },
  { titulo: "Auditoría", detalle: "Quién, qué y cuándo" },
  { titulo: "Resultado", detalle: "Informe descargable" },
];

function CargaCard({ carga, onSeleccionar }: { carga: Carga; onSeleccionar?: (id: CargaId) => void }) {
  const Icono = carga.icono;
  return (
    <button
      type="button"
      onClick={() => onSeleccionar?.(carga.id)}
      title={`${carga.descripcion} · ${carga.quien}`}
      className="group flex min-w-0 flex-auto items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 min-[1440px]:pr-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1e3a5f]/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8740e]"
    >
      <span className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-white">
        <Icono className="h-3 w-3" aria-hidden />
      </span>
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#c89b14]">{carga.id}</span>
      <span className="min-w-0 truncate whitespace-nowrap text-[11px] min-[1440px]:text-xs font-semibold text-[#1e3a5f]">{carga.titulo}</span>
      <span className="sr-only">. {carga.descripcion} {carga.quien}</span>
    </button>
  );
}

function ProcesoComun() {
  return (
    <ol className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-[rgba(30,58,95,0.09)] bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
      {PASOS.map((p, i) => (
        <li key={p.titulo} className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ede6d8] text-xs font-bold text-[#1e3a5f]">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#2c3e50]">{p.titulo}</p>
            <p className="text-xs text-[#6b7a8d]">{p.detalle}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface CentroDeCargasProps {
  /** Pide a ArchivoCentralArea abrir Transferencias con el tipo de entrega indicado. */
  onIrATransferencias?: (tipo: TipoEntrega) => void;
}

export function CentroDeCargas({ onIrATransferencias }: CentroDeCargasProps) {
  const [cargaActiva, setCargaActiva] = useState<CargaId | null>(null);
  const [lote, setLote] = useState<LoteData | null>(null); // lote recién creado (muestra su detalle)
  const abrirCarga = (id: CargaId) => {
    if (id === "A" || id === "D" || id === "E") setCargaActiva(id);
    else if (id === "B") onIrATransferencias?.("fisica");
    else if (id === "C") onIrATransferencias?.("digital");
    else alertaCarga.info(`La carga ${id} estará disponible pronto`, "Por ahora puedes usar las cargas A, B, C, D y E.");
  };

  if (lote) return <LoteDetalle lote={lote} onVolver={() => setLote(null)} />;
  if (cargaActiva === "A") return <NuevaCargaDocumento onVolver={() => setCargaActiva(null)} />;
  if (cargaActiva === "E")
    return (
      <NuevaCargaRegistro
        onVolver={() => setCargaActiva(null)}
        onIniciar={l => { setCargaActiva(null); setLote(l); }}
      />
    );
  if (cargaActiva === "D")
    return (
      <NuevaCargaHistorias
        onVolver={() => setCargaActiva(null)}
        onIniciar={l => { setCargaActiva(null); setLote(l); }}
      />
    );

  return (
    <div className="space-y-6">
      {/* ── Cabecera del módulo ─────────────────────────────────────────── */}
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <Upload className="h-6 w-6 text-[#e8740e]" />
          Centro de cargas
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">
          Todo lo que entra pasa por el mismo proceso. Solo cambian el origen y lo que se valida.
        </p>
      </div>

      {/* ── Tipos de carga ──────────────────────────────────────────────── */}
      <section aria-label="Tipos de carga" className="flex flex-wrap gap-1 lg:flex-nowrap">
        {CARGAS.filter(c => !OCULTAS.includes(c.id)).map(c => <CargaCard key={c.id} carga={c} onSeleccionar={abrirCarga} />)}
      </section>

      {/* ── Proceso común ───────────────────────────────────────────────── */}
      <section aria-labelledby="proceso-comun">
        <h3 id="proceso-comun" className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
          Proceso común a todas las cargas
        </h3>
        <ProcesoComun />
      </section>
    </div>
  );
}