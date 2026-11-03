/**
 * @file correosEventoApi.ts
 * @description Correo de un paso del historial de una comunicación (recibido o enviado),
 * para verlo en el detalle. Backend: GET /api/comunicaciones/{id}/eventos/{eventoId}/correo.
 */
import { sgdFetch } from "./sgdApi";
import type { AdjuntoCom, TipoEvento } from "./comunicacionesApi";

export interface CorreoEvento {
  evento_id: number;
  tipo: TipoEvento;
  direccion: "enviado" | "recibido";
  de: string | null;
  para: string | null;
  asunto: string | null;
  cuerpo: string | null;
  fecha: string;
  adjuntos: AdjuntoCom[];
  /** false = solo una parte del correo (p. ej. el mensaje escrito, sin la plantilla). */
  completo: boolean;
  aviso?: string;
}

/** Pasos del historial que envían o reciben un correo (se pueden abrir). */
export const EVENTOS_CON_CORREO: ReadonlySet<TipoEvento> = new Set<TipoEvento>([
  "recepcion", "acuse_recibo", "remision", "respuesta_dependencia", "devolucion",
  "respuesta_remitente", "recordatorio", "correo_adicional",
]);

export async function apiCorreoDeEvento(comunicacionId: number, eventoId: number): Promise<CorreoEvento> {
  return sgdFetch<CorreoEvento>(`/comunicaciones/${comunicacionId}/eventos/${eventoId}/correo`);
}
