/**
 * @file BandejaComunicaciones.tsx
 * @description Bandeja de comunicaciones (RF-AC-015 a RF-AC-018).
 * Correos recibidos en el buzón de Archivo Central, registrados por n8n con su
 * consecutivo, con pestañas por estado, filtros y detalle de cada comunicación.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Inbox, Paperclip, Search, X } from "lucide-react";
import { Input } from "../../components/ui/input";
import {
  type Comunicacion, type DependenciaCom, type EstadoComunicacion,
  ALERTA_DIAS_SIN_RESPUESTA, diasDesde, diasRemitida, estaVencida, formatoFecha,
} from "../../lib/comunicacionesApi";
import { EstadoBadge, MESES, TipoBadge, Vacio } from "./comunicacionesUi";

type Pestana = EstadoComunicacion | "todas";

const PESTANAS: { key: Pestana; label: string }[] = [
  { key: "nueva", label: "Nuevas" },
  { key: "remitida", label: "Remitidas" },
  { key: "respondida_dependencia", label: "Respondidas" },
  { key: "devuelta", label: "Devueltas" },
  { key: "cerrada", label: "Cerradas" },
  { key: "anulada", label: "Anuladas" },
  { key: "todas", label: "Todas" },
];

interface Props {
  comunicaciones: Comunicacion[];
  dependencias: DependenciaCom[];
  onAbrir: (c: Comunicacion) => void;
}

export function BandejaComunicaciones({ comunicaciones, dependencias, onAbrir }: Props) {
  const [pestana, setPestana] = useState<Pestana>("nueva");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState("todos");
  const [mes, setMes] = useState("todos");
  const [depId, setDepId] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [soloSinRespuesta, setSoloSinRespuesta] = useState(false);

  const depNombre = (id: number | null) => dependencias.find(d => d.id === id)?.nombre ?? null;

  // Comunicaciones remitidas hace ≥ N días sin respuesta (alerta del mockup).
  const sinRespuesta = useMemo(
    () => comunicaciones
      .filter(c => (diasRemitida(c) ?? -1) >= ALERTA_DIAS_SIN_RESPUESTA)
      .sort((a, b) => (diasRemitida(b) ?? 0) - (diasRemitida(a) ?? 0)),
    [comunicaciones],
  );

  const anios = useMemo(
    () => Array.from(new Set(comunicaciones.map(c => new Date(c.fecha_recepcion).getFullYear()))).sort((a, b) => b - a),
    [comunicaciones],
  );

  const conteo = (p: Pestana) => p === "todas" ? comunicaciones.length : comunicaciones.filter(c => c.estado === p).length;

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const idsSinResp = new Set(sinRespuesta.map(c => c.id));
    return comunicaciones.filter(c => {
      if (soloSinRespuesta) return idsSinResp.has(c.id);
      if (pestana !== "todas" && c.estado !== pestana) return false;
      const f = new Date(c.fecha_recepcion);
      if (anio !== "todos" && f.getFullYear() !== Number(anio)) return false;
      if (mes !== "todos" && f.getMonth() + 1 !== Number(mes)) return false;
      if (depId !== "todas" && c.dependencia_id !== Number(depId)) return false;
      if (tipo !== "todos" && c.tipo !== tipo) return false;
      if (q) {
        const texto = `${c.consecutivo} ${c.remitente_nombre ?? ""} ${c.remitente_correo ?? ""} ${c.destinatario_nombre ?? ""} ${c.asunto}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [comunicaciones, pestana, busqueda, anio, mes, depId, tipo, soloSinRespuesta, sinRespuesta]);

  const selectCls = "border border-[rgba(30,58,95,0.09)] bg-white rounded-lg px-3 py-2 text-sm font-medium text-[#2c3e50] h-10 focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none";
  const hayFiltros = busqueda || anio !== "todos" || mes !== "todos" || depId !== "todas" || tipo !== "todos";

  return (
    <div className="space-y-5">
      {/* Alerta: remitidas sin respuesta */}
      {sinRespuesta.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-[#e8740e]/10 border border-[#e8740e]/20">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#e8740e]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1e3a5f]">
              {sinRespuesta.length} comunicación(es) llevan {ALERTA_DIAS_SIN_RESPUESTA} días o más remitidas sin respuesta
            </p>
            <p className="text-xs text-[#6b7a8d] truncate">
              {sinRespuesta.map(c => `${c.consecutivo.split("-").pop()} · ${depNombre(c.dependencia_id)} (${diasRemitida(c)} días)`).join(" · ")}
            </p>
          </div>
          <button
            onClick={() => setSoloSinRespuesta(v => !v)}
            className={`shrink-0 text-xs font-bold rounded-lg px-3 py-2 border transition-colors ${
              soloSinRespuesta ? "bg-[#e8740e] text-white border-[#e8740e]" : "bg-white text-[#e8740e] border-[#e8740e]/30 hover:bg-[#e8740e]/10"
            }`}
          >
            {soloSinRespuesta ? "Ver todas" : "Ver solo estas"}
          </button>
        </div>
      )}

      {/* Pestañas por estado */}
      {!soloSinRespuesta && (
        <div className="flex flex-wrap gap-1 bg-white border border-[rgba(30,58,95,0.09)] rounded-xl p-1 shadow-sm w-fit">
          {PESTANAS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPestana(key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                pestana === key ? "bg-[#1e3a5f] text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
              }`}
            >
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pestana === key ? "bg-white/25" : "bg-[#f3ede1] text-[#1e3a5f]"}`}>
                {conteo(key)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-[rgba(30,58,95,0.09)] rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6b7a8d]" />
          <Input className="pl-9 h-10 text-sm border-[rgba(30,58,95,0.09)] focus-visible:ring-[#1e3a5f]/20" placeholder="Persona o consecutivo" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className={selectCls} value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año">
          <option value="todos">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={selectCls} value={mes} onChange={e => setMes(e.target.value)} aria-label="Mes">
          <option value="todos">Todos los meses</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className={selectCls} value={depId} onChange={e => setDepId(e.target.value)} aria-label="Dependencia">
          <option value="todas">Todas las dependencias</option>
          {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select className={selectCls} value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo">
          <option value="todos">Todos los tipos</option>
          <option value="ENT">Entrada</option>
          <option value="SAL">Salida</option>
          <option value="INT">Interno</option>
        </select>
        {hayFiltros && (
          <button
            onClick={() => { setBusqueda(""); setAnio("todos"); setMes("todos"); setDepId("todas"); setTipo("todos"); }}
            className="flex items-center gap-1 text-xs font-semibold text-[#6b7a8d] hover:text-[#1e3a5f] px-2 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6b7a8d]">{filtradas.length} comunicación(es)</p>
      </div>

      {/* Tabla */}
      {filtradas.length === 0 ? (
        <Vacio icon={Inbox} titulo="No hay comunicaciones" texto="Prueba con otra pestaña o ajusta los filtros" />
      ) : (
        <div className="bg-white border border-[rgba(30,58,95,0.09)] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f3ede1] text-[11px] uppercase tracking-wide text-[#1e3a5f]">
                <tr>
                  <th className="text-left font-bold px-4 py-3">Consecutivo</th>
                  <th className="text-left font-bold px-4 py-3">Fecha</th>
                  <th className="text-left font-bold px-4 py-3">Remitente</th>
                  <th className="text-left font-bold px-4 py-3">Asunto</th>
                  <th className="text-left font-bold px-4 py-3">Dependencia</th>
                  <th className="text-left font-bold px-4 py-3">Estado</th>
                  <th className="text-left font-bold px-4 py-3">Días</th>
                  <th className="px-4 py-3" aria-label="Adjuntos" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(30,58,95,0.06)]">
                {filtradas.map(c => {
                  const dias = diasDesde(c.fecha_recepcion);
                  const vencida = estaVencida(c);
                  const persona = c.tipo === "SAL" ? c.destinatario_nombre : c.remitente_nombre;
                  const correo = c.tipo === "SAL" ? c.destinatario_correo : c.remitente_correo;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onAbrir(c)}
                      className={`cursor-pointer hover:bg-[#f3ede1]/60 transition-colors ${c.estado === "anulada" ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-[#1e3a5f] font-mono text-xs">{c.consecutivo}</p>
                        <TipoBadge tipo={c.tipo} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7a8d] text-xs">{formatoFecha(c.fecha_recepcion)}</td>
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <p className="font-semibold text-[#2c3e50] truncate max-w-[220px]">{persona}</p>
                        <p className="text-xs text-[#6b7a8d] truncate max-w-[220px]">{correo}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[#2c3e50] min-w-[180px]">{c.asunto}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#6b7a8d]">
                        {depNombre(c.dependencia_id) ?? <span className="text-[#6b7a8d]/60 italic">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <EstadoBadge estado={c.estado} />
                          {vencida && <span className="text-[10px] font-bold text-[#e8740e]">Vencida</span>}
                          {c.por_escalar && <span className="text-[10px] font-bold text-red-700">Por escalar</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#6b7a8d]">
                        {dias === 0 ? "Hoy" : dias === 1 ? "1 día" : `${dias} días`}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#6b7a8d]">
                        {c.adjuntos.length > 0 && (
                          <span className="inline-flex items-center gap-0.5"><Paperclip className="w-3.5 h-3.5" />{c.adjuntos.length}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
