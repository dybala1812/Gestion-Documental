/**
 * @file NuevaCargaDocumento.tsx
 * @description Carga A · Documento individual (Archivo Central › Ingreso › Centro de cargas › Nueva carga).
 * Asistente de 4 pasos: Destino y datos → Archivos → Vista previa → Confirmar.
 * Mismo estilo que Comunicaciones › Bandeja. Por ahora no llama al backend (ver TODO en `crearLote`).
 */
import { useEffect, useState } from "react";
import { alertaCarga, motivoError, plural } from "../../lib/alertasCarga";
import { apiListDependenciasCom, type DependenciaCom } from "../../lib/comunicacionesApi";
import { apiCrearDocumento, apiListAsuntos, type AsuntoCat } from "../../lib/documentosApi";
import { textoUbicacion, UBICACION_VACIA, UbicacionCampos, type ValorUbicacion } from "./UbicacionFisica";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileInput, FileText,
  Info, Loader2, UploadCloud, X, XCircle,
} from "lucide-react";

/* ───────────────────────── Datos de ejemplo (luego, catálogos de la API) ───────────────────────── */
const TIPOS = ["Entrada", "Salida", "Interno"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);

const FORMATOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
const MAX_MB = 50;

const PASOS = [
  { titulo: "Destino y datos", detalle: "Dependencia, año, asunto" },
  { titulo: "Archivos", detalle: "PDF o imagen" },
  { titulo: "Vista previa", detalle: "Verde, amarillo, rojo" },
  { titulo: "Confirmar", detalle: "Crear el lote" },
];

interface Datos {
  dependencia: string; anio: string; asunto: string; tipo: string;
  consecutivo: string; fecha: string; ubicacion: ValorUbicacion;
}
const DATOS_INICIALES: Datos = {
  dependencia: "", anio: String(ANIO_ACTUAL), asunto: "", tipo: "Entrada",
  consecutivo: "", fecha: "", ubicacion: UBICACION_VACIA,
};

type Nivel = "verde" | "amarillo" | "rojo";
interface Resultado { archivo: File; nivel: Nivel; mensaje: string }

const ESTILO_NIVEL: Record<Nivel, { caja: string; icono: React.ElementType; titulo: string }> = {
  verde: { caja: "bg-emerald-50 border-emerald-200 text-emerald-700", icono: CheckCircle2, titulo: "Listo" },
  amarillo: { caja: "bg-amber-50 border-amber-200 text-amber-700", icono: AlertTriangle, titulo: "Por clasificar" },
  rojo: { caja: "bg-red-50 border-red-200 text-red-700", icono: XCircle, titulo: "Rechazado" },
};

function tamano(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Semáforo de la vista previa. La huella SHA-256 y los duplicados los valida el backend al crear el lote. */
function evaluar(archivo: File, d: Datos): Resultado {
  if (!FORMATOS_OK.includes(archivo.type))
    return { archivo, nivel: "rojo", mensaje: "Formato no permitido. Usa PDF o imagen (JPG, PNG, TIFF)." };
  if (archivo.size === 0)
    return { archivo, nivel: "rojo", mensaje: "El archivo está vacío o dañado." };
  if (archivo.size > MAX_MB * 1024 * 1024)
    return { archivo, nivel: "rojo", mensaje: `Supera el tamaño máximo de ${MAX_MB} MB.` };
  const faltan = [!d.asunto && "asunto", !d.consecutivo && "consecutivo", !d.fecha && "fecha"].filter(Boolean);
  if (faltan.length)
    return { archivo, nivel: "amarillo", mensaje: `Falta ${faltan.join(", ")}: quedará por clasificar.` };
  return { archivo, nivel: "verde", mensaje: "Listo para cargar." };
}

/* ───────────────────────── Piezas de formulario ───────────────────────── */
const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
        {label}{requerido && <span className="text-[#e8740e]"> *</span>}
      </span>
      {children}
    </label>
  );
}

const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

/* ───────────────────────── Componente ───────────────────────── */
export function NuevaCargaDocumento({ onVolver }: { onVolver: () => void }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [dependencias, setDependencias] = useState<DependenciaCom[]>([]);
  const [asuntos, setAsuntos] = useState<AsuntoCat[]>([]);

  useEffect(() => {
    apiListDependenciasCom().then(setDependencias).catch(e => alertaCarga.error("No se pudieron cargar las dependencias", motivoError(e, "Revisa la conexión con el servidor e intenta de nuevo.")));
  }, []);

  // Al cambiar la dependencia se cargan sus asuntos y se limpia el asunto elegido.
  useEffect(() => {
    setAsuntos([]);
    setDatos(d => (d.asunto ? { ...d, asunto: "" } : d));
    if (!datos.dependencia) return;
    let cancelado = false;
    apiListAsuntos(Number(datos.dependencia))
      .then(a => { if (!cancelado) setAsuntos(a); })
      .catch(e => alertaCarga.error("No se pudieron cargar los asuntos", motivoError(e, "Revisa la conexión con el servidor e intenta de nuevo.")));
    return () => { cancelado = true; };
  }, [datos.dependencia]);

  const nombreDependencia = dependencias.find(d => String(d.id) === datos.dependencia)?.nombre ?? "";
  const nombreAsunto = asuntos.find(a => String(a.id) === datos.asunto)?.nombre ?? "";

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos(d => ({ ...d, [k]: e.target.value }));

  const agregar = (lista: FileList | null) => {
    if (!lista) return;
    // Se copia a un arreglo AHORA: la lista del input se vacía al limpiar su valor y la de arrastrar
    // deja de ser válida al terminar el evento; el updater de setState corre más tarde.
    const recibidos = Array.from(lista);
    setArchivos(prev => [...prev, ...recibidos.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]);
  };

  const resultados = archivos.map(f => evaluar(f, datos));
  const cuenta = (n: Nivel) => resultados.filter(r => r.nivel === n).length;
  const aceptados = cuenta("verde") + cuenta("amarillo");

  const puedeContinuar =
    (paso === 1 && !!datos.dependencia && !!datos.anio && !!datos.tipo) ||
    (paso === 2 && archivos.length > 0) ||
    (paso === 3 && aceptados > 0);

  const subtitulo: Record<number, string> = {
    1: "destino y datos", 2: "archivos", 3: "vista previa", 4: "confirmar",
  };

  const crearLote = async () => {
    setCreando(true);
    let guardados = 0;
    let duplicados = 0;
    const fallos: string[] = [];
    const porSubir = resultados.filter(r => r.nivel !== "rojo").length;
    alertaCarga.procesando(
      `Cargando ${plural(porSubir, "documento", "documentos")}…`,
      "No cierres esta ventana hasta que termine.",
    );
    try {
      for (const r of resultados) {
        if (r.nivel === "rojo") continue;
        try {
          await apiCrearDocumento(r.archivo, {
            dependencia_id: Number(datos.dependencia),
            anio: Number(datos.anio),
            asunto_id: datos.asunto ? Number(datos.asunto) : undefined,
            tipo: datos.tipo,
            consecutivo: datos.consecutivo.trim() || undefined,
            fecha: datos.fecha || undefined,
            carro: datos.ubicacion.carro.trim() || undefined,
            estante: datos.ubicacion.estante.trim() || undefined,
            bandeja: datos.ubicacion.bandeja.trim() || undefined,
            caja: datos.ubicacion.caja.trim() || undefined,
            carpeta: datos.ubicacion.carpeta.trim() || undefined,
          });
          guardados++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error desconocido";
          if (/duplicad|ya fue cargado/i.test(msg)) duplicados++;
          else fallos.push(`${r.archivo.name}: ${msg}`);
        }
      }
      // Sileo muestra una alerta a la vez (la nueva reemplaza a la anterior): se avisa UNA sola vez, con todo el resumen.
      const resumen = [
        guardados ? plural(guardados, "cargado", "cargados") : "",
        duplicados ? plural(duplicados, "duplicado (ya estaba cargado)", "duplicados (ya estaban cargados)") : "",
        fallos.length ? plural(fallos.length, "con error", "con error") : "",
      ].filter(Boolean).join(" · ");
      const primerFallo = fallos[0] ? `${fallos[0]}${fallos.length > 1 ? ` (y ${fallos.length - 1} más)` : ""}` : "";
      if (guardados === 0 && fallos.length > 0) {
        alertaCarga.error(fallos.length === 1 ? "No se pudo cargar el documento" : "No se pudieron cargar los documentos", primerFallo);
      } else if (fallos.length > 0) {
        alertaCarga.aviso(`Carga terminada con problemas: ${resumen}`, primerFallo);
      } else if (duplicados > 0) {
        alertaCarga.aviso(
          guardados > 0 ? `Carga terminada: ${resumen}` : duplicados === 1 ? "El documento ya estaba cargado" : "Los documentos ya estaban cargados",
          guardados > 0 ? "Los duplicados no se guardaron de nuevo." : "No se guardó nada nuevo: el mismo archivo ya existe en este expediente.");
      } else {
        alertaCarga.ok(plural(guardados, "documento cargado", "documentos cargados"), `En ${nombreDependencia}${nombreAsunto ? ` · ${nombreAsunto}` : ""}.`);
      }
      if (fallos.length === 0) onVolver();
    } catch (e) {
      alertaCarga.error("La carga se interrumpió", motivoError(e));
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm transition-colors hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al Centro de cargas
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Centro de cargas · Carga A</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <FileInput className="h-6 w-6 text-[#e8740e]" />
          Documento individual
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">Paso {paso} de 4: {subtitulo[paso]}.</p>
      </div>

      {/* ── Pasos ───────────────────────────────────────────────────────── */}
      <ol className={`${panel} grid grid-cols-2 overflow-hidden lg:grid-cols-4`}>
        {PASOS.map((p, i) => {
          const n = i + 1;
          const activo = paso === n;
          const hecho = paso > n;
          return (
            <li key={p.titulo} className={`border-b-[3px] ${activo ? "border-[#e8740e]" : "border-transparent"}`}>
              <button
                type="button"
                disabled={!hecho}
                onClick={() => setPaso(n)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  activo ? "bg-[#1e3a5f] text-white" : hecho ? "bg-emerald-100 text-emerald-700" : "bg-[#ede6d8] text-[#6b7a8d]"
                }`}>
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

      {/* ── Contenido del paso ──────────────────────────────────────────── */}
      <section className={`${panel} p-5`}>
        {paso === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Dependencia" requerido>
                <select className={campo} value={datos.dependencia} onChange={set("dependencia")}>
                  <option value="">Selecciona…</option>
                  {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Año" requerido>
                <select className={campo} value={datos.anio} onChange={set("anio")}>
                  {ANIOS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Campo>
              <Campo label="Asunto">
                <select className={campo} value={datos.asunto} onChange={set("asunto")} disabled={!datos.dependencia}>
                  <option value="">Sin asunto · por clasificar</option>
                  {asuntos.map(a => <option key={a.id} value={a.id}>{a.trd_codigo ? `${a.trd_codigo} · ` : ""}{a.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Tipo" requerido>
                <select className={campo} value={datos.tipo} onChange={set("tipo")}>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label="Consecutivo">
                <input className={campo} placeholder="Ej. 1187" value={datos.consecutivo} onChange={set("consecutivo")} />
              </Campo>
              <Campo label="Fecha">
                <input type="date" className={campo} value={datos.fecha} onChange={set("fecha")} />
              </Campo>
              <UbicacionCampos
                valor={datos.ubicacion}
                onChange={ubicacion => setDatos(d => ({ ...d, ubicacion }))}
              />
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Si faltan asunto, consecutivo o fecha, el documento se carga igual y queda por clasificar.
            </p>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <label
              onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                arrastrando ? "border-[#e8740e] bg-[#f3ede1]" : "border-[rgba(30,58,95,0.2)] hover:bg-[#f3ede1]/60"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-[#1e3a5f]" />
              <span className="text-sm font-bold text-[#1e3a5f]">Arrastra los archivos aquí o haz clic para elegirlos</span>
              <span className="text-xs text-[#6b7a8d]">PDF, JPG, PNG o TIFF · hasta {MAX_MB} MB cada uno</span>
              <input
                type="file" multiple className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/*"
                onChange={e => { agregar(e.target.files); e.target.value = ""; }}
              />
            </label>
            {archivos.length > 0 && (
              <ul className="divide-y divide-[rgba(30,58,95,0.09)] rounded-xl border border-[rgba(30,58,95,0.09)]">
                {archivos.map(f => (
                  <li key={f.name + f.size} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-[#6b7a8d]" />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">{f.name}</span>
                    <span className="text-xs text-[#6b7a8d]">{tamano(f.size)}</span>
                    <button
                      aria-label={`Quitar ${f.name}`}
                      onClick={() => setArchivos(prev => prev.filter(x => x !== f))}
                      className="rounded-md p-1 text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">{cuenta("verde")} listos</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">{cuenta("amarillo")} por clasificar</span>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">{cuenta("rojo")} rechazados</span>
            </div>
            <ul className="space-y-2">
              {resultados.map(({ archivo, nivel, mensaje }) => {
                const e = ESTILO_NIVEL[nivel];
                const Icono = e.icono;
                return (
                  <li key={archivo.name + archivo.size} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${e.caja}`}>
                    <Icono className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{archivo.name}</p>
                      <p className="text-xs">{e.titulo}: {mensaje}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-[#6b7a8d]">Los duplicados se detectan por huella SHA-256 al crear el lote.</p>
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
              {([
                ["Dependencia", nombreDependencia], ["Año", datos.anio],
                ["Asunto", nombreAsunto || "Sin asunto · por clasificar"], ["Tipo", datos.tipo],
                ["Consecutivo", datos.consecutivo || "—"], ["Fecha", datos.fecha || "—"],
                ["Ubicación física", textoUbicacion(datos.ubicacion)],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-[#6b7a8d]">{k}</dt>
                  <dd className="font-medium text-[#2c3e50]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/60 px-4 py-3 text-sm text-[#2c3e50]">
              Se cargarán <strong>{aceptados}</strong> documento(s)
              {cuenta("amarillo") > 0 && <> ({cuenta("amarillo")} quedarán por clasificar)</>}
              {cuenta("rojo") > 0 && <> y se omitirán <strong>{cuenta("rojo")}</strong> rechazado(s)</>}.
            </p>
          </div>
        )}
      </section>

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-[rgba(30,58,95,0.09)] pt-4">
        <div className="flex gap-2">
          {paso > 1 && (
            <button
              onClick={() => setPaso(p => p - 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
            >
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          )}
          {paso < 4 ? (
            <button
              disabled={!puedeContinuar}
              onClick={() => setPaso(p => p + 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={creando || aceptados === 0}
              onClick={crearLote}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creando && <Loader2 className="h-4 w-4 animate-spin" />} Crear lote
            </button>
          )}
        </div>
        <button
          onClick={onVolver}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          <X className="h-4 w-4" /> Cancelar carga
        </button>
      </div>
    </div>
  );
}