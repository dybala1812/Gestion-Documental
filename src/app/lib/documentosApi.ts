/**
 * @file documentosApi.ts
 * @description Capa de datos de documentos del Archivo Central: asuntos, listados por estado y carga individual.
 * Va en: NOVA_FT/src/app/lib/documentosApi.ts
 */
import { sgdFetch } from "./sgdApi";
import type { Clasificado } from "./clasificadosApi";

export interface AsuntoCat {
  id: number;
  nombre: string;
  trd_codigo: string | null;
}

export interface NuevoDocumento {
  dependencia_id: number;
  anio: number;
  asunto_id?: number;
  /** "Entrada" | "Salida" | "Interno" */
  tipo?: string;
  consecutivo?: string;
  /** AAAA-MM-DD */
  fecha?: string;
  caja?: string;
  carpeta?: string;
}

export async function apiListAsuntos(dependenciaId: number): Promise<AsuntoCat[]> {
  return sgdFetch<AsuntoCat[]>(`/asuntos?dependencia_id=${dependenciaId}`);
}

export async function apiListDocumentos(
  estado: "clasificado" | "por_clasificar",
  filtros: { q?: string; dependencia_id?: number } = {},
): Promise<Clasificado[]> {
  const p = new URLSearchParams({ estado });
  if (filtros.q) p.set("q", filtros.q);
  if (filtros.dependencia_id) p.set("dependencia_id", String(filtros.dependencia_id));
  return sgdFetch<Clasificado[]>(`/documentos?${p}`);
}

/** Sube UN archivo y crea su documento. Si la huella ya existe, el backend responde 409 (duplicado). */
export async function apiCrearDocumento(archivo: File, datos: NuevoDocumento): Promise<Clasificado> {
  const form = new FormData();
  form.append("archivo", archivo);
  (Object.entries(datos) as [string, string | number | undefined][]).forEach(([k, v]) => {
    if (v !== undefined && v !== "") form.append(k, String(v));
  });
  // Sin Content-Type: el navegador agrega el boundary del multipart. Si sgdFetch fuerza JSON, hay que ajustarlo.
  return sgdFetch<Clasificado>("/documentos", { method: "POST", body: form });
}
/** Anula un documento (RF-AC-024): no se borra, queda "anulado" con motivo y auditado. */
export async function apiAnularDocumento(documentoId: number, motivo: string): Promise<{ ok: boolean }> {
  return sgdFetch<{ ok: boolean }>(`/documentos/${documentoId}/anular`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}
