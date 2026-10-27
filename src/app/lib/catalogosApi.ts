/**
 * @file lib/catalogosApi.ts
 * @description Cliente de los catálogos, parámetros, plantillas de correo y auditoría del backend SGD.
 */
import { sgdFetch } from "./sgdApi";

export type SlugCatalogo =
  | "dependencias"
  | "trd"
  | "asuntos"
  | "tipos-documentales"
  | "programas"
  | "ubicaciones"
  | "usuarios";

export interface PaginacionCatalogo<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface ListarCatalogoParams {
  pagina?: number;
  limite?: number;
  estado?: "activo" | "inactivo" | "";
  buscar?: string;
  [key: string]: string | number | undefined;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listarCatalogo<T>(tabla: SlugCatalogo, params: ListarCatalogoParams = {}): Promise<PaginacionCatalogo<T>> {
  return sgdFetch<PaginacionCatalogo<T>>(`/catalogos/${tabla}${qs(params)}`);
}

export async function obtenerCatalogo<T>(tabla: SlugCatalogo, id: number): Promise<T> {
  return sgdFetch<T>(`/catalogos/${tabla}/${id}`);
}

export async function crearCatalogo<T>(tabla: SlugCatalogo, payload: Record<string, unknown>): Promise<T> {
  return sgdFetch<T>(`/catalogos/${tabla}`, { method: "POST", body: JSON.stringify(payload) });
}

export async function actualizarCatalogo<T>(tabla: SlugCatalogo, id: number, payload: Record<string, unknown>): Promise<T> {
  return sgdFetch<T>(`/catalogos/${tabla}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

/** Activar o inactivar (nunca se borra). Inactivar exige motivo: queda en la auditoría. */
export async function cambiarEstadoCatalogo<T>(tabla: SlugCatalogo, id: number, estado: "activo" | "inactivo", motivo?: string): Promise<T> {
  return actualizarCatalogo<T>(tabla, id, { estado, ...(motivo ? { motivo } : {}) });
}

// ── Importación desde Excel ──────────────────────────────────────────────────

export type SlugImportable = "dependencias" | "trd" | "programas";

export interface FilaImportada {
  fila: number;
  ok: boolean;
  id?: number;
  campo?: string;
  tipo?: string;
  error?: string;
}

export interface ResultadoImportacion {
  confirmado: boolean;
  total: number;
  validas: number;
  con_error: number;
  filas: FilaImportada[];
}

/** confirmar=false: vista previa (no escribe). confirmar=true: inserta las válidas. */
export async function importarCatalogo(tabla: SlugImportable, filas: Record<string, string | number>[], confirmar: boolean): Promise<ResultadoImportacion> {
  return sgdFetch<ResultadoImportacion>(`/catalogos/${tabla}/importar`, { method: "POST", body: JSON.stringify({ filas, confirmar }) });
}

// ── Parámetros ───────────────────────────────────────────────────────────────

export interface Parametro {
  clave: string;
  valor: string;
  tipo: "entero" | "decimal" | "texto" | "lista" | "booleano";
  descripcion: string;
  minimo: number | null;
  maximo: number | null;
  actualizado_en: string;
}

export async function listarParametros(): Promise<Parametro[]> {
  return sgdFetch<Parametro[]>("/parametros");
}

export async function guardarParametro(clave: string, valor: string): Promise<Parametro> {
  return sgdFetch<Parametro>(`/parametros/${encodeURIComponent(clave)}`, { method: "PATCH", body: JSON.stringify({ valor }) });
}

// ── Plantillas de correo ─────────────────────────────────────────────────────

export interface Plantilla {
  codigo: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  cuerpo_original: string;
  actualizado_en: string;
}

export async function listarPlantillas(): Promise<Plantilla[]> {
  return sgdFetch<Plantilla[]>("/plantillas");
}

export async function guardarPlantilla(codigo: string, asunto: string, cuerpo: string): Promise<Plantilla> {
  return sgdFetch<Plantilla>(`/plantillas/${encodeURIComponent(codigo)}`, { method: "PATCH", body: JSON.stringify({ asunto, cuerpo }) });
}

export async function restablecerPlantilla(codigo: string): Promise<Plantilla> {
  return sgdFetch<Plantilla>(`/plantillas/${encodeURIComponent(codigo)}`, { method: "PATCH", body: JSON.stringify({ restablecer: true }) });
}

// ── Auditoría ────────────────────────────────────────────────────────────────

export interface RegistroAuditoria {
  id: number;
  fecha: string;
  accion: string;
  recurso_tipo: string;
  recurso_id: string | null;
  resultado: "ok" | "denegado" | "error";
  detalle: Record<string, unknown>;
  valores_previos: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  usuario_id: number | null;
  usuario: string | null;
}

export interface FiltrosAuditoria {
  desde?: string;
  hasta?: string;
  usuario?: number;
  accion?: string;
  recurso_tipo?: string;
  recurso_id?: string;
  resultado?: string;
  pagina?: number;
  limite?: number;
}

export async function consultarAuditoria(f: FiltrosAuditoria): Promise<PaginacionCatalogo<RegistroAuditoria>> {
  return sgdFetch<PaginacionCatalogo<RegistroAuditoria>>(`/auditoria${qs({ ...f })}`);
}
