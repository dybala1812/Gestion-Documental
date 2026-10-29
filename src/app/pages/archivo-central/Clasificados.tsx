/**
 * @file Clasificados.tsx
 * @description Archivo Central › Bandejas › Clasificados (Ingreso · Bandeja 2).
 * Datos reales desde el backend SGD (GET /api/clasificados). La búsqueda y el filtro por dependencia
 * se resuelven en el servidor. "Abrir PDF" abre la pantalla de detalle con el visor (GET /api/archivos/{id}).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, FolderCheck, Loader2, RefreshCw, Search, Upload } from "lucide-react";
import { DetalleDocumento, type DocumentoDetalle } from "./DetalleDocumento";
import { apiListClasificados, type Clasificado, type TipoClasificado } from "../../lib/clasificadosApi";
import { apiListDependenciasCom, formatoFecha, type DependenciaCom } from "../../lib/comunicacionesApi";
import { Paginacion, usePaginacion } from "./Paginacion";

const POR_PAGINA = 20;

const PILDORA_TIPO: Record<TipoClasificado, string> = {
  Entrada: "bg-blue-50 text-blue-700 border-blue-200",
  Salida: "bg-violet-50 text-violet-700 border-violet-200",
  Interno: "bg-slate-100 text-slate-600 border-slate-200",
};

const control =
  "h-10 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

function etiquetaEstado(estado: string) {
  const t = estado.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Adapta un clasificado del backend a la ficha de la pantalla de detalle. */
function aDetalle(c: Clasificado): DocumentoDetalle {
  return {
    consecutivo: c.consecutivo ?? `— / ${c.anio}`,
    fecha: c.fecha ? formatoFecha(c.fecha) : "Sin fecha",
    tipo: c.tipo,
    titulo: c.titulo,
    dependencia: c.dependencia,
    anio: c.anio,
    asunto: c.asunto ?? "Sin asunto",
    trd: c.trd ?? "—",
    contraparte: c.contraparte ?? "—",
    persona: "—",
    caja: c.caja ?? "—",
    carpeta: c.carpeta ?? "—",
    archivo: c.archivo_nombre ?? c.titulo,
    paginas: c.paginas ?? 1,
    origen: etiquetaEstado(c.origen ?? "—"),
    estado: c.estado === "anulado" ? "Anulado" : "Clasificado",
  };
}

export function Clasificados({ onCargarLote }: { onCargarLote?: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [dependenciaId, setDependenciaId] = useState("");
  const [dependencias, setDependencias] = useState<DependenciaCom[]>([]);
  const [items, setItems] = useState<Clasificado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  /** Documento abierto en la vista de detalle (visor del PDF + ficha); null = se ve la lista. */
  const [abierto, setAbierto] = useState<Clasificado | null>(null);

  // Dependencias reales para el filtro.
  useEffect(() => {
    apiListDependenciasCom().then(setDependencias).catch(() => setDependencias([]));
  }, []);

  // La búsqueda se envía al servidor medio segundo después de que se deja de escribir.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    apiListClasificados({
      q: busquedaAplicada || undefined,
      dependencia_id: dependenciaId ? Number(dependenciaId) : undefined,
    })
      .then(datos => { if (!cancelado) setItems(datos); })
      .catch(e => { if (!cancelado) setError(e instanceof Error ? e.message : "No se pudieron cargar los clasificados"); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [busquedaAplicada, dependenciaId, recarga]);

  const pag = usePaginacion(items, POR_PAGINA, [busquedaAplicada, dependenciaId]);

  if (abierto) {
    return (
      <DetalleDocumento
        documento={aDetalle(abierto)}
        documentoId={abierto.id}
        archivoId={abierto.archivo_id}
        textoVolver="Volver a clasificados"
        onVolver={() => setAbierto(null)}
        onAnulado={() => setRecarga(n => n + 1)}
      />
    );
  }

  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso · Bandeja 2</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <FolderCheck className="h-6 w-6 text-[#e8740e]" />
            Documentos clasificados
          </h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">
            Con su consecutivo, tipo, datos y la ruta donde quedaron. El PDF se abre desde aquí.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRecarga(n => n + 1)}
            aria-label="Refrescar"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm font-semibold text-[#6b7a8d] hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
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
        </div>
      </div>

      {/* ── Búsqueda y filtro ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en clasificados"
            aria-label="Buscar en clasificados"
            className={`${control} w-full pl-9 pr-3 placeholder:text-[#6b7a8d]/80`}
          />
        </div>
        <select
          className={`${control} px-3`}
          value={dependenciaId}
          onChange={e => setDependenciaId(e.target.value)}
          aria-label="Filtrar por dependencia"
        >
          <option value="">Todas las dependencias</option>
          {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>
      <p className="-mt-3 text-xs text-[#6b7a8d]">{cargando ? "Cargando…" : `${items.length} documento(s)`}</p>

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
      ) : cargando && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[rgba(30,58,95,0.09)] bg-white py-12 text-sm text-[#6b7a8d] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
          {busquedaAplicada || dependenciaId ? "Ningún documento coincide con la búsqueda." : "Aún no hay documentos clasificados."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <table className="w-full min-w-[1040px] border-collapse">
            <thead>
              <tr className="bg-[#f3ede1]/60">
                {["Consecutivo", "Tipo", "Datos", "Ruta · TRD", "Caja · carpeta", "Estado", ""].map((h, i) => (
                  <th key={h || i} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pag.visibles.map(c => (
                // Toda la fila abre el documento, igual que el botón Abrir PDF (SGD-088).
                <tr
                  key={c.id}
                  tabIndex={0}
                  aria-label={`Abrir ${c.consecutivo ?? c.titulo}`}
                  onClick={() => setAbierto(c)}
                  onKeyDown={e => {
                    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                    e.preventDefault();
                    setAbierto(c);
                  }}
                  className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-mono text-xs font-bold text-[#2c3e50]">{c.consecutivo ?? "—"}</p>
                    <p className="text-[11px] text-[#6b7a8d]">{c.fecha ? formatoFecha(c.fecha) : "Sin fecha"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {c.tipo ? (
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA_TIPO[c.tipo]}`}>{c.tipo}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#2c3e50]">{c.titulo}</p>
                    {c.contraparte && <p className="text-xs text-[#6b7a8d]">{c.contraparte}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="text-sm font-medium text-[#1e3a5f]">{c.dependencia} / {c.anio} / {c.asunto ?? "Sin asunto"}</p>
                    <p className="text-[11px] text-[#6b7a8d]">{c.trd ? `TRD ${c.trd}` : "Sin TRD"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">
                    Caja {c.caja ?? "—"} · Carpeta {c.carpeta ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {etiquetaEstado(c.estado)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setAbierto(c); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1] "
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Abrir PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!error && items.length > 0 && (
        <Paginacion pagina={pag.pagina} paginas={pag.paginas} desde={pag.desde} mostrados={pag.visibles.length}
          total={pag.total} onCambiar={pag.setPagina} etiqueta="documentos" />
      )}
    </div>
  );
}