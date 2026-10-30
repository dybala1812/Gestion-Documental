/**
 * @file HistoriasAcademicas.tsx
 * @description Archivo Central › Consulta › Historias académicas (RF-AC-020).
 * Árbol Estado → Año → Nivel → Programa con cuántas historias hay en cada nodo; a la derecha los
 * estudiantes del nodo (o de la búsqueda por nombre, cédula o título de un documento), 20 por página.
 * Al abrir una historia se ven sus documentos con el visor. Los datos vienen del backend
 * (GET /api/historias/arbol, /api/historias, /api/historias/{id}/documentos), que aplica la custodia:
 * Registro Académico solo ve las activas (RN-AC-06). Sin IA (RN-AC-13).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, FileText, Folder, FolderOpen, GraduationCap, Loader2, RefreshCw, Search, Upload,
} from "lucide-react";
import { formatApiError } from "../../lib/api";
import {
  apiArbolHistorias, apiDocumentosHistoria, apiListarHistorias,
  type DocumentoHistoria, type EstadoHistoria, type FiltrosHistorias, type HistoriaFila, type NodoEstadoHist, type PaginaHistorias,
} from "../../lib/historiasApi";
import { VisorDocumento, guardarArchivoDescargado, useArchivoDocumento } from "./VisorDocumento";

const ESTADO_LABEL: Record<EstadoHistoria, string> = { graduado: "Graduados", retirado: "Retirados", activa: "Activos" };
const POR_PAGINA = 20;
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

function fechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Fila del árbol (mismo estilo que Consulta › Archivo). */
function Fila({ nivel, etiqueta, cuenta, abierto, expandible, seleccionado, onToggle, onSelect }: {
  nivel: 0 | 1 | 2 | 3; etiqueta: string; cuenta: number; abierto: boolean; expandible: boolean;
  seleccionado: boolean; onToggle: () => void; onSelect: () => void;
}) {
  const sangria = ["pl-3", "pl-9", "pl-14", "pl-20"][nivel];
  const Icono = abierto ? FolderOpen : Folder;
  return (
    <div className={`flex items-center border-t border-[rgba(30,58,95,0.09)] pr-3 ${sangria} ${
      seleccionado ? "bg-[#1e3a5f] text-white" : "text-[#2c3e50] hover:bg-[#f3ede1]/60"}`}>
      <button type="button" onClick={onToggle} disabled={!expandible} aria-expanded={expandible ? abierto : undefined}
        aria-label={`${abierto ? "Contraer" : "Expandir"} ${etiqueta}`}
        className="flex h-10 w-7 shrink-0 items-center justify-center disabled:opacity-0">
        <ChevronRight className={`h-4 w-4 transition-transform ${abierto ? "rotate-90" : ""}`} />
      </button>
      <button type="button" onClick={onSelect} className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left text-sm">
        <Icono className={`h-4 w-4 shrink-0 ${seleccionado ? "text-white" : "text-[#e8740e]"}`} />
        <span className="min-w-0 flex-1 truncate font-semibold">{etiqueta}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${seleccionado ? "bg-white/20" : "bg-[#f3ede1] text-[#1e3a5f]"}`}>{cuenta}</span>
      </button>
    </div>
  );
}

/* ───────────────────── Ficha: documentos de una historia ───────────────────── */
function VisorHistoria({ doc }: { doc: DocumentoHistoria }) {
  const archivo = useArchivoDocumento(doc.archivo_id);
  return (
    <VisorDocumento
      titulo={doc.archivo_nombre ?? doc.titulo}
      paginas={doc.paginas ?? 1}
      archivo={archivo}
      onDescargar={() => guardarArchivoDescargado(archivo, doc.archivo_nombre ?? `${doc.titulo}.pdf`)}
    />
  );
}

function FichaHistoria({ historia, onVolver }: { historia: HistoriaFila; onVolver: () => void }) {
  const [docs, setDocs] = useState<DocumentoHistoria[] | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<DocumentoHistoria | null>(null);

  useEffect(() => {
    let vivo = true;
    apiDocumentosHistoria(historia.id)
      .then(d => { if (!vivo) return; setDocs(d); setAbierto(d[0] ?? null); })
      .catch(e => { if (vivo) setError(formatApiError(e)); });
    return () => { vivo = false; };
  }, [historia.id]);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm hover:bg-[#f3ede1] hover:text-[#1e3a5f]">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a historias académicas
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">
          Historia académica · {ESTADO_LABEL[historia.estado]}{historia.anio ? ` · ${historia.anio}` : ""}
        </p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <GraduationCap className="h-6 w-6 text-[#e8740e]" /> {historia.apellidos} {historia.nombres}
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">
          {historia.tipo_documento} {historia.numero_documento} · {historia.programa}{historia.nivel ? ` · ${historia.nivel}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section aria-label="Documentos de la historia" className={`${panel} overflow-hidden`}>
          <p className="bg-[#f3ede1]/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
            Documentos {docs ? `(${docs.length})` : ""}
          </p>
          {error ? <p className="px-4 py-6 text-sm text-red-600">{error}</p>
            : !docs ? <p className="flex items-center gap-2 px-4 py-6 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
            : docs.length === 0 ? <p className="px-4 py-6 text-sm text-[#6b7a8d]">Esta historia aún no tiene documentos.</p>
            : (
              <ul>
                {docs.map(d => (
                  <li key={d.id}>
                    <button type="button" onClick={() => setAbierto(d)}
                      className={`flex w-full items-start gap-3 border-t border-[rgba(30,58,95,0.09)] px-4 py-3 text-left ${
                        abierto?.id === d.id ? "bg-[#1e3a5f] text-white" : "hover:bg-[#f3ede1]/60"}`}>
                      <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${abierto?.id === d.id ? "text-white" : "text-[#e8740e]"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{d.titulo}</span>
                        <span className={`block text-xs ${abierto?.id === d.id ? "text-white/80" : "text-[#6b7a8d]"}`}>
                          {d.fecha ? fechaCorta(d.fecha) : `Cargado el ${fechaCorta(d.cargado_en)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
        <section aria-label="Visor">{abierto ? <VisorHistoria key={abierto.id} doc={abierto} /> : null}</section>
      </div>
    </div>
  );
}

/* ───────────────────── Pantalla principal ───────────────────── */
export function HistoriasAcademicas({ onCargar }: { onCargar?: () => void }) {
  const [arbol, setArbol] = useState<NodoEstadoHist[] | null>(null);
  const [errorArbol, setErrorArbol] = useState("");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<FiltrosHistorias & { clave?: string }>({});
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<PaginaHistorias | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState<HistoriaFila | null>(null);

  const cargarArbol = useCallback(() => {
    setErrorArbol("");
    apiArbolHistorias().then(setArbol).catch(e => { setArbol([]); setErrorArbol(formatApiError(e)); });
  }, []);
  useEffect(cargarArbol, [cargarArbol]);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError("");
    const { clave: _c, ...filtros } = sel;
    apiListarHistorias({ ...filtros, q: q || undefined }, pagina)
      .then(r => { if (vivo) setResultado(r); })
      .catch(e => { if (vivo) { setResultado(null); setError(formatApiError(e)); } })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [sel, q, pagina]);

  const alternar = (k: string) => setAbiertos(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const elegir = (s: FiltrosHistorias & { clave: string }) => { setSel(prev => (prev.clave === s.clave ? {} : s)); setPagina(1); };

  if (abierta) return <FichaHistoria historia={abierta} onVolver={() => setAbierta(null)} />;

  const total = resultado?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Consulta</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <GraduationCap className="h-6 w-6 text-[#e8740e]" /> Historias académicas
          </h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">Estado → Año → Nivel → Programa. Registro Académico custodia las activas; Archivo Central, retirados y graduados.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargarArbol}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          {onCargar && (
            <button onClick={onCargar}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white hover:opacity-90">
              <Upload className="h-4 w-4" /> Cargar historias
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section aria-label="Árbol de historias" className={`${panel} overflow-hidden`}>
          <p className="bg-[#f3ede1]/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Estado → Año → Nivel → Programa</p>
          <div className="max-h-[640px] overflow-y-auto">
            {errorArbol ? <p className="px-4 py-6 text-sm text-red-600">No se pudo cargar el árbol: {errorArbol}</p>
              : !arbol ? <p className="flex items-center gap-2 px-4 py-6 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
              : arbol.length === 0 ? <p className="px-4 py-6 text-sm text-[#6b7a8d]">Aún no hay historias académicas. Cárgalas desde el Centro de cargas (carga D).</p>
              : arbol.map(e => {
                const kE = e.estado;
                return (
                  <div key={kE}>
                    <Fila nivel={0} etiqueta={ESTADO_LABEL[e.estado]} cuenta={e.total} abierto={abiertos.has(kE)} expandible
                      seleccionado={sel.clave === kE} onToggle={() => alternar(kE)}
                      onSelect={() => elegir({ clave: kE, estado: e.estado })} />
                    {abiertos.has(kE) && e.anios.map(a => {
                      const kA = `${kE}|${a.anio ?? "sin"}`;
                      return (
                        <div key={kA}>
                          <Fila nivel={1} etiqueta={a.anio ? String(a.anio) : "Sin año"} cuenta={a.total} abierto={abiertos.has(kA)} expandible
                            seleccionado={sel.clave === kA} onToggle={() => alternar(kA)}
                            onSelect={() => elegir({ clave: kA, estado: e.estado, anio: a.anio })} />
                          {abiertos.has(kA) && a.niveles.map(n => {
                            const kN = `${kA}|${n.nivel_id ?? "sin"}`;
                            return (
                              <div key={kN}>
                                <Fila nivel={2} etiqueta={n.nivel} cuenta={n.total} abierto={abiertos.has(kN)} expandible
                                  seleccionado={sel.clave === kN} onToggle={() => alternar(kN)}
                                  onSelect={() => elegir({ clave: kN, estado: e.estado, anio: a.anio, nivel_id: n.nivel_id })} />
                                {abiertos.has(kN) && n.programas.map(p => {
                                  const kP = `${kN}|${p.programa_id}`;
                                  return (
                                    <Fila key={kP} nivel={3} etiqueta={p.programa} cuenta={p.total} abierto={false} expandible={false}
                                      seleccionado={sel.clave === kP} onToggle={() => {}}
                                      onSelect={() => elegir({ clave: kP, estado: e.estado, anio: a.anio, nivel_id: n.nivel_id, programa_id: p.programa_id })} />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </section>

        <section aria-label="Historias" className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
            <input value={texto} onChange={ev => setTexto(ev.target.value)} aria-label="Buscar historias"
              placeholder="Buscar por nombre, cédula o título del documento"
              className="h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white pl-9 pr-3 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30" />
          </div>
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-[#f3ede1]">
                <tr>{["Estudiante", "Programa", "Estado", "Documentos"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-sm text-[#6b7a8d]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando…</td></tr>
                ) : error ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-sm text-red-600">{error}</td></tr>
                ) : !resultado || resultado.filas.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-sm text-[#6b7a8d]">No hay historias {q ? "que coincidan con la búsqueda" : "en esta carpeta"}.</td></tr>
                ) : resultado.filas.map(h => (
                  <tr key={h.id} tabIndex={0} onClick={() => setAbierta(h)}
                    onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setAbierta(h); } }}
                    className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#2c3e50]">{h.apellidos} {h.nombres}</p>
                      <p className="text-xs text-[#6b7a8d]">{h.tipo_documento} {h.numero_documento}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#2c3e50]">{h.programa}<span className="block text-xs text-[#6b7a8d]">{h.nivel ?? "—"}</span></td>
                    <td className="px-4 py-3 text-sm text-[#2c3e50]">{ESTADO_LABEL[h.estado]}{h.anio ? ` · ${h.anio}` : ""}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#1e3a5f]">{h.documentos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs text-[#6b7a8d]">
              <span>{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} historias · Página {pagina} de {paginas}</span>
              <span className="flex gap-2">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} aria-label="Página anterior"
                  className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPagina(p => Math.min(paginas, p + 1))} disabled={pagina >= paginas} aria-label="Página siguiente"
                  className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
