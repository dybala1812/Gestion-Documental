/**
 * @file archivoCentralApi.ts
 * @description Cliente del backend de Archivo Central. Todos los componentes llaman a la API por aquí,
 * así la URL, el token y el manejo de errores se cambian en un solo lugar.
 * Usa las mismas variables que el resto del frontend (.env):
 *   VITE_SGD_API_URL        → http://localhost:3000/api   (ya incluye /api)
 *   VITE_SGD_DEV_TOKEN      → token de desarrollo (solo con VITE_DEV_BYPASS_AUTH=true)
 */

const BASE = ((import.meta.env.VITE_SGD_API_URL as string | undefined) ?? "http://localhost:3000/api").replace(/\/$/, "");

/** Token para el backend SGD. En desarrollo, el de pruebas; en producción debe salir del login de NOVA. */
function token(): string | undefined {
  if (import.meta.env.VITE_DEV_BYPASS_AUTH === "true") return import.meta.env.VITE_SGD_DEV_TOKEN as string | undefined;
  return undefined; // TODO: devolver aquí el token de sesión real (igual que el servicio de Comunicaciones)
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
    throw new Error(cuerpo?.mensaje ?? `Error ${r.status} al llamar a ${ruta}`);
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