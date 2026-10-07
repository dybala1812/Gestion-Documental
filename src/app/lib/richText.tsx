/**
 * @file richText.tsx
 * @description Formato de texto ligero (negrilla, cursiva, subrayado, resaltado y enlaces)
 * para las cajas de respuesta de PQRS y tickets, sin depender de HTML crudo.
 *
 * El texto se guarda como texto plano con marcadores tipo Markdown
 * (`**negrilla**`, `_cursiva_`, `__subrayado__`, `==resaltado==`, `[texto](url)`)
 * y se renderiza a elementos React mediante `parseRichText`. Al no usarse
 * `dangerouslySetInnerHTML` en ningún punto, no existe riesgo de inyección HTML/XSS
 * aunque el contenido provenga de otro usuario.
 */
import React from "react";

export type RichTextMarker = "bold" | "italic" | "underline" | "highlight";

/** Par de marcadores [apertura, cierre] que envuelven el texto seleccionado. */
const MARKER_TOKENS: Record<RichTextMarker, [string, string]> = {
  bold: ["**", "**"],
  italic: ["_", "_"],
  underline: ["__", "__"],
  highlight: ["==", "=="],
};

/**
 * Envuelve (o desenvuelve, si ya está aplicado) el texto seleccionado de un textarea
 * controlado con el marcador indicado.
 *
 * @param value  - Valor actual completo del textarea.
 * @param start  - Posición de inicio de la selección.
 * @param end    - Posición de fin de la selección.
 * @param marker - Tipo de formato a aplicar.
 * @returns El nuevo valor completo y el rango de selección a restaurar tras el cambio.
 */
export function applyRichTextMarker(
  value: string,
  start: number,
  end: number,
  marker: RichTextMarker,
): { newValue: string; selStart: number; selEnd: number } {
  const [open, close] = MARKER_TOKENS[marker];
  const hasSelection = end > start;
  const selected = hasSelection ? value.slice(start, end) : "texto";

  // Si la selección ya está envuelta exactamente por el marcador, lo removemos (toggle).
  const before = value.slice(0, start);
  const after = value.slice(end);
  const alreadyWrapped =
    hasSelection && before.endsWith(open) && after.startsWith(close);
  if (alreadyWrapped) {
    const newValue = `${before.slice(0, before.length - open.length)}${selected}${after.slice(close.length)}`;
    const selStart = start - open.length;
    const selEnd = selStart + selected.length;
    return { newValue, selStart, selEnd };
  }

  const newValue = `${before}${open}${selected}${close}${after}`;
  const selStart = start + open.length;
  const selEnd = selStart + selected.length;
  return { newValue, selStart, selEnd };
}

// Orden de alternancia importante: enlaces y URLs primero, luego marcadores
// de mayor a menor longitud de token (__ antes que _) para evitar ambigüedades.
const TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)|\*\*([^*]+)\*\*|__([^_]+)__|==([^=]+)==|_([^_]+)_/g;

/**
 * Convierte texto plano con marcadores ligeros en nodos React (negrilla, cursiva,
 * subrayado, resaltado y enlaces). Úsalo siempre en lugar de mostrar el texto crudo
 * cuando el contenido pudo haberse escrito con el editor de formato.
 */
export function parseRichText(
  text: string | null | undefined,
  options?: {
    linkClassName?: string;
    /**
     * Si es true, conserva los marcadores crudos (`**`, `__`, `==`, `_`) dentro
     * del nodo estilizado en vez de quitarlos. Se usa en el editor con overlay
     * para que el texto renderizado mantenga la misma longitud/posición de
     * caracteres que el textarea real (necesario para alinear el cursor).
     */
    keepMarkers?: boolean;
  },
): React.ReactNode[] {
  if (!text) return [];
  const linkClass = options?.linkClassName ?? "underline text-indigo-600 hover:text-indigo-800";
  const keepMarkers = options?.keepMarkers ?? false;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const [full, linkLabel, linkUrl, bareUrl, bold, underline, highlight, italic] = match;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    if (linkLabel && linkUrl) {
      parts.push(
        keepMarkers ? (
          <span key={key++} className={linkClass}>{full}</span>
        ) : (
          <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {linkLabel}
          </a>
        ),
      );
    } else if (bareUrl) {
      parts.push(
        keepMarkers ? (
          <span key={key++} className={`break-all ${linkClass}`}>{full}</span>
        ) : (
          <a key={key++} href={bareUrl} target="_blank" rel="noopener noreferrer" className={`break-all ${linkClass}`}>
            {bareUrl}
          </a>
        ),
      );
    } else if (bold !== undefined) {
      parts.push(<strong key={key++}>{keepMarkers ? full : bold}</strong>);
    } else if (underline !== undefined) {
      parts.push(<u key={key++}>{keepMarkers ? full : underline}</u>);
    } else if (highlight !== undefined) {
      parts.push(
        <mark key={key++} className={keepMarkers ? "bg-yellow-200" : "bg-yellow-200 rounded px-0.5"}>
          {keepMarkers ? full : highlight}
        </mark>,
      );
    } else if (italic !== undefined) {
      parts.push(<em key={key++}>{keepMarkers ? full : italic}</em>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
