/**
 * @file ComunicacionesArea.tsx
 * @description Módulo Comunicaciones del Panel de Área (Archivo Central · SGD).
 *
 * Circuito de comunicaciones por correo: Bandeja (recepción, remisión a
 * dependencias, respuesta al remitente), Correos sin asociar y Registro histórico.
 * Distribución basada en los mockups (ia_contexto/diseno/); colores de NOVA.
 *
 * ⚠️ Usa datos simulados (lib/comunicacionesApi.ts) hasta conectar el backend.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Clock, Inbox, Loader2, Mail, MailQuestion, RefreshCw, Send } from "lucide-react";
import {
  type Comunicacion, type CorreoSinAsociar, type DependenciaCom,
  apiListComunicaciones, apiListCorreosSinAsociar, apiListDependenciasCom, estaVencida,
} from "../../lib/comunicacionesApi";
import { BandejaComunicaciones } from "./BandejaComunicaciones";
import { CorreosSinAsociar as CorreosSinAsociarSeccion } from "./CorreosSinAsociar";
import { RegistroHistorico } from "./RegistroHistorico";
import { DetalleComunicacion } from "./DetalleComunicacion";

type Seccion = "bandeja" | "sinAsociar" | "historico";

interface Props {
  areaNombre: string;
  usuarioNombre: string;
}

export function ComunicacionesArea({ areaNombre, usuarioNombre }: Props) {
  const [seccion, setSeccion] = useState<Seccion>("bandeja");
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([]);
  const [correos, setCorreos] = useState<CorreoSinAsociar[]>([]);
  const [dependencias, setDependencias] = useState<DependenciaCom[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<Comunicacion | null>(null);
  const [version, setVersion] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [coms, sinAsoc, deps] = await Promise.all([
        apiListComunicaciones(), apiListCorreosSinAsociar(), apiListDependenciasCom(),
      ]);
      setComunicaciones(coms);
      setCorreos(sinAsoc);
      setDependencias(deps);
    } catch {
      toast.error("Error al cargar las comunicaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const reemplazar = (c: Comunicacion, extra?: Comunicacion) => {
    setComunicaciones(prev => {
      const sinViejas = prev.filter(x => x.id !== c.id && x.id !== extra?.id);
      return [c, ...(extra ? [extra] : []), ...sinViejas].sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion));
    });
    setAbierta(c);
    setVersion(v => v + 1);
  };

  const nuevas = comunicaciones.filter(c => c.estado === "nueva").length;
  const remitidas = comunicaciones.filter(c => c.estado === "remitida" || c.estado === "devuelta").length;
  const respondidas = comunicaciones.filter(c => c.estado === "respondida_dependencia").length;
  const vencidas = comunicaciones.filter(estaVencida).length;

  return (
    <div className="space-y-6">
      {/* ── Cabecera del módulo ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-orange-500" />
            Comunicaciones
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {areaNombre} · correos de <span className="font-medium">correspondencia@uniautonoma.edu.co</span> registrados por n8n
          </p>
        </div>
        <div className="flex items-center gap-2">
          {vencidas > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="w-3 h-3" /> {vencidas} vencida(s)
            </span>
          )}
          <button
            onClick={cargar}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} /> Refrescar
          </button>
        </div>
      </div>

      {/* ── Indicadores ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Nuevas", sub: "Por remitir", valor: nuevas, icon: Inbox, cls: "text-blue-600 bg-blue-50" },
          { label: "Remitidas", sub: "Esperando dependencia", valor: remitidas, icon: Send, cls: "text-amber-600 bg-amber-50" },
          { label: "Respondidas", sub: "Por responder al remitente", valor: respondidas, icon: Mail, cls: "text-violet-600 bg-violet-50" },
          { label: "Vencidas", sub: "Plazo superado", valor: vencidas, icon: Clock, cls: "text-red-600 bg-red-50" },
        ].map(({ label, sub, valor, icon: Icon, cls }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${cls}`}><Icon className="w-5 h-5" /></span>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{cargando ? "–" : valor}</p>
              <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
              <p className="text-[10px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pestañas internas ───────────────────────────────────────────── */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 w-fit">
        {([
          { key: "bandeja", label: "Bandeja", corto: "Bandeja", icon: Inbox, badge: 0 },
          { key: "sinAsociar", label: "Correos sin asociar", corto: "Sin asociar", icon: MailQuestion, badge: correos.length },
          { key: "historico", label: "Registro histórico", corto: "Histórico", icon: CalendarDays, badge: 0 },
        ] as const).map(({ key, label, corto, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setSeccion(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              seccion === key ? "bg-white text-orange-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{corto}</span>
            {badge > 0 && <span className="ml-0.5 bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold">{badge}</span>}
          </button>
        ))}
      </div>

      {cargando && comunicaciones.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando comunicaciones…
        </div>
      ) : (
        <>
          {seccion === "bandeja" && (
            <BandejaComunicaciones comunicaciones={comunicaciones} dependencias={dependencias} onAbrir={setAbierta} />
          )}
          {seccion === "sinAsociar" && (
            <CorreosSinAsociarSeccion
              correos={correos}
              comunicaciones={comunicaciones}
              usuarioNombre={usuarioNombre}
              onResuelto={(correoId, com) => {
                setCorreos(prev => prev.filter(c => c.id !== correoId));
                reemplazar(com);
                setAbierta(null);
              }}
            />
          )}
          {seccion === "historico" && <RegistroHistorico onAbrir={setAbierta} version={version} />}
        </>
      )}

      <DetalleComunicacion
        comunicacion={abierta}
        dependencias={dependencias}
        usuarioNombre={usuarioNombre}
        onClose={() => setAbierta(null)}
        onActualizada={reemplazar}
      />
    </div>
  );
}
