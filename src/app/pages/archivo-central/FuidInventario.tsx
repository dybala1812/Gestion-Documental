/**
 * @file FuidInventario.tsx
 * @description Paso 2 de "Nueva transferencia": Inventario FUID (Excel con validación).
 * Lee el Excel en el navegador (librería `xlsx`), muestra una tabla editable por caja y carpeta
 * y valida cada fila. Las filas con error se marcan en rojo y se corrigen ahí mismo.
 * Requiere: npm i xlsx
 */
import { useId } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Plus, Trash2, Wand2, CheckCircle2, AlertCircle } from "lucide-react";

/* ───────────────────────── Tipos y validación ───────────────────────── */
export interface FilaFuid {
  id: string;
  caja: string;
  carpeta: string;
  asunto: string;
  fechaInicial: string; // AAAA-MM-DD
  fechaFinal: string;   // AAAA-MM-DD
  folios: string;
  docs: string;
  descripcion: string;
}

let contador = 0;
const nuevoId = () => `f${Date.now()}-${contador++}`;

export const filaVacia = (): FilaFuid => ({
  id: nuevoId(), caja: "", carpeta: "", asunto: "", fechaInicial: "", fechaFinal: "", folios: "", docs: "", descripcion: "",
});

/** Devuelve, por id de fila, la lista de problemas. Sin entrada (o lista vacía) = fila correcta. */
export function validarFilas(filas: FilaFuid[], anio: number): Record<string, string[]> {
  const claves = new Map<string, number>();
  filas.forEach(f => {
    const k = `${f.caja.trim()}|${f.carpeta.trim()}`;
    claves.set(k, (claves.get(k) ?? 0) + 1);
  });

  const out: Record<string, string[]> = {};
  for (const f of filas) {
    const e: string[] = [];
    if (!f.caja.trim()) e.push("Falta la caja");
    if (!f.carpeta.trim()) e.push("Falta la carpeta");
    if (f.caja.trim() && f.carpeta.trim() && (claves.get(`${f.caja.trim()}|${f.carpeta.trim()}`) ?? 0) > 1)
      e.push("Caja y carpeta repetidas");
    if (!f.asunto.trim()) e.push("Falta asunto · serie");
    if (!f.fechaInicial || !f.fechaFinal) e.push("Faltan fechas");
    else {
      if (f.fechaInicial > f.fechaFinal) e.push("La fecha inicial es posterior a la final");
      if (Number(f.fechaInicial.slice(0, 4)) !== anio || Number(f.fechaFinal.slice(0, 4)) !== anio)
        e.push(`Fechas fuera de ${anio}`);
    }
    if (!(Number(f.folios) > 0) || !Number.isInteger(Number(f.folios))) e.push("Folios inválidos");
    if (f.docs === "" || !(Number(f.docs) >= 0) || !Number.isInteger(Number(f.docs))) e.push("Docs. inválidos");
    if (!f.descripcion.trim()) e.push("Falta la descripción");
    out[f.id] = e;
  }
  return out;
}

export function resumenFuid(filas: FilaFuid[], anio: number) {
  const problemas = validarFilas(filas, anio);
  const conError = filas.filter(f => (problemas[f.id]?.length ?? 0) > 0).length;
  return {
    problemas,
    correctas: filas.length - conError,
    errores: conError,
    cajas: new Set(filas.map(f => f.caja.trim()).filter(Boolean)).size,
    folios: filas.reduce((s, f) => s + (Number(f.folios) || 0), 0),
  };
}

/* ───────────────────────── Excel ───────────────────────── */
const COLUMNAS = ["Caja", "Carpeta", "Asunto · serie", "Fecha inicial", "Fecha final", "Folios", "Docs.", "Descripción"];

const normaliza = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Convierte lo que venga de la celda (Date, número serial de Excel o texto) a AAAA-MM-DD. */
function aFecha(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // +12 h evita que el desfase de zona horaria cambie el día.
    return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const c = XLSX.SSF.parse_date_code(v);
    if (c) return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

type Campo = Exclude<keyof FilaFuid, "id">;

/** Reconoce el título de una columna por palabras clave (sin tildes ni símbolos). */
function campoDe(titulo: unknown): Campo | null {
  const t = normaliza(String(titulo ?? ""));
  if (!t) return null;
  if (/inicial|inicio|desde/.test(t)) return "fechaInicial";
  if (/final|fechafin|hasta/.test(t)) return "fechaFinal";
  if (t.includes("caja")) return "caja";
  if (t.includes("carpeta")) return "carpeta";
  if (t.includes("folio")) return "folios";
  if (t.includes("descrip") || t.includes("contenido")) return "descripcion";
  if (t.includes("asunto") || t.includes("serie")) return "asunto";
  if (t.startsWith("doc")) return "docs";
  return null;
}

async function leerExcel(archivo: File): Promise<FilaFuid[]> {
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array", cellDates: true });
  let titulosVistos = "";

  for (const nombre of libro.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], { header: 1, defval: "", raw: true });

    // La fila de títulos es la primera (entre las 20 primeras) con al menos 3 columnas reconocidas.
    let filaTitulos = -1;
    let columnas: (Campo | null)[] = [];
    for (let i = 0; i < Math.min(matriz.length, 20); i++) {
      const cols = (matriz[i] as unknown[]).map(campoDe);
      if (new Set(cols.filter(Boolean)).size >= 3) { filaTitulos = i; columnas = cols; break; }
      if (!titulosVistos) titulosVistos = (matriz[i] as unknown[]).filter(Boolean).join(", ");
    }
    if (filaTitulos < 0) continue;

    const filas: FilaFuid[] = [];
    for (const fila of matriz.slice(filaTitulos + 1) as unknown[][]) {
      const f = filaVacia();
      columnas.forEach((campo, idx) => {
        if (!campo || f[campo] !== "") return; // si hay dos columnas parecidas, gana la primera
        const v = fila[idx];
        f[campo] = campo === "fechaInicial" || campo === "fechaFinal" ? aFecha(v) : String(v ?? "").trim();
      });
      if ((Object.keys(f) as (keyof FilaFuid)[]).some(k => k !== "id" && f[k] !== "")) filas.push(f);
    }
    if (filas.length > 0) return filas;
  }

  throw new Error(
    titulosVistos
      ? `No reconocí las columnas del Excel (encontré: ${titulosVistos.slice(0, 80)}). Usa la plantilla FUID.`
      : "El Excel no tiene filas con datos."
  );
}

function descargarPlantilla() {
  const hoja = XLSX.utils.aoa_to_sheet([
    COLUMNAS,
    ["1", "1", "Actas · Consejo", "2024-01-15", "2024-03-20", 120, 14, "Actas ordinarias del primer trimestre"],
  ]);
  hoja["!cols"] = COLUMNAS.map(() => ({ wch: 18 }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "FUID");
  XLSX.writeFile(libro, "plantilla-FUID.xlsx");
}

/** Filas de ejemplo: 6 carpetas en 2 cajas, todas correctas para el año indicado. */
function ejemplo(anio: number): FilaFuid[] {
  const d = (m: number, dia: number) => `${anio}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const datos: Omit<FilaFuid, "id">[] = [
    { caja: "1", carpeta: "1", asunto: "Actas · Comité administrativo", fechaInicial: d(1, 10), fechaFinal: d(3, 28), folios: "96", docs: "12", descripcion: "Actas del primer trimestre" },
    { caja: "1", carpeta: "2", asunto: "Actas · Comité administrativo", fechaInicial: d(4, 4), fechaFinal: d(6, 27), folios: "88", docs: "11", descripcion: "Actas del segundo trimestre" },
    { caja: "1", carpeta: "3", asunto: "Comunicaciones · Enviadas", fechaInicial: d(1, 8), fechaFinal: d(6, 30), folios: "140", docs: "58", descripcion: "Oficios enviados, primer semestre" },
    { caja: "2", carpeta: "1", asunto: "Comunicaciones · Recibidas", fechaInicial: d(1, 9), fechaFinal: d(6, 28), folios: "152", docs: "63", descripcion: "Oficios recibidos, primer semestre" },
    { caja: "2", carpeta: "2", asunto: "Circulares", fechaInicial: d(2, 1), fechaFinal: d(11, 15), folios: "45", docs: "20", descripcion: "Circulares internas del año" },
    { caja: "2", carpeta: "3", asunto: "Resoluciones", fechaInicial: d(2, 12), fechaFinal: d(12, 5), folios: "72", docs: "18", descripcion: "Resoluciones administrativas" },
  ];
  return datos.map(x => ({ ...x, id: nuevoId() }));
}

/* ───────────────────────── Componente ───────────────────────── */
interface Props {
  filas: FilaFuid[];
  nombreArchivo: string;
  anio: number;
  onFilas: (f: FilaFuid[]) => void;
  onNombreArchivo: (n: string) => void;
}

const celda =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const btnSec =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]";

export function FuidInventario({ filas, nombreArchivo, anio, onFilas, onNombreArchivo }: Props) {
  const inputId = useId();
  const { problemas, correctas, errores, cajas } = resumenFuid(filas, anio);
  const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap";

  const cargar = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!/\.xlsx?$/i.test(archivo.name)) return toast.error("El inventario debe ser un archivo Excel (.xlsx o .xls)");
    try {
      const leidas = await leerExcel(archivo);
      onFilas(leidas);
      onNombreArchivo(archivo.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el Excel. Revisa que no esté dañado.");
    }
  };

  const editar = (id: string, k: keyof FilaFuid, v: string) =>
    onFilas(filas.map(f => (f.id === id ? { ...f, [k]: v } : f)));

  return (
    <section className="space-y-5">
      {/* Archivo + contadores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-[rgba(30,58,95,0.3)] bg-white px-5 py-5 transition-colors hover:bg-[#f3ede1]/60"
        >
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-[#1e3a5f]" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-[#1e3a5f]">
              {nombreArchivo || "Arrastra o elige el inventario FUID (Excel)"}
            </span>
            <span className="block text-xs text-[#6b7a8d]">
              {nombreArchivo ? "Revisa las filas marcadas en rojo. Puedes corregirlas aquí mismo." : ".xlsx o .xls · usa la plantilla para no equivocarte de columnas"}
            </span>
          </span>
          <input
            id={inputId} type="file" accept=".xlsx,.xls" className="sr-only"
            onChange={e => { cargar(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>

        <div className="grid grid-cols-2 divide-x divide-[rgba(30,58,95,0.15)] rounded-xl border-2 border-[#1e3a5f] bg-white">
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Filas correctas</p>
            <p className="text-3xl font-bold text-emerald-700">{correctas}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Filas con error</p>
            <p className={`text-3xl font-bold ${errores > 0 ? "text-red-600" : "text-red-600/70"}`}>{errores}</p>
          </div>
        </div>
      </div>

      <button type="button" onClick={descargarPlantilla} className={btnSec}>
        <Download className="h-4 w-4" /> Descargar plantilla FUID
      </button>

      {/* Resumen + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#2c3e50]">
          {filas.length} carpeta{filas.length === 1 ? "" : "s"} en {cajas} caja(s) ·{" "}
          {errores === 0 ? "sin observaciones" : `${errores} con observaciones`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={btnSec}
            onClick={() => { onFilas(ejemplo(anio)); onNombreArchivo("FUID-ejemplo.xlsx"); }}
          >
            <Wand2 className="h-4 w-4" /> Usar FUID de ejemplo
          </button>
          <button
            type="button"
            className={btnSec}
            onClick={() => { onFilas([...filas, filaVacia()]); if (!nombreArchivo) onNombreArchivo("FUID-manual"); }}
          >
            <Plus className="h-4 w-4" /> Agregar carpeta
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
              {["Caja", "Carpeta", "Asunto · serie", "Fecha inicial", "Fecha final", "Folios", "Docs.", "Descripción", "Validación"].map(h => (
                <th key={h} className={th}>{h}</th>
              ))}
              <th className={th} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-[#6b7a8d]">
                  Aún no hay carpetas. Sube el Excel, usa el FUID de ejemplo o agrega una carpeta.
                </td>
              </tr>
            )}
            {filas.map(f => {
              const p = problemas[f.id] ?? [];
              const mal = p.length > 0;
              return (
                <tr key={f.id} className={`border-t border-[rgba(30,58,95,0.09)] ${mal ? "bg-red-50/70" : "hover:bg-[#f3ede1]/40"}`}>
                  <td className="w-16 px-2 py-1.5"><input aria-label="Caja" className={celda} value={f.caja} onChange={e => editar(f.id, "caja", e.target.value)} /></td>
                  <td className="w-20 px-2 py-1.5"><input aria-label="Carpeta" className={celda} value={f.carpeta} onChange={e => editar(f.id, "carpeta", e.target.value)} /></td>
                  <td className="min-w-[200px] px-2 py-1.5"><input aria-label="Asunto y serie" className={celda} value={f.asunto} onChange={e => editar(f.id, "asunto", e.target.value)} /></td>
                  <td className="w-40 px-2 py-1.5"><input type="date" aria-label="Fecha inicial" className={celda} value={f.fechaInicial} onChange={e => editar(f.id, "fechaInicial", e.target.value)} /></td>
                  <td className="w-40 px-2 py-1.5"><input type="date" aria-label="Fecha final" className={celda} value={f.fechaFinal} onChange={e => editar(f.id, "fechaFinal", e.target.value)} /></td>
                  <td className="w-20 px-2 py-1.5"><input type="number" min={1} aria-label="Folios" className={celda} value={f.folios} onChange={e => editar(f.id, "folios", e.target.value)} /></td>
                  <td className="w-20 px-2 py-1.5"><input type="number" min={0} aria-label="Documentos" className={celda} value={f.docs} onChange={e => editar(f.id, "docs", e.target.value)} /></td>
                  <td className="min-w-[220px] px-2 py-1.5"><input aria-label="Descripción" className={celda} value={f.descripcion} onChange={e => editar(f.id, "descripcion", e.target.value)} /></td>
                  <td className="min-w-[170px] px-3 py-1.5 text-xs">
                    {mal ? (
                      <span className="flex items-start gap-1.5 font-semibold text-red-700" title={p.join(" · ")}>
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{p[0]}{p.length > 1 && ` (+${p.length - 1})`}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Correcta
                      </span>
                    )}
                  </td>
                  <td className="w-10 px-2 py-1.5">
                    <button
                      type="button"
                      aria-label="Quitar carpeta"
                      onClick={() => onFilas(filas.filter(x => x.id !== f.id))}
                      className="rounded-md p-1.5 text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
