/**
 * @file ClasificarDocumento.tsx
 * @description Archivo Central › Bandejas › Por clasificar › Clasificar un documento.
 * Visor del documento a la izquierda y datos a la derecha; la ruta "Quedará en" se arma sola.
 * Mismo estilo que Comunicaciones › Bandeja. "Clasificar" y "Solo guardar" llaman a
 * POST /api/documentos/{id}/clasificar (migración 21); al clasificar, el documento pasa a Clasificados y al Archivo.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClasificarDocumento, apiListAsuntos, type AsuntoCat } from "../../lib/documentosApi";
import { VisorDocumento, guardarArchivoDescargado, useArchivoDocumento } from "./VisorDocumento";
import { UbicacionCampos, type ValorUbicacion } from "./UbicacionFisica";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, FolderOpen, Loader2, ScanText } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";

export interface DocumentoPendiente {
  id: string;
  nombre: string;
  dependencia: string;
  anio: number;
  origen: string;
  fechaCarga: string;
  paginas: number;
  /** Id del archivo en el almacenamiento (GET /api/archivos/{id}) para el visor. */
  archivoId?: string;
  /** Para listar los asuntos reales de la dependencia. */
  dependenciaId?: number | null;
  /** Lo que ya se escribió al cargarlo (se muestra para completar). */
  previo?: {
    tipo?: string | null; consecutivo?: string | null; fecha?: string | null;
    carro?: string | null; estante?: string | null; bandeja?: string | null;
    caja?: string | null; carpeta?: string | null;
  };
}

/* ───────────────────── Opciones del formulario ───────────────────── */
/** Valor que se envía al backend → texto que se muestra. */
const TIPOS: [string, string][] = [["Entrada", "Entrada (recibida)"], ["Salida", "Salida (enviada)"], ["Interno", "Interno"]];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);

interface Datos {
  tipo: string; consecutivo: string; dia: string; mes: string; anio: string;
  /** Id del asunto como texto ("" = sin elegir). */
  asunto: string; remitente: string; recibio: string; ubicacion: ValorUbicacion;
}
const datosIniciales = (d: DocumentoPendiente): Datos => {
  const p = d.previo ?? {};
  const [, mes, dia] = (p.fecha ?? "").split("-");
  return {
    tipo: TIPOS.some(([v]) => v === p.tipo) ? p.tipo! : TIPOS[0][0],
    // El listado muestra "385/2024": aquí solo va el número.
    consecutivo: (p.consecutivo ?? "").replace(/\/\d{4}$/, ""),
    dia: dia ? String(Number(dia)) : "", mes: mes ? MESES[Number(mes) - 1] ?? "" : "", anio: String(d.anio),
    asunto: "", remitente: "", recibio: "",
    ubicacion: { carro: p.carro ?? "", estante: p.estante ?? "", bandeja: p.bandeja ?? "", caja: p.caja ?? "", carpeta: p.carpeta ?? "" },
  };
};

/** AAAA-MM-DD si día, mes y año forman una fecha real; "" si falta algo; null si es imposible (30 de febrero). */
function fechaDe(d: Datos): string | null {
  const mes = MESES.indexOf(d.mes) + 1;
  const dia = Number(d.dia);
  if (!d.dia.trim() && !d.mes) return "";
  if (!mes || !Number.isInteger(dia) || dia < 1) return null;
  const f = new Date(Number(d.anio), mes - 1, dia);
  if (f.getMonth() !== mes - 1 || f.getDate() !== dia) return null;
  return `${d.anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

function Campo({ label, requerido, className = "", children }: {
  label: string; requerido?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
        {label}{requerido && <span className="text-[#e8740e]"> *</span>}
      </span>
      {children}
    </label>
  );
}

/* ───────────────────── Visor del documento real ───────────────────── */
function Visor({ doc }: { doc: DocumentoPendiente }) {
  const archivo = useArchivoDocumento(doc.archivoId);
  const descargar = () => {
    if (!guardarArchivoDescargado(archivo, doc.nombre)) {
      toast.info(archivo.cargando ? "El documento todavía se está cargando" : "Este documento no tiene un archivo disponible");
    }
  };
  return <VisorDocumento titulo={doc.nombre} paginas={doc.paginas} archivo={archivo} onDescargar={descargar} />;
}

/* ───────────────────── Componente ───────────────────── */
export function ClasificarDocumento({ documentos, indiceInicial, onClasificado, onVolver }: {
  documentos: DocumentoPendiente[];
  indiceInicial: number;
  onClasificado: (id: string) => void;
  onVolver: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [borradores, setBorradores] = useState<Record<string, Datos>>({});
  const [guardando, setGuardando] = useState(false);
  const [asuntos, setAsuntos] = useState<AsuntoCat[] | null>(null);
  /** Ventana "Te falta…": lo que hay que completar para clasificar (null = cerrada). */
  const [ventana, setVentana] = useState<string[] | null>(null);

  const doc = documentos[indice];
  const dependenciaId = doc?.dependenciaId ?? null;

  // Asuntos reales de la dependencia del documento (cada uno con su código TRD).
  useEffect(() => {
    if (!dependenciaId) { setAsuntos([]); return; }
    let vigente = true;
    setAsuntos(null);
    apiListAsuntos(dependenciaId)
      .then(a => { if (vigente) setAsuntos(a); })
      .catch(() => { if (vigente) { setAsuntos([]); toast.error("No se pudieron cargar los asuntos de la dependencia"); } });
    return () => { vigente = false; };
  }, [dependenciaId]);

  if (!doc) return null;

  const datos = borradores[doc.id] ?? datosIniciales(doc);
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBorradores(b => ({ ...b, [doc.id]: { ...datos, [k]: e.target.value } }));

  const fecha = fechaDe(datos);
  const asuntoElegido = asuntos?.find(a => String(a.id) === datos.asunto);
  // Lo que exige el F-02 para clasificar (RF-AC-011); la base lo vuelve a revisar.
  const faltan = [
    !datos.tipo && "tipo",
    !datos.consecutivo.trim() && "consecutivo",
    !fecha && "fecha (día y mes)",
    !datos.asunto && "asunto",
    !datos.ubicacion.caja.trim() && "caja",
    !datos.ubicacion.carpeta.trim() && "carpeta",
  ].filter(Boolean) as string[];
  const completo = faltan.length === 0;
  // Lo mismo, dicho como tareas para la ventana "Te falta…".
  const pendientes = [
    !datos.tipo && "Elegir el tipo (Entrada, Salida o Interno).",
    !datos.consecutivo.trim() && "Escribir el consecutivo del documento.",
    fecha === null
      ? "Revisar la fecha: ese día no existe en el mes elegido."
      : !fecha && "Escribir el día y elegir el mes de la fecha del documento.",
    !datos.asunto && (asuntos && asuntos.length === 0
      ? `Elegir el asunto: ${doc.dependencia} todavía no tiene asuntos. Créalos en Catálogos › Asuntos.`
      : "Elegir el asunto (con su código TRD)."),
    !datos.ubicacion.caja.trim() && "Escribir la caja donde está guardado.",
    !datos.ubicacion.carpeta.trim() && "Escribir la carpeta donde está guardado.",
  ].filter(Boolean) as string[];

  const enviar = (clasificar: boolean) => apiClasificarDocumento(Number(doc.id), {
    tipo: datos.tipo,
    consecutivo: datos.consecutivo.trim(),
    anio: Number(datos.anio),
    // Fecha imposible: no se envía (el campo queda marcado en pantalla).
    ...(fecha !== null ? { fecha: fecha || null } : {}),
    asunto_id: datos.asunto ? Number(datos.asunto) : null,
    remitente: datos.remitente.trim(),
    destinatario: datos.recibio.trim(),
    carro: datos.ubicacion.carro.trim(),
    estante: datos.ubicacion.estante.trim(),
    bandeja: datos.ubicacion.bandeja.trim(),
    caja: datos.ubicacion.caja.trim(),
    carpeta: datos.ubicacion.carpeta.trim(),
  }, clasificar);

  /** El documento salió de Por clasificar: se quita de la lista y se pasa al siguiente. */
  const salioDeLaBandeja = (mensaje: string) => {
    onClasificado(doc.id);
    setBorradores(b => { const n = { ...b }; delete n[doc.id]; return n; });
    const quedan = documentos.length - 1;
    if (quedan === 0) {
      toast.success(mensaje, { description: "No quedan documentos por clasificar" });
      onVolver();
    } else {
      toast.success(mensaje);
      setIndice(i => Math.min(i, quedan - 1));
    }
  };

  const guardar = async () => {
    if (fecha === null) return toast.error("La fecha no existe: revisa el día y el mes");
    setGuardando(true);
    try {
      const r = await enviar(false);
      // La base clasifica sola cuando el documento ya tiene asunto y fecha.
      if (r.estado === "clasificado") salioDeLaBandeja(`${doc.nombre} quedó clasificado (ya tenía asunto y fecha)`);
      else toast.success("Datos guardados", { description: "El documento sigue en Por clasificar." });
    } catch (e) {
      toast.error("No se pudieron guardar los datos", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setGuardando(false);
    }
  };

  const clasificar = async () => {
    if (!completo) return setVentana(pendientes);
    setGuardando(true);
    try {
      await enviar(true);
      salioDeLaBandeja(`${doc.nombre} clasificado`);
    } catch (e) {
      // Lo que rechaza el backend también se explica en la ventana.
      setVentana([e instanceof Error ? e.message : "No se pudo clasificar el documento."]);
    } finally {
      setGuardando(false);
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
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a por clasificar
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Clasificar · {doc.dependencia}</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <FileText className="h-6 w-6 text-[#e8740e]" />
          {doc.nombre}
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">
          Lee el documento y completa tipo, consecutivo, fecha, asunto y ubicación física. La ruta se arma sola.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Visor key={doc.id} doc={doc} />

        <div className="space-y-4">
          {/* ── Navegación entre pendientes ─────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-[rgba(30,58,95,0.09)] pb-3">
            <button
              aria-label="Documento anterior" disabled={indice === 0} onClick={() => setIndice(i => i - 1)}
              className="rounded-lg border border-[rgba(30,58,95,0.15)] bg-white p-2 text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-0 flex-1 text-sm text-[#6b7a8d]">
              Pendiente <strong className="text-[#2c3e50]">{indice + 1} de {documentos.length}</strong> · {doc.origen.replace("Transferencia ", "")}
            </p>
            <button
              aria-label="Documento siguiente" disabled={indice >= documentos.length - 1} onClick={() => setIndice(i => i + 1)}
              className="rounded-lg border border-[rgba(30,58,95,0.15)] bg-white p-2 text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* ── Datos ───────────────────────────────────────────────────── */}
          <section className={`${panel} p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Datos del documento</p>
              <button
                type="button"
                onClick={() => toast.info("La lectura automática del documento aún no está conectada")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
              >
                <ScanText className="h-3.5 w-3.5" /> Tomar del documento
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Tipo" requerido>
                <select className={campo} value={datos.tipo} onChange={set("tipo")}>
                  {TIPOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>
              </Campo>
              <Campo label="Consecutivo" requerido>
                <input className={campo} placeholder="Ej. 385" value={datos.consecutivo} onChange={set("consecutivo")} />
              </Campo>
              <Campo label="Día" requerido>
                <input inputMode="numeric" className={`${campo} ${fecha === null ? "border-red-400" : ""}`} placeholder="Ej. 29" value={datos.dia} onChange={set("dia")} />
              </Campo>
              <Campo label="Mes" requerido>
                <select className={campo} value={datos.mes} onChange={set("mes")}>
                  <option value="">Elegir…</option>
                  {MESES.map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo label="Año" requerido>
                <select className={campo} value={datos.anio} onChange={set("anio")}>
                  {ANIOS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Campo>
              <Campo label={`Asunto (${doc.dependencia})`} requerido>
                <select className={campo} value={datos.asunto} onChange={set("asunto")} disabled={asuntos === null}>
                  <option value="">
                    {asuntos === null ? "Cargando asuntos…" : asuntos.length === 0 ? "La dependencia no tiene asuntos" : "Elegir…"}
                  </option>
                  {(asuntos ?? []).map(a => (
                    <option key={a.id} value={a.id}>{a.trd_codigo ? `${a.trd_codigo} · ` : ""}{a.nombre}</option>
                  ))}
                </select>
              </Campo>
              {fecha === null && (
                <p className="text-xs font-semibold text-red-600 sm:col-span-2">Esa fecha no existe: revisa el día y el mes.</p>
              )}
              <Campo label="Remitente" className="sm:col-span-2">
                <input className={campo} placeholder="Persona o entidad" value={datos.remitente} onChange={set("remitente")} />
              </Campo>
              <Campo label="Quién recibió" className="sm:col-span-2">
                <input className={campo} placeholder="Funcionario" value={datos.recibio} onChange={set("recibio")} />
              </Campo>
              <UbicacionCampos
                requeridos={["caja", "carpeta"]}
                valor={datos.ubicacion}
                onChange={ubicacion => setBorradores(b => ({ ...b, [doc.id]: { ...datos, ubicacion } }))}
              />
            </div>
          </section>

          {/* ── Quedará en ──────────────────────────────────────────────── */}
          <section className="rounded-xl border border-[#1e3a5f]/20 bg-[#f3ede1]/60 p-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Quedará en</p>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#1e3a5f]">
              <FolderOpen className="h-4 w-4 shrink-0 text-[#e8740e]" />
              <span>{doc.dependencia}</span>
              <span className="text-[#6b7a8d]">/</span>
              <span className={datos.anio ? "" : "font-normal text-[#6b7a8d]"}>{datos.anio || "Año"}</span>
              <span className="text-[#6b7a8d]">/</span>
              <span className={asuntoElegido ? "" : "font-normal text-[#6b7a8d]"}>
                {asuntoElegido ? `${asuntoElegido.nombre}${asuntoElegido.trd_codigo ? ` · TRD ${asuntoElegido.trd_codigo}` : ""}` : "Asunto"}
              </span>
            </p>
            {!completo && <p className="mt-1.5 text-xs text-[#6b7a8d]">Para clasificar falta: {faltan.join(", ")}.</p>}
          </section>

          {/* ── Acciones ────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            <button
              disabled={guardando} onClick={clasificar}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Clasificar y siguiente
            </button>
            <button
              onClick={guardar} disabled={guardando}
              className="inline-flex h-10 items-center rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-40"
            >
              Solo guardar
            </button>
          </div>
        </div>
      </div>

      {/* ── Ventana "Te falta…" ─────────────────────────────────────────── */}
      <Dialog open={ventana !== null} onOpenChange={o => { if (!o) setVentana(null); }}>
        <DialogContent className="max-w-md border border-[rgba(30,58,95,0.12)] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <AlertCircle className="h-5 w-5 text-[#e8740e]" /> Aún no se puede clasificar
            </DialogTitle>
            <DialogDescription className="text-[#6b7a8d]">
              Para clasificar «{doc.nombre}» te falta:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {(ventana ?? []).map(p => (
              <li key={p} className="flex gap-2 rounded-lg bg-[#f3ede1]/60 px-3 py-2 text-sm text-[#2c3e50]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e8740e]" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              type="button" onClick={() => setVentana(null)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}