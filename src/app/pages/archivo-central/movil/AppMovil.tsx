/**
 * @file AppMovil.tsx
 * @description App del celular (PWA) para cargar historias académicas (RF-AC-021, RF-AC-022).
 * Ruta /movil, fuera del Layout de NOVA (pantalla completa en el celular).
 *  - Sesión: la de NOVA (sin sesión, va a /login?redirect=/movil).
 *  - Dos modos, con el mismo destino (Estado → Año → Nivel → Programa) y el título del documento:
 *      · Individual: fotos de las páginas (se unen en un PDF) + apellidos, nombres y cédula del estudiante.
 *      · Masiva: varios archivos nombrados "APELLIDOS NOMBRES - cédula.pdf" (como la carga D de la web);
 *        se suben uno a uno y cada uno muestra su resultado (los errores de uno no detienen a los demás).
 *  - Cada archivo va a POST /api/historias (permiso cargas.historias); el mismo archivo en la misma
 *    historia no se guarda dos veces. Sin IA (RN-AC-13). Ver y buscar las historias se hace en la web.
 *  - Si se pierde la conexión, avisa y deja reintentar sin perder lo escrito.
 */
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle, Camera, CheckCircle2, FileText, FolderUp, GraduationCap, ImagePlus, Loader2, LogOut, RefreshCw,
  Trash2, UploadCloud, User, WifiOff, XCircle,
} from "lucide-react";
import { tokens } from "../../../lib/api";
import { listarCatalogo } from "../../../lib/catalogosApi";
import {
  ESTADOS_HISTORIA, apiCargarHistoria, leerNombreArchivo, nivelesDeProgramas, programasDelNivel,
  type EstadoHistoria, type ProgramaHist,
} from "../../../lib/historiasApi";
import { usePwaMovil } from "./pwa";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1959 }, (_, i) => ANIO_ACTUAL - i);
const MAX_MB = 50;
const EXT_OK = /\.(pdf|jpe?g|png|tiff?)$/i;
/** Lado mayor de cada foto en el PDF (suficiente para leer un documento y liviano para subir por datos). */
const LADO_MAX = 1800;

type Modo = "individual" | "masiva";

interface Destino { estado: EstadoHistoria | ""; anio: string; nivel: string; programa: string; titulo: string }
const DESTINO_INICIAL: Destino = { estado: "graduado", anio: String(ANIO_ACTUAL), nivel: "", programa: "", titulo: "" };

interface Estudiante { apellidos: string; nombres: string; cedula: string }
const ESTUDIANTE_VACIO: Estudiante = { apellidos: "", nombres: "", cedula: "" };

type EstadoArchivo = "listo" | "subiendo" | "ok" | "duplicado" | "error" | "invalido";
interface ArchivoMasivo { archivo: File; estudiante: Estudiante | null; estado: EstadoArchivo; mensaje: string }

interface Subido { id: string; titulo: string; estudiante: string; programa: string; cuando: Date; nueva: boolean }

const campo =
  "h-12 w-full rounded-xl border border-[rgba(30,58,95,0.15)] bg-white px-3 text-base text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30 disabled:bg-[#f3ede1]/60";

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-[#2c3e50]">
        {label}{requerido && <span className="text-[#e8740e]"> *</span>}
      </span>
      {children}
    </label>
  );
}

const haySesion = () => !!tokens.getAccess();
/** Nombre del usuario de NOVA guardado al iniciar sesión (localStorage "usuario"). */
const nombreDeNova = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem("usuario") ?? "null") as { nombre?: string; apellido?: string } | null;
    return u ? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() : "";
  } catch {
    return "";
  }
};
const tamano = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const esErrorDeRed = (e: unknown) =>
  e instanceof TypeError || !navigator.onLine || /failed to fetch|network/i.test(e instanceof Error ? e.message : String(e));
const esDuplicado = (e: unknown) => /duplicad|ya est/i.test(e instanceof Error ? e.message : String(e));

/** Lee una foto y la devuelve reducida como JPEG (data URL) con su tamaño. */
async function fotoReducida(archivo: File): Promise<{ data: string; ancho: number; alto: number }> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error(`No se pudo leer la foto ${archivo.name}`));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.round(img.naturalWidth * escala), alto = Math.round(img.naturalHeight * escala);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho; lienzo.height = alto;
    lienzo.getContext("2d")!.drawImage(img, 0, 0, ancho, alto);
    return { data: lienzo.toDataURL("image/jpeg", 0.82), ancho, alto };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Une las fotos en un PDF (una página por foto, del tamaño de la foto) o deja el PDF tal cual. */
async function armarPdf(paginas: File[], nombreBase: string): Promise<File> {
  const nombre = `${nombreBase.trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120) || "documento"}.pdf`;
  if (paginas.length === 1 && paginas[0].type === "application/pdf") {
    return new File([paginas[0]], nombre, { type: "application/pdf" });
  }
  let pdf: jsPDF | null = null;
  for (const p of paginas) {
    const f = await fotoReducida(p);
    const orientacion = f.ancho > f.alto ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ orientation: orientacion, unit: "px", format: [f.ancho, f.alto], compress: true });
    else pdf.addPage([f.ancho, f.alto], orientacion);
    pdf.addImage(f.data, "JPEG", 0, 0, f.ancho, f.alto);
  }
  return new File([pdf!.output("blob")], nombre, { type: "application/pdf" });
}

function Aviso({ aviso }: { aviso: { tipo: "ok" | "error" | "red"; texto: string } }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
      aviso.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : aviso.tipo === "red" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {aviso.tipo === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        : aviso.tipo === "red" ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{aviso.texto}</span>
    </div>
  );
}

const ESTILO_ARCHIVO: Record<EstadoArchivo, { texto: string; clase: string }> = {
  listo: { texto: "Listo", clase: "bg-slate-100 text-slate-600" },
  subiendo: { texto: "Subiendo…", clase: "bg-blue-50 text-blue-700" },
  ok: { texto: "Subido", clase: "bg-emerald-100 text-emerald-700" },
  duplicado: { texto: "Ya estaba", clase: "bg-amber-100 text-amber-700" },
  error: { texto: "Error", clase: "bg-red-100 text-red-700" },
  invalido: { texto: "No se sube", clase: "bg-red-100 text-red-700" },
};

export default function AppMovil() {
  usePwaMovil();
  const [modo, setModo] = useState<Modo>("individual");
  const [destino, setDestino] = useState<Destino>(DESTINO_INICIAL);
  const [programas, setProgramas] = useState<ProgramaHist[] | null>(null);
  const [sinRed, setSinRed] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error" | "red"; texto: string } | null>(null);
  const [subidos, setSubidos] = useState<Subido[]>([]);
  // Individual
  const [paginas, setPaginas] = useState<File[]>([]);
  const [estudiante, setEstudiante] = useState<Estudiante>(ESTUDIANTE_VACIO);
  const [subiendo, setSubiendo] = useState(false);
  // Masiva
  const [lote, setLote] = useState<ArchivoMasivo[]>([]);
  const [procesando, setProcesando] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const masivos = useRef<HTMLInputElement>(null);

  // Sin sesión → al login de NOVA y de vuelta aquí.
  useEffect(() => {
    if (!haySesion()) window.location.replace("/login?redirect=/movil");
  }, []);

  useEffect(() => {
    const on = () => setSinRed(false), off = () => setSinRed(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!haySesion()) return;
    listarCatalogo<ProgramaHist>("programas", { estado: "activo", limite: 500 })
      .then(r => setProgramas(r.datos ?? []))
      .catch(() => { setProgramas([]); setAviso({ tipo: "red", texto: "No se pudieron cargar los programas. Revisa la conexión." }); });
  }, []);

  const niveles = nivelesDeProgramas(programas ?? []);
  const delNivel = programasDelNivel(programas ?? [], destino.nivel);
  const nivelSel = niveles.find(n => n.clave === destino.nivel);
  const programaSel = (programas ?? []).find(p => String(p.id) === destino.programa);

  const setD = (k: keyof Destino) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDestino(d => ({ ...d, [k]: e.target.value, ...(k === "nivel" ? { programa: "" } : {}) }));
  const setE = (k: keyof Estudiante) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEstudiante(s => ({ ...s, [k]: k === "cedula" ? e.target.value.replace(/\D/g, "") : e.target.value }));

  const faltaDestino = [
    !destino.estado && "el estado",
    destino.estado !== "activa" && !destino.anio && "el año",
    !destino.programa && "el programa",
    !destino.titulo.trim() && "el título del documento",
  ].filter(Boolean) as string[];

  const datosBase = () => ({
    programa_id: Number(destino.programa),
    estado: destino.estado as EstadoHistoria,
    anio: destino.anio ? Number(destino.anio) : undefined,
    titulo: destino.titulo.trim(),
  });

  const registrar = (titulo: string, est: Estudiante, nueva: boolean) =>
    setSubidos(s => [{
      id: `${Date.now()}-${Math.random()}`, titulo, estudiante: `${est.apellidos} ${est.nombres}`.toUpperCase(),
      programa: programaSel?.nombre ?? "", cuando: new Date(), nueva,
    }, ...s].slice(0, 10));

  /* ───────── Individual ───────── */
  const agregarPaginas = (lista: FileList | null) => {
    if (!lista) return;
    const recibidos = Array.from(lista); // se copia ya: el FileList se vacía al limpiar el input
    const malos = recibidos.filter(f => (!/^image\//.test(f.type) && f.type !== "application/pdf") || f.size > MAX_MB * 1024 * 1024);
    const buenos = recibidos.filter(f => !malos.includes(f));
    const conPdf = [...paginas, ...buenos].some(f => f.type === "application/pdf");
    if (conPdf && paginas.length + buenos.length > 1) {
      setAviso({ tipo: "error", texto: "Un PDF va solo: no se mezcla con fotos ni con otro PDF." });
      return;
    }
    setAviso(malos.length ? { tipo: "error", texto: `${malos.length} archivo(s) no se agregaron: usa fotos o un PDF de hasta ${MAX_MB} MB.` } : null);
    setPaginas(p => [...p, ...buenos]);
  };

  const faltaIndividual = [
    ...faltaDestino,
    paginas.length === 0 && "las páginas (toma al menos una foto)",
    !estudiante.apellidos.trim() && "los apellidos",
    !estudiante.nombres.trim() && "los nombres",
    !(estudiante.cedula.length >= 5 && estudiante.cedula.length <= 12) && "la cédula (de 5 a 12 dígitos)",
  ].filter(Boolean) as string[];

  const subirIndividual = async () => {
    if (faltaIndividual.length) return setAviso({ tipo: "error", texto: `Falta ${faltaIndividual.join(", ")}.` });
    setSubiendo(true);
    setAviso(null);
    try {
      const nombre = `${estudiante.apellidos} ${estudiante.nombres} - ${estudiante.cedula}`.toUpperCase();
      const pdf = await armarPdf(paginas, nombre);
      const h = await apiCargarHistoria(pdf, {
        ...datosBase(), apellidos: estudiante.apellidos.trim(), nombres: estudiante.nombres.trim(), numero_documento: estudiante.cedula,
      });
      setAviso({
        tipo: "ok",
        texto: `«${destino.titulo.trim()}» ${h.nueva_historia ? "abrió la historia de" : "se agregó a la historia de"} ${h.estudiante.apellidos} ${h.estudiante.nombres}`
          + ` (${paginas.length} página${paginas.length === 1 ? "" : "s"}).`
          + (h.estudiante.nombre_distinto ? " Ese estudiante ya estaba registrado con ese nombre." : ""),
      });
      registrar(destino.titulo.trim(), { ...estudiante, apellidos: h.estudiante.apellidos, nombres: h.estudiante.nombres }, h.nueva_historia);
      // Se conserva el destino: suele repetirse en la siguiente historia.
      setPaginas([]);
      setEstudiante(ESTUDIANTE_VACIO);
    } catch (e) {
      if (esErrorDeRed(e)) setAviso({ tipo: "red", texto: "Sin conexión con el servidor. Revisa la red y pulsa Reintentar: los datos no se pierden." });
      else setAviso({ tipo: "error", texto: esDuplicado(e) ? "Ese archivo ya estaba en la historia del estudiante." : e instanceof Error ? e.message : String(e) });
    } finally {
      setSubiendo(false);
    }
  };

  /* ───────── Masiva ───────── */
  const agregarMasivos = (lista: FileList | null) => {
    if (!lista) return;
    const recibidos = Array.from(lista);
    setLote(prev => {
      const nuevos = recibidos
        .filter(f => !prev.some(p => p.archivo.name === f.name && p.archivo.size === f.size))
        .map((f): ArchivoMasivo => {
          if (!EXT_OK.test(f.name)) return { archivo: f, estudiante: null, estado: "invalido", mensaje: "Formato no permitido: usa PDF o foto." };
          if (f.size === 0 || f.size > MAX_MB * 1024 * 1024) return { archivo: f, estudiante: null, estado: "invalido", mensaje: `Vacío o de más de ${MAX_MB} MB.` };
          const est = leerNombreArchivo(f.name);
          if (!est) return { archivo: f, estudiante: null, estado: "invalido", mensaje: "El nombre debe ser APELLIDOS NOMBRES - cédula.pdf" };
          return { archivo: f, estudiante: { apellidos: est.apellidos, nombres: est.nombres, cedula: est.cedula }, estado: "listo", mensaje: "" };
        });
      return [...prev, ...nuevos].sort((a, b) => a.archivo.name.localeCompare(b.archivo.name, "es"));
    });
    setAviso(null);
  };

  const pendientes = lote.filter(a => a.estado === "listo" || a.estado === "error");
  const cuenta = (e: EstadoArchivo) => lote.filter(a => a.estado === e).length;

  const subirMasiva = async () => {
    if (faltaDestino.length) return setAviso({ tipo: "error", texto: `Falta ${faltaDestino.join(", ")}.` });
    if (pendientes.length === 0) return setAviso({ tipo: "error", texto: "No hay archivos listos para subir." });
    setProcesando(true);
    setAviso(null);
    const base = datosBase();
    let ok = 0, dup = 0, err = 0, red = false;
    for (const item of pendientes) {
      setLote(l => l.map(a => (a.archivo === item.archivo ? { ...a, estado: "subiendo", mensaje: "" } : a)));
      try {
        const h = await apiCargarHistoria(item.archivo, {
          ...base, apellidos: item.estudiante!.apellidos, nombres: item.estudiante!.nombres, numero_documento: item.estudiante!.cedula,
        });
        ok++;
        registrar(base.titulo, { ...item.estudiante!, apellidos: h.estudiante.apellidos, nombres: h.estudiante.nombres }, h.nueva_historia);
        setLote(l => l.map(a => (a.archivo === item.archivo
          ? { ...a, estado: "ok", mensaje: h.nueva_historia ? "Abrió la historia." : "Se agregó a su historia." } : a)));
      } catch (e) {
        if (esDuplicado(e)) {
          dup++;
          setLote(l => l.map(a => (a.archivo === item.archivo ? { ...a, estado: "duplicado", mensaje: "Ya estaba en su historia." } : a)));
        } else {
          err++;
          red = red || esErrorDeRed(e);
          const msg = esErrorDeRed(e) ? "Sin conexión" : e instanceof Error ? e.message : String(e);
          setLote(l => l.map(a => (a.archivo === item.archivo ? { ...a, estado: "error", mensaje: msg } : a)));
        }
      }
    }
    setProcesando(false);
    const resumen = `${ok} subidos · ${dup} ya estaban · ${err} con error`;
    setAviso(red ? { tipo: "red", texto: `${resumen}. Revisa la red y pulsa Reintentar: solo se vuelven a subir los que fallaron.` }
      : { tipo: err ? "error" : "ok", texto: err ? `${resumen}. Pulsa Reintentar para los que fallaron.` : `Listo: ${resumen}.` });
  };

  const salir = () => { tokens.clear(); window.location.assign("/login?redirect=/movil"); };

  if (!haySesion()) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3ede1] text-[#1e3a5f]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const nombreUsuario = nombreDeNova();
  const ocupado = subiendo || procesando;

  return (
    <div className="min-h-screen bg-[#f3ede1] pb-10">
      {/* Encabezado */}
      <header className="sticky top-0 z-10 bg-[#1e3a5f] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f5b971]">Archivo Central</p>
            <h1 className="flex items-center gap-1.5 text-lg font-bold leading-tight"><GraduationCap className="h-5 w-5" /> Historias académicas</h1>
            {nombreUsuario && <p className="truncate text-xs text-white/75">{nombreUsuario}</p>}
          </div>
          <button type="button" onClick={salir} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
        {/* Modo */}
        <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-1 rounded-xl bg-white/10 p-1" role="tablist" aria-label="Tipo de carga">
          {([["individual", "Individual", User], ["masiva", "Masiva", FolderUp]] as const).map(([m, texto, Icono]) => (
            <button key={m} type="button" role="tab" aria-selected={modo === m} disabled={ocupado}
              onClick={() => { setModo(m); setAviso(null); }}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${modo === m ? "bg-white text-[#1e3a5f]" : "text-white/85"}`}>
              <Icono className="h-4 w-4" /> {texto}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {sinRed && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión. Puedes seguir llenando; sube cuando vuelva la red.
          </p>
        )}

        {/* 1. Destino */}
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">1 · Destino en el archivo</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estado" requerido>
              <select className={campo} value={destino.estado} onChange={setD("estado")} disabled={ocupado}>
                {ESTADOS_HISTORIA.map(e => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
              </select>
            </Campo>
            <Campo label={destino.estado === "activa" ? "Año (opcional)" : "Año de grado o retiro"} requerido={destino.estado !== "activa"}>
              <select className={campo} value={destino.anio} onChange={setD("anio")} disabled={ocupado}>
                {destino.estado === "activa" && <option value="">Sin año</option>}
                {ANIOS.map(a => <option key={a}>{a}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Nivel" requerido>
            <select className={campo} value={destino.nivel} onChange={setD("nivel")} disabled={ocupado || programas === null}>
              <option value="">{programas === null ? "Cargando…" : niveles.length === 0 ? "No hay programas en el catálogo" : "Elegir…"}</option>
              {niveles.map(n => <option key={n.clave} value={n.clave}>{n.nombre}</option>)}
            </select>
          </Campo>
          <Campo label={nivelSel?.tipo === "posgrado" ? "Especialización / programa de posgrado" : "Programa"} requerido>
            <select className={campo} value={destino.programa} onChange={setD("programa")} disabled={ocupado || !destino.nivel}>
              <option value="">{!destino.nivel ? "Primero elige el nivel" : "Elegir…"}</option>
              {delNivel.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Título del documento" requerido>
            <input className={campo} placeholder="Ej. Acta de grado, Certificado de notas" value={destino.titulo} onChange={setD("titulo")} disabled={ocupado} />
          </Campo>
          <p className="text-xs text-[#6b7a8d]">
            El título sirve para encontrarlo en Consulta › Buscar.{modo === "masiva" ? " Se usa para todos los archivos de esta carga." : ""}
          </p>
        </section>

        {modo === "individual" ? (
          <>
            {/* 2. Estudiante */}
            <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">2 · Estudiante</h2>
              <Campo label="Apellidos" requerido>
                <input className={campo} autoCapitalize="characters" placeholder="Ej. GÓMEZ RIASCOS" value={estudiante.apellidos} onChange={setE("apellidos")} disabled={subiendo} />
              </Campo>
              <Campo label="Nombres" requerido>
                <input className={campo} autoCapitalize="characters" placeholder="Ej. ANA LUCÍA" value={estudiante.nombres} onChange={setE("nombres")} disabled={subiendo} />
              </Campo>
              <Campo label="Cédula" requerido>
                <input className={campo} inputMode="numeric" placeholder="Solo números" value={estudiante.cedula} onChange={setE("cedula")} disabled={subiendo} />
              </Campo>
              <p className="text-xs text-[#6b7a8d]">Si el estudiante ya tiene historia en ese programa, el documento se agrega a ella.</p>
            </section>

            {/* 3. Páginas */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">3 · Páginas del documento</h2>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => camara.current?.click()} disabled={subiendo}
                  className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl bg-[#1e3a5f] text-sm font-bold text-white active:opacity-80 disabled:opacity-60">
                  <Camera className="h-6 w-6" /> Tomar foto
                </button>
                <button type="button" onClick={() => galeria.current?.click()} disabled={subiendo}
                  className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-[#1e3a5f] text-sm font-bold text-[#1e3a5f] active:bg-[#f3ede1] disabled:opacity-60">
                  <ImagePlus className="h-6 w-6" /> Galería o PDF
                </button>
              </div>
              {/* capture="environment": abre la cámara trasera. Cada foto es una página. */}
              <input ref={camara} type="file" accept="image/*" capture="environment" className="sr-only"
                onChange={e => { agregarPaginas(e.target.files); e.target.value = ""; }} />
              <input ref={galeria} type="file" accept="image/*,application/pdf" multiple className="sr-only"
                onChange={e => { agregarPaginas(e.target.files); e.target.value = ""; }} />
              {paginas.length > 0 ? (
                <ol className="mt-3 divide-y divide-[rgba(30,58,95,0.09)] rounded-xl border border-[rgba(30,58,95,0.09)]">
                  {paginas.map((p, i) => (
                    <li key={`${p.name}-${p.size}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-[#1e3a5f]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">{p.type === "application/pdf" ? p.name : `Página ${i + 1}`}</span>
                      <span className="shrink-0 text-xs text-[#6b7a8d]">{tamano(p.size)}</span>
                      <button type="button" aria-label={`Quitar ${p.type === "application/pdf" ? p.name : `página ${i + 1}`}`}
                        onClick={() => setPaginas(ps => ps.filter((_, j) => j !== i))}
                        className="rounded-lg p-2 text-[#6b7a8d] active:bg-red-50 active:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-center text-sm text-[#6b7a8d]">Toma una foto por cada página. Se unen en un solo PDF.</p>
              )}
            </section>

            {aviso && <Aviso aviso={aviso} />}
            <button type="button" onClick={subirIndividual} disabled={subiendo}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e8740e] text-lg font-bold text-white shadow active:opacity-90 disabled:opacity-60">
              {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : aviso?.tipo === "red" ? <RefreshCw className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
              {subiendo ? "Subiendo…" : aviso?.tipo === "red" ? "Reintentar" : "Subir a la historia"}
            </button>
          </>
        ) : (
          <>
            {/* 2. Archivos */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">2 · Archivos</h2>
              <p className="mb-3 text-xs text-[#6b7a8d]">
                Un archivo por estudiante, nombrado <strong>APELLIDOS NOMBRES - cédula.pdf</strong> (también fotos). De ahí se toman el nombre y la cédula.
              </p>
              <button type="button" onClick={() => masivos.current?.click()} disabled={procesando}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1e3a5f] text-sm font-bold text-[#1e3a5f] active:bg-[#f3ede1] disabled:opacity-60">
                <FolderUp className="h-5 w-5" /> Elegir archivos
              </button>
              <input ref={masivos} type="file" accept="application/pdf,image/*" multiple className="sr-only"
                onChange={e => { agregarMasivos(e.target.files); e.target.value = ""; }} />

              {lote.length > 0 && (
                <>
                  <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#6b7a8d]">
                    <span>{lote.length} archivo{lote.length === 1 ? "" : "s"}</span>
                    {cuenta("ok") > 0 && <span className="text-emerald-700">{cuenta("ok")} subidos</span>}
                    {cuenta("duplicado") > 0 && <span className="text-amber-700">{cuenta("duplicado")} ya estaban</span>}
                    {cuenta("error") + cuenta("invalido") > 0 && <span className="text-red-700">{cuenta("error") + cuenta("invalido")} con problema</span>}
                  </p>
                  <ul className="mt-2 divide-y divide-[rgba(30,58,95,0.09)] rounded-xl border border-[rgba(30,58,95,0.09)]">
                    {lote.map(a => (
                      <li key={`${a.archivo.name}-${a.archivo.size}`} className="flex items-start gap-3 px-3 py-2.5">
                        {a.estado === "invalido" || a.estado === "error"
                          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          : a.estado === "subiendo" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-700" />
                          : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a5f]" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#2c3e50]">
                            {a.estudiante ? `${a.estudiante.apellidos} ${a.estudiante.nombres}` : a.archivo.name}
                          </span>
                          <span className="block truncate text-xs text-[#6b7a8d]">
                            {a.estudiante ? `C.C. ${a.estudiante.cedula} · ` : ""}{a.mensaje || tamano(a.archivo.size)}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${ESTILO_ARCHIVO[a.estado].clase}`}>
                          {ESTILO_ARCHIVO[a.estado].texto}
                        </span>
                        {!procesando && (a.estado === "listo" || a.estado === "invalido" || a.estado === "error") && (
                          <button type="button" aria-label={`Quitar ${a.archivo.name}`}
                            onClick={() => setLote(l => l.filter(x => x !== a))}
                            className="rounded-lg p-1.5 text-[#6b7a8d] active:bg-red-50 active:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!procesando && lote.every(a => a.estado === "ok" || a.estado === "duplicado" || a.estado === "invalido") && (
                    <button type="button" onClick={() => setLote([])} className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-[#1e3a5f] active:bg-[#f3ede1]">
                      Limpiar la lista para otra carga
                    </button>
                  )}
                </>
              )}
            </section>

            {aviso && <Aviso aviso={aviso} />}
            <button type="button" onClick={subirMasiva} disabled={procesando || pendientes.length === 0}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e8740e] text-lg font-bold text-white shadow active:opacity-90 disabled:opacity-60">
              {procesando ? <Loader2 className="h-5 w-5 animate-spin" /> : cuenta("error") > 0 ? <RefreshCw className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
              {procesando ? `Subiendo ${lote.filter(a => a.estado === "ok" || a.estado === "duplicado").length + 1} de ${lote.filter(a => a.estado !== "invalido").length}…`
                : cuenta("error") > 0 && cuenta("listo") === 0 ? `Reintentar ${cuenta("error")} con error`
                : `Subir ${pendientes.length} archivo${pendientes.length === 1 ? "" : "s"}`}
            </button>
          </>
        )}

        {/* Últimos subidos en esta sesión */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">Subidos desde este celular</h2>
          {subidos.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#6b7a8d]">Aún no se ha subido nada en esta sesión.</p>
          ) : (
            <ul className="divide-y divide-[rgba(30,58,95,0.09)]">
              {subidos.map(u => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <GraduationCap className="h-4 w-4 shrink-0 text-[#1e3a5f]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#2c3e50]">{u.estudiante}</span>
                    <span className="block truncate text-xs text-[#6b7a8d]">
                      {u.titulo} · {u.programa} · {u.cuando.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {u.nueva ? "Nueva" : "Agregado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-[#6b7a8d]">Para ver o buscar las historias, entra a Archivo Central › Historias académicas en la web.</p>
        </section>
      </main>
    </div>
  );
}
