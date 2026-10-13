/**
 * @file Clasificados.tsx
 * @description Archivo Central › Bandejas › Clasificados (Ingreso · Bandeja 2).
 * Documentos ya clasificados: consecutivo, tipo, datos, ruta · TRD y ubicación física.
 * Los datos son de EJEMPLO: se reemplazan por la API. "Abrir PDF" aún no abre el archivo (ver TODO).
 */
import { useState } from "react";
import { toast } from "sonner";
import { FileText, FolderCheck, Search, Upload } from "lucide-react";

type Tipo = "Entrada" | "Salida" | "Interno";

interface Clasificado {
  consecutivo: string;
  fecha: string;
  tipo: Tipo;
  titulo: string;
  origen: string;
  dependencia: string;
  anio: number;
  asunto: string;
  trd: string;
  caja: number;
  carpeta: number;
}

const fila = (
  consecutivo: string, fecha: string, tipo: Tipo, titulo: string, origen: string,
  dependencia: string, asunto: string, trd: string, caja: number, carpeta: number,
): Clasificado => ({ consecutivo, fecha, tipo, titulo, origen, dependencia, anio: 2024, asunto, trd, caja, carpeta });

const CLASIFICADOS: Clasificado[] = [
  fila("20/2024", "8 ene 2024", "Entrada", "Resolución de calendario académico 2024-2", "sdsd", "Secretaría General", "Resoluciones", "110.01", 3, 3),
  fila("194/2024", "20 dic 2024", "Salida", "Informe a Consejo Superior", "Cámara de Comercio del Cauca", "Rectoría", "Informes de gestión", "100.03", 36, 4),
  fila("230/2024", "10 dic 2024", "Interno", "Invitación a evento institucional", "Gestión Documental", "Gestión Documental", "Comunicaciones", "140.02", 36, 2),
  fila("412/2024", "8 dic 2024", "Entrada", "Resolución de calendario académico", "Colciencias", "Secretaría General", "Resoluciones", "110.01", 21, 2),
  fila("411/2024", "6 dic 2024", "Entrada", "Remisión de documentos", "Alcaldía de Popayán", "Mercadeo", "Comunicaciones", "120.02", 9, 1),
  fila("410/2024", "3 dic 2024", "Entrada", "Solicitud de información", "Contraloría Departamental", "Rectoría", "Comunicaciones", "100.02", 15, 6),
  fila("229/2024", "1 dic 2024", "Interno", "Contrato de prestación de servicios", "Mercadeo", "Mercadeo", "Contratos", "120.03", 4, 6),
  fila("409/2024", "25 nov 2024", "Entrada", "Soporte de nómina mensual", "Ministerio de Educación Nacional", "Talento Humano", "Nómina", "160.01", 19, 4),
  fila("407/2024", "7 nov 2024", "Entrada", "Solicitud de certificación", "Ministerio de Educación Nacional", "Registro Académico", "Comunicaciones", "150.02", 3, 3),
];

const DEPENDENCIAS = [
  "Rectoría", "Secretaría General", "Mercadeo", "Dirección Administrativa",
  "Gestión Documental", "Registro Académico", "Talento Humano", "Financiera",
];

const PILDORA_TIPO: Record<Tipo, string> = {
  Entrada: "bg-blue-50 text-blue-700 border-blue-200",
  Salida: "bg-violet-50 text-violet-700 border-violet-200",
  Interno: "bg-slate-100 text-slate-600 border-slate-200",
};

const control =
  "h-10 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

export function Clasificados({ onCargarLote }: { onCargarLote?: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [dependencia, setDependencia] = useState("");

  const q = busqueda.trim().toLowerCase();
  const visibles = CLASIFICADOS.filter(c => {
    if (dependencia && c.dependencia !== dependencia) return false;
    if (!q) return true;
    return [c.consecutivo, c.titulo, c.origen, c.dependencia, c.asunto, c.trd, c.tipo]
      .some(v => v.toLowerCase().includes(q));
  });

  const abrirPdf = (c: Clasificado) => {
    // TODO: abrir el PDF real (URL firmada del almacenamiento) en una pestaña nueva.
    toast.info(`El PDF de ${c.consecutivo} se abrirá cuando esté conectado al almacenamiento`);
  };

  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso · Bandeja 2</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <FolderCheck className="h-6 w-6 text-[#e8740e]" />
            Documentos clasificados
          </h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">
            Con su consecutivo, tipo, datos y la ruta donde quedaron. El PDF se abre desde aquí.
          </p>
        </div>
        {onCargarLote && (
          <button
            onClick={onCargarLote}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
          >
            <Upload className="h-4 w-4" /> Cargar lote
          </button>
        )}
      </div>

      {/* ── Búsqueda y filtro ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en clasificados"
            aria-label="Buscar en clasificados"
            className={`${control} w-full pl-9 pr-3 placeholder:text-[#6b7a8d]/80`}
          />
        </div>
        <select
          className={`${control} px-3`}
          value={dependencia}
          onChange={e => setDependencia(e.target.value)}
          aria-label="Filtrar por dependencia"
        >
          <option value="">Todas las dependencias</option>
          {DEPENDENCIAS.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      <p className="-mt-3 text-xs text-[#6b7a8d]">{visibles.length} documento(s)</p>

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
          Ningún documento coincide con la búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <table className="w-full min-w-[1040px] border-collapse">
            <thead>
              <tr className="bg-[#f3ede1]/60">
                {["Consecutivo", "Tipo", "Datos", "Ruta · TRD", "Caja · carpeta", "Estado", ""].map((h, i) => (
                  <th key={h || i} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(c => (
                <tr key={c.consecutivo} className="border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-mono text-xs font-bold text-[#2c3e50]">{c.consecutivo}</p>
                    <p className="text-[11px] text-[#6b7a8d]">{c.fecha}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA_TIPO[c.tipo]}`}>{c.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#2c3e50]">{c.titulo}</p>
                    <p className="text-xs text-[#6b7a8d]">{c.origen}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="text-sm font-medium text-[#1e3a5f]">{c.dependencia} / {c.anio} / {c.asunto}</p>
                    <p className="text-[11px] text-[#6b7a8d]">TRD {c.trd}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">Caja {c.caja} · Carpeta {c.carpeta}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Clasificado
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() => abrirPdf(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                    >
                      <FileText className="h-3.5 w-3.5" /> Abrir PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}