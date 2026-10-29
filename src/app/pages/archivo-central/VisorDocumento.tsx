/**
 * @file VisorDocumento.tsx
 * @description Visor común de los documentos del Archivo Central (Clasificados, Por clasificar…).
 * Descarga el archivo real del backend (GET /api/archivos/{id}) y lo muestra según su tipo:
 * PDF en un iframe con páginas, imagen ajustada al panel y, para otros formatos, botón de descarga.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { apiDescargarArchivo } from "../../lib/comunicacionesApi";

/** Cómo se muestra el archivo según su tipo real (el que devuelve el backend). */
export type TipoVista = "pdf" | "imagen" | "otro";
const tipoVista = (mime: string): TipoVista =>
  mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "imagen" : "otro";

export interface ArchivoDocumento {
  /** URL (blob) del archivo descargado; null mientras carga, si falla o si no hay archivo. */
  url: string | null;
  tipo: TipoVista;
  /** Nombre real del archivo (con extensión) que envía el backend. */
  nombre: string | null;
  cargando: boolean;
  error: string | null;
}

/** Descarga el archivo del documento. Se libera la URL al cambiar de archivo o desmontar. */
export function useArchivoDocumento(archivoId?: string | null): ArchivoDocumento {
  const [estado, setEstado] = useState<ArchivoDocumento>({
    url: null, tipo: "pdf", nombre: null, cargando: !!archivoId, error: null,
  });

  useEffect(() => {
    if (!archivoId) {
      setEstado({ url: null, tipo: "pdf", nombre: null, cargando: false, error: null });
      return;
    }
    let cancelado = false;
    let objetoUrl: string | null = null;
    setEstado({ url: null, tipo: "pdf", nombre: null, cargando: true, error: null });
    apiDescargarArchivo(archivoId)
      .then(({ blob, nombre }) => {
        if (cancelado) return;
        // Se respeta el tipo real (PDF, JPG, PNG…): forzar application/pdf dejaba las imágenes en blanco.
        objetoUrl = URL.createObjectURL(blob);
        setEstado({ url: objetoUrl, tipo: tipoVista(blob.type), nombre, cargando: false, error: null });
      })
      .catch(e => {
        if (!cancelado) {
          setEstado({ url: null, tipo: "pdf", nombre: null, cargando: false, error: e instanceof Error ? e.message : "No se pudo descargar el archivo" });
        }
      });
    return () => {
      cancelado = true;
      if (objetoUrl) URL.revokeObjectURL(objetoUrl);
    };
  }, [archivoId]);

  return estado;
}

/** Guarda en el equipo el archivo ya descargado. Devuelve false si todavía no hay archivo. */
export function guardarArchivoDescargado(archivo: ArchivoDocumento, nombrePorDefecto: string): boolean {
  if (!archivo.url) return false;
  const a = document.createElement("a");
  a.href = archivo.url;
  a.download = archivo.nombre ?? nombrePorDefecto;
  a.click();
  return true;
}

const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

export function VisorDocumento({ titulo, paginas, archivo, onDescargar, sinArchivo }: {
  /** Nombre que se muestra en la barra si el backend aún no dio el nombre real. */
  titulo: string;
  paginas: number;
  archivo: ArchivoDocumento;
  onDescargar: () => void;
  /** Texto cuando el documento no tiene archivo asociado (sin id). */
  sinArchivo?: string;
}) {
  const [pagina, setPagina] = useState(1);
  const { url, tipo, cargando, error } = archivo;
  const nombre = archivo.nombre ?? titulo;
  // La paginación solo tiene sentido con un PDF ya cargado (no con imágenes ni cuando el archivo falta).
  const esPdf = !!url && tipo === "pdf";

  return (
    <section className={`${panel} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-4 py-3 text-white">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nombre}</span>
        {esPdf && (
          <>
            <button aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums">{pagina} / {paginas}</span>
            <button aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        <button aria-label="Descargar archivo" onClick={onDescargar} className="rounded p-1 hover:bg-white/10">
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col bg-[#ede6d8] p-3">
        {url && tipo === "pdf" ? (
          <iframe
            title={nombre}
            src={`${url}#page=${pagina}&view=FitH`}
            className="min-h-[640px] w-full flex-1 rounded bg-white shadow-sm"
          />
        ) : url && tipo === "imagen" ? (
          <div className="flex min-h-[460px] flex-1 items-center justify-center overflow-auto rounded bg-white p-3 shadow-sm">
            <img src={url} alt={nombre} className="max-h-[75vh] max-w-full object-contain" />
          </div>
        ) : url ? (
          <div className="flex min-h-[460px] flex-1 flex-col items-center justify-center gap-2 rounded bg-white p-6 text-center shadow-sm">
            <FileText className="h-10 w-10 text-[#6b7a8d]" />
            <p className="text-sm font-semibold text-[#2c3e50]">Este formato no tiene vista previa</p>
            <button onClick={onDescargar} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]">
              <Download className="h-3.5 w-3.5" /> Descargar el archivo
            </button>
          </div>
        ) : (
          <div className="flex min-h-[460px] flex-1 flex-col items-center justify-center gap-2 rounded bg-white p-6 text-center shadow-sm">
            <FileText className="h-10 w-10 text-[#6b7a8d]" />
            {cargando ? (
              <p className="text-sm font-semibold text-[#2c3e50]">Cargando el documento…</p>
            ) : error ? (
              <>
                <p className="text-sm font-semibold text-red-700">No se pudo abrir el archivo</p>
                <p className="text-xs text-[#6b7a8d]">{error}</p>
              </>
            ) : (
              <p className="text-sm font-semibold text-[#2c3e50]">{sinArchivo ?? "Este documento no tiene un archivo asociado."}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
