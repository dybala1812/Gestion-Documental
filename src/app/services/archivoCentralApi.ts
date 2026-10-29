/**
 * @file archivoCentralApi.ts
 * @description Cliente del backend de Archivo Central. Todos los componentes llaman a la API por aquí,
 * así la URL, el token y el manejo de errores se cambian en un solo lugar.
 * Usa las mismas variables que el resto del frontend (.env):
 *   VITE_SGD_API_URL        → http://localhost:3000/api   (ya incluye /api)
 */

import { mensajeErrorSgd } from "../lib/sgdApi";
import { tokens } from "../lib/api";
import { leerSesionTemporal } from "../lib/loginTemporal"; // ⚠️ TEMPORAL

const BASE =((import.meta.env.VITE_SGD_API_URL as string | undefined) ?? "http://localhost:3000/api").replace(/\/$/, "");

/**
 * Token para el backend SGD: el de la sesión del login temporal de pruebas (⚠️ TEMPORAL) o, si no
 * hay, el de NOVA, igual que sgdApi. Ya no se usa un token fijo de .env: quedaba dentro del JavaScript.
 */
function token(): string | undefined {
  return leerSesionTemporal()?.token ?? tokens.getAccess() ?? undefined;
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
  fechaInicial: string; fechaFinal: string;
  folios: number; docs: number; descripcion: string;
}
export interface NuevaTransferenciaDto {
  dependencia: string; anio: number; tipo: TipoEntrega; contenido: string;
  responsable: string; ubicacion: string; carpetas: CarpetaDto[];
}

export interface DetalleTransferenciaApi {
  id: number; codigo: string; dependencia: string; anio: number; tipo: TipoEntrega;
  estado: "Borrador" | "En revisión" | "Recibida";
  contenido: string | null; responsable: string; recibio: string | null;
  fecha: string; ubicacion: string | null; unidades: number;
  carpetas: {
    caja: string; carpeta: string | null; asunto: string | null;
    fechaInicial: string | null; fechaFinal: string | null;
    folios: number | null; docs: number | null;
    consecutivoDesde: string | null; consecutivoHasta: string | null;
    descripcion: string | null;
  }[];
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
    http<{ id: number; codigo: string; acta: string }>("/transferencias", { method: "POST", body: JSON.stringify(d) }),
  resumen: () => http<ResumenTransferencias>("/transferencias/resumen"),
};