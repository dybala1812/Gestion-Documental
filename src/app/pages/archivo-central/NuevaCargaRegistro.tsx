/**
 * @file NuevaCargaRegistro.tsx
 * @description Carga E · Registro histórico (Centro de cargas › Nueva carga).
 * Asistente de 4 pasos: Año y tipo → Excel por año → Vista previa (mapeo de columnas) → Confirmar.
 * Lee el Excel/CSV en el navegador (librería `xlsx`). El consecutivo se adapta (385 → 385/2019) y se conserva el original.
 * Repetir la carga no duplica filas: la comparación contra lotes anteriores la hace el backend (TODO).
 */
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { alertaCarga, motivoError, plural } from "../../lib/alertasCarga";
import { ArrowLeft, ArrowRight, Check, FileText, History, Info, Loader2, UploadCloud, Wand2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { tamanoLegible, type ArchivoLote, type LoteData } from "./LoteDetalle";

/* ───────────────────────── Constantes ───────────────────────── */
const TIPOS = ["Recibidas", "Enviadas"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);

const PASOS = [
  { titulo: "Destino y datos", detalle: "Año y tipo" },
  { titulo: "Archivos", detalle: "Excel por año" },
  { titulo: "Vista previa", detalle: "Verde, amarillo, rojo" },
  { titulo: "Confirmar", detalle: "Crear el lote" },
];
const SUBTITULO = [
  "",
  "destino y datos.",
  "archivos. Se suben directo al almacenamiento.",
  "vista previa y validación. Verde se carga, amarillo se carga con aviso o se omite, rojo no se carga.",
  "confirma y se crea el lote.",
];

type CampoId = "consecutivo" | "fecha" | "remitente" | "asunto" | "recibio" | "pdf" | "ignorar";
const CAMPOS: { id: CampoId; label: string }[] = [
  { id: "consecutivo", label: "Consecutivo" },
  { id: "fecha", label: "Fecha" },
  { id: "remitente", label: "Remitente / destinatario" },
  { id: "asunto", label: "Asunto" },
  { id: "recibio", label: "Quién recibió" },
  { id: "pdf", label: "Archivo PDF" },
  { id: "ignorar", label: "Ignorar" },
];
const OBLIGATORIOS: CampoId[] = ["consecutivo", "fecha", "remitente"];

/* ───────────────────────── Lectura del Excel ───────────────────────── */
interface FilaCruda { n: number; celdas: unknown[]; huella: string }
interface Lectura { cabeceras: string[]; filas: FilaCruda[] }

const normaliza = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Propone a qué campo corresponde cada columna según su título. */
function autoMapa(cabeceras: string[]): CampoId[] {
  return cabeceras.map(h => {
    const t = normaliza(h);
    if (!t) return "ignorar";
    if (["no", "nro", "num", "numero", "consecutivo", "radicado"].includes(t) || t.startsWith("consecutivo")) return "consecutivo";
    if (t.startsWith("fecha")) return "fecha";
    if (t.includes("remitente") || t.includes("destinatario") || t === "de" || t === "para") return "remitente";
    if (t.includes("asunto")) return "asunto";
    if (t.includes("recibi")) return "recibio";
    if (t.includes("pdf") || t.includes("archivo")) return "pdf";
    return "ignorar";
  });
}

function aFechaISO(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const c = XLSX.SSF.parse_date_code(v);
    if (c) return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // d/m/aaaa
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
const verFecha = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return a ? `${d}/${m}/${a}` : "—"; };

async function sha256Texto(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function leerArchivo(archivo: File): Promise<Lectura> {
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array", cellDates: true });
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "", raw: true });
  const iTit = matriz.slice(0, 20).findIndex(f => (f as unknown[]).filter(c => String(c).trim() !== "").length >= 3);
  if (iTit < 0) throw new Error("No encontré la fila de títulos del Excel (al menos 3 columnas con nombre).");
  const cabeceras = (matriz[iTit] as unknown[]).map(c => String(c ?? "").trim());
  const filas: FilaCruda[] = [];
  for (let i = iTit + 1; i < matriz.length; i++) {
    const celdas = matriz[i] as unknown[];
    if (celdas.every(c => String(c ?? "").trim() === "")) continue;
    filas.push({ n: i + 1, celdas, huella: await sha256Texto(JSON.stringify(celdas)) });
  }
  if (filas.length === 0) throw new Error("El Excel no tiene filas con datos debajo de los títulos.");
  return { cabeceras, filas };
}

/* ───────────────────────── Validación de filas ───────────────────────── */
type Nivel = "verde" | "amarillo" | "rojo";
interface FilaEval {
  n: number; huella: string; nivel: Nivel; mensaje: string;
  original: string; sistema: string; fecha: string; remitente: string;
}

function evaluar(lec: Lectura, mapa: CampoId[], anio: number): FilaEval[] {
  const col = (c: CampoId) => mapa.indexOf(c);
  const val = (f: FilaCruda, c: CampoId) => (col(c) < 0 ? "" : f.celdas[col(c)]);
  const vistos = new Set<string>();
  return lec.filas.map(f => {
    const original = String(val(f, "consecutivo") ?? "").trim();
    const fecha = aFechaISO(val(f, "fecha"));
    const remitente = String(val(f, "remitente") ?? "").trim();
    const sistema = original ? (original.includes("/") ? original : `${original}/${anio}`) : "";
    const base = { n: f.n, huella: f.huella, original, sistema, fecha, remitente };

    if (!original) return { ...base, nivel: "rojo" as Nivel, mensaje: "Falta el consecutivo." };
    if (!fecha) return { ...base, nivel: "rojo" as Nivel, mensaje: "La fecha está vacía o no es válida." };
    if (Number(fecha.slice(0, 4)) !== anio) return { ...base, nivel: "rojo" as Nivel, mensaje: `La fecha no es de ${anio}.` };
    if (!remitente) return { ...base, nivel: "rojo" as Nivel, mensaje: "Falta el remitente o destinatario." };
    // TODO: el backend también marca como duplicadas las filas "ya cargadas en un lote anterior".
    if (vistos.has(sistema)) return { ...base, nivel: "amarillo" as Nivel, mensaje: "Consecutivo repetido en el Excel: se omite." };
    vistos.add(sistema);
    return { ...base, nivel: "verde" as Nivel, mensaje: "Correcto" };
  });
}

/** Excel de ejemplo con 12 filas: 10 correctas, 1 consecutivo repetido y 1 sin fecha. */
function excelEjemplo(anio: number): File {
  const f = (d: number, m: number) => `${d}/${m}/${anio}`;
  const filas = [
    ["No.", "FECHA", "REMITENTE", "ASUNTO", "RECIBIÓ", "PDF"],
    [102, f(1, 2), "Alcaldía de Popayán", "Solicitud de información", "Diana Paz", "102.pdf"],
    [105, f(16, 8), "ICETEX", "Convenio de crédito", "Diana Paz", "105.pdf"],
    [106, f(1, 6), "Contraloría Departamental", "Requerimiento", "Diana Paz", "106.pdf"],
    [110, f(18, 1), "Ministerio de Educación Nacional", "Registro calificado", "Diana Paz", "110.pdf"],
    [114, f(23, 5), "SENA Regional Cauca", "Prácticas empresariales", "Diana Paz", "114.pdf"],
    [115, f(5, 4), "Colciencias", "Convocatoria", "Diana Paz", "115.pdf"],
    [118, f(12, 3), "Gobernación del Cauca", "Invitación", "Diana Paz", "118.pdf"],
    [121, f(7, 7), "Universidad del Cauca", "Convenio marco", "Diana Paz", "121.pdf"],
    [121, f(7, 7), "Universidad del Cauca", "Convenio marco", "Diana Paz", "121.pdf"],
    [124, f(30, 9), "Procuraduría", "Citación", "Diana Paz", "124.pdf"],
    [130, f(14, 11), "Cámara de Comercio del Cauca", "Certificado", "Diana Paz", "130.pdf"],
    [133, "", "Defensoría del Pueblo", "Queja", "Diana Paz", "133.pdf"],
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Registro");
  const bytes = XLSX.write(libro, { type: "array", bookType: "xlsx" });
  return new File([bytes], `Autonoma ${anio}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ───────────────────────── UI ───────────────────────── */
const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";
const btnSec = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]";

interface Props {
  onVolver: () => void;
  /** Se llama al iniciar la carga; el padre muestra el detalle del lote. */
  onIniciar: (lote: LoteData) => void;
}

export function NuevaCargaRegistro({ onVolver, onIniciar }: Props) {
  const { usuario } = useAuth();
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";

  const [paso, setPaso] = useState(1);
  const [anio, setAnio] = useState(String(ANIO_ACTUAL - 1));
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [mapa, setMapa] = useState<CampoId[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [validando, setValidando] = useState(false);

  const filas = useMemo(() => (lectura ? evaluar(lectura, mapa, Number(anio)) : []), [lectura, mapa, anio]);
  const cuenta = (n: Nivel) => filas.filter(f => f.nivel === n).length;
  const faltanCampos = OBLIGATORIOS.filter(c => !mapa.includes(c));
  const destino = `Registro histórico ${anio} · ${tipo}`;

  const elegir = (lista: FileList | File[] | null) => {
    const f = lista && Array.from(lista)[0];
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return alertaCarga.error("Formato no permitido", "Sube un archivo .xlsx, .xls o .csv.");
    setArchivo(f);
  };

  const validar = async () => {
    if (!archivo) return;
    setValidando(true);
    alertaCarga.procesando("Leyendo el archivo…", archivo.name);
    try {
      const lec = await leerArchivo(archivo);
      setLectura(lec);
      setMapa(autoMapa(lec.cabeceras));
      setPaso(3);
      alertaCarga.ok("Archivo leído", `${plural(lec.filas.length, "fila", "filas")} encontradas. Revisa el mapeo de columnas.`);
    } catch (e) {
      alertaCarga.error("No se pudo leer el archivo", motivoError(e, "Comprueba que no esté dañado ni protegido con contraseña."));
    } finally {
      setValidando(false);
    }
  };

  const iniciar = () => {
    // TODO: crear el lote en el backend (código, registro de filas, auditoría). El código aquí es de ejemplo.
    const items: ArchivoLote[] = filas.map(f => ({
      id: `fila-${f.n}`,
      nombre: `Fila ${f.n} · consecutivo ${f.original || "—"}`,
      tamano: 0,
      huella: f.huella,
      estudiante: "",
      estado: f.nivel === "verde" ? "Pendiente" : f.nivel === "amarillo" ? "Duplicado" : "Error",
      detalle: f.nivel === "verde" ? "" : f.mensaje,
      detalleAceptado: `${f.original} → ${f.sistema} (original conservado)`,
    }));
    alertaCarga.info("Lote iniciado", `Registro histórico · ${plural(items.length, "fila", "filas")}.`);
    onIniciar({
      codigo: `L-${ANIO_ACTUAL}-045`,
      tituloCarga: "Registro histórico",
      destino,
      usuario: usuarioNombre,
      fecha: new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, ""),
      unidad: "filas",
      archivos: items,
    });
  };

  const puedeContinuar =
    (paso === 1 && !!anio && !!tipo) || (paso === 3 && cuenta("verde") > 0 && faltanCampos.length === 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al Centro de cargas
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Centro de cargas · Carga E</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <History className="h-6 w-6 text-[#e8740e]" /> Registro histórico
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">Paso {paso} de 4: {SUBTITULO[paso]}</p>
      </div>

      {/* Pasos */}
      <ol className={`${panel} grid grid-cols-2 overflow-hidden lg:grid-cols-4`}>
        {PASOS.map((p, i) => {
          const n = i + 1, activo = paso === n, hecho = paso > n;
          return (
            <li key={p.titulo} className={`border-b-[3px] ${activo ? "border-[#e8740e]" : "border-transparent"}`}>
              <button type="button" disabled={!hecho} onClick={() => setPaso(n)} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  activo ? "bg-[#1e3a5f] text-white" : hecho ? "bg-emerald-100 text-emerald-700" : "bg-[#ede6d8] text-[#6b7a8d]"}`}>
                  {hecho ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${activo ? "text-[#1e3a5f]" : "text-[#2c3e50]"}`}>{p.titulo}</span>
                  <span className="block truncate text-xs text-[#6b7a8d]">{p.detalle}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Paso 1 */}
      {paso === 1 && (
        <section className={`${panel} space-y-5 p-5`}>
          <div className="grid grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Año del Excel <span className="text-[#e8740e]">*</span></span>
              <select className={campo} value={anio} onChange={e => { setAnio(e.target.value); setLectura(null); }}>
                {ANIOS.map(a => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Comunicaciones <span className="text-[#e8740e]">*</span></span>
              <select className={campo} value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <p className="flex items-start gap-2 rounded-xl border-2 border-[#1e3a5f] bg-[#eef2f7] px-4 py-3 text-sm text-[#2c3e50]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a5f]" />
            Las columnas del Excel se mapean en el paso 3. El consecutivo se adapta (ej. 385 → 385/{anio}) y se conserva el original.
            Repetir la carga no duplica filas.
          </p>
        </section>
      )}

      {/* Paso 2 */}
      {paso === 2 && (
        <section className="space-y-4">
          <label
            onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files); }}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
              arrastrando ? "border-[#e8740e] bg-[#f3ede1]" : "border-[rgba(30,58,95,0.4)] bg-white hover:bg-[#f3ede1]/60"}`}
          >
            <UploadCloud className="h-9 w-9 shrink-0 text-[#1e3a5f]" />
            <span>
              <span className="block text-base font-bold text-[#1e3a5f]">Arrastra el Excel del registro histórico</span>
              <span className="block text-xs text-[#6b7a8d]">Un archivo por año (.xlsx o .csv).</span>
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={e => { elegir(e.target.files); e.target.value = ""; }} />
          </label>

          <button type="button" className={btnSec} onClick={() => setArchivo(excelEjemplo(Number(anio)))}>
            <Wand2 className="h-4 w-4" /> Usar archivos de ejemplo
          </button>

          {archivo && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 border-b border-[rgba(30,58,95,0.12)] pb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Archivos recibidos</p>
                <div className="flex items-center gap-3 text-xs font-bold text-[#2c3e50]">
                  1 archivo · {tamanoLegible(archivo.size)}
                  <button type="button" className={btnSec} onClick={() => { setArchivo(null); setLectura(null); }}>Quitar todos</button>
                </div>
              </div>
              <div className="flex items-center gap-3 border-b border-[rgba(30,58,95,0.09)] py-2">
                <FileText className="h-4 w-4 shrink-0 text-[#6b7a8d]" />
                <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">{archivo.name}</span>
                <span className="text-xs text-[#6b7a8d]">{tamanoLegible(archivo.size)}</span>
                <button aria-label={`Quitar ${archivo.name}`} onClick={() => { setArchivo(null); setLectura(null); }}
                  className="rounded-md p-1 text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Paso 3 */}
      {paso === 3 && lectura && (
        <section className="space-y-5">
          <dl className="grid grid-cols-1 divide-[rgba(30,58,95,0.15)] border-2 border-[#1e3a5f] bg-white sm:grid-cols-3 sm:divide-x">
            {([
              ["verde", "bg-emerald-600", "Se cargan"],
              ["amarillo", "bg-amber-500", "Con aviso o duplicados (se omiten)"],
              ["rojo", "bg-red-600", "Con error (no se cargan)"],
            ] as const).map(([n, color, texto]) => (
              <div key={n} className="flex items-start gap-3 px-5 py-4">
                <span className={`mt-3 h-3.5 w-3.5 shrink-0 ${color}`} />
                <div>
                  <dd className="text-3xl font-bold leading-none text-[#1e3a5f]">{cuenta(n)}</dd>
                  <dt className="mt-1 text-xs text-[#6b7a8d]">{texto}</dt>
                </div>
              </div>
            ))}
          </dl>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Mapeo de columnas del Excel</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {lectura.cabeceras.map((h, i) => h && (
                <label key={i} className="block">
                  <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Columna “{h}”</span>
                  <select
                    className={campo}
                    value={mapa[i]}
                    onChange={e => setMapa(m => m.map((x, j) => (j === i ? (e.target.value as CampoId) : x)))}
                  >
                    {CAMPOS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {faltanCampos.length > 0 && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                Falta asignar: {faltanCampos.map(c => CAMPOS.find(x => x.id === c)?.label).join(", ")}.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
              Filas leídas · el consecutivo se adapta y se conserva el original
            </p>
            <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
                    {["Fila", "Consecutivo original", "Consecutivo en el sistema", "Fecha", "Remitente", "Resultado"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.n} className="border-t border-[rgba(30,58,95,0.09)] odd:bg-white even:bg-[#f3ede1]/40">
                      <td className="px-3 py-2 text-sm text-[#6b7a8d]">{f.n}</td>
                      <td className="px-3 py-2 text-sm font-bold text-[#1e3a5f]">{f.original || "—"}</td>
                      <td className="px-3 py-2 text-sm font-bold text-[#1e3a5f]">{f.sistema || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-[#2c3e50]">{verFecha(f.fecha)}</td>
                      <td className="px-3 py-2 text-sm text-[#2c3e50]">{f.remitente || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                          f.nivel === "verde" ? "bg-emerald-50 text-emerald-700" : f.nivel === "amarillo" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                          {f.nivel === "verde" ? "Correcto" : f.nivel === "amarillo" ? "Duplicado" : "Error"}
                        </span>
                        {f.nivel !== "verde" && (
                          <p className={`mt-0.5 text-xs ${f.nivel === "amarillo" ? "text-amber-700" : "text-red-700"}`}>{f.mensaje}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Paso 4 */}
      {paso === 4 && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-2 border-[#1e3a5f] bg-white p-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Resumen del lote</p>
            <dl>
              {([
                ["Carga", "E · Registro histórico"], ["Destino", destino], ["Filas", String(filas.length)],
                ["Se cargarán", String(cuenta("verde"))], ["Duplicados (se omiten)", String(cuenta("amarillo"))],
                ["Con error", String(cuenta("rojo"))], ["Usuario", usuarioNombre],
              ] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-[rgba(30,58,95,0.12)] py-2 text-sm">
                  <dt className="text-[#6b7a8d]">{k}</dt><dd className="font-bold text-[#2c3e50]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="self-start text-sm text-[#2c3e50]">
            {[
              "Los errores de un archivo no detienen el lote: se reportan al final y puedes reintentar solo los fallidos.",
              "Cada archivo aceptado queda con su huella SHA-256 y se registra en Auditoría.",
              "Puedes repetir esta carga: las filas ya cargadas se omiten.",
            ].map(t => (
              <li key={t} className="flex gap-3 border-b border-[rgba(30,58,95,0.12)] py-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(30,58,95,0.09)] pt-4">
        <div className="flex gap-2">
          {paso > 1 && (
            <button onClick={() => setPaso(p => p - 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]">
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          )}
          {paso === 2 ? (
            <button disabled={!archivo || validando} onClick={validar}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {validando && <Loader2 className="h-4 w-4 animate-spin" />} Validar archivos <ArrowRight className="h-4 w-4" />
            </button>
          ) : paso < 4 ? (
            <button disabled={!puedeContinuar} onClick={() => setPaso(p => p + 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={cuenta("verde") === 0} onClick={iniciar}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Iniciar carga <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <button onClick={onVolver}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50">
          <X className="h-4 w-4" /> Cancelar carga
        </button>
      </div>
    </div>
  );
}