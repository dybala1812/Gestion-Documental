/**
 * @file RegistroHistorico.tsx
 * @description Registro histórico de comunicaciones (RF-AC-019): calendario por
 * año y mes con las cerradas en el sistema y las importadas de los Excel.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, FileSpreadsheet, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  type Comunicacion, type ResumenMesHistorico,
  apiComunicacionesDelMes, apiResumenHistorico, formatoFecha,
} from "../../lib/comunicacionesApi";
import { MESES, TipoBadge, Vacio } from "./comunicacionesUi";

type FiltroTipo = "todas" | "ENT" | "SAL" | "INT";

interface Props {
  onAbrir: (c: Comunicacion) => void;
  /** Cambia cuando se cierra una comunicación, para refrescar los totales. */
  version: number;
}

export function RegistroHistorico({ onAbrir, version }: Props) {
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: anioActual - 2019 + 1 }, (_, i) => anioActual - i);
  const [anio, setAnio] = useState(anioActual);
  const [tipo, setTipo] = useState<FiltroTipo>("todas");
  const [resumen, setResumen] = useState<ResumenMesHistorico[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mesSel, setMesSel] = useState<number | null>(null);
  const [delMes, setDelMes] = useState<Comunicacion[]>([]);
  const [cargandoMes, setCargandoMes] = useState(false);

  useEffect(() => {
    setCargando(true);
    setMesSel(null);
    apiResumenHistorico(anio).then(setResumen).finally(() => setCargando(false));
  }, [anio, version]);

  const abrirMes = async (mes: number) => {
    setMesSel(mes);
    setCargandoMes(true);
    try {
      setDelMes(await apiComunicacionesDelMes(anio, mes));
    } finally {
      setCargandoMes(false);
    }
  };

  const lista = delMes.filter(c => tipo === "todas" || c.tipo === tipo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white h-9" value={anio} onChange={e => setAnio(Number(e.target.value))} aria-label="Año">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([["todas", "Todas"], ["ENT", "Recibidas"], ["SAL", "Enviadas"], ["INT", "Internas"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTipo(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tipo === k ? "bg-white text-orange-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info("Importación de Excel", { description: "Disponible cuando se conecte el backend (Centro de cargas · Registro histórico)." })}
        >
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Importar Excel
        </Button>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Cerradas en el sistema</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a5f]" /> Importadas de Excel</span>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {resumen.map(r => {
            const futuro = r.cerradas_sistema < 0;
            const total = futuro ? 0 : r.cerradas_sistema + r.importadas;
            const pctSistema = total > 0 ? (r.cerradas_sistema / total) * 100 : 0;
            return (
              <button
                key={r.mes}
                disabled={futuro}
                onClick={() => abrirMes(r.mes)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  futuro ? "bg-gray-50 border-dashed border-gray-200 cursor-not-allowed"
                    : mesSel === r.mes ? "bg-white border-orange-400 ring-2 ring-orange-100 shadow-sm"
                      : "bg-white border-gray-200 hover:border-orange-300 hover:shadow-sm"
                }`}
              >
                <p className="text-xs font-semibold text-gray-500">{MESES[r.mes - 1]}</p>
                <p className={`text-2xl font-bold mt-1 ${futuro ? "text-gray-300" : "text-gray-900"}`}>{futuro ? "—" : total}</p>
                {futuro ? (
                  <p className="text-[11px] text-gray-400 mt-1">Aún no llega</p>
                ) : (
                  <>
                    <div className="h-1.5 rounded-full bg-[#1e3a5f] overflow-hidden mt-2">
                      <div className="h-full bg-orange-500" style={{ width: `${pctSistema}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">{r.cerradas_sistema} cerradas · {r.importadas} importadas</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {mesSel !== null && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-orange-500" /> {MESES[mesSel - 1]} {anio}
            </h3>
            <button onClick={() => setMesSel(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
          {cargandoMes ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
          ) : lista.length === 0 ? (
            <Vacio icon={CalendarDays} titulo="Sin comunicaciones cerradas en el sistema este mes"
              texto="Las importadas de Excel se listarán cuando se conecte el backend" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {lista.map(c => (
                <li key={c.id}>
                  <button onClick={() => onAbrir(c)} className="w-full text-left px-4 py-3 hover:bg-orange-50/40 flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <p className="font-mono text-xs font-semibold text-gray-900">{c.consecutivo}</p>
                      <TipoBadge tipo={c.tipo} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{c.asunto}</p>
                      <p className="text-xs text-gray-400 truncate">{c.tipo === "SAL" ? c.destinatario_nombre : c.remitente_nombre}</p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{formatoFecha(c.cerrado_en ?? c.fecha_recepcion)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
