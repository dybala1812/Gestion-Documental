/**
 * @file FormattingToolbar.tsx
 * @description Barra de herramientas de formato de texto (negrilla, cursiva,
 * subrayado, resaltado) para usar junto a un `<textarea>` controlado en los
 * formularios de respuesta de PQRS y tickets.
 *
 * Funciona envolviendo la selección actual del textarea con marcadores ligeros
 * (ver `../../lib/richText.tsx`); no requiere `contentEditable` ni HTML crudo.
 */
import { RefObject } from "react";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter } from "lucide-react";
import { applyRichTextMarker, type RichTextMarker } from "../../lib/richText";
import { cn } from "../../lib/utils";

interface FormattingToolbarProps {
  /** Ref del textarea controlado sobre el que se aplica el formato. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Valor actual del textarea. */
  value: string;
  /** Callback para actualizar el valor tras aplicar el formato. */
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Paleta de color de los botones (p. ej. "amber" para notas internas). */
  variant?: "default" | "amber";
  className?: string;
}

const BUTTONS: { marker: RichTextMarker; icon: typeof Bold; label: string }[] = [
  { marker: "bold", icon: Bold, label: "Negrilla" },
  { marker: "italic", icon: Italic, label: "Cursiva" },
  { marker: "underline", icon: UnderlineIcon, label: "Subrayado" },
  { marker: "highlight", icon: Highlighter, label: "Resaltar" },
];

export function FormattingToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
  variant = "default",
  className,
}: FormattingToolbarProps) {
  const colorCls =
    variant === "amber"
      ? "border-amber-200 text-amber-600 hover:bg-amber-50"
      : "border-gray-200 text-gray-600 hover:bg-gray-50";

  const handleClick = (marker: RichTextMarker) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const { newValue, selStart, selEnd } = applyRichTextMarker(value, start, end, marker);
    onChange(newValue);
    // El textarea es controlado: hay que esperar al repintado para reposicionar el cursor.
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(selStart, selEnd);
    });
  };

  return (
    <div className={cn("flex items-center gap-1", className)} role="toolbar" aria-label="Formato de texto">
      {BUTTONS.map(({ marker, icon: Icon, label }) => (
        <button
          key={marker}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleClick(marker)}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
            colorCls,
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
