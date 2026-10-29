/**
 * @file Archivo.tsx
 * @description Archivo Central › Consulta › Archivo (repositorio histórico).
 * Carpetas virtuales Dependencia → Año → Asunto con la cantidad de documentos clasificados de cada
 * nodo (RF-AC-013). Árbol a la izquierda y documentos de la carpeta a la derecha, 20 por página.
 * Los datos vienen del backend (GET /api/archivo/arbol y /api/archivo/buscar), que limita a un
 * usuario de Dependencia a sus carpetas. Al abrir un documento se ve en el visor con su ficha.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Folder, FolderOpen, Loader2, RefreshCw, Search, Upload, Archive as ArchiveIcon } from "lucide-react";
import { DetalleDocumento, type DocumentoDetalle } from "./DetalleDocumento";
import { formatApiError } from "../../lib/api";
import {
  apiArbolArchivo, apiBuscarArchivo, TIPO_LEGIBLE,
  type NodoDependencia, type PaginaBusqueda, type ResultadoBusqueda,
} from "../../lib/archivoApi";

type Tipo = "Entrada" | "Salida" | "Interno";

const PILDORA_TIPO: Record<Tipo, string> = {
  Entrada: "bg-blue-50 text-blue-700 border-blue-200",
  Salida: "bg-violet-50 text-violet-700 border-violet-200",
  Interno: "bg-slate-100 text-slate-600 border-slate-200",
};

const POR_PAGINA = 20;

/** "2024-12-08" → "8 dic 2024" (al mediodía para que la zona horaria no cambie el día). */
function fechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

const consecutivoDe = (x: ResultadoBusqueda) =>
  x.consecutivo ? (x.consecutivo.includes("/") ? x.consecutivo : `${x.consecutivo}/${x.anio}`) : `— / ${x.anio}`;

/** Adapta un documento del backend a la ficha de la pantalla de detalle. */
function detalleDe(x: ResultadoBusqueda): DocumentoDetalle {
  return {
    consecutivo: consecutivoDe(x),
    fecha: fechaCorta(x.fecha),
    tipo: x.tipo ? TIPO_LEGIBLE[x.tipo] : null,
    titulo: x.titulo,
    dependencia: x.dependencia ?? "—",
    anio: x.anio,
    asunto: x.asunto ?? "Sin asunto",
    trd: x.trd ?? "—",
    contraparte: x.contraparte ?? "—",
    persona: "—",
    caja: x.caja ?? "—",
    carpeta: x.carpeta ?? "—",
    ubicacion: x.ubicacion ?? null,
    archivo: x.titulo,
    paginas: 1,
    origen: "—",
    estado: "Clasificado",
  };
}

interface Seleccion { depId?: number; anio?: number; asuntoId?: number }

/* ───────────────────────── Fila del árbol ───────────────────────── */
function Fila({ nivel, etiqueta, cuenta, abierto, expandible, seleccionado, onToggle, onSelect }: {
  nivel: 0 | 1 | 2;
  etiqueta: string;
  cuenta: number;
  abierto: boolean;
  expandible: boolean;
  seleccionado: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const sangria = ["pl-3", "pl-9", "pl-14"][nivel];
  const Icono = abierto ? FolderOpen : Folder;
  return (
    <div
      className={`flex items-center border-t border-[rgba(30,58,95,0.09)] pr-3 ${sangria} ${
        seleccionado ? "bg-[#1e3a5f] text-white" : "text-[#2c3e50] hover:bg-[#f3ede1]/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!expandible}
        aria-expanded={expandible ? abierto : undefined}
        aria-label={`${abierto ? "Contraer" : "Expandir"} ${etiqueta}`}
        className="flex h-10 w-7 shrink-0 items-center justify-center disabled:opacity-0"
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${abierto ? "rotate-90" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-current={seleccionado ? "true" : undefined}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icono className={`h-4 w-4 shrink-0 ${seleccionado ? "text-white" : "text-[#6b7a8d]"}`} />
        <span className={`min-w-0 flex-1 truncate text-sm ${nivel === 0 ? "font-bold" : "font-medium"}`}>{etiqueta}</span>
        <span
          className={`rounded px-1.5 text-[11px] font-bold leading-5 ${
            seleccionado ? "bg-white/20 text-white" : "bg-[#ede6d8] text-[#1e3a5f]"
          }`}
        >
          {cuenta}
        </span>
      </button>
    </div>
  );
}

/* ───────────────────────── Componente ───────────────────────── */
export function Archivo({ onCargarLote }: { onCargarLote?: () => void }) {
  const [arbol, setArbol] = useState<NodoDependencia[] | null>(null);
  const [errorArbol, setErrorArbol] = useState("");
  const [sel, setSel] = useState<Seleccion>({});
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<PaginaBusqueda | null>(null);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [recarga, setRecarga] = useState(0);
  /** Documento abierto (detalle); null = se ve el repositorio. */
  const [abierto, setAbierto] = useState<ResultadoBusqueda | null>(null);

  // Árbol con contadores.
  useEffect(() => {
    let vigente = true;
    setErrorArbol("");
    apiArbolArchivo()
      .then((a) => {
        if (!vigente) return;
        setArbol(a);
        // Primera vez: se abre la primera dependencia con documentos.
        const primera = a.find((d) => d.total > 0) ?? a[0];
        setSel((s) => (s.depId ? s : { depId: primera?.dependencia_id }));
        setAbiertos((prev) => (prev.size || !primera ? prev : new Set([String(primera.dependencia_id)])));
      })
      .catch((e) => { if (vigente) setErrorArbol(formatApiError(e)); });
    return () => { vigente = false; };
  }, [recarga]);

  // La búsqueda dentro de la carpeta espera a que se deje de escribir.
  useEffect(() => {
    const h = setTimeout(() => { setTexto(busqueda.trim()); setPagina(1); }, 350);
    return () => clearTimeout(h);
  }, [busqueda]);

  const cargarDocumentos = useCallback(async () => {
    setCargandoDocs(true);
    setErrorDocs("");
    try {
      setResultado(await apiBuscarArchivo({
        alcance: "documentos", dependencia_id: sel.depId, anio: sel.anio, asunto_id: sel.asuntoId, texto: texto || undefined,
      }, pagina, POR_PAGINA));
    } catch (e) {
      setResultado(null);
      setErrorDocs(formatApiError(e));
    } finally {
      setCargandoDocs(false);
    }
  }, [sel.depId, sel.anio, sel.asuntoId, texto, pagina]);

  useEffect(() => { cargarDocumentos(); }, [cargarDocumentos, recarga]);

  const elegir = (s: Seleccion) => { setSel(s); setPagina(1); };

  const alternar = (clave: string) =>
    setAbiertos(prev => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave); else n.add(clave);
      return n;
    });

  const nodoDep = useMemo(() => arbol?.find((d) => d.dependencia_id === sel.depId), [arbol, sel.depId]);
  const nodoAnio = nodoDep?.anios.find((y) => y.anio === sel.anio);
  const nodoAsunto = nodoAnio?.asuntos.find((a) => a.asunto_id === sel.asuntoId);

  const ruta: { etiqueta: string; sel: Seleccion }[] = [{ etiqueta: "Archivo", sel: {} }];
  if (nodoDep) ruta.push({ etiqueta: nodoDep.nombre, sel: { depId: nodoDep.dependencia_id } });
  if (nodoDep && sel.anio !== undefined) ruta.push({ etiqueta: String(sel.anio), sel: { depId: nodoDep.dependencia_id, anio: sel.anio } });
  if (nodoDep && sel.anio !== undefined && nodoAsunto) ruta.push({ etiqueta: nodoAsunto.nombre, sel });

  const visibles = resultado?.filas ?? [];
  const total = resultado?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  if (abierto) {
    return (
      <DetalleDocumento
        key={abierto.id}
        documento={detalleDe(abierto)}
        documentoId={abierto.id}
        archivoId={abierto.archivo_id ?? undefined}
        onVolver={() => setAbierto(null)}
        onAnulado={() => { setAbierto(null); setRecarga(n => n + 1); }}
        onAbrirCarpeta={() => {
          const dep = arbol?.find((d) => d.dependencia_id === abierto.dependencia_id);
          const asunto = dep?.anios.find((y) => y.anio === abierto.anio)?.asuntos.find((a) => a.nombre === abierto.asunto);
          if (dep) {
            elegir({ depId: dep.dependencia_id, anio: abierto.anio, asuntoId: asunto?.asunto_id });
            setAbiertos(prev => new Set(prev).add(String(dep.dependencia_id)).add(`${dep.dependencia_id}|${abierto.anio}`));
          }
          setAbierto(null);
        }}
      />
    );
  }

  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Repositorio histórico</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <ArchiveIcon className="h-6 w-6 text-[#e8740e]" />
            Archivo
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-[#6b7a8d]">
            Carpetas virtuales por Dependencia → Año → Asunto. Cada dependencia ya viene creada; el asunto reemplaza la serie documental.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => setRecarga(n => n + 1)}
          aria-label="Actualizar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(30,58,95,0.15)] bg-white text-[#1e3a5f] hover:bg-[#f3ede1]"
        >
          <RefreshCw className={`h-4 w-4 ${cargandoDocs ? "animate-spin" : ""}`} />
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* ── Árbol de carpetas ─────────────────────────────────────────── */}
        <section aria-label="Carpetas" className="overflow-hidden rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <p className="bg-[#f3ede1]/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
            Dependencia → Año → Asunto
          </p>
          <div className="max-h-[640px] overflow-y-auto">
            {errorArbol ? (
              <p className="px-4 py-6 text-sm text-red-600">No se pudo cargar el árbol: {errorArbol}</p>
            ) : !arbol ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando carpetas…</p>
            ) : arbol.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#6b7a8d]">No hay dependencias para mostrar.</p>
            ) : arbol.map(dep => {
              const claveDep = String(dep.dependencia_id);
              const abiertoDep = abiertos.has(claveDep);
              return (
                <div key={claveDep}>
                  <Fila
                    nivel={0} etiqueta={dep.nombre} cuenta={dep.total} abierto={abiertoDep} expandible={dep.total > 0}
                    seleccionado={sel.depId === dep.dependencia_id && sel.anio === undefined}
                    onToggle={() => alternar(claveDep)}
                    onSelect={() => elegir({ depId: dep.dependencia_id })}
                  />
                  {abiertoDep && dep.anios.map(y => {
                    const claveAnio = `${claveDep}|${y.anio}`;
                    const abiertoAnio = abiertos.has(claveAnio);
                    return (
                      <div key={claveAnio}>
                        <Fila
                          nivel={1} etiqueta={String(y.anio)}
                          cuenta={y.total}
                          abierto={abiertoAnio} expandible
                          seleccionado={sel.depId === dep.dependencia_id && sel.anio === y.anio && !sel.asuntoId}
                          onToggle={() => alternar(claveAnio)}
                          onSelect={() => elegir({ depId: dep.dependencia_id, anio: y.anio })}
                        />
                        {abiertoAnio && y.asuntos.map(a => (
                          <Fila
                            key={`${claveAnio}|${a.asunto_id}`}
                            nivel={2} etiqueta={a.trd ? `${a.nombre} · ${a.trd}` : a.nombre}
                            cuenta={a.total}
                            abierto={false} expandible={false}
                            seleccionado={sel.depId === dep.dependencia_id && sel.anio === y.anio && sel.asuntoId === a.asunto_id}
                            onToggle={() => {}}
                            onSelect={() => elegir({ depId: dep.dependencia_id, anio: y.anio, asuntoId: a.asunto_id })}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Documentos de la carpeta ──────────────────────────────────── */}
        <section aria-label="Documentos de la carpeta" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label="Ruta de la carpeta" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
              <FolderOpen className="h-5 w-5 shrink-0 text-[#e8740e]" />
              {ruta.map((r, i) => (
                <span key={r.etiqueta + i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[#6b7a8d]">/</span>}
                  {i < ruta.length - 1 ? (
                    <button onClick={() => elegir(r.sel)} className="text-[#6b7a8d] hover:text-[#1e3a5f] hover:underline">
                      {r.etiqueta}
                    </button>
                  ) : (
                    <span className="font-bold text-[#1e3a5f]">{r.etiqueta}</span>
                  )}
                </span>
              ))}
            </nav>
            <span className="text-xs text-[#6b7a8d]">{total} documento(s)</span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar dentro de esta carpeta"
              aria-label="Buscar dentro de esta carpeta"
              className="h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white pl-9 pr-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/80 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30"
            />
          </div>

          {errorDocs ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">{errorDocs}</div>
          ) : cargandoDocs && !resultado ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos…</p>
          ) : visibles.length === 0 ? (
            <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
              Esta carpeta no tiene documentos{texto ? " que coincidan con la búsqueda" : ""}.
            </div>
          ) : (
            <>
            <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="bg-[#f3ede1]/60">
                    {["Consecutivo", "Tipo", "Documento", "Estado", ""].map((h, i) => <th key={h || i} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(x => (
                    // Toda la fila abre el documento, igual que el botón Abrir (SGD-088).
                    <tr
                      key={x.id}
                      tabIndex={0}
                      aria-label={`Abrir ${consecutivoDe(x)}`}
                      onClick={() => setAbierto(x)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                        e.preventDefault();
                        setAbierto(x);
                      }}
                      className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-xs font-bold text-[#2c3e50]">{consecutivoDe(x)}</p>
                        <p className="text-[11px] text-[#6b7a8d]">{fechaCorta(x.fecha)}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {x.tipo ? (
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA_TIPO[TIPO_LEGIBLE[x.tipo]]}`}>{TIPO_LEGIBLE[x.tipo]}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#2c3e50]">{x.titulo}</p>
                        <p className="text-xs text-[#6b7a8d]">{x.asunto ?? "Sin asunto"}{x.trd ? ` · ${x.trd}` : ""}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Clasificado
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setAbierto(x); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                        >
                          <FileText className="h-3.5 w-3.5" /> Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs text-[#6b7a8d]">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} aria-label="Página anterior"
                  className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                Página {pagina} de {paginas}
                <button onClick={() => setPagina(p => Math.min(paginas, p + 1))} disabled={pagina === paginas} aria-label="Página siguiente"
                  className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}