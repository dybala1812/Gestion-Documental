/**
 * @file PorClasificar.tsx
 * @description Archivo Central › Bandejas › Por clasificar (Ingreso · Bandeja 1).
 * Datos reales: GET /api/documentos?estado=por_clasificar.
 * OJO: guardar la clasificación desde ClasificarDocumento aún no se persiste (siguiente etapa).
 */
import { useEffect, useState } from "react";
import { FileText, Inbox, Loader2, Play, RefreshCw, Upload } from "lucide-react";
import { ClasificarDocumento, type DocumentoPendiente } from "./ClasificarDocumento";
import { apiListDocumentos } from "../../lib/documentosApi";
import { formatoFecha } from "../../lib/comunicacionesApi";

const select =
  "h-10 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

export function PorClasificar({ onCargarLote }: { onCargarLote?: () => void }) {
  const [documentos, setDocumentos] = useState<DocumentoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [dependencia, setDependencia] = useState("");
  const [origen, setOrigen] = useState("");
  /** Índice (dentro de `documentos`) del documento que se está clasificando; null = se ve la lista. */
  const [clasificando, setClasificando] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    apiListDocumentos("por_clasificar")
      .then(datos => {
        if (cancelado) return;
        setDocumentos(datos.map((d): DocumentoPendiente => ({
          id: String(d.id),
          nombre: d.archivo_nombre ?? d.titulo,
          dependencia: d.dependencia,
          anio: d.anio,
          origen: d.origen ?? "Documento individual",
          fechaCarga: d.cargado_en ? formatoFecha(d.cargado_en.slice(0, 10)) : "—",
          paginas: d.paginas ?? 1,
          archivoId: d.archivo_id,
        })));
      })
      .catch(e => { if (!cancelado) setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos"); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [recarga]);

  if (clasificando !== null) {
    return (
      <ClasificarDocumento
        documentos={documentos}
        indiceInicial={clasificando}
        onClasificado={id => setDocumentos(prev => prev.filter(d => d.id !== id))}
        onVolver={() => { setClasificando(null); setRecarga(n => n + 1); }}
      />
    );
  }

  const dependencias = [...new Set(documentos.map(d => d.dependencia))];
  const origenes = [...new Set(documentos.map(d => d.origen))];
  const visibles = documentos.filter(
    d => (!dependencia || d.dependencia === dependencia) && (!origen || d.origen === origen),
  );
  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso · Bandeja 1</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <Inbox className="h-6 w-6 text-[#e8740e]" />
            Documentos por clasificar
          </h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">Llegaron por transferencia y todavía no tienen asunto, año ni ubicación.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRecarga(n => n + 1)} aria-label="Refrescar"
            className="inline-flex h-10 items-center rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
          </button>
          {onCargarLote && (
            <button
              onClick={onCargarLote}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
            >
              <Upload className="h-4 w-4" /> Cargar lote
            </button>
          )}
          <button
            disabled={documentos.length === 0}
            onClick={() => setClasificando(0)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> Empezar a clasificar
          </button>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select className={select} value={dependencia} onChange={e => setDependencia(e.target.value)} aria-label="Filtrar por dependencia">
          <option value="">Todas las dependencias</option>
          {dependencias.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className={select} value={origen} onChange={e => setOrigen(e.target.value)} aria-label="Filtrar por origen">
          <option value="">Todos los orígenes</option>
          {origenes.map(o => <option key={o}>{o}</option>)}
        </select>
        <span className="text-xs text-[#6b7a8d]">{cargando ? "Cargando…" : `${visibles.length} documento(s)`}</span>
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm font-bold text-red-800">No se pudieron cargar los documentos</p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <button
            onClick={() => setRecarga(n => n + 1)}
            className="mt-3 h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : cargando && documentos.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[rgba(30,58,95,0.09)] bg-white py-12 text-sm text-[#6b7a8d] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos…
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
          No hay documentos por clasificar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-[#f3ede1]/60">
                {["Nombre", "Dependencia", "Año", "Origen", "Fecha de carga", "Estado", "Acciones"].map(h => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(d => (
                // Toda la fila abre el visor, igual que el botón Clasificar (SGD-088).
                <tr
                  key={d.id}
                  tabIndex={0}
                  aria-label={`Clasificar ${d.nombre}`}
                  onClick={() => setClasificando(documentos.findIndex(x => x.id === d.id))}
                  onKeyDown={e => {
                    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                    e.preventDefault();
                    setClasificando(documentos.findIndex(x => x.id === d.id));
                  }}
                  className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[#6b7a8d]" />
                      <span>
                        <span className="block font-mono text-xs font-bold text-[#2c3e50]">{d.nombre}</span>
                        <span className="block text-[11px] text-[#6b7a8d]">{d.paginas} pág.</span>
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#2c3e50]">{d.dependencia}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">{d.anio}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#2c3e50]">{d.origen}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">{d.fechaCarga}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      Por clasificar
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setClasificando(documentos.findIndex(x => x.id === d.id)); }}
                      className="rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                    >
                      Clasificar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}