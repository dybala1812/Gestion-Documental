/**
 * useTicketChat.ts
 * ────────────────
 * Custom hook que gestiona la conexión WebSocket para el chat en tiempo
 * real de un ticket interno.
 *
 * URL del WebSocket:
 *   ws(s)://host/ws/tickets/<ticket_id>/?token=<access_token>
 *
 * Protocolo de mensajes (ver pqrs/consumers.py):
 *   Enviar  → { type: "chat.message", detail: string, is_internal_note?: boolean }
 *           → { type: "typing" }
 *   Recibir ← { type: "chat.message", message: ChatMessage }
 *           ← { type: "typing",       user: string }
 *           ← { type: "error",        detail: string }
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { tokens, API_BASE, tryRefreshToken } from "./api";

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  ticket: string;
  activity_type: "COMMENT" | "INTERNAL_NOTE" | string;
  detail: string;
  created_at: string;
  performed_by?: {
    id: number | string;
    nombre: string;
    email: string;
  };
  /** true si el mensaje fue enviado por el usuario actual (para estilos) */
  isMine?: boolean;
}

export type ChatStatus = "connecting" | "connected" | "disconnected" | "error";

export interface UseTicketChatReturn {
  /** Lista de mensajes recibidos en esta sesión (no carga historial). */
  messages: ChatMessage[];
  /** Estado de la conexión WebSocket. */
  status: ChatStatus;
  /** Nombre del usuario que está escribiendo (o null). */
  typingUser: string | null;
  /** Envía un comentario al canal del ticket. */
  sendMessage: (detail: string, isInternalNote?: boolean) => void;
  /** Emite el indicador de "está escribiendo". */
  sendTyping: () => void;
  /** Cierra la conexión manualmente (p. ej., al desmontar el componente). */
  disconnect: () => void;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Construye la URL WebSocket reemplazando el esquema http(s) por ws(s). */
function buildWsUrl(ticketId: string, token: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws/tickets/${ticketId}/?token=${encodeURIComponent(token)}`;
}

// Pausa entre intentos de reconexión (ms), con backoff exponencial hasta 30 s.
const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];

// Tiempo (ms) sin actividad después del cual se limpia el indicador de typing.
const TYPING_CLEAR_DELAY = 3_000;

// Si onopen no dispara en este tiempo, cerrar la WS y reintentar.
const WS_CONNECT_TIMEOUT = 10_000;

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Conecta al WebSocket del ticket y gestiona el ciclo de vida de la conexión.
 *
 * @param ticketId  UUID del ticket interno.
 * @param currentUserId  ID del usuario autenticado (para marcar isMine).
 * @param enabled  Si es `false` la conexión no se inicia (útil para condicionar).
 */
export function useTicketChat(
  ticketId: string | null | undefined,
  currentUserId: string | number | null | undefined,
  enabled = true,
): UseTicketChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("disconnected");
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para que onmessage siempre use el currentUserId más reciente sin recrear el WS
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // ── Conexión ─────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!ticketId || !enabled) return;

    const token = tokens.getAccess();
    if (!token) {
      // Sin token en storage: intentar refrescar antes de rendirse.
      // Mostrar "connecting" mientras esperamos para que el punto sea amarillo (no rojo).
      setStatus("connecting");
      tryRefreshToken().then(() => {
        // tryRefreshToken actualiza sessionStorage y _at_shared si tiene éxito.
        // También lo habrá hecho otra pestaña → getAccess() lo verá en _at_shared.
        const refreshedToken = tokens.getAccess();
        if (refreshedToken && wsRef.current === null) {
          connect(); // token disponible ahora → conectar (recursión única ya que token ≠ null)
        } else {
          setStatus("error");
        }
      });
      return;
    }

    const url = buildWsUrl(ticketId, token);
    console.log(`[WS] connect → ${url.replace(/token=.*/, 'token=<JWT>')}`);
    // Verificar que el token no esté expirado ANTES de intentar la conexión
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expIn = payload.exp - Math.floor(Date.now() / 1000);
      console.log(`[WS] token exp in ${expIn}s (${payload.exp}) user=${payload.user_id}`);
      if (expIn <= 0) {
        console.warn('[WS] token ALREADY EXPIRED before WS connect — forcing refresh');
        tryRefreshToken().then(ok => {
          console.log('[WS] pre-connect refresh result:', ok, '| new token:', tokens.getAccess()?.slice(-10));
          if (wsRef.current === null) connect();
        });
        return;
      }
    } catch { /* token malformed, try anyway */ }
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    // Timeout de conexión: si onopen no dispara en WS_CONNECT_TIMEOUT ms,
    // cerrar y reintentar (detecta WS colgados en handshake)
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        ws.close();
        // Reintentar con backoff
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    }, WS_CONNECT_TIMEOUT);

    ws.onopen = () => {
      // La WS puede haber sido reemplazada por una nueva antes de que onopen dispare
      if (wsRef.current !== ws) { console.log('[WS] onopen ignored — stale WS'); return; }
      if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
      reconnectAttempt.current = 0;
      setStatus("connected");
      console.log('[WS] onopen → connected, ticket=', ticketId);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current !== ws) { console.log('[WS] onmessage ignored — stale WS'); return; }
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          message?: ChatMessage;
          user?: string;
          detail?: string;
        };
        console.log('[WS] message received, type=', data.type, data.type === 'chat.message' ? 'detail=' + data.message?.detail?.slice(0, 40) : '');

        if (data.type === "chat.message" && data.message) {
          const msg: ChatMessage = {
            ...data.message,
            isMine: String(data.message.performed_by?.id) === String(currentUserIdRef.current),
          };
          setMessages((prev) => [...prev, msg]);
        } else if (data.type === "typing" && data.user) {
          setTypingUser(data.user);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => {
            if (wsRef.current === ws) setTypingUser(null);
          }, TYPING_CLEAR_DELAY);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (event) => {
      // Si wsRef ya apunta a otra WS (cleanup reemplazó este socket), ignorar
      console.log('[WS] onclose code=', event.code, 'reason=', event.reason, 'wasClean=', event.wasClean, '| stale=', wsRef.current !== ws);
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setStatus("disconnected");

      // 4003 = sin permiso: no reintentar
      if (event.code === 4003) {
        setStatus("error");
        return;
      }

      // 4001 = token inválido o expirado: intentar refrescar antes de rendirse.
      // También 1006 (cierre anormal): puede indicar un rechazo HTTP 4xx en el
      // handshake si el servidor cerró antes de aceptar (pre-accept reject).
      if (event.code === 4001 || event.code === 1006) {
        // Capturar el token activo ANTES del intento para detectar cambios cross-tab
        const tokenBefore = tokens.getAccess();
        tryRefreshToken().then(async (ok) => {
          if (ok) {
            // Esta pestaña refrescó exitosamente → reconectar
            reconnectAttempt.current = 0;
            if (wsRef.current === null) connect();
            return;
          }

          // tryRefresh falló: con ROTATE_REFRESH_TOKENS=True, otra pestaña puede
          // haber consumido el refresh_token justo antes que nosotros.
          // Verificar si otra pestaña ya guardó un token nuevo en _at_shared.
          let crossTabToken = localStorage.getItem("_at_shared");
          if (!crossTabToken || crossTabToken === tokenBefore) {
            // Esperar un poco: la otra pestaña puede estar en medio de escribir
            // su nuevo token.  500 ms suele ser suficiente para el RTT del refresh.
            await new Promise(r => setTimeout(r, 500));
            crossTabToken = localStorage.getItem("_at_shared");
          }

          if (crossTabToken && crossTabToken !== tokenBefore) {
            // Sincronizar sessionStorage y reconectar con el token de la otra pestaña
            sessionStorage.setItem("access_token", crossTabToken);
            reconnectAttempt.current = 0;
            if (wsRef.current === null) connect();
            return;
          }

          // Sin token nuevo en ninguna fuente → backoff y reintentar.
          // Nunca marcar "error" por un fallo de refresh: el usuario sigue autenticado
          // (la sesión puede recuperarse en el próximo intento) a menos que sea 4003.
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
          reconnectAttempt.current += 1;
          if (wsRef.current === null) reconnectTimer.current = setTimeout(connect, delay);
        });
        return;
      }

      // Cualquier otro cierre → reconectar con backoff exponencial
      const delay =
        RECONNECT_DELAYS[
          Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
        ];
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose; let onclose handle retry
    };
  }, [ticketId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  // currentUserId se omite intencionalmente: se lee siempre vía currentUserIdRef.current
  // para evitar que un cambio en el ID reabra la conexión.

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setMessages([]);          // limpiar mensajes del ticket anterior
    reconnectAttempt.current = 0; // resetear backoff al cambiar de ticket
    if (enabled && ticketId) connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      // Mover la referencia a null ANTES de close() para que onclose la ignore
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [ticketId, enabled, connect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API pública ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (detail: string, isInternalNote = false) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: "chat.message",
          detail,
          is_internal_note: isInternalNote,
        }),
      );
    },
    [],
  );

  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing" }));
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  return { messages, status, typingUser, sendMessage, sendTyping, disconnect };
}
