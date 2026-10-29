/**
 * @file RegistroHistorico.tsx
 * @description Registro histórico de comunicaciones (RF-AC-019, SGD-044).
 * Calendario de 12 meses por año con el total y el desglose "cerradas en el sistema · importadas de
 * Excel"; filtro por recibidas, enviadas o internas; al elegir un mes, la lista de sus comunicaciones.
 * "Importar Excel" abre el asistente de importación (vista previa, sin duplicar).
 */
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { formatApiError } from "../../lib/api";
import {
  apiCalendarioHistorico, apiComunicacionesDelMes, apiObtenerComunicacion, formatoFecha,
  type CalendarioHistorico, type Comunicacion, type ComunicacionHistorico, type FiltroHistorico,
} from "../../lib/comunicacionesApi";
import { EstadoBadge, MESES, TipoBadge, Vacio } from "./comunicacionesUi";
import { ImportarHistorico } from "./ImportarHistorico";

interface Props {
  onAbrir: (c: Comunicacion) => void;
  version?: number;
}

const FILTROS: { valor: FiltroHistorico; label: string }[] = [
  { valor: "", label: "Todas" },
  { valor: "recibidas", label: "Recibidas" },
  { valor: "enviadas", label: "Enviadas" },
  { valor: "internas", label: "Internas" },
];

const ANIO_ACTUAL = new Date().getFullYear();
const PRIMER_ANIO = 2019;

export function RegistroHistorico({ onAbrir, version }: Props) {
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [filtro, setFiltro] = useState<FiltroHistorico>("");
  const [calendario, setCalendario] = useState<CalendarioHistorico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mes, setMes] = useState<number | null>(null);
  const [lista, setLista] = useState<{ total: number; filas: ComunicacionHistorico[] } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [importar, setImportar] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    apiCalendarioHistorico(anio, filtro)
      .then((c) => { if (vigente) setCalendario(c); })
      .catch((e) => { if (vigente) setError(formatApiError(e)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [anio, filtro, recarga, version]);

  const cargarMes = useCallback(async (m: number, p: number) => {
    setCargandoLista(true);
    try {
      setLista(await apiComunicacionesDelMes(anio, m, filtro, p));
    } catch (e) {
      setLista(null);
      sileo.error({ title: "No se pudieron cargar las comunicaciones del mes", description: formatApiError(e) });
    } finally {
      setCargandoLista(false);
    }
  }, [anio, filtro]);

  // Al cambiar de año, filtro o tras importar, la lista abierta se vuelve a cargar.
  useEffect(() => {
    if (mes !== null) cargarMes(mes, pagina);
  }, [mes, pagina, cargarMes, recarga]);

  const elegirMes = (m: number) => { setPagina(1); setMes(m === mes ? null : m); if (m === mes) setLista(null); };

  const abrir = async (id: number) => {
    setAbriendo(id);
    try {
      onAbrir(await apiObtenerComunicacion(id));
    } catch (e) {
      sileo.error({ title: "No se pudo abrir la comunicación", description: formatApiError(e) });
    } finally {
      setAbriendo(null);
    }
  };

  const anios = Array.from(new Set([
    ...Array.from({ length: ANIO_ACTUAL - PRIMER_ANIO + 1 }, (_, i) => ANIO_ACTUAL - i),
    ...(calendario?.anios ?? []),
  ])).sort((a, b) => b - a);
  const totalAnio = calendario?.meses.reduce((s, m) => s + m.total, 0) ?? 0;
  const paginas = lista ? Math.max(1, Math.ceil(lista.total / 50)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="historico-anio" className="sr-only">Año</label>
          <select id="historico-anio" value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setMes(null); setLista(null); }}
            className="h-9 rounded-lg border border-[rgba(30,58,95,0.12)] bg-white px-3 text-sm font-semibold text-[#1e3a5f] shadow-sm">
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="inline-flex gap-1 rounded-xl border border-[rgba(30,58,95,0.09)] bg-white p-1 shadow-sm" role="group" aria-label="Tipo de comunicación">
            {FILTROS.map((f) => (
              <button key={f.label} onClick={() => { setFiltro(f.valor); setPagina(1); }} aria-pressed={filtro === f.valor}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filtro === f.valor ? "bg-[#1e3a5f] text-white" : "text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f]"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRecarga((n) => n + 1)} aria-label="Actualizar"
            className="rounded-lg border border-[rgba(30,58,95,0.09)] bg-white p-2 text-[#6b7a8d] shadow-sm hover:bg-[#f3ede1] hover:text-[#1e3a5f]">
            <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setImportar(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#152a45]">
            <FileSpreadsheet className="h-4 w-4" /> Importar Excel
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          <p className="font-semibold">No se pudo cargar el histórico</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : cargando && !calendario ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando calendario…</p>
      ) : calendario && (
        <>
          <p className="text-sm text-[#6b7a8d]">
            <span className="font-semibold text-[#2c3e50]">{totalAnio}</span> {totalAnio === 1 ? "comunicación" : "comunicaciones"} en {anio}. Elija un mes para ver el detalle.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {calendario.meses.map((m) => {
              const sinLlegar = m.futuro && m.total === 0;
              const activo = mes === m.mes;
              return (
                <button key={m.mes} onClick={() => elegirMes(m.mes)} disabled={sinLlegar} aria-pressed={activo}
                  className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-colors ${
                    activo ? "border-[#1e3a5f] ring-2 ring-[#1e3a5f]/20" : "border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/60"
                  } ${sinLlegar ? "cursor-default opacity-50 hover:bg-white" : ""}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6b7a8d]">{MESES[m.mes - 1]}</p>
                  {sinLlegar ? (
                    <p className="mt-2 text-sm text-[#6b7a8d]">Aún no llega</p>
                  ) : (
                    <>
                      <p className="mt-1 text-2xl font-bold leading-none text-[#1e3a5f]">{m.total}</p>
                      <p className="mt-1 text-[11px] text-[#6b7a8d]">{m.cerradas_sistema} cerradas en el sistema · {m.importadas} importadas de Excel</p>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mes !== null && (
        <div className="overflow-hidden rounded-2xl border border-[rgba(30,58,95,0.12)] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#1e3a5f]">
              <CalendarDays className="h-4 w-4" /> {MESES[mes - 1]} de {anio}
              {lista && <span className="font-normal text-[#6b7a8d]">· {lista.total}</span>}
            </p>
            {paginas > 1 && (
              <div className="flex items-center gap-1 text-xs text-[#6b7a8d]">
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} aria-label="Página anterior"
                  className="rounded p-1 hover:bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                {pagina} / {paginas}
                <button onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina === paginas} aria-label="Página siguiente"
                  className="rounded p-1 hover:bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>
          {cargandoLista && !lista ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
          ) : !lista || lista.filas.length === 0 ? (
            <Vacio icon={CalendarDays} titulo="Sin comunicaciones en este mes" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-[#f3ede1]/60 text-left text-xs font-semibold text-[#1e3a5f]">
                    <th className="px-4 py-2">Consecutivo</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Asunto</th><th className="px-4 py-2">Remitente / destinatario</th><th className="px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.filas.map((c) => (
                    <tr key={c.id} tabIndex={0} aria-label={`Abrir ${c.consecutivo}`}
                      onClick={() => abrir(c.id)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                        e.preventDefault();
                        abrir(c.id);
                      }}
                      className="cursor-pointer border-t border-[rgba(30,58,95,0.06)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#2c3e50]">
                          {abriendo === c.id && <Loader2 className="h-3 w-3 animate-spin" />}{c.consecutivo}
                        </p>
                        {c.consecutivo_original && <p className="text-[11px] text-[#6b7a8d]">N.º original {c.consecutivo_original}</p>}
                      </td>
                      <td className="px-4 py-2.5"><TipoBadge tipo={c.tipo} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[#6b7a8d]">{formatoFecha(c.fecha_recepcion)}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[#2c3e50]">{c.asunto}</p>
                        {c.dependencia && <p className="text-[11px] text-[#6b7a8d]">{c.dependencia}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#2c3e50]">{(c.tipo === "ENT" ? c.remitente_nombre : c.destinatario_nombre) ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {c.origen === "historico" ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Importada de Excel</span>
                        ) : <EstadoBadge estado={c.estado} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ImportarHistorico open={importar} onClose={() => setImportar(false)} onImportado={() => setRecarga((n) => n + 1)} />
    </div>
  );
}
