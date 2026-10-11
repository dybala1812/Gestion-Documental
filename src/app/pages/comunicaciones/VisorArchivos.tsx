/**
 * @file VisorArchivos.tsx
 * @description Visor de adjuntos de una comunicación (mockup: tarjeta "Adjuntos").
 *
 * Lista de adjuntos + vista previa con herramientas según el tipo:
 *  · PDF          → react-pdf (no depende del visor del navegador: funciona en celular)
 *                   con páginas, zoom, ajuste al ancho y rotación.
 *  · Imagen       → zoom, ajuste y rotación.
 *  · Word (.docx) → docx-preview (respeta páginas, tablas y formato).
 *  · Excel (.xlsx)→ exceljs, una pestaña por hoja.
 *  · Texto/CSV/JSON/XML/correo (.eml) → texto plano.
 *  · Otros (.doc, .xls, .zip…) → aviso y descarga.
 * Los archivos se piden al backend por su id (GET /archivos/{id}), nunca por ruta.
 * Las librerías pesadas (docx-preview, exceljs) se cargan solo cuando se necesitan.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../../lib/pdfWorker";
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, FileSpreadsheet, FileText, FileType2,
  Image as ImageIcon, Loader2, Maximize2, Minimize2, MoveHorizontal, Paperclip, RotateCw, ZoomIn, ZoomOut,
} from "lucide-react";
import { type AdjuntoCom, apiDescargarArchivo, formatoTamano } from "../../lib/comunicacionesApi";

// ── Tipo de vista ───────────────────────────────────────────────────────────

type Vista = "pdf" | "imagen" | "docx" | "excel" | "texto" | "otro";

const EXT_TEXTO = /\.(txt|csv|tsv|json|xml|md|log|eml|html?)$/i;

export function tipoVista(mime: string, nombre: string): Vista {
  const m = (mime || "").toLowerCase();
  if (m === "application/pdf" || /\.pdf$/i.test(nombre)) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nombre)) return "imagen";
  if (m.includes("wordprocessingml") || /\.docx$/i.test(nombre)) return "docx";
  if (m.includes("spreadsheetml") || /\.xlsx$/i.test(nombre)) return "excel";
  if (m.startsWith("text/") || m === "application/json" || m === "message/rfc822" || EXT_TEXTO.test(nombre)) return "texto";
  return "otro";
}

const ICONO: Record<Vista, { icon: React.ElementType; cls: string; etiqueta: string }> = {
  pdf: { icon: FileText, cls: "text-red-500", etiqueta: "PDF" },
  imagen: { icon: ImageIcon, cls: "text-sky-500", etiqueta: "Imagen" },
  docx: { icon: FileType2, cls: "text-blue-600", etiqueta: "Word" },
  excel: { icon: FileSpreadsheet, cls: "text-green-600", etiqueta: "Excel" },
  texto: { icon: FileText, cls: "text-gray-500", etiqueta: "Texto" },
  otro: { icon: Paperclip, cls: "text-gray-400", etiqueta: "Archivo" },
};

/** Ancho disponible de un contenedor (para "ajustar al ancho"). */
function useAncho<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

const botonBarra = "inline-flex items-center justify-center gap-1 h-7 min-w-7 px-1.5 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent";

// ── Visores por tipo ─────────────────────────────────────────────────────────

function VistaPdf({ blob, alto }: { blob: Blob; alto: string }) {
  const [contRef, ancho] = useAncho<HTMLDivElement>();
  const [paginas, setPaginas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1); // 1 = ajustado al ancho
  const [rotacion, setRotacion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPagina(1); setZoom(1); setRotacion(0); setError(null); }, [blob]);

  const ir = useCallback((n: number) => setPagina(p => Math.min(Math.max(1, n || p), paginas || 1)), [paginas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") ir(pagina + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") ir(pagina - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, pagina]);

  const anchoPagina = Math.max(200, (ancho - 32) * zoom);

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xs">
        <button className={botonBarra} onClick={() => ir(pagina - 1)} disabled={pagina <= 1} title="Página anterior (←)"><ChevronLeft className="w-4 h-4" /></button>
        <span className="flex items-center gap-1 text-gray-600">
          <input
            type="number" min={1} max={paginas || 1} value={pagina}
            onChange={e => ir(Number(e.target.value))}
            className="w-11 h-7 text-center border border-gray-200 rounded-md bg-white" aria-label="Página"
          />
          de {paginas || "…"}
        </span>
        <button className={botonBarra} onClick={() => ir(pagina + 1)} disabled={pagina >= paginas} title="Página siguiente (→)"><ChevronRight className="w-4 h-4" /></button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button className={botonBarra} onClick={() => setZoom(z => Math.max(0.4, +(z - 0.2).toFixed(1)))} title="Alejar"><ZoomOut className="w-4 h-4" /></button>
        <span className="w-11 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
        <button className={botonBarra} onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))} title="Acercar"><ZoomIn className="w-4 h-4" /></button>
        <button className={botonBarra} onClick={() => setZoom(1)} title="Ajustar al ancho"><MoveHorizontal className="w-4 h-4" /></button>
        <button className={botonBarra} onClick={() => setRotacion(r => (r + 90) % 360)} title="Rotar"><RotateCw className="w-4 h-4" /></button>
      </div>
      <div ref={contRef} className={`overflow-auto bg-gray-200/70 p-4 ${alto}`}>
        {error ? (
          <p className="text-sm text-red-600 text-center mt-10">No se pudo mostrar el PDF: {error}. Usa “Descargar”.</p>
        ) : (
          <Document
            file={blob}
            onLoadSuccess={({ numPages }) => setPaginas(numPages)}
            onLoadError={e => setError(e.message)}
            loading={<span className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-10"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo PDF…</span>}
            className="flex [justify-content:safe_center]"
          >
            {ancho > 0 && (
              <Page
                pageNumber={pagina}
                width={anchoPagina}
                rotate={rotacion}
                className="shadow-md bg-white"
                loading={<div className="bg-white shadow-md" style={{ width: anchoPagina, height: anchoPagina * 1.3 }} />}
              />
            )}
          </Document>
        )}
      </div>
    </div>
  );
}

function VistaImagen({ url, nombre, alto }: { url: string; nombre: string; alto: string }) {
  const [zoom, setZoom] = useState(1);
  const [rotacion, setRotacion] = useState(0);
  useEffect(() => { setZoom(1); setRotacion(0); }, [url]);
  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xs">
        <button className={botonBarra} onClick={() => setZoom(z => Math.max(0.2, +(z - 0.25).toFixed(2)))} title="Alejar"><ZoomOut className="w-4 h-4" /></button>
        <span className="w-11 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
        <button className={botonBarra} onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} title="Acercar"><ZoomIn className="w-4 h-4" /></button>
        <button className={botonBarra} onClick={() => setZoom(1)} title="Ajustar"><MoveHorizontal className="w-4 h-4" /></button>
        <button className={botonBarra} onClick={() => setRotacion(r => (r + 90) % 360)} title="Rotar"><RotateCw className="w-4 h-4" /></button>
      </div>
      <div className={`overflow-auto bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:20px_20px] flex items-center justify-center p-4 ${alto}`}>
        <img
          src={url} alt={nombre}
          style={{ transform: `rotate(${rotacion}deg)`, width: zoom === 1 ? undefined : `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none", maxHeight: zoom === 1 ? "100%" : "none" }}
          className="object-contain shadow-sm transition-transform"
        />
      </div>
    </div>
  );
}

function VistaDocx({ blob, alto }: { blob: Blob; alto: string }) {
  const [cajaRef, ancho] = useAncho<HTMLDivElement>();
  const contRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [anchoPagina, setAnchoPagina] = useState(816); // carta a 96 dpi; se mide al renderizar
  const [zoom, setZoom] = useState(1); // 1 = ajustado al ancho

  useEffect(() => {
    let cancelado = false;
    setEstado("cargando");
    setZoom(1);
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelado || !contRef.current) return;
        contRef.current.innerHTML = "";
        await renderAsync(blob, contRef.current, undefined, {
          className: "docx", inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true,
          experimental: false, useBase64URL: true, renderHeaders: true, renderFooters: true,
        });
        const pagina = contRef.current.querySelector<HTMLElement>("section.docx");
        // Ancho CSS de la página (no afectado por el zoom aplicado al contenedor).
        const w = pagina ? parseFloat(getComputedStyle(pagina).width) : NaN;
        if (w > 0) setAnchoPagina(w);
        if (!cancelado) setEstado("ok");
      } catch {
        if (!cancelado) setEstado("error");
      }
    })();
    return () => { cancelado = true; };
  }, [blob]);

  // Escala para que la página quepa completa en el ancho disponible (sin recortes).
  const ajuste = ancho > 0 ? Math.min(1, (ancho - 40) / anchoPagina) : 1;
  const escala = ajuste * zoom;

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xs">
        <button className={botonBarra} onClick={() => setZoom(z => Math.max(0.4, +(z - 0.2).toFixed(1)))} title="Alejar"><ZoomOut className="w-4 h-4" /></button>
        <span className="w-11 text-center text-gray-600">{Math.round(escala * 100)}%</span>
        <button className={botonBarra} onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))} title="Acercar"><ZoomIn className="w-4 h-4" /></button>
        <button className={botonBarra} onClick={() => setZoom(1)} title="Ajustar al ancho"><MoveHorizontal className="w-4 h-4" /></button>
        <span className="ml-auto text-gray-400 hidden sm:inline">Vista previa de Word: la descarga conserva el formato original</span>
      </div>
      <div ref={cajaRef} className={`relative w-full overflow-auto bg-gray-200/70 ${alto}`}>
        {estado === "cargando" && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo documento de Word…</span>
        )}
        {estado === "error" && (
          <p className="text-sm text-red-600 text-center mt-10 px-6">No se pudo mostrar el documento de Word. Usa “Descargar” para abrirlo.</p>
        )}
        {/* docx-preview dibuja aquí las páginas; `zoom` las ajusta al ancho y "safe center" evita recortar el borde izquierdo */}
        <div
          ref={contRef}
          style={{ zoom: escala }}
          className="[&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-5 [&_.docx-wrapper]:![align-items:safe_center] [&_.docx-wrapper>section.docx]:!shadow-md [&_.docx-wrapper>section.docx]:!mb-5"
        />
      </div>
    </div>
  );
}

const MAX_FILAS = 500;
const MAX_COLUMNAS = 40;

function VistaExcel({ blob, alto }: { blob: Blob; alto: string }) {
  const [hojas, setHojas] = useState<{ nombre: string; filas: string[][]; total: number }[] | null>(null);
  const [hoja, setHoja] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelado = false;
    setHojas(null); setHoja(0); setError(false);
    (async () => {
      try {
        const ExcelJS = (await import("exceljs")).default;
        const libro = new ExcelJS.Workbook();
        await libro.xlsx.load(await blob.arrayBuffer());
        const resultado = libro.worksheets.map(ws => {
          const filas: string[][] = [];
          ws.eachRow({ includeEmpty: false }, (row) => {
            if (filas.length >= MAX_FILAS) return;
            const celdas: string[] = [];
            for (let c = 1; c <= Math.min(ws.columnCount, MAX_COLUMNAS); c++) {
              const t = row.getCell(c).text;
              celdas.push(t ?? "");
            }
            filas.push(celdas);
          });
          return { nombre: ws.name, filas, total: ws.actualRowCount };
        });
        if (!cancelado) setHojas(resultado);
      } catch {
        if (!cancelado) setError(true);
      }
    })();
    return () => { cancelado = true; };
  }, [blob]);

  if (error) return <p className={`text-sm text-red-600 text-center pt-10 px-6 ${alto}`}>No se pudo leer el libro de Excel. Usa “Descargar”.</p>;
  if (!hojas) return <span className={`flex items-center justify-center gap-2 text-sm text-gray-500 ${alto}`}><Loader2 className="w-4 h-4 animate-spin" /> Abriendo libro de Excel…</span>;
  const actual = hojas[hoja];
  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {hojas.length > 1 && (
        <div className="flex gap-0.5 px-2 pt-1.5 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {hojas.map((h, i) => (
            <button key={h.nombre} onClick={() => setHoja(i)}
              className={`px-3 py-1 text-xs rounded-t-md border border-b-0 whitespace-nowrap ${i === hoja ? "bg-white text-green-700 font-semibold border-gray-200" : "text-gray-500 border-transparent hover:text-gray-800"}`}>
              {h.nombre}
            </button>
          ))}
        </div>
      )}
      <div className={`overflow-auto bg-white ${alto}`}>
        {actual && actual.filas.length > 0 ? (
          <table className="text-xs border-collapse min-w-full">
            <tbody>
              {actual.filas.map((f, i) => (
                <tr key={i} className={i === 0 ? "bg-gray-50 font-semibold sticky top-0" : "hover:bg-green-50/40"}>
                  <td className="border border-gray-200 bg-gray-50 text-gray-400 text-right px-2 py-1 w-10">{i + 1}</td>
                  {f.map((celda, j) => <td key={j} className="border border-gray-200 px-2 py-1 whitespace-pre-wrap max-w-[320px] align-top">{celda}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-gray-400 text-center mt-10">Hoja vacía</p>}
        {actual && actual.total > MAX_FILAS && (
          <p className="text-xs text-gray-500 text-center py-2">Se muestran las primeras {MAX_FILAS} de {actual.total} filas. Descarga el archivo para verlo completo.</p>
        )}
      </div>
    </div>
  );
}

const MAX_TEXTO = 1_000_000;

function VistaTexto({ blob, alto }: { blob: Blob; alto: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    blob.slice(0, MAX_TEXTO).text().then(t => { if (!cancelado) setTexto(t); });
    return () => { cancelado = true; };
  }, [blob]);
  if (texto === null) return <span className={`flex items-center justify-center gap-2 text-sm text-gray-500 ${alto}`}><Loader2 className="w-4 h-4 animate-spin" /> Abriendo…</span>;
  return (
    <div className={`overflow-auto bg-white ${alto}`}>
      <pre className="p-4 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap break-words font-mono">{texto || "(archivo vacío)"}</pre>
      {blob.size > MAX_TEXTO && <p className="text-xs text-gray-500 text-center pb-3">Se muestra el primer MB. Descarga el archivo para verlo completo.</p>}
    </div>
  );
}

// ── Visor principal ─────────────────────────────────────────────────────────

export function VisorArchivos({ adjuntos }: { adjuntos: AdjuntoCom[] }) {
  const [selId, setSelId] = useState<string | null>(adjuntos[0]?.archivo_id ?? null);
  const [archivo, setArchivo] = useState<{ id: string; blob: Blob; url: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);

  const sel = adjuntos.find(a => a.archivo_id === selId) ?? null;

  useEffect(() => {
    if (!adjuntos.some(a => a.archivo_id === selId)) setSelId(adjuntos[0]?.archivo_id ?? null);
  }, [adjuntos, selId]);

  // Descarga el adjunto seleccionado (una vez) y crea una URL local blob: para verlo/guardarlo.
  useEffect(() => {
    if (!sel) return;
    let url: string | null = null;
    let cancelado = false;
    setCargando(true);
    setError(null);
    setArchivo(null);
    apiDescargarArchivo(sel.archivo_id)
      .then(({ blob }) => {
        if (cancelado) return;
        const tipado = blob.type && blob.type !== "application/octet-stream" ? blob : new Blob([blob], { type: sel.mime || "application/octet-stream" });
        url = URL.createObjectURL(tipado);
        setArchivo({ id: sel.archivo_id, blob: tipado, url });
      })
      .catch(e => { if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el archivo"); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sel?.archivo_id, sel?.mime]);

  useEffect(() => {
    if (!ampliado) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAmpliado(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [ampliado]);

  const descargar = () => {
    if (!archivo || !sel) { toast.error("El archivo aún no está disponible"); return; }
    const a = document.createElement("a");
    a.href = archivo.url;
    a.download = sel.nombre_original;
    a.click();
  };

  if (adjuntos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Adjuntos · 0
        </h3>
        <p className="text-sm text-gray-400 mt-3">Esta comunicación no tiene adjuntos.</p>
      </div>
    );
  }

  const vista = sel ? tipoVista(sel.mime, sel.nombre_original) : "otro";
  const alto = ampliado ? "flex-1 min-h-0" : "h-[78vh] min-h-[520px]";
  const listo = !!archivo && archivo.id === sel?.archivo_id && !cargando && !error;

  return (
    <div className={ampliado ? "fixed inset-0 z-50 bg-gray-900/80 p-3 sm:p-6 flex" : ""}>
      <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col ${ampliado ? "w-full" : ""}`}>
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5 min-w-0">
            <Paperclip className="w-3.5 h-3.5 shrink-0" /> Adjuntos · {adjuntos.length}
            {sel && <span className="normal-case tracking-normal font-medium text-gray-700 truncate">— {sel.nombre_original}</span>}
          </h3>
          {sel && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => archivo && window.open(archivo.url, "_blank", "noopener")} disabled={!listo}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 disabled:opacity-40" title="Abrir en una pestaña nueva">
                <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Abrir</span>
              </button>
              <button onClick={descargar} disabled={!listo}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 disabled:opacity-40" title="Descargar">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Descargar</span>
              </button>
              <button onClick={() => setAmpliado(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100" title={ampliado ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}>
                {ampliado ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{ampliado ? "Cerrar" : "Ampliar"}</span>
              </button>
            </div>
          )}
        </div>

        <div className={`flex flex-col md:flex-row ${ampliado ? "flex-1 min-h-0" : ""}`}>
          {/* Lista de adjuntos */}
          <ul className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-gray-100 max-h-44 md:max-h-none overflow-y-auto bg-gray-50/50">
            {adjuntos.map(a => {
              const t = ICONO[tipoVista(a.mime, a.nombre_original)];
              const Icono = t.icon;
              return (
                <li key={a.archivo_id}>
                  <button
                    onClick={() => setSelId(a.archivo_id)}
                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-l-2 transition-colors ${
                      a.archivo_id === selId ? "bg-white border-orange-500 shadow-sm" : "border-transparent hover:bg-white"
                    }`}
                  >
                    <span className="w-8 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                      <Icono className={`w-4 h-4 ${t.cls}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-gray-800 break-all leading-snug">{a.nombre_original}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">
                        {t.etiqueta} · {formatoTamano(a.tamano_bytes)}{a.de_respuesta ? " · respuesta" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Vista previa */}
          <div className={`flex-1 min-w-0 flex flex-col ${ampliado ? "min-h-0" : ""}`}>
            {cargando && (
              <span className={`flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 ${alto}`}><Loader2 className="w-4 h-4 animate-spin" /> Cargando archivo…</span>
            )}
            {!cargando && error && (
              <div className={`flex flex-col items-center justify-center text-center px-6 bg-gray-50 ${alto}`}>
                <p className="text-sm font-medium text-red-600">No se pudo cargar el archivo</p>
                <p className="text-xs text-gray-500 mt-1">{error}</p>
              </div>
            )}
            {listo && archivo && sel && (
              <>
                {vista === "pdf" && <VistaPdf blob={archivo.blob} alto={alto} />}
                {vista === "imagen" && <VistaImagen url={archivo.url} nombre={sel.nombre_original} alto={alto} />}
                {vista === "docx" && <VistaDocx blob={archivo.blob} alto={alto} />}
                {vista === "excel" && <VistaExcel blob={archivo.blob} alto={alto} />}
                {vista === "texto" && <VistaTexto blob={archivo.blob} alto={alto} />}
                {vista === "otro" && (
                  <div className={`flex flex-col items-center justify-center text-center px-6 bg-gray-50 ${alto}`}>
                    <Paperclip className="w-12 h-12 text-gray-300" />
                    <p className="text-sm text-gray-700 mt-2 font-medium">{sel.nombre_original}</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      Este formato no se puede mostrar en el navegador (por ejemplo .doc, .xls o .zip antiguos). Descárgalo para abrirlo con su programa.
                    </p>
                    <button onClick={descargar} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-1.5">
                      <Download className="w-4 h-4" /> Descargar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
