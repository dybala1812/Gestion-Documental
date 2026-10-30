/**
 * @file AppMovil.tsx
 * @description App del celular (PWA) para escanear y cargar documentos físicos (carga F, RF-AC-022).
 * Ruta /movil, fuera del Layout de NOVA (pantalla completa en el celular).
 *  - Sesión: por ahora el login temporal de pruebas (/login-temporal?redirect=/movil); después, el de NOVA.
 *  - Igual que Centro de cargas › Documento individual: fotos de las páginas (se unen en un PDF) + datos.
 *  - Sin vistas previas ni búsquedas: solo los últimos 10 documentos cargados desde la app.
 *    Ver, buscar y clasificar se hace en la web.
 *  - Si se pierde la conexión, avisa y deja reintentar sin perder lo escrito.
 */
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle, Camera, CheckCircle2, FileText, ImagePlus, Loader2, LogOut, RefreshCw, Trash2, UploadCloud, WifiOff,
} from "lucide-react";
import { tokens } from "../../../lib/api";
import { LOGIN_TEMPORAL } from "../../../lib/config";
import { borrarSesionTemporal, leerSesionTemporal } from "../../../lib/loginTemporal"; // ⚠️ TEMPORAL
import { apiListDependenciasCom, type DependenciaCom } from "../../../lib/comunicacionesApi";
import { apiCrearDocumento, apiListAsuntos, apiUltimosMovil, type AsuntoCat } from "../../../lib/documentosApi";
import type { Clasificado } from "../../../lib/clasificadosApi";
import { usePwaMovil } from "./pwa";

const TIPOS = ["Entrada", "Salida", "Interno"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);
const MAX_MB = 50;
/** Lado mayor de cada foto en el PDF (suficiente para leer un documento y liviano para subir por datos). */
const LADO_MAX = 1800;

interface Datos {
  titulo: string; dependencia: string; anio: string; asunto: string; tipo: string;
  consecutivo: string; fecha: string; caja: string; carpeta: string;
}
const DATOS_INICIALES: Datos = {
  titulo: "", dependencia: "", anio: String(ANIO_ACTUAL), asunto: "", tipo: "Entrada",
  consecutivo: "", fecha: "", caja: "", carpeta: "",
};

const campo =
  "h-12 w-full rounded-xl border border-[rgba(30,58,95,0.15)] bg-white px-3 text-base text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

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

const haySesion = () => !!(leerSesionTemporal() ?? tokens.getAccess());
const tamano = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

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
async function armarPdf(paginas: File[], titulo: string): Promise<File> {
  const nombre = `${titulo.trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120) || "documento"}.pdf`;
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

export default function AppMovil() {
  usePwaMovil();
  const sesion = leerSesionTemporal();
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  const [paginas, setPaginas] = useState<File[]>([]);
  const [dependencias, setDependencias] = useState<DependenciaCom[]>([]);
  const [asuntos, setAsuntos] = useState<AsuntoCat[]>([]);
  const [ultimos, setUltimos] = useState<Clasificado[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [sinRed, setSinRed] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error" | "red"; texto: string } | null>(null);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  // Sin sesión → al login (por ahora el temporal de pruebas; después el de NOVA) y de vuelta aquí.
  useEffect(() => {
    if (!haySesion()) window.location.replace(LOGIN_TEMPORAL ? "/login-temporal?redirect=/movil" : "/login?redirect=/movil");
  }, []);

  useEffect(() => {
    const on = () => setSinRed(false), off = () => setSinRed(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const cargarUltimos = () => apiUltimosMovil().then(setUltimos).catch(() => setUltimos([]));
  useEffect(() => {
    if (!haySesion()) return;
    apiListDependenciasCom().then(setDependencias).catch(() => setAviso({ tipo: "red", texto: "No se pudieron cargar las dependencias. Revisa la conexión." }));
    cargarUltimos();
  }, []);

  useEffect(() => {
    if (!datos.dependencia) { setAsuntos([]); return; }
    apiListAsuntos(Number(datos.dependencia)).then(setAsuntos).catch(() => setAsuntos([]));
  }, [datos.dependencia]);

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos(d => ({ ...d, [k]: e.target.value, ...(k === "dependencia" ? { asunto: "" } : {}) }));

  const agregar = (lista: FileList | null) => {
    if (!lista) return;
    const recibidos = Array.from(lista); // se copia ya: el FileList se vacía al limpiar el input
    const malos = recibidos.filter(f => !/^image\//.test(f.type) && f.type !== "application/pdf" || f.size > MAX_MB * 1024 * 1024);
    const buenos = recibidos.filter(f => !malos.includes(f));
    const conPdf = [...paginas, ...buenos].some(f => f.type === "application/pdf");
    if (conPdf && paginas.length + buenos.length > 1) {
      setAviso({ tipo: "error", texto: "Un PDF va solo: no se mezcla con fotos ni con otro PDF." });
      return;
    }
    if (malos.length) setAviso({ tipo: "error", texto: `${malos.length} archivo(s) no se agregaron: usa fotos o un PDF de hasta ${MAX_MB} MB.` });
    else setAviso(null);
    setPaginas(p => [...p, ...buenos]);
  };

  const faltan = [
    paginas.length === 0 && "las páginas (toma al menos una foto)",
    !datos.titulo.trim() && "el título",
    !datos.dependencia && "la dependencia",
  ].filter(Boolean) as string[];

  const subir = async () => {
    if (faltan.length) return setAviso({ tipo: "error", texto: `Falta ${faltan.join(", ")}.` });
    setSubiendo(true);
    setAviso(null);
    try {
      const pdf = await armarPdf(paginas, datos.titulo);
      const doc = await apiCrearDocumento(pdf, {
        dependencia_id: Number(datos.dependencia),
        anio: Number(datos.anio),
        asunto_id: datos.asunto ? Number(datos.asunto) : undefined,
        tipo: datos.tipo,
        consecutivo: datos.consecutivo.trim() || undefined,
        fecha: datos.fecha || undefined,
        caja: datos.caja.trim() || undefined,
        carpeta: datos.carpeta.trim() || undefined,
        origen: "app_movil",
      });
      setAviso({
        tipo: "ok",
        texto: `«${datos.titulo.trim()}» subido (${paginas.length} página${paginas.length === 1 ? "" : "s"}). ${
          doc.estado === "clasificado" ? "Quedó clasificado." : "Quedó por clasificar: complétalo en la web."}`,
      });
      // Se conservan dependencia, año, tipo, caja y carpeta: suelen repetirse en el siguiente documento.
      setDatos(d => ({ ...d, titulo: "", consecutivo: "", fecha: "", asunto: "" }));
      setPaginas([]);
      cargarUltimos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof TypeError || !navigator.onLine || /failed to fetch|network/i.test(msg)) {
        setAviso({ tipo: "red", texto: "Sin conexión con el servidor. Revisa la red y pulsa Reintentar: los datos no se pierden." });
      } else {
        setAviso({ tipo: "error", texto: /duplicad|ya fue cargado/i.test(msg) ? "Ese documento ya estaba cargado (mismo archivo)." : msg });
      }
    } finally {
      setSubiendo(false);
    }
  };

  const salir = () => { borrarSesionTemporal(); window.location.assign(LOGIN_TEMPORAL ? "/login-temporal?redirect=/movil" : "/login?redirect=/movil"); };

  if (!haySesion()) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3ede1] text-[#1e3a5f]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const nombreUsuario = sesion ? `${sesion.usuario.nombre} ${sesion.usuario.apellido}`.trim() : "";

  return (
    <div className="min-h-screen bg-[#f3ede1] pb-10">
      {/* Encabezado */}
      <header className="sticky top-0 z-10 bg-[#1e3a5f] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f5b971]">Archivo Central</p>
            <h1 className="text-lg font-bold leading-tight">Escanear y cargar</h1>
            {nombreUsuario && <p className="truncate text-xs text-white/75">{nombreUsuario}</p>}
          </div>
          <button type="button" onClick={salir} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {sinRed && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión. Puedes seguir llenando; sube cuando vuelva la red.
          </p>
        )}

        {/* 1. Páginas */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">1 · Páginas del documento</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={() => camara.current?.click()}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl bg-[#1e3a5f] text-sm font-bold text-white active:opacity-80"
            >
              <Camera className="h-6 w-6" /> Tomar foto
            </button>
            <button
              type="button" onClick={() => galeria.current?.click()}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-[#1e3a5f] text-sm font-bold text-[#1e3a5f] active:bg-[#f3ede1]"
            >
              <ImagePlus className="h-6 w-6" /> Galería o PDF
            </button>
          </div>
          {/* capture="environment": abre la cámara trasera. Cada foto es una página. */}
          <input ref={camara} type="file" accept="image/*" capture="environment" className="sr-only"
            onChange={e => { agregar(e.target.files); e.target.value = ""; }} />
          <input ref={galeria} type="file" accept="image/*,application/pdf" multiple className="sr-only"
            onChange={e => { agregar(e.target.files); e.target.value = ""; }} />

          {paginas.length > 0 ? (
            <ol className="mt-3 divide-y divide-[rgba(30,58,95,0.09)] rounded-xl border border-[rgba(30,58,95,0.09)]">
              {paginas.map((p, i) => (
                <li key={`${p.name}-${p.size}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[#1e3a5f]" />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">
                    {p.type === "application/pdf" ? p.name : `Página ${i + 1}`}
                  </span>
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

        {/* 2. Datos */}
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">2 · Datos</h2>
          <Campo label="Título" requerido>
            <input className={campo} placeholder="Ej. Oficio de Rectoría" value={datos.titulo} onChange={set("titulo")} />
          </Campo>
          <Campo label="Dependencia" requerido>
            <select className={campo} value={datos.dependencia} onChange={set("dependencia")}>
              <option value="">Elegir…</option>
              {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Año" requerido>
              <select className={campo} value={datos.anio} onChange={set("anio")}>
                {ANIOS.map(a => <option key={a}>{a}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo">
              <select className={campo} value={datos.tipo} onChange={set("tipo")}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Asunto">
            <select className={campo} value={datos.asunto} onChange={set("asunto")} disabled={!datos.dependencia}>
              <option value="">Sin asunto · por clasificar</option>
              {asuntos.map(a => <option key={a.id} value={a.id}>{a.trd_codigo ? `${a.trd_codigo} · ` : ""}{a.nombre}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Consecutivo">
              <input className={campo} inputMode="numeric" placeholder="Ej. 385" value={datos.consecutivo} onChange={set("consecutivo")} />
            </Campo>
            <Campo label="Fecha">
              <input type="date" className={campo} value={datos.fecha} onChange={set("fecha")} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Caja">
              <input className={campo} placeholder="Ej. 12" value={datos.caja} onChange={set("caja")} />
            </Campo>
            <Campo label="Carpeta">
              <input className={campo} placeholder="Ej. 3" value={datos.carpeta} onChange={set("carpeta")} />
            </Campo>
          </div>
          <p className="text-xs text-[#6b7a8d]">Si faltan asunto, consecutivo o fecha, el documento se sube igual y queda por clasificar.</p>
        </section>

        {aviso && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : aviso.tipo === "red" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            {aviso.tipo === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : aviso.tipo === "red" ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        <button
          type="button" onClick={subir} disabled={subiendo}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e8740e] text-lg font-bold text-white shadow active:opacity-90 disabled:opacity-60"
        >
          {subiendo ? <Loader2 className="h-5 w-5 animate-spin" />
            : aviso?.tipo === "red" ? <RefreshCw className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
          {subiendo ? "Subiendo…" : aviso?.tipo === "red" ? "Reintentar" : "Subir"}
        </button>

        {/* 3. Últimos 10 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#6b7a8d]">Últimos cargados desde la app</h2>
            <button type="button" onClick={cargarUltimos} aria-label="Actualizar" className="rounded-lg p-2 text-[#1e3a5f] active:bg-[#f3ede1]">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {ultimos === null ? (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
          ) : ultimos.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#6b7a8d]">Aún no se ha cargado nada desde la app.</p>
          ) : (
            <ul className="divide-y divide-[rgba(30,58,95,0.09)]">
              {ultimos.map(u => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[#1e3a5f]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#2c3e50]">{u.titulo}</span>
                    <span className="block truncate text-xs text-[#6b7a8d]">{u.dependencia} · {u.anio} · {fechaCorta(u.cargado_en)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    u.estado === "clasificado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {u.estado === "clasificado" ? "Clasificado" : "Por clasificar"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-[#6b7a8d]">Para ver, buscar o clasificar los documentos, entra a Archivo Central en la web.</p>
        </section>
      </main>
    </div>
  );
}
