/**
 * TicketChat.tsx
 * ──────────────
 * Componente de chat en tiempo real para tickets internos.
 * Conecta automáticamente al WebSocket del ticket via `useTicketChat`.
 *
 * Uso básico:
 *   <TicketChat ticketId={ticket.id} currentUserId={usuario.id} />
 *
 * Props:
 *   ticketId       — UUID del ticket interno.
 *   currentUserId  — ID del usuario autenticado.
 *   initialMessages — Mensajes históricos cargados vía REST antes de montar.
 *   isClosed       — Si true, desactiva el input (ticket cerrado).
 *   className      — Clases adicionales para el contenedor.
 */
import { useEffect, useRef, useState } from "react";
import { useTicketChat, ChatMessage } from "../../lib/useTicketChat";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FormattingToolbar } from "../ui/FormattingToolbar";
import { InlineRichTextarea } from "../ui/InlineRichTextarea";
import { parseRichText } from "../../lib/richText";
import { cn } from "../ui/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface TicketChatProps {
  ticketId: string;
  currentUserId: string | number;
  initialMessages?: ChatMessage[];
  isClosed?: boolean;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  connecting:   { label: "Conectando…",  variant: "secondary"   },
  connected:    { label: "En línea",     variant: "default"      },
  disconnected: { label: "Desconectado", variant: "outline"      },
  error:        { label: "Sin acceso",   variant: "destructive"  },
};

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("es-CO", {
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ── Componente ───────────────────────────────────────────────────────────────

export function TicketChat({
  ticketId,
  currentUserId,
  initialMessages = [],
  isClosed = false,
  className,
}: TicketChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { messages, status, typingUser, sendMessage, sendTyping } = useTicketChat(
    ticketId,
    currentUserId,
    !isClosed,
  );

  // Combina mensajes históricos (REST) con mensajes en tiempo real (WS)
  const allMessages: ChatMessage[] = [
    ...initialMessages,
    ...messages.filter((m) => !initialMessages.some((h) => h.id === m.id)),
  ];

  // Scroll automático al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    sendMessage(text, isInternalNote);
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Typing indicator — throttled to one emit per 2 s
    if (typingTimeoutRef.current) return;
    sendTyping();
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2_000);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.disconnected;

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-sm font-semibold text-gray-700">Chat del ticket</span>
        <Badge variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {allMessages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">
            No hay mensajes todavía. ¡Sé el primero en escribir!
          </p>
        )}

        {allMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-gray-400 italic">
            <TypingDots />
            <span>{typingUser} está escribiendo…</span>
          </div>
        )}

        {/* Anchor to scroll into view */}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!isClosed && (
        <div className="border-t px-4 py-3 shrink-0 space-y-2">
          {/* Internal note toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Nota interna (solo visible para el equipo)</span>
          </label>

          <FormattingToolbar
            textareaRef={textareaRef}
            value={inputValue}
            onChange={setInputValue}
            disabled={status !== "connected"}
            variant={isInternalNote ? "amber" : "default"}
          />

          <div className="flex gap-2 items-end">
            <InlineRichTextarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              linkClassName={
                isInternalNote
                  ? "underline text-amber-700 hover:text-amber-900"
                  : "underline text-indigo-600 hover:text-indigo-800"
              }
              placeholder={
                isInternalNote
                  ? "Escribe una nota interna… (Enter para enviar)"
                  : "Escribe un mensaje… (Enter para enviar)"
              }
              rows={2}
              disabled={status !== "connected"}
              className={cn(
                "resize-y flex-1 text-sm",
                isInternalNote && "border-amber-400 bg-amber-50 focus-visible:ring-amber-400",
              )}
            />
            <Button
              onClick={handleSend}
              disabled={status !== "connected" || !inputValue.trim()}
              size="sm"
              className="self-end"
              aria-label="Enviar mensaje"
            >
              Enviar
            </Button>
          </div>
        </div>
      )}

      {isClosed && (
        <p className="text-center text-xs text-gray-400 py-3 border-t">
          Este ticket está cerrado — no se pueden enviar mensajes.
        </p>
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isInternal = msg.activity_type === "INTERNAL_NOTE";
  const isMine = msg.isMine;

  return (
    <div className={cn("flex flex-col gap-0.5", isMine ? "items-end" : "items-start")}>
      {/* Sender + time */}
      <span className="text-[11px] text-gray-400">
        {msg.performed_by?.nombre ?? "Usuario"} · {formatTime(msg.created_at)}
        {isInternal && (
          <span className="ml-1 font-medium text-amber-600">[nota interna]</span>
        )}
      </span>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-snug whitespace-pre-wrap break-words",
          isMine
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm",
          isInternal && "border border-amber-300 bg-amber-50 text-amber-900",
        )}
      >
        {parseRichText(msg.detail)}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
