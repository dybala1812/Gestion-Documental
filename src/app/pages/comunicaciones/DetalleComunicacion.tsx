/**
 * @file DetalleComunicacion.tsx
 * @description Detalle de una comunicación: datos, mensaje, adjuntos, línea de
 * pasos, historial y acciones según su estado (Remitir, Devolver, Enviar
 * respuesta, Anular). RF-AC-016, RF-AC-017, RF-AC-024.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Ban, CheckCircle2, Clock, CornerUpLeft, Loader2, Mail, Paperclip, Send, Undo2,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  type Comunicacion, type DependenciaCom,
  EVENTO_LABEL, PLAZO_DEFECTO_DIAS_HABILES, TRANSICIONES,
  apiAnularComunicacion, apiDevolverComunicacion, apiRemitirComunicacion, apiResponderRemitente,
  estaVencida, formatoFecha, sumarDiasHabiles,
} from "../../lib/comunicacionesApi";
import { AdjuntoChip, EstadoBadge, TipoBadge } from "./comunicacionesUi";

type Accion = "remitir" | "devolver" | "responder" | "anular" | null;

interface Props {
  comunicacion: Comunicacion | null;
  dependencias: DependenciaCom[];
  usuarioNombre: string;
  onClose: () => void;
  onActualizada: (c: Comunicacion, extra?: Comunicacion) => void;
}

const PASOS = [
  { estado: "nueva", label: "Recibida" },
  { estado: "remitida", label: "Remitida" },
  { estado: "respondida_dependencia", label: "Respondida" },
  { estado: "cerrada", label: "Cerrada" },
] as const;

function indicePaso(c: Comunicacion): number {
  if (c.estado === "devuelta") return 1;
  return PASOS.findIndex(p => p.estado === c.estado);
}

export function DetalleComunicacion({ comunicacion: c, dependencias, usuarioNombre, onClose, onActualizada }: Props) {
  const [accion, setAccion] = useState<Accion>(null);
  const [enviando, setEnviando] = useState(false);

  // Formularios
  const [depId, setDepId] = useState<string>("");
  const [plazo, setPlazo] = useState(PLAZO_DEFECTO_DIAS_HABILES);
  const [mensaje, setMensaje] = useState("");
  const [adjSel, setAdjSel] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [respAsunto, setRespAsunto] = useState("");
  const [respCuerpo, setRespCuerpo] = useState("");

  useEffect(() => { setAccion(null); }, [c?.id]);

  if (!c) return <Sheet open={false} onOpenChange={() => onClose()} />;

  const dep = dependencias.find(d => d.id === c.dependencia_id) ?? null;
  const puede = (hacia: Comunicacion["estado"]) => TRANSICIONES[c.estado].includes(hacia);
  const paso = indicePaso(c);
  const anulada = c.estado === "anulada";

  const abrir = (a: Accion) => {
    setMotivo("");
    setMensaje("");
    if (a === "remitir") {
      setDepId(c.dependencia_id ? String(c.dependencia_id) : "");
      setPlazo(PLAZO_DEFECTO_DIAS_HABILES);
      setAdjSel(c.adjuntos.map(x => x.archivo_id));
    }
    if (a === "responder") {
      const respuestaDep = c.adjuntos.filter(x => x.de_respuesta);
      setAdjSel(respuestaDep.map(x => x.archivo_id));
      setRespAsunto(`[SGD ${c.consecutivo}] Respuesta a su comunicación`);
      setRespCuerpo(
        `Estimado(a) ${c.remitente_nombre ?? ""}:\n\nEn atención a su comunicación ${c.consecutivo} sobre "${c.asunto}", ` +
        `le enviamos la respuesta de ${dep?.nombre ?? "la dependencia"}.\n\nCordialmente,\nArchivo Central\nUniversidad Autónoma del Cauca`,
      );
    }
    setAccion(a);
  };

  const ejecutar = async () => {
    setEnviando(true);
    try {
      if (accion === "remitir") {
        if (!depId) { toast.error("Elige la dependencia"); return; }
        const r = await apiRemitirComunicacion(c.id, { dependencia_id: Number(depId), plazo_dias_habiles: plazo, mensaje, adjuntos: adjSel }, usuarioNombre);
        toast.success(`Remitida a ${dependencias.find(d => d.id === Number(depId))?.nombre}`, { description: `Plazo hasta ${formatoFecha(r.fecha_limite!)}` });
        onActualizada(r);
      } else if (accion === "devolver") {
        if (!motivo.trim()) { toast.error("Indica qué falta en la respuesta"); return; }
        const r = await apiDevolverComunicacion(c.id, motivo, usuarioNombre);
        toast.success("Devuelta a la dependencia");
        onActualizada(r);
      } else if (accion === "responder") {
        if (!respCuerpo.trim()) { toast.error("Escribe la respuesta"); return; }
        const { entrada, salida } = await apiResponderRemitente(c.id, { asunto: respAsunto, cuerpo: respCuerpo, adjuntos: adjSel }, usuarioNombre);
        toast.success("Respuesta enviada y comunicación cerrada", { description: `Salida ${salida.consecutivo}` });
        onActualizada(entrada, salida);
      } else if (accion === "anular") {
        if (!motivo.trim()) { toast.error("El motivo es obligatorio"); return; }
        const r = await apiAnularComunicacion(c.id, motivo, usuarioNombre);
        toast.success("Comunicación anulada");
        onActualizada(r);
      }
      setAccion(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción");
    } finally {
      setEnviando(false);
    }
  };

  const fechaLimitePreview = sumarDiasHabiles(new Date(), plazo);

  return (
    <>
      <Sheet open={!!c} onOpenChange={o => { if (!o && accion === null) onClose(); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 gap-0">
          {/* Cabecera */}
          <SheetHeader className="border-b border-gray-100 px-6 py-4 bg-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-gray-900">{c.consecutivo}</span>
              <TipoBadge tipo={c.tipo} />
              <EstadoBadge estado={c.estado} />
              {estaVencida(c) && <span className="text-[11px] font-semibold text-red-600">Vencida</span>}
              {c.por_escalar && <span className="text-[11px] font-semibold text-red-700">Por escalar</span>}
            </div>
            <SheetTitle className="text-lg text-gray-900 pr-6">{c.asunto}</SheetTitle>
            <SheetDescription className="text-xs">
              Recibida el {formatoFecha(c.fecha_recepcion, true)}
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Línea de pasos */}
            {!anulada && c.tipo === "ENT" && (
              <ol className="flex items-center">
                {PASOS.map((p, i) => {
                  const hecho = i < paso || (i === paso && c.estado === "cerrada");
                  const actual = i === paso && c.estado !== "cerrada";
                  return (
                    <li key={p.estado} className="flex-1 flex items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          hecho ? "bg-orange-500 border-orange-500 text-white"
                            : actual ? "bg-white border-orange-500 text-orange-600"
                              : "bg-white border-gray-200 text-gray-300"
                        }`}>
                          {hecho ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </span>
                        <span className={`text-[10px] font-medium ${hecho || actual ? "text-gray-700" : "text-gray-400"}`}>
                          {c.estado === "devuelta" && i === 1 ? "Devuelta" : p.label}
                        </span>
                      </div>
                      {i < PASOS.length - 1 && (
                        <span className={`flex-1 h-0.5 mx-1 mb-4 ${i < paso ? "bg-orange-500" : "bg-gray-200"}`} />
                      )}
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

            {/* Datos */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{c.tipo === "SAL" ? "Destinatario" : "Remitente"}</dt>
                <dd className="text-gray-800 font-medium">{c.tipo === "SAL" ? c.destinatario_nombre : c.remitente_nombre}</dd>
                <dd className="text-xs text-gray-500">{c.tipo === "SAL" ? c.destinatario_correo : c.remitente_correo}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Dependencia</dt>
                <dd className="text-gray-800">{dep?.nombre ?? <span className="italic text-gray-400">Sin asignar</span>}</dd>
                {dep && <dd className="text-xs text-gray-500">{dep.correo_oficial}</dd>}
              </div>
              {c.fecha_limite && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Plazo de respuesta</dt>
                  <dd className={`flex items-center gap-1 ${estaVencida(c) ? "text-red-600 font-semibold" : "text-gray-800"}`}>
                    <Clock className="w-3.5 h-3.5" /> {formatoFecha(c.fecha_limite)}
                  </dd>
                </div>
              )}
              {c.n_recordatorios > 0 && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Recordatorios</dt>
                  <dd className="text-gray-800">{c.n_recordatorios} enviado(s)</dd>
                </div>
              )}
            </dl>

            {/* Mensaje */}
            {c.cuerpo && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Mensaje</h3>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 whitespace-pre-line">{c.cuerpo}</div>
              </div>
            )}

            {/* Adjuntos */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Adjuntos ({c.adjuntos.length})
              </h3>
              {c.adjuntos.length === 0
                ? <p className="text-sm text-gray-400">Sin adjuntos</p>
                : <div className="grid sm:grid-cols-2 gap-2">{c.adjuntos.map(a => <AdjuntoChip key={a.archivo_id} adjunto={a} />)}</div>}
            </div>

            {/* Historial */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial</h3>
              <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
                {[...c.eventos].reverse().map(e => (
                  <li key={e.id} className="ml-4">
                    <span className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full border-2 border-white ${
                      e.tipo === "anulacion" || e.tipo === "error_envio" ? "bg-gray-400"
                        : e.tipo === "respuesta_remitente" ? "bg-green-500"
                          : e.tipo === "devolucion" || e.tipo === "marcada_escalar" ? "bg-rose-500"
                            : "bg-orange-400"
                    }`} />
                    <p className="text-sm font-medium text-gray-800">
                      {EVENTO_LABEL[e.tipo]}{e.dependencia ? ` · ${e.dependencia}` : ""}
                    </p>
                    {e.detalle && <p className="text-xs text-gray-500">{e.detalle}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatoFecha(e.creado_en, true)} · {e.usuario ?? "Sistema"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Acciones */}
          {!anulada && c.estado !== "cerrada" && (
            <div className="sticky bottom-0 mt-auto border-t border-gray-100 bg-white px-6 py-3 flex flex-wrap gap-2 justify-end">
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
              {(c.estado === "remitida" || c.estado === "devuelta") && (
                <p className="w-full text-right text-xs text-gray-400">
                  Esperando respuesta de {dep?.nombre}. Llegará automáticamente por correo.
                </p>
              )}
            </div>
          )}
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
                          <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)}
                            onToggle={() => setAdjSel(s => s.includes(a.archivo_id) ? s.filter(x => x !== a.archivo_id) : [...s, a.archivo_id])} />
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
                          <AdjuntoChip key={a.archivo_id} adjunto={a} seleccionable seleccionado={adjSel.includes(a.archivo_id)}
                            onToggle={() => setAdjSel(s => s.includes(a.archivo_id) ? s.filter(x => x !== a.archivo_id) : [...s, a.archivo_id])} />
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setAccion(null)} disabled={enviando}>Cancelar</Button>
              <Button
                onClick={ejecutar}
                disabled={enviando}
                className={
                  accion === "anular" ? "bg-gray-700 hover:bg-gray-800 text-white"
                    : accion === "devolver" ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : accion === "responder" ? "bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white"
                        : "bg-orange-500 hover:bg-orange-600 text-white"
                }
              >
                {enviando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {accion === "remitir" ? "Remitir" : accion === "devolver" ? "Devolver" : accion === "responder" ? "Enviar respuesta" : "Anular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </SheetContent>
      </Sheet>

    </>
  );
}
