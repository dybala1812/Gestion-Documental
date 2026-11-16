/**
 * @file ComunicacionesArea.tsx
 * @description Módulo Comunicaciones del Panel de Área (Archivo Central · SGD).
 *
 * Circuito de comunicaciones por correo: Bandeja (recepción, remisión a
 * dependencias, respuesta al remitente), Correos sin asociar y Registro histórico.
 * Los datos vienen del backend SGD (Next.js) a través de lib/comunicacionesApi.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import { formatApiError } from "../../lib/api";
import { AlertTriangle, Inbox, Loader2, Mail, MailQuestion, RefreshCw, Send } from "lucide-react";
import {
  type Comunicacion, type CorreoSinAsociar, type DependenciaCom,
  apiListComunicaciones, apiListCorreosSinAsociar, apiListDependenciasCom, estaVencida,
  apiActualizarTriaje, apiObtenerComunicacion,
} from "../../lib/comunicacionesApi";
import { BandejaComunicaciones, type CambiosTriaje } from "./BandejaComunicaciones";
import { CorreosSinAsociar as CorreosSinAsociarSeccion } from "./CorreosSinAsociar";
import { RegistroHistorico } from "./RegistroHistorico";
import { DetalleComunicacion } from "./DetalleComunicacion";

export type SeccionComunicaciones = "bandeja" | "sinAsociar" | "historico";
type Seccion = SeccionComunicaciones;

interface Props {
  areaNombre: string;
  usuarioNombre: string;
  /** Sección controlada desde el menú lateral de Archivo Central (opcional). */
  seccion?: Seccion;
  onSeccionChange?: (s: Seccion) => void;
  /** Señal desde el padre para forzar una recarga de la bandeja. */
  recargarTrigger?: number;
  /** Devuelve el id de la comunicación más reciente tras cada carga. */
  onUltimaComunicacionId?: (id: number) => void;
  /** Comunicación que se abre al entrar (p. ej. desde la búsqueda avanzada). */
  abrirId?: number | null;
  /** Avisa que ya se abrió `abrirId`, para que el padre lo limpie. */
  onAbierta?: () => void;
}

export function ComunicacionesArea({
  areaNombre,
  usuarioNombre,
  seccion: seccionControlada,
  onSeccionChange,
  recargarTrigger,
  onUltimaComunicacionId,
  abrirId,
  onAbierta,
}: Props) {
  const [seccionLocal, setSeccionLocal] = useState<Seccion>(seccionControlada ?? "bandeja");
  const seccion = seccionControlada ?? seccionLocal;
  const setSeccion = (s: Seccion) => { setSeccionLocal(s); onSeccionChange?.(s); };
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([]);
  const [correos, setCorreos] = useState<CorreoSinAsociar[]>([]);
  const [dependencias, setDependencias] = useState<DependenciaCom[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Comunicacion | null>(null);
  const [version, setVersion] = useState(0);

  // Abrir una comunicación pedida desde fuera (búsqueda avanzada).
  useEffect(() => {
    if (!abrirId) return;
    apiObtenerComunicacion(abrirId)
      .then(setAbierta)
      .catch((e) => sileo.error({ title: "No se pudo abrir la comunicación", description: formatApiError(e) }))
      .finally(() => onAbierta?.());
  }, [abrirId, onAbierta]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [coms, sinAsoc, deps] = await Promise.all([
        apiListComunicaciones(), apiListCorreosSinAsociar(), apiListDependenciasCom(),
      ]);
      setComunicaciones(coms);
      setCorreos(sinAsoc);
      setDependencias(deps);
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(formatApiError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (recargarTrigger) cargar();
  }, [recargarTrigger, cargar]);

  useEffect(() => {
    const ultimaNueva = comunicaciones.find(c => c.estado === "nueva");
    if (ultimaNueva?.id) {
      onUltimaComunicacionId?.(ultimaNueva.id);
    }
  }, [comunicaciones, onUltimaComunicacionId]);

  const reemplazar = (c: Comunicacion, extra?: Comunicacion) => {
    setComunicaciones(prev => {
      const sinViejas = prev.filter(x => x.id !== c.id && x.id !== extra?.id);
      return [c, ...(extra ? [extra] : []), ...sinViejas].sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion));
    });
    setAbierta(c);
    setVersion(v => v + 1);
  };

  // Leído y reclasificar: se queda en la bandeja, sin abrir el detalle.
  const aplicarTriaje = async (c: Comunicacion, cambios: CambiosTriaje) => {
    try {
      const actualizada = await apiActualizarTriaje(c.id, cambios);
      setComunicaciones(prev => prev.map(x => (x.id === actualizada.id ? actualizada : x)));
    } catch (e) {
      sileo.error({ title: "No se pudo actualizar el correo", description: formatApiError(e) });
    }
  };

  const nuevas = comunicaciones.filter(c => c.estado === "nueva").length;
  const remitidas = comunicaciones.filter(c => c.estado === "remitida" || c.estado === "devuelta").length;
  const respondidas = comunicaciones.filter(c => c.estado === "respondida_dependencia").length;
  const vencidas = comunicaciones.filter(estaVencida).length;

  const indicadores = [
    { label: "Nuevas", sub: "Por remitir", valor: nuevas, icon: Inbox, cls: "bg-blue-50 text-blue-600 border-blue-100", iconBg: "bg-blue-100" },
    { label: "Remitidas", sub: "Esperando dependencia", valor: remitidas, icon: Send, cls: "bg-amber-50 text-amber-600 border-amber-100", iconBg: "bg-amber-100" },
    { label: "Respondidas", sub: "Por responder al remitente", valor: respondidas, icon: Mail, cls: "bg-violet-50 text-violet-600 border-violet-100", iconBg: "bg-violet-100" },
    { label: "Vencidas", sub: "Plazo superado", valor: vencidas, icon: AlertTriangle, cls: "bg-red-50 text-red-600 border-red-100", iconBg: "bg-red-100" },
  ];

  // Detalle a pantalla completa: reemplaza la bandeja (como en el mockup).
  if (abierta) {
    return (
      <DetalleComunicacion
        comunicacion={abierta}
        dependencias={dependencias}
        usuarioNombre={usuarioNombre}
        onClose={() => setAbierta(null)}
        onActualizada={reemplazar}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cabecera del módulo ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14] mb-1">Comunicaciones</p>
          <h2 className="text-xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <Mail className="w-6 h-6 text-[#e8740e]" />
            Bandeja de correspondencia
          </h2>
          <p className="text-sm text-[#6b7a8d] mt-0.5">
            {areaNombre} · correos de <span className="font-medium text-[#2c3e50]">correspondencia@uniautonoma.edu.co</span> registrados por n8n
          </p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6b7a8d] border border-[rgba(30,58,95,0.09)] bg-white rounded-lg px-3 py-1.5 hover:bg-[#f3ede1] hover:text-[#1e3a5f] transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} /> Refrescar
        </button>
      </div>

      {/* ── Indicadores ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indicadores.map(({ label, sub, valor, icon: Icon, cls, iconBg }) => (
          <div key={label} className={`rounded-xl p-4 border shadow-sm flex items-center gap-3 transition-transform hover:-translate-y-0.5 ${cls}`}>
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{cargando ? "–" : valor}</p>
              <p className="text-xs font-bold mt-1">{label}</p>
              <p className="text-[10px] opacity-70">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pestañas internas ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 bg-white border border-[rgba(30,58,95,0.09)] rounded-xl p-1 shadow-sm">
          {([
            { key: "bandeja", label: "Bandeja", corto: "Bandeja", icon: Inbox, badge: 0 },
            { key: "sinAsociar", label: "Correos sin asociar", corto: "Sin asociar", icon: MailQuestion, badge: correos.length },
            // Registro histórico: oculto por ahora (pedido del usuario, 30/10/2026).
          ] as const).map(({ key, label, corto, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setSeccion(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                seccion === key ? "bg-[#1e3a5f] text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{corto}</span>
              {!!badge && (
                <span className="ml-0.5 bg-[#e8740e] text-white rounded-full px-1.5 text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {cargando && comunicaciones.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-[#6b7a8d] text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando comunicaciones…
        </div>
      ) : errorCarga && comunicaciones.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-[#e8740e]" />
          <div>
            <p className="text-sm font-bold text-[#1e3a5f]">No se pudieron cargar las comunicaciones</p>
            <p className="text-xs text-[#6b7a8d] mt-1">{errorCarga}</p>
          </div>
          <button onClick={cargar} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#2a4a6f] rounded-lg px-4 py-2 transition-colors">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      ) : (
        <>
          {errorCarga && (
            <p role="alert" className="text-xs font-semibold text-[#e8740e]">No se pudo actualizar la bandeja: se muestra la última información cargada.</p>
          )}
          {seccion === "bandeja" && (
            <BandejaComunicaciones comunicaciones={comunicaciones} dependencias={dependencias} onAbrir={setAbierta} onTriaje={aplicarTriaje} />
          )}
          {seccion === "sinAsociar" && (
            <CorreosSinAsociarSeccion
              correos={correos}
              comunicaciones={comunicaciones}
              onResuelto={(correoId, com, comoNueva) => {
                setCorreos(prev => prev.filter(c => c.id !== correoId));
                if (comoNueva) {
                  setComunicaciones(prev => [com, ...prev].sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion)));
                } else {
                  reemplazar(com);
                }
                setAbierta(null);
                cargar();
              }}
            />
          )}
          {seccion === "historico" && <RegistroHistorico onAbrir={setAbierta} version={version} />}
        </>
      )}

    </div>
  );
}
