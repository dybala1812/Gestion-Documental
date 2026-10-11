"use client";

/**
 * @file CorreosSinAsociar.tsx
 * @description Respuestas que n8n no pudo vincular a una comunicación (RF-AC-018).
 * Se asocian como respuesta de una comunicación remitida/devuelta o se crean como nuevas.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Info, Link2, Loader2, MailQuestion, PlusCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { cn } from "../../components/ui/utils";
import {
  type Comunicacion, type CorreoSinAsociar,
  ESTADO_LABEL, MOTIVO_SIN_ASOCIAR_LABEL, apiAsociarCorreo, apiCrearDesdeCorreo, formatoFecha,
} from "../../lib/comunicacionesApi";
import { AdjuntoChip, EstadoBadge, Vacio } from "./comunicacionesUi";

interface Props {
  correos: CorreoSinAsociar[];
  comunicaciones: Comunicacion[];
  onResuelto: (correoId: number, comunicacion: Comunicacion, comoNueva: boolean) => void;
}

export function CorreosSinAsociar({ correos, comunicaciones, onResuelto }: Props) {
  const [selId, setSelId] = useState<number | null>(correos[0]?.id ?? null);
  const [destino, setDestino] = useState<string>("");
  const [procesando, setProcesando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!correos.some(c => c.id === selId)) setSelId(correos[0]?.id ?? null);
  }, [correos, selId]);

  const sel = correos.find(c => c.id === selId) ?? null;

  // Solo se puede asociar como respuesta a comunicaciones que esperan respuesta.
  const candidatas = useMemo(
    () => comunicaciones.filter(c => c.estado === "remitida" || c.estado === "devuelta"),
    [comunicaciones],
  );
  const posible = sel?.posible_comunicacion_id ? comunicaciones.find(c => c.id === sel.posible_comunicacion_id) ?? null : null;

  useEffect(() => {
    setDestino(posible && candidatas.some(c => c.id === posible.id) ? String(posible.id) : "");
  }, [sel?.id, posible, candidatas]);

  const seleccionada = candidatas.find(c => String(c.id) === destino) ?? null;

  const asociar = async () => {
    if (!sel || !destino) { toast.error("Elige la comunicación a la que vas a ligar la respuesta"); return; }
    setProcesando(true);
    try {
      const com = await apiAsociarCorreo(sel.id, Number(destino));
      toast.success(`Ligado a ${com.consecutivo}`, { description: "Quedó como respuesta de la dependencia" });
      onResuelto(sel.id, com, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asociar");
    } finally {
      setProcesando(false);
    }
  };

  const crearNueva = async () => {
    if (!sel) return;
    setProcesando(true);
    try {
      const com = await apiCrearDesdeCorreo(sel.id);
      toast.success(`Creada como ${com.consecutivo}`);
      onResuelto(sel.id, com, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          n8n asocia cada respuesta por la etiqueta del consecutivo en el asunto, por ejemplo <span className="font-mono">[SGD ENT-2026-001377]</span>.
          Estos correos llegaron sin etiqueta o con una que no coincide. Aquí puedes comparar y ligar manualmente la respuesta.
        </p>
      </div>

      {correos.length === 0 ? (
        <Vacio icon={MailQuestion} titulo="No hay correos sin asociar" texto="Todas las respuestas quedaron vinculadas" />
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          {/* Lista */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {correos.map(c => (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                  c.id === selId ? "bg-orange-50/60 border-orange-500" : "border-transparent hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.de_nombre ?? c.de_correo}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">{formatoFecha(c.recibido_en)}</span>
                </div>
                <p className="text-xs text-gray-600 truncate">{c.asunto}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                    {MOTIVO_SIN_ASOCIAR_LABEL[c.motivo]}
                  </span>
                  {c.adjuntos.length > 0 && <span className="text-[10px] text-gray-400">{c.adjuntos.length} adjunto(s)</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Detalle */}
          {sel && (
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              {/* Acción principal: ligar como respuesta */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Ligar como respuesta a</label>
                  <Popover open={abierto} onOpenChange={setAbierto}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={abierto}
                        className="w-full justify-between font-normal h-auto py-2"
                        disabled={candidatas.length === 0}
                      >
                        {seleccionada ? (
                          <span className="truncate text-left">
                            {seleccionada.consecutivo} · {seleccionada.asunto}
                          </span>
                        ) : (
                          <span className="text-gray-400">Elegir comunicación remitida…</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por consecutivo, asunto o remitente…" />
                        <CommandList>
                          <CommandEmpty>No se encontró comunicación</CommandEmpty>
                          <CommandGroup>
                            {candidatas.map(c => (
                              <CommandItem
                                key={c.id}
                                value={`${c.consecutivo} ${c.asunto} ${c.remitente_nombre ?? ""} ${c.remitente_correo ?? ""}`}
                                onSelect={() => { setDestino(String(c.id)); setAbierto(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", destino === String(c.id) ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium truncate">{c.consecutivo} · {c.asunto}</span>
                                  <span className="text-xs text-gray-500 truncate">
                                    {c.remitente_nombre ?? c.remitente_correo} · {ESTADO_LABEL[c.estado]}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {candidatas.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No hay comunicaciones remitidas o devueltas a las que se pueda ligar esta respuesta.
                  </p>
                )}

                {/* Previsualización de la comunicación elegida */}
                {seleccionada && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Vista previa de la comunicación seleccionada</span>
                      <EstadoBadge estado={seleccionada.estado} />
                    </div>
                    <p className="text-sm">
                      <span className="text-gray-400 w-14 inline-block">De</span>
                      <span className="text-gray-800">{seleccionada.remitente_nombre} &lt;{seleccionada.remitente_correo}&gt;</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-400 w-14 inline-block">Asunto</span>
                      <span className="font-medium text-gray-800">{seleccionada.asunto}</span>
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-3">{seleccionada.cuerpo}</p>
                    {seleccionada.adjuntos.length > 0 && (
                      <p className="text-xs text-gray-500">{seleccionada.adjuntos.length} adjunto(s) en la comunicación original</p>
                    )}
                  </div>
                )}

                {posible && posible.id !== seleccionada?.id && (
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm">
                    <p className="font-semibold text-orange-800">Posible coincidencia sugerida: {posible.consecutivo}</p>
                    <p className="text-xs text-orange-700">{posible.asunto} · {posible.remitente_nombre}</p>
                  </div>
                )}
              </div>

              {/* Correo recibido */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-1 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Correo recibido</p>
                <p><span className="text-gray-400 w-16 inline-block">De</span> <span className="text-gray-800">{sel.de_nombre} &lt;{sel.de_correo}&gt;</span></p>
                <p><span className="text-gray-400 w-16 inline-block">Para</span> <span className="text-gray-800">correspondencia@uniautonoma.edu.co</span></p>
                <p><span className="text-gray-400 w-16 inline-block">Fecha</span> <span className="text-gray-800">{formatoFecha(sel.recibido_en, true)}</span></p>
                <p><span className="text-gray-400 w-16 inline-block">Asunto</span> <span className="text-gray-800 font-medium">{sel.asunto}</span></p>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-line">{sel.cuerpo}</div>
                {sel.adjuntos.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">{sel.adjuntos.map(a => <AdjuntoChip key={a.archivo_id} adjunto={a} />)}</div>
                )}

                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={crearNueva} disabled={procesando}>
                    <PlusCircle className="w-4 h-4 mr-1" /> Crear como nueva
                  </Button>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={asociar} disabled={procesando || !destino}>
                    {procesando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                    Ligar respuesta
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
