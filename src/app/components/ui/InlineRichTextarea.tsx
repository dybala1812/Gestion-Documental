/**
 * @file InlineRichTextarea.tsx
 * @description Textarea que muestra el formato (negrilla, cursiva, subrayado,
 * resaltado, enlaces) directamente sobre lo que el usuario escribe, en vez de
 * un panel de vista previa aparte. Funciona superponiendo una capa de solo
 * lectura con el texto ya formateado (sin los signos `**`/`==`/`_`) encima de
 * un `<textarea>` real cuyo texto se vuelve invisible (mantiene el cursor y
 * la selección nativos). Al ocultar los marcadores, el cursor puede quedar
 * unos píxeles desalineado del texto visible en frases largas con formato.
 */
import React, { forwardRef, useRef, useImperativeHandle } from "react";
import { Textarea, TextareaProps } from "./textarea";
import { parseRichText } from "../../lib/richText";
import { cn } from "./utils";

export interface InlineRichTextareaProps extends TextareaProps {
  linkClassName?: string;
}

export const InlineRichTextarea = forwardRef<HTMLTextAreaElement, InlineRichTextareaProps>(
  ({ value, linkClassName, className, onScroll, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = e.currentTarget.scrollTop;
        overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      onScroll?.(e);
    };

    const text = typeof value === "string" ? value : "";

    return (
      <div className="relative">
        {/* Capa visual: texto formateado, no interactúa con el mouse/teclado */}
        <div
          ref={overlayRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 text-sm leading-normal text-gray-900",
            className,
          )}
        >
          {parseRichText(text, { linkClassName })}
          {/* Mantiene el alto/scroll sincronizado cuando el texto termina en salto de línea */}
          {text.endsWith("\n") ? "\u00A0" : null}
        </div>
        {/* Textarea real: texto invisible, solo se ve el cursor/selección */}
        <Textarea
          ref={innerRef}
          value={value}
          onScroll={syncScroll}
          className={cn(
            "relative bg-transparent text-transparent caret-gray-900 selection:bg-blue-200/70",
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);
InlineRichTextarea.displayName = "InlineRichTextarea";
