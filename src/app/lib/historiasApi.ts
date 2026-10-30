/**
 * @file historiasApi.ts
 * @description Historias académicas del backend SGD: árbol, lista, documentos de una historia y carga (carga D).
 */
import { sgdFetch } from "./sgdApi";

export type EstadoHistoria = "activa" | "retirado" | "graduado";

export interface NuevaHistoriaDocumento {
  programa_id: number;
  estado: EstadoHistoria;
  anio: number;
  /** Título para buscarlo después (p. ej. "Acta de grado"). */
  titulo: string;
  apellidos: string;
  nombres: string;
  numero_documento: string;
  tipo_documento?: string;
}

export interface HistoriaCargada {
  documento_id: number;
  historia_id: number;
  estudiante_id: number;
  nueva_historia: boolean;
  estudiante: { apellidos: string; nombres: string; existia: boolean; nombre_distinto: boolean };
}

/** Sube UN archivo a la historia del estudiante. Si ya está en esa historia, el backend responde 409 (duplicado). */
export async function apiCargarHistoria(archivo: File, datos: NuevaHistoriaDocumento): Promise<HistoriaCargada> {
  const form = new FormData();
  form.append("archivo", archivo);
  (Object.entries(datos) as [string, string | number | undefined][]).forEach(([k, v]) => {
    if (v !== undefined && v !== "") form.append(k, String(v));
  });
  return sgdFetch<HistoriaCargada>("/historias", { method: "POST", body: form });
}

// ── Consulta (RF-AC-020) ─────────────────────────────────────────────────────

export interface NodoProgramaHist { programa_id: number; programa: string; total: number }
export interface NodoNivelHist { nivel_id: number | null; nivel: string; tipo: string | null; total: number; programas: NodoProgramaHist[] }
export interface NodoAnioHist { anio: number | null; total: number; niveles: NodoNivelHist[] }
export interface NodoEstadoHist { estado: EstadoHistoria; total: number; anios: NodoAnioHist[] }

export interface HistoriaFila {
  id: number;
  estado: EstadoHistoria;
  anio: number | null;
  apellidos: string;
  nombres: string;
  tipo_documento: string;
  numero_documento: string;
  programa_id: number;
  programa: string;
  nivel_id: number | null;
  nivel: string | null;
  documentos: number;
  ultimo_cargue: string | null;
}

export interface PaginaHistorias { total: number; pagina: number; limite: number; filas: HistoriaFila[] }

export interface FiltrosHistorias {
  estado?: EstadoHistoria;
  anio?: number | null;
  nivel_id?: number | null;
  programa_id?: number;
  /** Nombre, cédula o título de un documento. */
  q?: string;
}

export interface DocumentoHistoria {
  id: number;
  titulo: string;
  fecha: string | null;
  cargado_en: string;
  archivo_id: string;
  archivo_nombre: string | null;
  paginas: number | null;
}

export function apiArbolHistorias(): Promise<NodoEstadoHist[]> {
  return sgdFetch<NodoEstadoHist[]>("/historias/arbol");
}

export function apiListarHistorias(filtros: FiltrosHistorias, pagina = 1): Promise<PaginaHistorias> {
  const p = new URLSearchParams({ pagina: String(pagina) });
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  return sgdFetch<PaginaHistorias>(`/historias?${p}`);
}

export function apiDocumentosHistoria(historiaId: number): Promise<DocumentoHistoria[]> {
  return sgdFetch<DocumentoHistoria[]>(`/historias/${historiaId}/documentos`);
}
