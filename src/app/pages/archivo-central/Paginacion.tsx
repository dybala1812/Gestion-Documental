/**
 * Paginación de listas del Archivo Central (Por clasificar, Clasificados, Últimos lotes).
 * `usePaginacion` corta la lista ya cargada y vuelve a la página 1 cuando cambian los filtros.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function usePaginacion<T>(items: T[], porPagina: number, reinicio: unknown[] = []) {
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPagina(1), reinicio);
  // Si la lista se achica (p. ej. tras clasificar el último de la página), no quedar en una página vacía.
  useEffect(() => { if (pagina > paginas) setPagina(paginas); }, [pagina, paginas]);

  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * porPagina;
  return { visibles: items.slice(desde, desde + porPagina), pagina: actual, paginas, setPagina, desde, total: items.length };
}

interface Props {
  pagina: number;
  paginas: number;
  desde: number;
  mostrados: number;
  total: number;
  onCambiar: (pagina: number) => void;
  etiqueta?: string;
}

export function Paginacion({ pagina, paginas, desde, mostrados, total, onCambiar, etiqueta = "registros" }: Props) {
  if (total === 0) return null;
  const boton = "rounded-md border border-gray-200 bg-white p-1.5 text-[#1e3a5f] hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#6b7a8d]" aria-label="Paginación">
      <span>
        {desde + 1}–{desde + mostrados} de {total} {etiqueta}
      </span>
      {paginas > 1 && (
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => onCambiar(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior" className={boton}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          Página {pagina} de {paginas}
          <button type="button" onClick={() => onCambiar(pagina + 1)} disabled={pagina === paginas} aria-label="Página siguiente" className={boton}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </span>
      )}
    </nav>
  );
}
