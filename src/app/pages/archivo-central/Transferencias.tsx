/**
 * @file Transferencias.tsx
 * @description Archivo Central › Ingreso › Transferencias documentales.
 * Carga la lista y el resumen desde el backend (/api/transferencias y /api/transferencias/resumen).
 * Si recibe `tipoInicial` (desde Centro de cargas B o C), abre directo el asistente con ese tipo de entrega.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, RotateCw } from "lucide-react";
import { NuevaTransferencia } from "./NuevaTransferencia";
import { DetalleTransferencia } from "./DetalleTransferencia";
import {
  transferenciasApi, type ResumenTransferencias, type TipoEntrega, type TransferenciaApi,
} from "../../services/archivoCentralApi";

export type { TipoEntrega };

const ETIQUETA_TIPO: Record<TipoEntrega, string> = { fisica: "Física", digital: "Digital", ambas: "Física y digital" };

const PILDORA: Record<TransferenciaApi["estado"], string> = {
  Borrador: "bg-slate-100 text-slate-600",
  "En revisión": "bg-amber-50 text-amber-700",
  Recibida: "bg-emerald-50 text-emerald-700",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const verFecha = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return a ? `${d} ${MESES[m - 1]} ${a}` : "—";
};

export function Transferencias({ tipoInicial, abrirId, onAbierta }: {
  tipoInicial?: TipoEntrega;
  /** Abre directo el detalle de esta transferencia (desde Consulta › Buscar o el Archivo). */
  abrirId?: number;
  onAbierta?: () => void;
}) {
  // Si llega un tipo (desde Centro de cargas), abre directo el asistente.
  const [nueva, setNueva] = useState(!!tipoInicial);
  const [tipo, setTipo] = useState<TipoEntrega>(tipoInicial ?? "fisica");

  const [detalleId, setDetalleId] = useState<number | null>(abrirId ?? null);
  const [lista, setLista] = useState<TransferenciaApi[]>([]);
  const [resumen, setResumen] = useState<ResumenTransferencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [l, r] = await Promise.all([transferenciasApi.listar(), transferenciasApi.resumen()]);
      setLista(l);
      setResumen(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga al entrar y cada vez que se vuelve de "Nueva transferencia" (para ver la recién creada).
  useEffect(() => { if (!nueva && detalleId === null) cargar(); }, [nueva, detalleId, cargar]);

  if (detalleId !== null) return <DetalleTransferencia id={detalleId} onVolver={() => { setDetalleId(null); onAbierta?.(); }} />;
  if (nueva) return <NuevaTransferencia tipoInicial={tipo} onVolver={() => setNueva(false)} />;

  const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso</p>
          <h2 className="text-2xl font-bold text-[#1e3a5f] sm:text-3xl">Transferencias documentales</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6b7a8d]">
            Cada dependencia entrega una vez al año lo que lleva dos años en su archivo de gestión, con inventario, acta de entrega y rótulos.
          </p>
        </div>
        <button
          onClick={() => { setTipo("fisica"); setNueva(true); }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nueva transferencia
        </button>
      </div>

      {/* Error de conexión */}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={cargar} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50">
            <RotateCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      )}

      {/* Resumen */}
      {resumen && (
        <dl className="grid grid-cols-1 divide-[rgba(30,58,95,0.12)] border-y-2 border-t-[#1e3a5f] border-b-[rgba(30,58,95,0.12)] md:grid-cols-3 md:divide-x">
          <div className="px-5 py-4">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Año transferible en {resumen.anioActual}</dt>
            <dd className="text-2xl font-bold text-[#1e3a5f]">Hasta {resumen.anioMaximo}</dd>
            <p className="mt-1 text-xs text-[#6b7a8d]">Regla de los dos años: año actual − 2. Lo más reciente sigue en el archivo de gestión.</p>
          </div>
          <div className="px-5 py-4">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Próxima transferencia</dt>
            <dd className="text-2xl font-bold text-[#1e3a5f]">{resumen.proximoAnio} → hasta {resumen.proximoMaximo}</dd>
            <p className="mt-1 text-xs text-[#6b7a8d]">Cada año cada dependencia hace una transferencia nueva.</p>
          </div>
          <div className="px-5 py-4">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Faltan por entregar {resumen.anioMaximo}</dt>
            <dd className="text-2xl font-bold text-[#1e3a5f]">{resumen.faltan.length} de {resumen.total}</dd>
            <p className="mt-1 text-xs text-[#6b7a8d]">
              {resumen.faltan.length > 0 ? resumen.faltan.join(", ") : "Todas las dependencias entregaron."}
            </p>
          </div>
        </dl>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
              {["Código", "Dependencia", "Año", "Tipo", "Estado", "Fecha", "Quién entrega", "Contenido", "Unid."].map(h => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#6b7a8d]">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando transferencias…
              </td></tr>
            )}
            {!cargando && !error && lista.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#6b7a8d]">
                Aún no hay transferencias registradas. Usa “Nueva transferencia” para crear la primera.
              </td></tr>
            )}
            {!cargando && lista.map(t => (
              <tr
                key={t.codigo}
                onClick={() => setDetalleId(t.id)}
                className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] odd:bg-white even:bg-[#f3ede1]/40 hover:bg-[#f3ede1]/70"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDetalleId(t.id); }}
                    className="text-[#1e3a5f] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#e8740e]"
                  >
                    {t.codigo}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#2c3e50]">{t.dependencia}</td>
                <td className="px-3 py-2.5 text-sm text-[#6b7a8d]">{t.anio}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#2c3e50]">{ETIQUETA_TIPO[t.tipo]}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${PILDORA[t.estado]}`}>{t.estado}</span>
                  {t.porClasificar ? <p className="mt-0.5 text-[11px] text-[#6b7a8d]">{t.porClasificar} por clasificar</p> : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#2c3e50]">{verFecha(t.fecha)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[#2c3e50]">{t.entrega}</td>
                <td className="min-w-[260px] px-3 py-2.5">
                  <p className="text-sm font-bold text-[#1e3a5f]">{t.contenido}</p>
                  <p className="text-xs text-[#6b7a8d]">{t.detalle}</p>
                </td>
                <td className="px-3 py-2.5 text-sm text-[#2c3e50]">{t.unidades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}