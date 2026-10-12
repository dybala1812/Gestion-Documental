/**
 * @file DetalleComunicacion.tsx
 * @description Vista de detalle de una comunicación a pantalla completa (mockup
 * "Bandeja › detalle"): encabezado con acciones, línea de pasos con fechas, correo
 * original, visor de adjuntos, datos e historial. Acciones según el estado:
 * Remitir, Devolver, Enviar respuesta y Anular (RF-AC-016, RF-AC-017, RF-AC-024).
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Ban, Bell, Check, ChevronRight, Clock, CornerUpLeft, Inbox, Loader2, Mail, MailPlus, Send, Trash2, Undo2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  type Comunicacion, type DependenciaCom, type EventoCom, type TipoEvento,
  EVENTO_LABEL, PLAZO_DEFECTO_DIAS_HABILES, TIPO_LABEL, TRANSICIONES,
  apiAnularComunicacion, apiCorreoAdicional, apiDevolverComunicacion, apiEliminarComunicacion, apiRecordatorioManual, apiRemitirComunicacion, apiResponderDirecto, apiResponderRemitente,
  estaVencida, formatoFecha, sumarDiasHabiles,
} from "../../lib/comunicacionesApi";
import { type CorreoEvento, EVENTOS_CON_CORREO, apiCorreoDeEvento } from "../../lib/correosEventoApi";
import { AdjuntoChip, EstadoBadge } from "./comunicacionesUi";
import { VisorArchivos } from "./VisorArchivos";

type Accion = "remitir" | "devolver" | "responder" | "responderDirecto" | "recordatorio" | "adicional" | "anular" | "eliminar" | null;

interface Props {
  comunicacion: Comunicacion;
  dependencias: DependenciaCom[];
  usuarioNombre: string;
  onClose: () => void;
  onActualizada: (c: Comunicacion, extra?: Comunicacion) => void;
  onEliminada?: (id: number) => void;
}

/** Pasos del circuito y el evento que marca cada uno (para mostrar su fecha). */
const PASOS: { label: string; evento: TipoEvento }[] = [
  { label: "Recibida", evento: "recepcion" },
  { label: "Remitida", evento: "remision" },
  { label: "Respondida", evento: "respuesta_dependencia" },
  { label: "Cerrada", evento: "respuesta_remitente" },
];

function indicePaso(c: Comunicacion): number {
  switch (c.estado) {
    case "nueva": return 0;
    case "remitida":
    case "devuelta": return 1;
    case "respondida_dependencia": return 2;
    case "cerrada": return 3;
    default: return 0;
  }
}

/** El backend guarda el detalle de cada evento como JSON; se muestra legible. */
function textoDetalle(detalle: string | null | undefined): string | null {
  if (!detalle) return null;
  let d: unknown;
  try { d = JSON.parse(detalle); } catch { return detalle; }
  if (!d || typeof d !== "object") return String(d);
  const o = d as Record<string, unknown>;
  if (o.tipo === "sugerencia_ia") {
    const partes = [o.dependencia && `dependencia sugerida: ${o.dependencia}`, o.asunto_sugerido && `asunto: ${o.asunto_sugerido}`,
      o.confianza && `confianza ${o.confianza}`].filter(Boolean);
    return `Sugerencia de IA — ${partes.join(" · ")}${o.motivo ? `. ${o.motivo}` : ""}`;
  }
  const lineas: string[] = [];
  if (o.mensaje) lineas.push(String(o.mensaje));
  if (o.cuerpo) lineas.push(String(o.cuerpo));
  if (o.plazo_dias_habiles) lineas.push(`Plazo: ${o.plazo_dias_habiles} días hábiles`);
  if (o.motivo === "adjuntos_no_guardados") lineas.push("Algunos adjuntos no se guardaron (tamaño o formato no permitido).");
  else if (o.motivo === "rebote") lineas.push(`El correo rebotó${o.de ? ` (${o.de})` : ""}.`);
  else if (o.motivo) lineas.push(String(o.motivo));
  if (o.error) lineas.push(`Error: ${typeof o.error === "string" ? o.error : JSON.stringify(o.error)}`);
  if (o.de_correo && !o.cuerpo) lineas.push(`De: ${o.de_correo}`);
  return lineas.length ? lineas.join("\n") : null;
}

/** Respuesta directa de Archivo Central: no es un correo (el correo está en "Respuesta enviada al remitente"). */
function esDirecta(detalle: string | null | undefined): boolean {
  if (!detalle) return false;
  try { return (JSON.parse(detalle) as Record<string, unknown>)?.directo === true; } catch { return false; }
}

/** Correo de un paso del historial, en el lugar del correo original (con sus adjuntos en el visor). */
function CorreoDelHistorial({ titulo, estado, onVolver }: {
  titulo: string;
  estado: { eventoId: number; cargando: boolean; correo?: CorreoEvento; error?: string };
  onVolver: () => void;
}) {
  const { cargando, correo, error } = estado;
  return (
    <>
      <section className="bg-white border border-[#1e3a5f]/25 rounded-xl shadow-sm ring-1 ring-[#1e3a5f]/5">
        <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#1e3a5f] flex items-center gap-1.5 min-w-0">
            {correo?.direccion === "recibido" ? <Inbox className="w-3.5 h-3.5 shrink-0" /> : <Send className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{titulo}</span>
          </h3>
          <button
            type="button"
            onClick={onVolver}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] border border-[#1e3a5f]/30 rounded-md px-2.5 py-1 hover:bg-[#1e3a5f]/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Ver correo original
          </button>
        </div>

        {cargando && (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando correo…
          </div>
        )}

        {!cargando && error && (
          <div className="px-4 py-6 text-sm text-gray-600 flex gap-2">
            <Mail className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!cargando && correo && (
          <>
            <dl className="px-4 py-3 border-b border-gray-100 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-400">De</dt>
              <dd className="text-gray-800 break-all">{correo.de ?? "—"}</dd>
              <dt className="text-gray-400">Para</dt>
              <dd className="text-gray-800 break-all">{correo.para ?? "—"}</dd>
              <dt className="text-gray-400">Fecha</dt>
              <dd className="text-gray-800">{formatoFecha(correo.fecha, true)}</dd>
              <dt className="text-gray-400">Asunto</dt>
              <dd className="text-gray-900 font-semibold">{correo.asunto ?? <span className="font-normal italic text-gray-400">No guardado</span>}</dd>
            </dl>
            {correo.aviso && (
              <p className="mx-4 mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{correo.aviso}</p>
            )}
            <div className="px-4 py-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {correo.cuerpo || <span className="italic text-gray-400">Sin texto en el cuerpo del correo.</span>}
            </div>
          </>
        )}
      </section>

      {!cargando && correo && correo.adjuntos.length > 0 && (
        <VisorArchivos key={`evento-${estado.eventoId}`} adjuntos={correo.adjuntos} />
      )}
    </>
  );
}

function ColorEvento(tipo: TipoEvento): string {
  if (tipo === "anulacion" || tipo === "error_envio") return "bg-gray-400";
  if (tipo === "respuesta_remitente") return "bg-green-500";
  if (tipo === "devolucion" || tipo === "marcada_escalar") return "bg-rose-500";
  if (tipo === "nota" || tipo === "correo_adicional") return "bg-blue-400";
  return "bg-orange-400";
}

export function DetalleComunicacion({ comunicacion: c, dependencias, onClose, onActualizada, onEliminada }: Props) {
  const [accion, setAccion] = useState<Accion>(null);
  const [enviando, setEnviando] = useState(false);

  // Formularios de las acciones
  const [depId, setDepId] = useState<string>("");
  const [plazo, setPlazo] = useState(PLAZO_DEFECTO_DIAS_HABILES);
  const [mensaje, setMensaje] = useState("");
  const [adjSel, setAdjSel] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [respAsunto, setRespAsunto] = useState("");
  const [respCuerpo, setRespCuerpo] = useState("");

  // Recordatorio manual / correo adicional / respuesta directa
  const [recordAsunto, setRecordAsunto] = useState("");
  const [recordCuerpo, setRecordCuerpo] = useState("");
  // "remitente" o "dep:<id>" (la dependencia asignada u otra cualquiera).
  const [adicionalDestino, setAdicionalDestino] = useState<string>("remitente");
  const [adicionalAsunto, setAdicionalAsunto] = useState("");
  const [adicionalCuerpo, setAdicionalCuerpo] = useState("");

  // Correo de un paso del historial que se está viendo en lugar del correo original.
  const [correoSel, setCorreoSel] = useState<
    { eventoId: number; cargando: boolean; correo?: CorreoEvento; error?: string } | null
  >(null);
  const columnaCorreoRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setAccion(null); setCorreoSel(null); window.scrollTo({ top: 0, behavior: "smooth" }); }, [c.id]);

  const verCorreo = async (e: EventoCom) => {
    if (correoSel?.eventoId === e.id) { setCorreoSel(null); return; }
    setCorreoSel({ eventoId: e.id, cargando: true });
    // En pantallas angostas el historial queda debajo: se sube hasta el correo.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      columnaCorreoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    try {
      const correo = await apiCorreoDeEvento(c.id, e.id);
      setCorreoSel(prev => (prev?.eventoId === e.id ? { eventoId: e.id, cargando: false, correo } : prev));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cargar el correo";
      setCorreoSel(prev => (prev?.eventoId === e.id ? { eventoId: e.id, cargando: false, error: msg } : prev));
    }
  };
  const eventoSel = correoSel ? c.eventos.find(x => x.id === correoSel.eventoId) ?? null : null;

  const dep = dependencias.find(d => d.id === c.dependencia_id) ?? null;
  const puede = (hacia: Comunicacion["estado"]) => TRANSICIONES[c.estado].includes(hacia);
  const paso = indicePaso(c);
  const anulada = c.estado === "anulada";
  const esSalida = c.tipo === "SAL";
  const fechaEvento = (tipo: TipoEvento): string | null => {
    const e = [...c.eventos].reverse().find(x => x.tipo === tipo);
    return e ? e.creado_en : tipo === "recepcion" ? c.fecha_recepcion : null;
  };

  const abrir = (a: Accion) => {
    setMotivo("");
    setMensaje("");
    if (a === "remitir") {
      setDepId(c.dependencia_id ? String(c.dependencia_id) : "");
      setPlazo(PLAZO_DEFECTO_DIAS_HABILES);
      setAdjSel(c.adjuntos.map(x => x.archivo_id));
    }
    if (a === "responder") {
      setAdjSel(c.adjuntos.filter(x => x.de_respuesta).map(x => x.archivo_id));
      setRespAsunto(`[SGD ${c.consecutivo}] Respuesta a su comunicación`);
      setRespCuerpo(
        `Estimado(a) ${c.remitente_nombre ?? ""}:\n\nEn atención a su comunicación ${c.consecutivo} sobre "${c.asunto}", ` +
        `le enviamos la respuesta de ${dep?.nombre ?? "la dependencia"}.\n\nCordialmente,\nArchivo Central\nUniversidad Autónoma del Cauca`,
      );
    }
    if (a === "responderDirecto") {
      setAdjSel([]);
      setRespAsunto(`[SGD ${c.consecutivo}] Respuesta a su comunicación`);
      setRespCuerpo(
        `Estimado(a) ${c.remitente_nombre ?? ""}:\n\nEn atención a su comunicación ${c.consecutivo} sobre "${c.asunto}", ` +
        `le informamos lo siguiente.\n\nCordialmente,\nArchivo Central\nUniversidad Autónoma del Cauca`,
      );
    }
    if (a === "recordatorio") {
      setAdjSel([]);
      setRecordAsunto(`[SGD ${c.consecutivo}] Recordatorio de respuesta`);
      setRecordCuerpo(
        `Cordial saludo,\n\nLe recordamos que la comunicación ${c.consecutivo} sobre "${c.asunto}" ` +
        `aún está pendiente de respuesta.${c.fecha_limite ? ` Fecha límite: ${formatoFecha(c.fecha_limite)}.` : ""}\n\n` +
        `Agradecemos su atención.\n\nCordialmente,\nArchivo Central\nUniversidad Autónoma del Cauca`,
      );
    }
    if (a === "adicional") {
      setAdjSel([]);
      setAdicionalDestino("remitente");
      setAdicionalAsunto(`[SGD ${c.consecutivo}] Información adicional`);
      setAdicionalCuerpo("");
    }
    setAccion(a);
  };

  const ejecutar = async () => {
    setEnviando(true);
    try {
      if (accion === "remitir") {
        if (!depId) { toast.error("Elige la dependencia"); return; }
        const r = await apiRemitirComunicacion(c.id, { dependencia_id: Number(depId), plazo_dias_habiles: plazo, mensaje, adjuntos: adjSel });
        toast.success(`Remitida a ${dependencias.find(d => d.id === Number(depId))?.nombre}`,
          r.fecha_limite ? { description: `Plazo hasta ${formatoFecha(r.fecha_limite)}` } : undefined);
        onActualizada(r);
      } else if (accion === "devolver") {
        if (!motivo.trim()) { toast.error("Indica qué falta en la respuesta"); return; }
        const r = await apiDevolverComunicacion(c.id, motivo);
        toast.success("Devuelta a la dependencia");
        onActualizada(r);
      } else if (accion === "responder") {
        if (!respCuerpo.trim()) { toast.error("Escribe la respuesta"); return; }
        const entrada = await apiResponderRemitente(c.id, { asunto: respAsunto, cuerpo: respCuerpo, adjuntos: adjSel });
        toast.success("Respuesta enviada a n8n", { description: "La comunicación se cerrará tras confirmar el envío del correo" });
        onActualizada(entrada);
      } else if (accion === "responderDirecto") {
        if (!respCuerpo.trim()) { toast.error("Escribe la respuesta"); return; }
        await apiResponderDirecto(c.id, { asunto: respAsunto, cuerpo: respCuerpo, adjuntos: adjSel });
        toast.success("Respuesta directa enviada a n8n", { description: "La comunicación se cerrará tras confirmar el envío del correo" });
        // Refrescar desde el padre; mientras tanto no tenemos el objeto actualizado.
        onActualizada({ ...c, estado: "respondida_dependencia" } as Comunicacion);
      } else if (accion === "recordatorio") {
        if (!recordCuerpo.trim()) { toast.error("Escribe el recordatorio"); return; }
        await apiRecordatorioManual(c.id, { asunto: recordAsunto, cuerpo: recordCuerpo, adjuntos: adjSel });
        toast.success("Recordatorio enviado");
      } else if (accion === "adicional") {
        if (!adicionalCuerpo.trim()) { toast.error("Escribe el mensaje"); return; }
        const depDestino = adicionalDestino.startsWith("dep:") ? Number(adicionalDestino.slice(4)) : null;
        await apiCorreoAdicional(c.id, {
          destinatario_tipo: depDestino ? "dependencia" : "remitente",
          ...(depDestino ? { dependencia_id: depDestino } : {}),
          asunto: adicionalAsunto,
          cuerpo: adicionalCuerpo,
          adjuntos: adjSel,
        });
        toast.success("Correo adicional enviado", depDestino
          ? { description: `A ${dependencias.find(d => d.id === depDestino)?.nombre ?? "la dependencia"}` }
          : undefined);
      } else if (accion === "anular") {
        if (!motivo.trim()) { toast.error("El motivo es obligatorio"); return; }
        const r = await apiAnularComunicacion(c.id, motivo);
        toast.success("Comunicación anulada");
        onActualizada(r);
      } else if (accion === "eliminar") {
        const r = await apiEliminarComunicacion(c.id);
        toast.success("Comunicación eliminada", { description: `${r.consecutivo} y sus archivos fueron borrados` });
        onEliminada?.(c.id);
        setAccion(null);
        onClose();
        return;
      }
      setAccion(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción");
    } finally {
      setEnviando(false);
    }
  };

  const toggleAdj = (id: string) => setAdjSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const fechaLimitePreview = sumarDiasHabiles(new Date(), plazo);

  const datos: [string, React.ReactNode][] = [
    ["Consecutivo", <span className="font-mono">{c.consecutivo}</span>],
    [esSalida ? "Destinatario" : "Remitente", (esSalida ? c.destinatario_nombre : c.remitente_nombre) ?? "—"],
    ["Correo", <span className="break-all">{(esSalida ? c.destinatario_correo : c.remitente_correo) ?? "—"}</span>],
    ["Asunto", c.asunto],
    ["Tipo", TIPO_LABEL[c.tipo]],
    ["Dependencia asignada", dep?.nombre ?? <span className="italic text-gray-400">Sin asignar</span>],
    ["Fecha de recepción", formatoFecha(c.fecha_recepcion, true)],
    ...(c.fecha_limite ? [["Plazo de respuesta", (
      <span className={`inline-flex items-center gap-1 ${estaVencida(c) ? "text-red-600 font-semibold" : ""}`}>
        <Clock className="w-3.5 h-3.5" /> {formatoFecha(c.fecha_limite)}{estaVencida(c) ? " · vencida" : ""}
      </span>
    )] as [string, React.ReactNode]] : []),
    ...(c.n_recordatorios > 0 ? [["Recordatorios", `${c.n_recordatorios} enviado(s)${c.por_escalar ? " · por escalar" : ""}`] as [string, React.ReactNode]] : []),
    ...(c.consecutivo_original ? [["Consecutivo original", c.consecutivo_original] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-slide-up">
      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      {/* Fijo arriba al hacer scroll: la vista es larga (correo + visor) y siempre debe poder volverse */}
      <div className="sticky top-3 z-20">
        <button onClick={onClose}
          className="inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold shadow-md shadow-[#1e3a5f]/25 hover:bg-[#2a4a6f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8740e] focus-visible:ring-offset-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a la bandeja
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{c.consecutivo}</h2>
            <EstadoBadge estado={c.estado} />
            {estaVencida(c) && <span className="text-xs font-semibold text-red-600">Vencida</span>}
            {c.por_escalar && <span className="text-xs font-semibold text-red-700">Por escalar</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {TIPO_LABEL[c.tipo]} · recibida el {formatoFecha(c.fecha_recepcion)} · <span className="text-gray-700">{c.asunto}</span>
          </p>
        </div>

        {!anulada && c.estado !== "cerrada" && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {c.tipo === "ENT" && c.estado === "nueva" && !c.dependencia_id && (
              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white" onClick={() => abrir("responderDirecto")}>
                <CornerUpLeft className="w-4 h-4 mr-1" /> Responder correo
              </Button>
            )}
            {(c.estado === "remitida" || c.estado === "devuelta") && (
              <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => abrir("recordatorio")}>
                <Bell className="w-4 h-4 mr-1" /> Recordatorio
              </Button>
            )}
            {(c.estado === "nueva" || c.estado === "remitida" || c.estado === "devuelta" || c.estado === "respondida_dependencia") && (
              <Button variant="outline" size="sm" className="text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => abrir("adicional")}>
                <MailPlus className="w-4 h-4 mr-1" /> Correo adicional
              </Button>
            )}
            {onEliminada && (
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => abrir("eliminar")}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            )}
            {puede("anulada") && (
              <Button variant="outline" size="sm" className="text-gray-600" onClick={() => abrir("anular")}>
                <Ban className="w-4 h-4 mr-1" /> Anular
              </Button>
            )}
            {puede("devuelta") && (
              <Button variant="outline" size="sm" className="text-rose-700 border-rose-200 hover:bg-rose-50" onClick={() => abrir("devolver")}>
                <Undo2 className="w-4 h-4 mr-1" /> Devolver
              </Button>
            )}
            {puede("remitida") && (
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => abrir("remitir")}>
                <Send className="w-4 h-4 mr-1" /> Remitir
              </Button>
            )}
            {puede("cerrada") && (
              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white" onClick={() => abrir("responder")}>
                <CornerUpLeft className="w-4 h-4 mr-1" /> Enviar respuesta
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Línea de pasos con fechas ──────────────────────────────────── */}
      {!anulada && !esSalida && (
        <ol className="grid grid-cols-4 gap-2">
          {PASOS.map((p, i) => {
            const hecho = i < paso || (i === paso && c.estado === "cerrada") || i === 0;
            const actual = i === paso && c.estado !== "cerrada" && i !== 0;
            const fecha = hecho || actual ? fechaEvento(p.evento) : null;
            const etiqueta = c.estado === "devuelta" && i === 1 ? "Devuelta" : p.label;
            return (
              <li key={p.label} className={`border-t-4 pt-2 ${hecho ? "border-[#1e3a5f]" : actual ? "border-orange-500" : "border-gray-200"}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    hecho ? "bg-[#1e3a5f] text-white" : actual ? "bg-orange-500 text-white" : "bg-white border border-gray-300 text-gray-400"
                  }`}>
                    {hecho ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className={`text-sm font-semibold ${hecho || actual ? "text-gray-900" : "text-gray-400"}`}>{etiqueta}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 ml-7">{fecha ? formatoFecha(fecha) : "Pendiente"}</p>
              </li>
            );
          })}
        </ol>
      )}

      {anulada && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-700 flex items-center gap-1.5"><Ban className="w-4 h-4" /> Comunicación anulada</p>
          <p className="mt-1">Motivo: {c.anulado_motivo}</p>
        </div>
      )}

      {/* ── Cuerpo: correo + adjuntos | datos + historial ──────────────── */}
      <div className="grid gap-5 xl:grid-cols-5 items-start">
        <div ref={columnaCorreoRef} className="xl:col-span-3 space-y-5 min-w-0 scroll-mt-24">
          {correoSel && eventoSel ? (
            <CorreoDelHistorial
              titulo={EVENTO_LABEL[eventoSel.tipo] ?? eventoSel.tipo}
              estado={correoSel}
              onVolver={() => setCorreoSel(null)}
            />
          ) : (
          <>
          {/* Correo original */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <h3 className="px-4 py-3 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {esSalida ? "Correo enviado" : "Correo original"}
            </h3>
            <dl className="px-4 py-3 border-b border-gray-100 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-400">De</dt>
              <dd className="text-gray-800 break-all">
                {esSalida ? "Archivo Central <correspondencia@uniautonoma.edu.co>" : `${c.remitente_nombre ?? ""} <${c.remitente_correo ?? ""}>`}
              </dd>
              <dt className="text-gray-400">Para</dt>
              <dd className="text-gray-800 break-all">
                {esSalida ? `${c.destinatario_nombre ?? ""} <${c.destinatario_correo ?? ""}>` : "correspondencia@uniautonoma.edu.co"}
              </dd>
              <dt className="text-gray-400">Fecha</dt>
              <dd className="text-gray-800">{formatoFecha(c.fecha_recepcion, true)}</dd>
              <dt className="text-gray-400">Asunto</dt>
              <dd className="text-gray-900 font-semibold">{c.asunto}</dd>
            </dl>
            <div className="px-4 py-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {c.cuerpo || <span className="italic text-gray-400">Sin texto en el cuerpo del correo.</span>}
            </div>
          </section>

          {/* Adjuntos con visor (se ajusta al ancho de la columna) */}
          <VisorArchivos key="original" adjuntos={c.adjuntos} />
          </>
          )}
        </div>

        <div className="xl:col-span-2 space-y-5 min-w-0">
          {/* Datos */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <h3 className="px-4 py-3 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Datos</h3>
            <dl className="divide-y divide-gray-50">
              {datos.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2 text-sm">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="text-gray-800 font-medium min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Historial */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Historial</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Haga clic en un paso con <Mail className="inline w-3 h-3 -mt-0.5" /> para ver su correo.</p>
            </div>
            <ol className="relative border-l-2 border-gray-100 ml-6 my-4 mr-4 space-y-3">
              {[...c.eventos].reverse().map((e: EventoCom) => {
                const texto = textoDetalle(e.detalle);
                const conCorreo = EVENTOS_CON_CORREO.has(e.tipo) && !(e.tipo === "respuesta_dependencia" && esDirecta(e.detalle));
                const seleccionado = correoSel?.eventoId === e.id;
                const contenido = (
                  <>
                    <p className="text-[11px] text-gray-400">{formatoFecha(e.creado_en, true)}</p>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      {conCorreo && <Mail className={`w-3.5 h-3.5 shrink-0 ${seleccionado ? "text-[#1e3a5f]" : "text-gray-400"}`} />}
                      <span className="min-w-0">{EVENTO_LABEL[e.tipo] ?? e.tipo}{e.dependencia ? ` · ${e.dependencia}` : ""}</span>
                      {conCorreo && <ChevronRight className={`w-4 h-4 ml-auto shrink-0 transition-transform ${seleccionado ? "text-[#1e3a5f] rotate-90 xl:rotate-180" : "text-gray-300"}`} />}
                    </p>
                    <p className="text-xs text-gray-500">{e.usuario ?? "Sistema (n8n)"}</p>
                    {texto && (
                      <p className="mt-1.5 text-xs text-gray-600 whitespace-pre-line bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 line-clamp-4">{texto}</p>
                    )}
                  </>
                );
                return (
                  <li key={e.id} className="ml-4">
                    <span className={`absolute -left-[7px] mt-3 w-3 h-3 rounded-full border-2 border-white ${ColorEvento(e.tipo)}`} />
                    {conCorreo ? (
                      <button
                        type="button"
                        onClick={() => verCorreo(e)}
                        aria-pressed={seleccionado}
                        title={seleccionado ? "Volver al correo original" : "Ver el correo de este paso"}
                        className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40 ${
                          seleccionado ? "bg-[#1e3a5f]/5 border-[#1e3a5f]/30" : "border-transparent hover:bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        {contenido}
                      </button>
                    ) : (
                      <div className="px-2.5 py-2">{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      {/* ── Diálogos de acción ───────────────────────────────────────── */}
      <Dialog open={accion !== null} onOpenChange={o => { if (!o && !enviando) setAccion(null); }}>
        <DialogContent className="sm:max-w-lg">
          {accion === "remitir" && (
            <>
              <DialogHeader>
                <DialogTitle>Remitir {c.consecutivo}</DialogTitle>
                <DialogDescription>Se enviará por correo a la dependencia con la etiqueta [SGD {c.consecutivo}] en el asunto.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Dependencia</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={depId} onChange={e => setDepId(e.target.value)}>
                    <option value="">Elegir…</option>
                    {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre} — {d.correo_oficial}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plazo de respuesta (días hábiles)</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={60} className="w-24" value={plazo} onChange={e => setPlazo(Math.max(1, Number(e.target.value) || 1))} />
                    <span className="text-xs text-gray-500">Vence el {formatoFecha(fechaLimitePreview.toISOString())}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje para la dependencia (opcional)</Label>
                  <Textarea rows={3} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Ej.: Favor revisar y responder dentro del plazo." />
                </div>
                {c.adjuntos.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Adjuntos a reenviar</Label>
                    <div className="grid gap-1.5">
                      {c.adjuntos.map(a => (
                        <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)} onToggle={() => toggleAdj(a.archivo_id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {accion === "devolver" && (
            <>
              <DialogHeader>
                <DialogTitle>Devolver a {dep?.nombre}</DialogTitle>
                <DialogDescription>La respuesta está incompleta. La dependencia recibirá un correo con lo que falta y un nuevo plazo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label>¿Qué falta en la respuesta?</Label>
                <Textarea rows={4} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: Falta el certificado firmado." />
              </div>
            </>
          )}

          {accion === "responder" && (
            <>
              <DialogHeader>
                <DialogTitle>Enviar respuesta al remitente</DialogTitle>
                <DialogDescription>
                  Para: {c.remitente_nombre} &lt;{c.remitente_correo}&gt;. Se creará la comunicación de salida y esta quedará cerrada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={respAsunto} onChange={e => setRespAsunto(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea rows={7} value={respCuerpo} onChange={e => setRespCuerpo(e.target.value)} />
                </div>
                {c.adjuntos.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Adjuntos</Label>
                    <div className="grid gap-1.5">
                      {c.adjuntos.map(a => (
                        <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)} onToggle={() => toggleAdj(a.archivo_id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {accion === "responderDirecto" && (
            <>
              <DialogHeader>
                <DialogTitle>Responder directamente al remitente</DialogTitle>
                <DialogDescription>
                  Para: {c.remitente_nombre} &lt;{c.remitente_correo}&gt;. No se remitirá a ninguna dependencia.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={respAsunto} onChange={e => setRespAsunto(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea rows={7} value={respCuerpo} onChange={e => setRespCuerpo(e.target.value)} />
                </div>
                {c.adjuntos.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Adjuntos</Label>
                    <div className="grid gap-1.5">
                      {c.adjuntos.map(a => (
                        <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)} onToggle={() => toggleAdj(a.archivo_id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {accion === "recordatorio" && (
            <>
              <DialogHeader>
                <DialogTitle>Enviar recordatorio</DialogTitle>
                <DialogDescription>
                  Se enviará a {dep?.nombre ?? "la dependencia"} ({dep?.correo_oficial ?? "sin correo"}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={recordAsunto} onChange={e => setRecordAsunto(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea rows={7} value={recordCuerpo} onChange={e => setRecordCuerpo(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {accion === "adicional" && (
            <>
              <DialogHeader>
                <DialogTitle>Enviar correo adicional</DialogTitle>
                <DialogDescription>El correo quedará registrado en el historial de la comunicación.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Destinatario</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={adicionalDestino}
                    onChange={e => setAdicionalDestino(e.target.value)}
                  >
                    <option value="remitente">{c.remitente_nombre ?? c.remitente_correo} (remitente)</option>
                    {dep && (
                      <option value={`dep:${dep.id}`}>{dep.nombre} — {dep.correo_oficial || "sin correo"} (asignada)</option>
                    )}
                    <optgroup label="Otra dependencia">
                      {dependencias.filter(d => d.id !== dep?.id).map(d => (
                        <option key={d.id} value={`dep:${d.id}`} disabled={!d.correo_oficial}>
                          {d.nombre} — {d.correo_oficial || "sin correo"}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={adicionalAsunto} onChange={e => setAdicionalAsunto(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea rows={6} value={adicionalCuerpo} onChange={e => setAdicionalCuerpo(e.target.value)} />
                </div>
                {c.adjuntos.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Adjuntos</Label>
                    <div className="grid gap-1.5">
                      {c.adjuntos.map(a => (
                        <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)} onToggle={() => toggleAdj(a.archivo_id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {accion === "anular" && (
            <>
              <DialogHeader>
                <DialogTitle>Anular {c.consecutivo}</DialogTitle>
                <DialogDescription>La comunicación no se borra: queda anulada con el motivo y se puede consultar en la pestaña Anuladas.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: Correo publicitario, no es una comunicación oficial." />
              </div>
            </>
          )}

          {accion === "eliminar" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-red-600 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Eliminar {c.consecutivo}</DialogTitle>
                <DialogDescription className="text-red-700">
                  ⚠️ Esta acción es irreversible. Se borrará la comunicación, sus eventos, adjuntos y archivos del disco.
                  Solo usar en pruebas.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <p>Consecutivo: <span className="font-mono font-semibold">{c.consecutivo}</span></p>
                <p>Asunto: {c.asunto}</p>
                <p>Adjuntos: {c.adjuntos.length}</p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccion(null)} disabled={enviando}>Cancelar</Button>
            <Button
              onClick={ejecutar}
              disabled={enviando}
              className={
                accion === "eliminar" ? "bg-red-600 hover:bg-red-700 text-white"
                  : accion === "anular" ? "bg-gray-700 hover:bg-gray-800 text-white"
                    : accion === "devolver" ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : accion === "responder" || accion === "responderDirecto" ? "bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white"
                        : accion === "recordatorio" ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : accion === "adicional" ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
              }
            >
              {enviando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {accion === "remitir" ? "Remitir" :
                accion === "devolver" ? "Devolver" :
                  accion === "responder" ? "Enviar respuesta" :
                    accion === "responderDirecto" ? "Enviar respuesta directa" :
                      accion === "recordatorio" ? "Enviar recordatorio" :
                        accion === "adicional" ? "Enviar correo" :
                          accion === "eliminar" ? "Eliminar definitivamente" : "Anular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
