/**
 * @file NuevaCargaHistorias.tsx
 * @description Carga D · Historias académicas masivas (Centro de cargas › Nueva carga).
 * Asistente de 4 pasos: Destino y datos → Archivos → Vista previa → Confirmar.
 * El nombre del archivo debe seguir la convención "APELLIDOS NOMBRES - cédula.pdf" (por acordar).
 * Calcula la huella SHA-256 en el navegador; la detección de duplicados contra el archivo existente la hace el backend (TODO).
 */
import { useEffect, useState } from "react";
import { alertaCarga, plural } from "../../lib/alertasCarga";
import { listarCatalogo } from "../../lib/catalogosApi";
import { apiCargarHistoria, type EstadoHistoria } from "../../lib/historiasApi";
import { ArrowLeft, ArrowRight, Check, FileText, FolderUp, GraduationCap, Info, Loader2, UploadCloud, Wand2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { tamanoLegible, type ArchivoLote, type LoteData } from "./LoteDetalle";

/* ───────────────────────── Catálogos de ejemplo (luego, de la API) ───────────────────────── */
const ESTADOS = ["Graduados", "Retirados", "Activos"];
const ESTADO_DB: Record<string, EstadoHistoria> = { Graduados: "graduado", Retirados: "retirado", Activos: "activa" };

/** Programa del catálogo (Catálogos › Programas académicos). El nivel también sale de ahí. */
interface ProgramaCat { id: number; nombre: string; nivel: string }
const NIVEL_LABEL: Record<string, string> = {
  pregrado: "Pregrado", especializacion: "Especialización", maestria: "Maestría", doctorado: "Doctorado", posgrado: "Posgrado",
};
const ORDEN_NIVEL = ["pregrado", "especializacion", "maestria", "doctorado", "posgrado"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);
const MAX_MB = 50;
const EXT_OK = /\.(pdf|jpe?g|png|tiff?)$/i;
const CONVENCION = /^(.+?)\s+-\s+(\d{5,12})(?:\s*\(\d+\))?\.(pdf|jpe?g|png|tiff?)$/i;

const PASOS = [
  { titulo: "Destino y datos", detalle: "Estado, año, nivel, programa" },
  { titulo: "Archivos", detalle: "Carpeta escaneada" },
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

/** nivel = valor del catálogo (pregrado, especializacion…); programa = id del programa. */
interface Datos { estado: string; anio: string; nivel: string; programa: string; titulo: string }
type Nivel = "verde" | "amarillo" | "rojo";
interface Resultado {
  archivo: File; huella: string; nivel: Nivel; mensaje: string; estudiante: string;
  apellidos: string; nombres: string; cedula: string;
  /** Título del documento para buscarlo (p. ej. "Acta de grado"); se puede cambiar por archivo. */
  titulo: string;
}

/* ───────────────────────── Utilidades ───────────────────────── */
async function sha256(archivo: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** "GÓMEZ RIASCOS ANA LUCÍA - 1061998877.pdf" → { nombre, apellidos, nombres, cedula } o null si no cumple la convención.
 *  Apellidos: las dos primeras palabras (una si el nombre solo tiene dos); nombres: el resto. */
function leerNombre(nombreArchivo: string) {
  const m = nombreArchivo.match(CONVENCION);
  if (!m || !/^[\p{L}'. ]+$/u.test(m[1]) || m[1].trim().split(/\s+/).length < 2) return null;
  const palabras = m[1].trim().split(/\s+/);
  const corte = palabras.length >= 3 ? 2 : 1;
  return { nombre: m[1].trim(), apellidos: palabras.slice(0, corte).join(" "), nombres: palabras.slice(corte).join(" "), cedula: m[2] };
}

async function evaluar(archivos: File[], titulo: string): Promise<Resultado[]> {
  const vistas = new Map<string, string>(); // huella → primer archivo con esa huella
  const out: Resultado[] = [];
  const ordenados = [...archivos].sort((a, b) => a.name.localeCompare(b.name, "es"));
  for (const archivo of ordenados) {
    const base = { archivo, huella: "", estudiante: "—", apellidos: "", nombres: "", cedula: "", titulo };
    if (!EXT_OK.test(archivo.name)) { out.push({ ...base, nivel: "rojo", mensaje: "Formato no permitido. Usa PDF, JPG, PNG o TIFF." }); continue; }
    if (archivo.size === 0) { out.push({ ...base, nivel: "rojo", mensaje: "El archivo está vacío o dañado." }); continue; }
    if (archivo.size > MAX_MB * 1024 * 1024) { out.push({ ...base, nivel: "rojo", mensaje: `Supera el tamaño máximo de ${MAX_MB} MB.` }); continue; }
    const huella = await sha256(archivo);
    const est = leerNombre(archivo.name);
    if (!est) { out.push({ ...base, huella, nivel: "rojo", mensaje: "El nombre no sigue la convención APELLIDOS NOMBRES - cédula.pdf" }); continue; }
    const estudiante = `${est.nombre} · C.C. ${est.cedula}`;
    const persona = { estudiante, apellidos: est.apellidos, nombres: est.nombres, cedula: est.cedula, titulo };
    const previo = vistas.get(huella);
    if (previo) {
      out.push({ archivo, huella, ...persona, nivel: "amarillo", mensaje: `Duplicado: misma huella que ${previo}. No se guarda otra vez.` });
      continue;
    }
    vistas.set(huella, archivo.name);
    // El backend también compara la huella con lo que ya tiene la historia (409 = ya estaba).
    out.push({ archivo, huella, ...persona, nivel: "verde", mensaje: "Listo para cargar." });
  }
  return out;
}

/** Archivos de ejemplo: incluye un duplicado por contenido y un nombre fuera de convención. */
function archivosEjemplo(): File[] {
  const pdf = (nombre: string, semilla: string) =>
    new File([semilla.repeat(1) + "x".repeat(1_100_000)], nombre, { type: "application/pdf" });
  return [
    pdf("CERÓN IMBACHÍ SARA - 1063427717.pdf", "A"),
    pdf("CERÓN IMBACHÍ SARA - 1063427717 (2).pdf", "A"),
    pdf("CHICANGANA ZÚÑIGA ANDRÉS - 1066311667.pdf", "B"),
    pdf("GÓMEZ RIASCOS ANA LUCÍA - 1061998877.pdf", "C"),
    pdf("GUZMÁN MUÑOZ ANDRÉS - 1068584352.pdf", "D"),
    pdf("guia de clase semana 8 (estudiante).pdf", "E"),
  ];
}

/* ───────────────────────── Piezas de UI ───────────────────────── */
const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";
const btnSec = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#2c3e50]">{label} <span className="text-[#e8740e]">*</span></span>
      {children}
    </label>
  );
}

/* ───────────────────────── Componente ───────────────────────── */
interface Props {
  onVolver: () => void;
  /** Se llama al iniciar la carga; el padre muestra el detalle del lote. */
  onIniciar: (lote: LoteData) => void;
}

export function NuevaCargaHistorias({ onVolver, onIniciar }: Props) {
  const { usuario } = useAuth();
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";

  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>({ estado: "", anio: String(ANIO_ACTUAL), nivel: "", programa: "", titulo: "" });
  const [archivos, setArchivos] = useState<File[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [programas, setProgramas] = useState<ProgramaCat[] | null>(null);

  // Programas activos del catálogo; Pregrado y Posgrado muestran los suyos.
  useEffect(() => {
    listarCatalogo<ProgramaCat>("programas", { estado: "activo", limite: 500 })
      .then(r => setProgramas(r.datos ?? []))
      .catch(() => setProgramas([]));
  }, []);
  // Niveles: los que tienen programas activos en el catálogo, en orden.
  const niveles = ORDEN_NIVEL.filter(n => (programas ?? []).some(p => p.nivel === n));
  const delNivel = (nivel: string) => (programas ?? []).filter(p => p.nivel === nivel);
  const programaSel = (programas ?? []).find(p => String(p.id) === datos.programa);

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setDatos(d => ({ ...d, [k]: e.target.value }));
  const destino = `${datos.estado} / ${datos.anio} / ${NIVEL_LABEL[datos.nivel] ?? datos.nivel} / ${programaSel?.nombre ?? ""}`;
  const cuenta = (n: Nivel) => resultados.filter(r => r.nivel === n).length;
  const totalBytes = archivos.reduce((s, f) => s + f.size, 0);

  const agregar = (lista: FileList | File[] | null) => {
    if (!lista) return;
    // Se copia ya: el FileList del input se vacía al limpiar su valor, antes de que React ejecute el setState.
    const recibidos = Array.from(lista);
    setArchivos(prev => {
      const nuevos = recibidos.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));
      return [...prev, ...nuevos];
    });
  };

  const validar = async () => {
    setValidando(true);
    alertaCarga.procesando(`Validando ${plural(archivos.length, "archivo", "archivos")}…`, "Se calcula la huella SHA-256 de cada uno.");
    try {
      const evaluados = await evaluar(archivos, datos.titulo.trim());
      setResultados(evaluados);
      setPaso(3);
      const ok = evaluados.filter(r => r.nivel === "verde").length;
      const dup = evaluados.filter(r => r.nivel === "amarillo").length;
      const err = evaluados.filter(r => r.nivel === "rojo").length;
      const resumen = `${ok} listos · ${dup} duplicados · ${err} con error`;
      if (err > 0 || dup > 0) alertaCarga.aviso("Validación terminada con observaciones", resumen);
      else alertaCarga.ok("Validación terminada", resumen);
    } catch {
      alertaCarga.error("No se pudieron validar los archivos", "Vuelve a seleccionarlos e intenta de nuevo.");
    } finally {
      setValidando(false);
    }
  };

  const iniciar = () => {
    // Cada archivo "Listo" se sube al backend (POST /api/historias); duplicados y errores ya vienen resueltos.
    const items: ArchivoLote[] = resultados.map((r, i) => ({
      id: `${i}-${r.archivo.name}`,
      nombre: r.archivo.name,
      tamano: r.archivo.size,
      huella: r.huella || "—",
      estudiante: r.estudiante,
      estado: r.nivel === "verde" ? "Pendiente" : r.nivel === "amarillo" ? "Duplicado" : "Error",
      detalle: r.nivel === "verde" ? "" : r.mensaje,
    }));
    const porId = new Map(items.map((it, i) => [it.id, resultados[i]] as const));
    const procesar = async (it: ArchivoLote) => {
      const r = porId.get(it.id)!;
      const titulo = r.titulo.trim() || datos.titulo.trim();
      try {
        const h = await apiCargarHistoria(r.archivo, {
          programa_id: Number(datos.programa), estado: ESTADO_DB[datos.estado], anio: Number(datos.anio),
          titulo, apellidos: r.apellidos, nombres: r.nombres, numero_documento: r.cedula,
        });
        const quien = `${h.estudiante.apellidos} ${h.estudiante.nombres}`;
        return {
          estado: "Aceptado" as const,
          detalle: `«${titulo}» ${h.nueva_historia ? "abrió la historia de" : "se agregó a la historia de"} ${quien}.`
            + (h.estudiante.nombre_distinto ? " Ese estudiante ya estaba registrado con ese nombre." : ""),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo cargar";
        if (/duplicad|ya est/i.test(msg)) return { estado: "Duplicado" as const, detalle: "Ya estaba en la historia del estudiante. No se guarda otra vez." };
        return { estado: "Error" as const, detalle: msg, reintentable: true };
      }
    };
    alertaCarga.info("Lote iniciado", `Historias académicas masivas · ${plural(items.length, "archivo", "archivos")}.`);
    onIniciar({
      codigo: `L-${ANIO_ACTUAL}-044`,
      tituloCarga: "Historias académicas masivas",
      destino,
      usuario: usuarioNombre,
      fecha: new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, ""),
      archivos: items,
      procesar,
    });
  };

  const puedeContinuar =
    (paso === 1 && !!datos.estado && !!datos.anio && !!datos.nivel && !!datos.programa && !!datos.titulo.trim()) ||
    (paso === 3 && cuenta("verde") > 0);

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
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Centro de cargas · Carga D</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <GraduationCap className="h-6 w-6 text-[#e8740e]" /> Historias académicas masivas
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Estado">
              <select className={campo} value={datos.estado} onChange={set("estado")}>
                <option value="">Selecciona…</option>{ESTADOS.map(x => <option key={x}>{x}</option>)}
              </select>
            </Campo>
            <Campo label="Año">
              <select className={campo} value={datos.anio} onChange={set("anio")}>{ANIOS.map(x => <option key={x}>{x}</option>)}</select>
            </Campo>
            <Campo label="Nivel">
              <select className={campo} value={datos.nivel} onChange={e => setDatos(d => ({ ...d, nivel: e.target.value, programa: "" }))}>
                <option value="">{programas === null ? "Cargando…" : niveles.length === 0 ? "Sin programas en el catálogo" : "Selecciona…"}</option>
                {niveles.map(n => <option key={n} value={n}>{NIVEL_LABEL[n] ?? n}</option>)}
              </select>
            </Campo>
            <Campo label={datos.nivel === "especializacion" ? "Especialización" : datos.nivel && datos.nivel !== "pregrado" ? "Programa de posgrado" : "Programa"}>
              <select className={campo} value={datos.programa} onChange={set("programa")} disabled={!datos.nivel}>
                <option value="">{!datos.nivel ? "Primero elige el nivel" : "Selecciona…"}</option>
                {delNivel(datos.nivel).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Título del documento <span className="text-[#e8740e]">*</span></span>
              <input className={campo} placeholder="Ej. Acta de grado, Certificado de notas" value={datos.titulo} onChange={set("titulo")} />
              <span className="mt-1 block text-xs text-[#6b7a8d]">Se usa para encontrarlo en Consulta › Buscar. Se puede cambiar por archivo en la vista previa.</span>
            </label>
          </div>
          <p className="flex items-start gap-2 rounded-xl border-2 border-[#1e3a5f] bg-[#eef2f7] px-4 py-3 text-sm text-[#2c3e50]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a5f]" />
            El sistema ordena por apellido y propone el estudiante a partir del nombre del archivo (APELLIDOS NOMBRES - cédula.pdf,
            convención por acordar). Si ya tiene historia, el documento se agrega a ella. No usa IA.
          </p>
        </section>
      )}

      {/* Paso 2 */}
      {paso === 2 && (
        <section className="space-y-4">
          <label
            onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
              arrastrando ? "border-[#e8740e] bg-[#f3ede1]" : "border-[rgba(30,58,95,0.4)] bg-white hover:bg-[#f3ede1]/60"}`}
          >
            <UploadCloud className="h-9 w-9 shrink-0 text-[#1e3a5f]" />
            <span>
              <span className="block text-base font-bold text-[#1e3a5f]">Arrastra la carpeta de historias o selecciona los archivos</span>
              <span className="block text-xs text-[#6b7a8d]">PDF, JPG, PNG o TIFF · máximo {MAX_MB} MB por archivo</span>
            </span>
            <input type="file" multiple className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
              onChange={e => { agregar(e.target.files); e.target.value = ""; }} />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className={`${btnSec} cursor-pointer`}>
              <FolderUp className="h-4 w-4" /> Subir una carpeta
              <input type="file" multiple className="sr-only"
                {...({ webkitdirectory: "" } as Record<string, string>)}
                onChange={e => { agregar(e.target.files); e.target.value = ""; }} />
            </label>
            <button type="button" className={btnSec} onClick={() => agregar(archivosEjemplo())}>
              <Wand2 className="h-4 w-4" /> Usar archivos de ejemplo
            </button>
          </div>

          {archivos.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 border-b border-[rgba(30,58,95,0.12)] pb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Archivos recibidos</p>
                <div className="flex items-center gap-3 text-xs font-bold text-[#2c3e50]">
                  {archivos.length} archivo{archivos.length === 1 ? "" : "s"} · {tamanoLegible(totalBytes)}
                  <button type="button" className={btnSec} onClick={() => setArchivos([])}>Quitar todos</button>
                </div>
              </div>
              <ul className="divide-y divide-[rgba(30,58,95,0.09)]">
                {archivos.map(f => (
                  <li key={f.name + f.size} className="flex items-center gap-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-[#6b7a8d]" />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">{f.name}</span>
                    <span className="text-xs text-[#6b7a8d]">{tamanoLegible(f.size)}</span>
                    <button aria-label={`Quitar ${f.name}`} onClick={() => setArchivos(p => p.filter(x => x !== f))}
                      className="rounded-md p-1 text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-red-600"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Paso 3 */}
      {paso === 3 && (
        <section className="space-y-4">
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

          <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
                  {["#", "Archivo", "Tamaño", "Huella SHA-256", "Resultado", "Estudiante propuesto", "Título"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={r.archivo.name + r.archivo.size} className="border-t border-[rgba(30,58,95,0.09)] odd:bg-white even:bg-[#f3ede1]/40">
                    <td className="px-3 py-2 text-sm text-[#6b7a8d]">{i + 1}</td>
                    <td className="px-3 py-2 text-sm font-bold text-[#1e3a5f]">{r.archivo.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#6b7a8d]">{tamanoLegible(r.archivo.size)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[#2c3e50]" title={r.huella}>{r.huella ? `${r.huella.slice(0, 14)}…` : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                        r.nivel === "verde" ? "bg-emerald-50 text-emerald-700" : r.nivel === "amarillo" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                        {r.nivel === "verde" ? "Listo" : r.nivel === "amarillo" ? "Duplicado" : "Error"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#2c3e50]">{r.nivel === "rojo" ? <span className="text-red-700">{r.mensaje}</span> : r.nivel === "amarillo" ? <span className="text-amber-700">{r.mensaje}</span> : r.estudiante}</td>
                    <td className="px-3 py-2">
                      {r.nivel === "verde" ? (
                        <input
                          aria-label={`Título de ${r.archivo.name}`}
                          className="h-8 w-48 rounded-md border border-[rgba(30,58,95,0.15)] bg-white px-2 text-xs text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30"
                          value={r.titulo}
                          onChange={e => setResultados(rs => rs.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))}
                        />
                      ) : <span className="text-xs text-[#6b7a8d]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                ["Carga", "D · Historias académicas masivas"], ["Destino", destino], ["Archivos", String(resultados.length)],
                ["Se cargarán", String(cuenta("verde"))], ["Duplicados (se omiten)", String(cuenta("amarillo"))],
                ["Con error", String(cuenta("rojo"))], ["Usuario", usuarioNombre],
              ] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-[rgba(30,58,95,0.12)] py-2 text-sm">
                  <dt className="text-[#6b7a8d]">{k}</dt><dd className="font-bold text-[#2c3e50]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="space-y-0 self-start text-sm text-[#2c3e50]">
            {[
              "Los errores de un archivo no detienen el lote: se reportan al final y puedes reintentar solo los fallidos.",
              "Cada archivo aceptado queda con su huella SHA-256 y se registra en Auditoría.",
              "Se procesa por partes con barra de avance; puedes pausar y retomar.",
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
            <button disabled={archivos.length === 0 || validando} onClick={validar}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {validando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Validar archivos <ArrowRight className="h-4 w-4" />
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