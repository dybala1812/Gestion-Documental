/**
 * @file historiasApi.ts
 * @description Historias académicas del backend SGD: cargar un documento en la historia de un estudiante (carga D).
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
