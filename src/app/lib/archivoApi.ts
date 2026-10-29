/**
 * @file archivoApi.ts
 * @description Archivo navegable y búsqueda avanzada del backend SGD (RF-AC-013, RF-AC-014, SGD-032).
 * El backend aplica los permisos: un usuario de Dependencia solo recibe lo de su dependencia.
 */
import { sgdFetch } from "./sgdApi";

export interface NodoAsunto { asunto_id: number; nombre: string; trd: string | null; total: number }
export interface NodoAnio { anio: number; total: number; asuntos: NodoAsunto[] }
export interface NodoDependencia { dependencia_id: number; codigo: string; nombre: string; total: number; anios: NodoAnio[] }

export type TipoCodigo = "ENT" | "SAL" | "INT";

export interface ResultadoBusqueda {
  origen: "documento" | "comunicacion";
  id: number;
  consecutivo: string | null;
  consecutivo_original: string | null;
  anio: number;
  fecha: string | null; // AAAA-MM-DD
  tipo: TipoCodigo | null;
  titulo: string;
  contraparte: string | null;
  dependencia: string | null;
  dependencia_id: number | null;
  asunto: string | null;
  trd: string | null;
  archivo_id: string | null;
  caja: string | null;
  carpeta: string | null;
  estado: string | null;
}

export interface PaginaBusqueda {
  total: number;
  pagina: number;
  limite: number;
  incluye: { documentos: boolean; comunicaciones: boolean };
  filas: ResultadoBusqueda[];
}

export interface FiltrosBusqueda {
  anio?: number;
  mes?: number;
  dependencia_id?: number;
  tipo?: "entrada" | "salida" | "interno";
  asunto_id?: number;
  asunto?: string;
  consecutivo?: string;
  persona?: string;
  trd?: string;
  texto?: string;
  alcance?: "todo" | "documentos" | "comunicaciones";
}

export const TIPO_LEGIBLE: Record<TipoCodigo, "Entrada" | "Salida" | "Interno"> = { ENT: "Entrada", SAL: "Salida", INT: "Interno" };

export function apiArbolArchivo(): Promise<NodoDependencia[]> {
  return sgdFetch<NodoDependencia[]>("/archivo/arbol");
}

export function apiBuscarArchivo(filtros: FiltrosBusqueda, pagina = 1, limite = 20): Promise<PaginaBusqueda> {
  const qs = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") qs.set(k, String(v).trim());
  }
  return sgdFetch<PaginaBusqueda>(`/archivo/buscar?${qs}`);
}
