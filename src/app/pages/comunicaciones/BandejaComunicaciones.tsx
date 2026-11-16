/**
 * @file BandejaComunicaciones.tsx
 * @description Bandeja de comunicaciones (RF-AC-015 a RF-AC-018).
 * Correos recibidos en el buzón de Archivo Central, registrados por n8n con su
 * consecutivo, con pestañas por estado, filtros y detalle de cada comunicación.
 * Triaje (D-32): contadores por categoría, correos urgentes, prioridad, resumen,
 * marcar como leído y reclasificar. La categoría y la prioridad las sugiere la IA.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Flame, Inbox, Mail, MailOpen, Paperclip, Search, X } from "lucide-react";
import { Input } from "../../components/ui/input";
import {
  type CategoriaCorreo, type Comunicacion, type DependenciaCom, type EstadoComunicacion, type PrioridadCorreo,
  ALERTA_DIAS_SIN_RESPUESTA, CATEGORIA_BADGE, CATEGORIA_LABEL, PRIORIDAD_BADGE, PRIORIDAD_LABEL,
  diasDesde, diasRemitida, esCorreoEntrante, esNoLeido, esUrgente, estaVencida, formatoFecha,
} from "../../lib/comunicacionesApi";
import { CategoriaBadge, EstadoBadge, MESES, PrioridadBadge, TipoBadge, Vacio } from "./comunicacionesUi";

type Pestana = EstadoComunicacion | "todas";
type FiltroCategoria = CategoriaCorreo | "sin_clasificar" | "todas";

export type CambiosTriaje = { leido?: boolean; categoria?: CategoriaCorreo; prioridad?: PrioridadCorreo };

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaCorreo[];
const PRIORIDADES = Object.keys(PRIORIDAD_LABEL) as PrioridadCorreo[];
const MAX_URGENTES_VISIBLES = 4;

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
  onTriaje: (c: Comunicacion, cambios: CambiosTriaje) => void;
}

export function BandejaComunicaciones({ comunicaciones, dependencias, onAbrir, onTriaje }: Props) {
  const [pestana, setPestana] = useState<Pestana>("nueva");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState("todos");
  const [mes, setMes] = useState("todos");
  const [depId, setDepId] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [soloSinRespuesta, setSoloSinRespuesta] = useState(false);
  const [categoria, setCategoria] = useState<FiltroCategoria>("todas");
  const [prioridad, setPrioridad] = useState("todas");
  const [soloNoLeidos, setSoloNoLeidos] = useState(false);
  const [soloUrgentes, setSoloUrgentes] = useState(false);

  // Contadores del triaje: correos de entrada que no están anulados.
  const correos = useMemo(() => comunicaciones.filter(c => esCorreoEntrante(c) && c.estado !== "anulada"), [comunicaciones]);
  const conteoCategoria = (cat: FiltroCategoria) => correos.filter(c => (cat === "sin_clasificar" ? !c.categoria : c.categoria === cat)).length;
  const noLeidos = correos.filter(esNoLeido).length;

  // Urgentes sin cerrar, los no leídos primero.
  const urgentes = useMemo(
    () => correos
      .filter(c => esUrgente(c) && c.estado !== "cerrada")
      .sort((a, b) => Number(esNoLeido(b)) - Number(esNoLeido(a)) || b.fecha_recepcion.localeCompare(a.fecha_recepcion)),
    [correos],
  );

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
      // Un filtro de triaje busca en todos los estados: si no, un urgente ya remitido no aparecería.
      const conFiltroTriaje = categoria !== "todas" || prioridad !== "todas" || soloNoLeidos || soloUrgentes;
      if (!conFiltroTriaje && pestana !== "todas" && c.estado !== pestana) return false;
      if (conFiltroTriaje && (!esCorreoEntrante(c) || c.estado === "anulada")) return false;
      if (categoria === "sin_clasificar" ? c.categoria : categoria !== "todas" && c.categoria !== categoria) return false;
      if (prioridad !== "todas" && c.prioridad !== prioridad) return false;
      if (soloNoLeidos && !esNoLeido(c)) return false;
      if (soloUrgentes && !esUrgente(c)) return false;
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
  }, [comunicaciones, pestana, busqueda, anio, mes, depId, tipo, soloSinRespuesta, sinRespuesta, categoria, prioridad, soloNoLeidos, soloUrgentes]);

  const selectCls = "border border-[rgba(30,58,95,0.09)] bg-white rounded-lg px-3 py-2 text-sm font-medium text-[#2c3e50] h-10 focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none";
  const hayFiltros = busqueda || anio !== "todos" || mes !== "todos" || depId !== "todas" || tipo !== "todos"
    || categoria !== "todas" || prioridad !== "todas" || soloNoLeidos || soloUrgentes;
  const hayFiltroTriaje = categoria !== "todas" || prioridad !== "todas" || soloNoLeidos || soloUrgentes;

  const chipCls = (activo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
      activo ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-[#2c3e50] border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]"
    }`;
  const chipNumeroCls = (activo: boolean) =>
    `rounded-full px-1.5 text-[11px] font-bold ${activo ? "bg-white/25" : "bg-[#f3ede1] text-[#1e3a5f]"}`;
  const elegirCategoria = (cat: FiltroCategoria) => { setSoloUrgentes(false); setCategoria(actual => (actual === cat ? "todas" : cat)); };

  return (
    <div className="space-y-5">
      {/* Contadores por categoría: también filtran */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Contadores por categoría">
        <button type="button" aria-pressed={soloNoLeidos} onClick={() => setSoloNoLeidos(v => !v)} className={chipCls(soloNoLeidos)}>
          <Mail className="w-3.5 h-3.5" /> No leídos <span className={chipNumeroCls(soloNoLeidos)}>{noLeidos}</span>
        </button>
        {CATEGORIAS.map(cat => (
          <button key={cat} type="button" aria-pressed={categoria === cat} onClick={() => elegirCategoria(cat)} className={chipCls(categoria === cat)}>
            {CATEGORIA_LABEL[cat]} <span className={chipNumeroCls(categoria === cat)}>{conteoCategoria(cat)}</span>
          </button>
        ))}
        <button type="button" aria-pressed={categoria === "sin_clasificar"} onClick={() => elegirCategoria("sin_clasificar")} className={chipCls(categoria === "sin_clasificar")}>
          Sin clasificar <span className={chipNumeroCls(categoria === "sin_clasificar")}>{conteoCategoria("sin_clasificar")}</span>
        </button>
      </div>

      {/* Correos urgentes sin cerrar */}
      {urgentes.length > 0 && !hayFiltroTriaje && (
        <section aria-label="Correos urgentes" className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-red-800">
              <Flame className="w-4 h-4" /> Correos urgentes
              <span className="rounded-full bg-red-100 px-2 text-xs">{urgentes.length}</span>
            </h3>
            {urgentes.length > MAX_URGENTES_VISIBLES && (
              <button type="button" onClick={() => setSoloUrgentes(true)} className="text-xs font-semibold text-red-800 underline underline-offset-2">
                Ver todos
              </button>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {urgentes.slice(0, MAX_URGENTES_VISIBLES).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAbrir(c)}
                className="text-left rounded-lg border border-red-100 bg-white p-3 hover:border-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <span className={`block text-sm truncate text-[#2c3e50] ${esNoLeido(c) ? "font-bold" : "font-medium"}`}>{c.asunto}</span>
                <span className="block text-xs text-[#6b7a8d] truncate mt-0.5">{c.remitente_nombre ?? c.remitente_correo} · {formatoFecha(c.fecha_recepcion)}</span>
                {c.resumen && <span className="block text-xs text-[#2c3e50] mt-1 line-clamp-2">{c.resumen}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

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

      {/* Pestañas por estado (un filtro de triaje busca en todos los estados) */}
      {!soloSinRespuesta && !hayFiltroTriaje && (
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
          <Input className="pl-9 h-10 text-sm border-[rgba(30,58,95,0.09)] focus-visible:ring-[#1e3a5f]/20" placeholder="Remitente, asunto o consecutivo" aria-label="Buscar" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className={selectCls} value={prioridad} onChange={e => setPrioridad(e.target.value)} aria-label="Prioridad">
          <option value="todas">Todas las prioridades</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
        </select>
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
            onClick={() => {
              setBusqueda(""); setAnio("todos"); setMes("todos"); setDepId("todas"); setTipo("todos");
              setCategoria("todas"); setPrioridad("todas"); setSoloNoLeidos(false); setSoloUrgentes(false);
            }}
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
                  <th className="pl-3 py-3" aria-label="Leído" />
                  <th className="text-left font-bold px-4 py-3">Consecutivo</th>
                  <th className="text-left font-bold px-4 py-3">Fecha</th>
                  <th className="text-left font-bold px-4 py-3">Remitente</th>
                  <th className="text-left font-bold px-4 py-3">Asunto y resumen</th>
                  <th className="text-left font-bold px-4 py-3">Categoría y prioridad</th>
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
                  const noLeido = esNoLeido(c);
                  const conTriaje = esCorreoEntrante(c) && c.estado !== "anulada";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onAbrir(c)}
                      className={`cursor-pointer hover:bg-[#f3ede1]/60 transition-colors ${c.estado === "anulada" ? "opacity-60" : ""} ${noLeido ? "bg-[#f3ede1]/30" : ""}`}
                    >
                      <td className="pl-3 py-3.5" onClick={e => e.stopPropagation()}>
                        {conTriaje && (
                          <button
                            type="button"
                            onClick={() => onTriaje(c, { leido: noLeido })}
                            title={noLeido ? "Marcar como leído" : "Marcar como no leído"}
                            aria-label={`${noLeido ? "Marcar como leído" : "Marcar como no leído"}: ${c.consecutivo}`}
                            className="p-2 rounded-lg text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40"
                          >
                            {noLeido ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-[#1e3a5f] font-mono text-xs">{c.consecutivo}</p>
                        <TipoBadge tipo={c.tipo} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7a8d] text-xs">{formatoFecha(c.fecha_recepcion)}</td>
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <p className="font-semibold text-[#2c3e50] truncate max-w-[220px]">{persona}</p>
                        <p className="text-xs text-[#6b7a8d] truncate max-w-[220px]">{correo}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[#2c3e50] min-w-[220px]">
                        <p className={`flex items-start gap-1.5 ${noLeido ? "font-bold" : ""}`}>
                          {noLeido && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#e8740e] shrink-0" title="No leído" />}
                          {c.asunto}
                        </p>
                        {c.resumen && <p className="text-xs text-[#6b7a8d] mt-0.5 line-clamp-2">{c.resumen}</p>}
                      </td>
                      <td className="px-4 py-3.5 min-w-[150px]" onClick={e => e.stopPropagation()}>
                        {conTriaje ? (
                          <div className="flex flex-col items-start gap-1">
                            <select
                              aria-label={`Categoría de ${c.consecutivo}`}
                              value={c.categoria ?? ""}
                              onChange={e => onTriaje(c, { categoria: e.target.value as CategoriaCorreo })}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ${c.categoria ? CATEGORIA_BADGE[c.categoria] : "bg-white text-[#6b7a8d] border-[rgba(30,58,95,0.15)]"}`}
                            >
                              {!c.categoria && <option value="" disabled>Sin clasificar</option>}
                              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{CATEGORIA_LABEL[cat]}</option>)}
                            </select>
                            <select
                              aria-label={`Prioridad de ${c.consecutivo}`}
                              value={c.prioridad ?? ""}
                              onChange={e => onTriaje(c, { prioridad: e.target.value as PrioridadCorreo })}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ${c.prioridad ? PRIORIDAD_BADGE[c.prioridad] : "bg-white text-[#6b7a8d] border-[rgba(30,58,95,0.15)]"}`}
                            >
                              {!c.prioridad && <option value="" disabled>Sin prioridad</option>}
                              {PRIORIDADES.map(p => <option key={p} value={p}>Prioridad {PRIORIDAD_LABEL[p].toLowerCase()}</option>)}
                            </select>
                            {c.triaje_origen === "ia" && <span className="text-[10px] text-[#6b7a8d]">Sugerido por IA</span>}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            {c.categoria && <CategoriaBadge categoria={c.categoria} />}
                            {c.prioridad && <PrioridadBadge prioridad={c.prioridad} />}
                          </div>
                        )}
                      </td>
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
