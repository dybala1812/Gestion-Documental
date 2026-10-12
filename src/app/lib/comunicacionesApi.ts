/**
 * @file comunicacionesApi.ts
 * @description Capa de datos del módulo Comunicaciones (Archivo Central · SGD).
 *
 * Todas las llamadas van al backend SGD (Next.js). Reutiliza el JWT de NOVA.
 * Los tipos replican las tablas de la base de datos.
 *
 * Reglas que respeta el backend:
 *  - Estados: nueva → remitida → respondida_dependencia (↺ devuelta) → cerrada; anulada.
 *  - Solo se cierra al enviar la respuesta al remitente (crea la salida SAL).
 *  - Anular exige motivo. No hay borrado.
 */
import { sgdFetch, sgdFetchBlob } from "./sgdApi";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoComunicacion = "ENT" | "SAL" | "INT";

export type EstadoComunicacion =
  | "nueva"
  | "remitida"
  | "respondida_dependencia"
  | "devuelta"
  | "cerrada"
  | "anulada";

export type TipoEvento =
  | "recepcion"
  | "acuse_recibo"
  | "remision"
  | "respuesta_dependencia"
  | "devolucion"
  | "respuesta_remitente"
  | "recordatorio"
  | "marcada_escalar"
  | "asociacion_manual"
  | "anulacion"
  | "nota"
  | "correo_adicional"
  | "error_envio";

export interface DependenciaCom {
  id: number;
  codigo: string;
  nombre: string;
  correo_oficial: string;
}

export interface AdjuntoCom {
  archivo_id: string;
  nombre_original: string;
  tamano_bytes: number;
  mime: string;
  /** Si viene de la respuesta de la dependencia. */
  de_respuesta?: boolean;
}

export interface EventoCom {
  id: number;
  tipo: TipoEvento;
  estado_anterior?: EstadoComunicacion | null;
  estado_nuevo?: EstadoComunicacion | null;
  dependencia?: string | null;
  usuario?: string | null;
  detalle?: string | null;
  creado_en: string;
}

export interface Comunicacion {
  id: number;
  tipo: TipoComunicacion;
  consecutivo: string;
  consecutivo_original?: string | null;
  origen: "correo" | "manual" | "historico";
  estado: EstadoComunicacion;
  remitente_nombre: string | null;
  remitente_correo: string | null;
  destinatario_nombre?: string | null;
  destinatario_correo?: string | null;
  asunto: string;
  cuerpo: string | null;
  fecha_recepcion: string;
  dependencia_id: number | null;
  fecha_limite: string | null;
  comunicacion_entrada_id?: number | null;
  n_recordatorios: number;
  por_escalar: boolean;
  anulado_motivo?: string | null;
  cerrado_en?: string | null;
  adjuntos: AdjuntoCom[];
  eventos: EventoCom[];
}

export interface CorreoSinAsociar {
  id: number;
  message_id: string;
  de_nombre: string | null;
  de_correo: string;
  asunto: string | null;
  cuerpo: string | null;
  recibido_en: string;
  motivo: "sin_etiqueta" | "etiqueta_no_coincide" | "remitente_externo_sin_etiqueta" | "otro";
  posible_comunicacion_id: number | null;
  adjuntos: AdjuntoCom[];
  resuelto: boolean;
  resuelto_como?: "asociado" | "nueva" | null;
  comunicacion_id?: number | null;
}

export interface ResumenMesHistorico {
  mes: number; // 1-12
  cerradas_sistema: number;
  importadas: number;
}

// ── Etiquetas y colores (paleta de NOVA, Tailwind) ──────────────────────────

export const ESTADO_LABEL: Record<EstadoComunicacion, string> = {
  nueva: "Nueva",
  remitida: "Remitida",
  respondida_dependencia: "Respondida",
  devuelta: "Devuelta",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const ESTADO_BADGE: Record<EstadoComunicacion, string> = {
  nueva: "bg-blue-50 text-blue-700 border-blue-200",
  remitida: "bg-amber-50 text-amber-700 border-amber-200",
  respondida_dependencia: "bg-violet-50 text-violet-700 border-violet-200",
  devuelta: "bg-rose-50 text-rose-700 border-rose-200",
  cerrada: "bg-green-50 text-green-700 border-green-200",
  anulada: "bg-gray-100 text-gray-500 border-gray-200",
};

export const TIPO_LABEL: Record<TipoComunicacion, string> = {
  ENT: "Entrada",
  SAL: "Salida",
  INT: "Interno",
};

export const EVENTO_LABEL: Record<TipoEvento, string> = {
  recepcion: "Recibida por correo",
  acuse_recibo: "Acuse de recibo enviado",
  remision: "Remitida a dependencia",
  respuesta_dependencia: "Respuesta de la dependencia",
  devolucion: "Devuelta a la dependencia",
  respuesta_remitente: "Respuesta enviada al remitente",
  recordatorio: "Recordatorio enviado",
  marcada_escalar: "Marcada para escalar",
  asociacion_manual: "Asociada manualmente",
  anulacion: "Anulada",
  nota: "Nota",
  correo_adicional: "Correo adicional",
  error_envio: "Error de envío",
};

export const MOTIVO_SIN_ASOCIAR_LABEL: Record<CorreoSinAsociar["motivo"], string> = {
  sin_etiqueta: "Sin etiqueta en el asunto",
  etiqueta_no_coincide: "La etiqueta no coincide",
  remitente_externo_sin_etiqueta: "Remitente externo sin etiqueta",
  otro: "Otro",
};

/** Transiciones válidas (RN-AC-09). */
export const TRANSICIONES: Record<EstadoComunicacion, EstadoComunicacion[]> = {
  nueva: ["remitida", "anulada"],
  remitida: ["respondida_dependencia", "anulada"],
  respondida_dependencia: ["devuelta", "cerrada", "anulada"],
  devuelta: ["respondida_dependencia", "anulada"],
  cerrada: [],
  anulada: [],
};

export const PLAZO_DEFECTO_DIAS_HABILES = 5;
export const ALERTA_DIAS_SIN_RESPUESTA = 5;

// ── Utilidades de fecha ─────────────────────────────────────────────────────

function esDiaHabil(d: Date) {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6; // festivos: los aporta el backend (dia_festivo)
}

/** Fecha local en formato AAAA-MM-DD (sin pasar por UTC). */
export function fechaLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Interpreta "AAAA-MM-DD" como fecha local (new Date() la tomaría como UTC). */
function parseFecha(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const f = new Date(desde);
  let n = 0;
  while (n < dias) {
    f.setDate(f.getDate() + 1);
    if (esDiaHabil(f)) n++;
  }
  return f;
}

export function diasDesde(fechaIso: string): number {
  const ms = Date.now() - new Date(fechaIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function estaVencida(c: Comunicacion): boolean {
  return (c.estado === "remitida" || c.estado === "devuelta") && !!c.fecha_limite && parseFecha(c.fecha_limite) < new Date(new Date().toDateString());
}

/** Días desde la última remisión (para la alerta "remitidas sin respuesta"). */
export function diasRemitida(c: Comunicacion): number | null {
  if (c.estado !== "remitida" && c.estado !== "devuelta") return null;
  const ev = [...c.eventos].reverse().find(e => e.tipo === "remision" || e.tipo === "devolucion");
  return ev ? diasDesde(ev.creado_en) : null;
}

export function formatoFecha(iso: string, conHora = false): string {
  const d = parseFecha(iso);
  return d.toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── API real hacia el backend SGD ───────────────────────────────────────────

export async function apiListDependenciasCom(): Promise<DependenciaCom[]> {
  return sgdFetch<DependenciaCom[]>("/dependencias");
}

interface ListComunicacionesFiltros {
  estado?: string;
  anio?: number;
  mes?: number;
  dependencia_id?: number;
  tipo?: string;
  q?: string;
}

export async function apiListComunicaciones(filtros: ListComunicacionesFiltros = {}): Promise<Comunicacion[]> {
  const q = new URLSearchParams();
  if (filtros.estado) q.set("estado", filtros.estado);
  if (filtros.anio) q.set("anio", String(filtros.anio));
  if (filtros.mes) q.set("mes", String(filtros.mes));
  if (filtros.dependencia_id) q.set("dependencia_id", String(filtros.dependencia_id));
  if (filtros.tipo) q.set("tipo", filtros.tipo);
  if (filtros.q) q.set("q", filtros.q);
  const qs = q.toString() ? `?${q}` : "";
  return sgdFetch<Comunicacion[]>(`/comunicaciones${qs}`);
}

/** Obtiene una comunicación por id. */
export async function apiObtenerComunicacion(id: number): Promise<Comunicacion> {
  return sgdFetch<Comunicacion>(`/comunicaciones/${id}`);
}

/** F2 · Remitir a una dependencia con plazo en días hábiles.
 *  El frontend dispara el webhook de n8n; n8n envía el correo y luego actualiza el estado vía /api/n8n/remisiones/remitir.
 */
export async function apiRemitirComunicacion(
  id: number,
  payload: { dependencia_id: number; plazo_dias_habiles: number; mensaje: string; adjuntos: string[] },
): Promise<Comunicacion> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_REMITIR_URL;
  if (!webhookUrl) {
    throw new Error("VITE_N8N_WEBHOOK_REMITIR_URL no está configurado");
  }

  const webhookToken = import.meta.env.VITE_N8N_WEBHOOK_TOKEN;
  const webhookAuthHeader = import.meta.env.VITE_N8N_WEBHOOK_AUTH_HEADER ?? "Authorization";
  const webhookAuthPrefix = import.meta.env.VITE_N8N_WEBHOOK_AUTH_PREFIX ?? "Bearer ";
  const authValue = webhookToken ? `${webhookAuthPrefix}${webhookToken}` : undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authValue) headers[webhookAuthHeader] = authValue;

  const usuarioId = Number(import.meta.env.VITE_N8N_WEBHOOK_USUARIO_ID) || 1;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modo: "remitir",
      comunicacion_id: id,
      usuario_id: usuarioId,
      dependencia_id: payload.dependencia_id,
      plazo_dias_habiles: payload.plazo_dias_habiles,
      mensaje: payload.mensaje,
      adjuntos_ids: payload.adjuntos,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Error en n8n");
    throw new Error(`n8n respondió ${res.status}: ${err}`);
  }

  // n8n actualizó el estado; refrescamos la comunicación desde el backend.
  return apiObtenerComunicacion(id);
}

/** F2 · Devolver a la dependencia (respuesta incompleta). */
export async function apiDevolverComunicacion(id: number, motivo: string): Promise<Comunicacion> {
  return sgdFetch<Comunicacion>(`/comunicaciones/${id}/devolver`, {
    method: "POST",
    body: JSON.stringify({ mensaje: motivo }),
  });
}

/** F3 · Enviar respuesta al remitente: dispara el webhook de n8n, que envía el correo y luego cierra la entrada.
 *  Devuelve la comunicación de entrada actualizada desde el backend.
 */
export async function apiResponderRemitente(
  id: number,
  payload: { asunto: string; cuerpo: string; adjuntos: string[] },
): Promise<Comunicacion> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_RESPONDER_URL;
  if (!webhookUrl) {
    throw new Error("VITE_N8N_WEBHOOK_RESPONDER_URL no está configurado");
  }

  const webhookToken = import.meta.env.VITE_N8N_WEBHOOK_TOKEN;
  const webhookAuthHeader = import.meta.env.VITE_N8N_WEBHOOK_AUTH_HEADER ?? "Authorization";
  const webhookAuthPrefix = import.meta.env.VITE_N8N_WEBHOOK_AUTH_PREFIX ?? "Bearer ";
  const authValue = webhookToken ? `${webhookAuthPrefix}${webhookToken}` : undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authValue) headers[webhookAuthHeader] = authValue;

  const usuarioId = Number(import.meta.env.VITE_N8N_WEBHOOK_USUARIO_ID) || 1;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      modo: "responder",
      comunicacion_id: id,
      usuario_id: usuarioId,
      asunto: payload.asunto,
      cuerpo: payload.cuerpo,
      adjuntos_ids: payload.adjuntos,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Error en n8n");
    throw new Error(`n8n respondió ${res.status}: ${err}`);
  }

  // n8n enviará el correo y luego cerrará la entrada vía /api/comunicaciones/[id]/responder.
  return apiObtenerComunicacion(id);
}

/** Anular con motivo (RF-AC-024). */
export async function apiAnularComunicacion(id: number, motivo: string): Promise<Comunicacion> {
  return sgdFetch<Comunicacion>(`/comunicaciones/${id}/anular`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

/** F4 manual · Enviar recordatorio editable para una comunicación remitida/devuelta. */
export async function apiRecordatorioManual(
  id: number,
  payload: { asunto?: string; cuerpo?: string; adjuntos?: string[] },
): Promise<{ ok: boolean; comunicacion_id: number; n8n: unknown }> {
  return sgdFetch<{ ok: boolean; comunicacion_id: number; n8n: unknown }>(`/comunicaciones/${id}/recordatorio-manual`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Enviar correo adicional asociado a una comunicación: al remitente o a una dependencia
 *  (la asignada si no se indica `dependencia_id`, o cualquier otra dependencia activa). */
export async function apiCorreoAdicional(
  id: number,
  payload: { destinatario_tipo: "remitente" | "dependencia"; dependencia_id?: number; asunto: string; cuerpo: string; adjuntos?: string[] },
): Promise<{ ok: boolean; comunicacion_id: number; n8n: unknown }> {
  return sgdFetch<{ ok: boolean; comunicacion_id: number; n8n: unknown }>(`/comunicaciones/${id}/correo-adicional`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Respuesta directa al remitente sin pasar por dependencia (excepción a RN-AC-09). */
export async function apiResponderDirecto(
  id: number,
  payload: { asunto?: string; cuerpo: string; adjuntos?: string[] },
): Promise<{ ok: boolean; comunicacion_id: number; n8n: unknown }> {
  return sgdFetch<{ ok: boolean; comunicacion_id: number; n8n: unknown }>(`/comunicaciones/${id}/responder-directo`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiListCorreosSinAsociar(): Promise<CorreoSinAsociar[]> {
  return sgdFetch<CorreoSinAsociar[]>("/correos-sin-asociar");
}

/** Asociar un correo sin asociar como respuesta de una comunicación remitida/devuelta. */
export async function apiAsociarCorreo(correoId: number, comunicacionId: number): Promise<Comunicacion> {
  return sgdFetch<Comunicacion>(`/correos-sin-asociar/${correoId}/asociar`, {
    method: "POST",
    body: JSON.stringify({ comunicacion_id: comunicacionId }),
  });
}

/** Crear una comunicación nueva a partir de un correo sin asociar. */
export async function apiCrearDesdeCorreo(correoId: number): Promise<Comunicacion> {
  return sgdFetch<Comunicacion>(`/correos-sin-asociar/${correoId}/crear`, { method: "POST" });
}

// ── Histórico: aún no hay endpoints en el backend ───────────────────────────
// Cuando se implementen, reemplazar estas funciones por llamadas a /api/historico/*.

export async function apiResumenHistorico(_year: number): Promise<ResumenMesHistorico[]> {
  // TODO: implementar backend de registro histórico (RF-AC-020).
  return [];
}

export async function apiComunicacionesDelMes(_year: number, _mes: number): Promise<Comunicacion[]> {
  // TODO: implementar backend de registro histórico (RF-AC-020).
  return [];
}

/** ⚠️ SOLO PRUEBAS: elimina físicamente una comunicación y sus archivos. */
export async function apiEliminarComunicacion(id: number): Promise<{ eliminado: boolean; consecutivo: string }> {
  return sgdFetch<{ eliminado: boolean; consecutivo: string }>(`/comunicaciones/${id}/eliminar`, { method: "DELETE" });
}

/** Descarga un adjunto (GET /archivos/{id}) para verlo o guardarlo. */
export async function apiDescargarArchivo(archivoId: string): Promise<{ blob: Blob; nombre: string | null }> {
  return sgdFetchBlob(`/archivos/${archivoId}`);
}
