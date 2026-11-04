/**
 * @file archivoCentralApi.ts
 * @description Cliente del backend de Archivo Central. Todos los componentes llaman a la API por aquí,
 * así la URL, el token y el manejo de errores se cambian en un solo lugar.
 * Usa las mismas variables que el resto del frontend (.env):
 *   VITE_SGD_API_URL        → http://localhost:3000/api   (ya incluye /api)
 */

import { SGD_API_BASE, mensajeErrorSgd } from "../lib/sgdApi";
import { tokens } from "../lib/api";
import type { UbicacionBodega } from "../lib/clasificadosApi";

// La misma URL que sgdApi (también sirve desde otro equipo de la red local).
const BASE = SGD_API_BASE;

/** Token de NOVA para el backend SGD, igual que sgdApi (nunca un token fijo de .env: quedaría en el JavaScript). */
function token(): string | undefined {
  return tokens.getAccess() ?? undefined;
}

async function http<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const r = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...init.headers,
    },
  });
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => null);
    // Contrato de errores del backend (RN-AC-15): { error, campo? } o { error: número, motivo }.
    throw new Error(mensajeErrorSgd(cuerpo) ?? cuerpo?.mensaje ?? `Error ${r.status} al llamar a ${ruta}`);
  }
  return r.json() as Promise<T>;
}

/* ───────────────────────── Tipos ───────────────────────── */
export type TipoEntrega = "fisica" | "digital" | "ambas";

export interface TransferenciaApi {
  id: number;
  codigo: string;
  dependencia: string;
  anio: number;
  tipo: TipoEntrega;
  estado: "Borrador" | "En revisión" | "Recibida";
  fecha: string; // AAAA-MM-DD
  entrega: string;
  contenido: string;
  detalle: string;
  unidades: number;
  porClasificar?: number;
}

export interface CarpetaDto {
  caja: string; carpeta: string; asunto: string;
  /** AAAA-MM-DD; null si no se conoce. */
  fechaInicial: string | null; fechaFinal: string | null;
  folios: number; docs: number; descripcion: string;
}
export interface NuevaTransferenciaDto {
  dependencia: string; anio: number; tipo: TipoEntrega; contenido: string;
  responsable: string; ubicacion: string; carpetas: CarpetaDto[];
  /** Acta de entrega: el archivo que entregó la dependencia, subido antes con `subirActa`. */
  acta_archivo_id?: string;
  /** Física: dónde quedó guardada cada caja (carro, estante y bandeja escritos en la carga). Obligatorio para todas. */
  cajas?: { caja: string; carro: string; estante: string; bandeja: string }[];
  /** Física: novedades de la entrega. */
  observaciones?: string;
  /** Digital: cuántos documentos se van a subir. */
  total_documentos?: number;
}

export interface DetalleTransferenciaApi {
  id: number; codigo: string; dependencia: string; anio: number; tipo: TipoEntrega;
  estado: "Borrador" | "En revisión" | "Recibida";
  contenido: string | null; responsable: string; recibio: string | null;
  fecha: string; ubicacion: string | null; unidades: number;
  observaciones?: string | null;
  /** Acta de entrega (el archivo que se subió); null en las transferencias registradas antes. */
  acta?: { id: string; nombre: string; mime?: string | null; tamano?: number } | null;
  carpetas: {
    caja: string; carpeta: string | null; asunto: string | null;
    fechaInicial: string | null; fechaFinal: string | null;
    folios: number | null; docs: number | null;
    consecutivoDesde: string | null; consecutivoHasta: string | null;
    descripcion: string | null;
    /** Dónde quedó guardada la caja (física). */
    ubicacion?: UbicacionBodega | null;
  }[];
  /** Digital: los archivos que entregó la dependencia, guardados con la transferencia (no pasan a Por clasificar). */
  archivos?: { id: string; nombre: string; mime: string; tamano: number }[];
  /** Aviso si falta la migración de los archivos de transferencia. */
  aviso_archivos?: string | null;
}

export interface ResumenTransferencias {
  anioActual: number;
  anioMaximo: number;
  proximoAnio: number;
  proximoMaximo: number;
  total: number;
  faltan: string[];
  /** Nombres de todas las dependencias activas (para el selector del asistente). */
  dependencias: string[];
}

/* ───────────────────────── Transferencias ───────────────────────── */
export const transferenciasApi = {
  listar: (anio?: number) => http<TransferenciaApi[]>(`/transferencias${anio ? `?anio=${anio}` : ""}`),
  obtener: (id: number) => http<DetalleTransferenciaApi>(`/transferencias/${id}`),
  crear: (d: NuevaTransferenciaDto) =>
    http<{ id: number; codigo: string; acta: string; aviso?: string }>("/transferencias", { method: "POST", body: JSON.stringify(d) }),
  /** Sube el acta de entrega (cualquier archivo que entregó la dependencia) y devuelve su id. */
  subirActa: async (archivo: File, anio: number): Promise<string> => {
    const form = new FormData();
    form.append("archivo", archivo);
    form.append("categoria", "transferencias");
    form.append("contexto", JSON.stringify({ anio, tipo: "acta_entrega" }));
    const t = token();
    // Sin Content-Type: el navegador pone el boundary del multipart.
    const r = await fetch(`${BASE}/archivos`, { method: "POST", body: form, headers: t ? { Authorization: `Bearer ${t}` } : {} });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error(mensajeErrorSgd(cuerpo) ?? cuerpo?.error ?? `No se pudo subir el acta (${r.status})`);
    return String(cuerpo.archivo_id);
  },
  /** Digital: guarda UNO de los documentos con la transferencia (no pasa a Por clasificar). 409 si ya está en ella. */
  subirDocumento: async (transferenciaId: number, archivo: File): Promise<void> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const t = token();
    const r = await fetch(`${BASE}/transferencias/${transferenciaId}/documentos`, {
      method: "POST", body: form, headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) {
      const cuerpo = await r.json().catch(() => null);
      throw Object.assign(new Error(mensajeErrorSgd(cuerpo) ?? cuerpo?.error ?? `Error ${r.status}`), { status: r.status });
    }
  },
  resumen: () => http<ResumenTransferencias>("/transferencias/resumen"),
};