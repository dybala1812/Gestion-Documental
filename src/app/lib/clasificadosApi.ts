/**
 * @file clasificadosApi.ts
 * @description Capa de datos de la bandeja "Clasificados" (Archivo Central · SGD).
 * Va en: NOVA_FT/src/app/lib/clasificadosApi.ts
 * Llama al backend SGD (GET /api/clasificados) con el mismo cliente que Comunicaciones.
 */
import { sgdFetch } from "./sgdApi";

export type TipoClasificado = "Entrada" | "Salida" | "Interno";

/** Posición del catálogo de ubicaciones físicas: Carro · Estante · Bandeja (D-23). Bodega y módulo: registros viejos. */
export interface UbicacionBodega {
  id: number;
  carro?: string | null;
  estante: string | null;
  bandeja?: string | null;
  bodega?: string | null;
  modulo?: string | null;
}

export interface Clasificado {
  id: number;
  /** Ej. "194/2024". */
  consecutivo: string | null;
  anio: number;
  /** AAAA-MM-DD */
  fecha: string | null;
  tipo: TipoClasificado | null;
  titulo: string;
  /** Remitente (Entrada) o destinatario (Salida/Interno). */
  contraparte: string | null;
  dependencia: string;
  dependencia_id: number | null;
  asunto: string | null;
  trd: string | null;
  /** Ubicación física: Carro → Estante → Bandeja → Caja → Carpeta (D-23). */
  carro?: string | null;
  estante?: string | null;
  bandeja?: string | null;
  caja: string | null;
  carpeta: string | null;
  /** Posición del catálogo, si el documento la tiene. */
  ubicacion?: UbicacionBodega | null;
  origen: string | null;
  estado: string;
  archivo_id: string;
  archivo_nombre: string | null;
  paginas: number | null;
  cargado_en: string | null;
}

export interface FiltrosClasificados {
  q?: string;
  dependencia_id?: number;
  limite?: number;
}

export async function apiListClasificados(filtros: FiltrosClasificados = {}): Promise<Clasificado[]> {
  const p = new URLSearchParams();
  if (filtros.q) p.set("q", filtros.q);
  if (filtros.dependencia_id) p.set("dependencia_id", String(filtros.dependencia_id));
  if (filtros.limite) p.set("limite", String(filtros.limite));
  const qs = p.toString() ? `?${p}` : "";
  return sgdFetch<Clasificado[]>(`/clasificados${qs}`);
}