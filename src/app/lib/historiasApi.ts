/**
 * @file historiasApi.ts
 * @description Historias académicas del backend SGD: árbol, lista, documentos de una historia y carga (carga D).
 */
import { sgdFetch } from "./sgdApi";

export type EstadoHistoria = "activa" | "retirado" | "graduado";

/** Estados como se eligen en pantalla (carpetas del árbol). */
export const ESTADOS_HISTORIA: { valor: EstadoHistoria; etiqueta: string }[] = [
  { valor: "graduado", etiqueta: "Graduados" },
  { valor: "retirado", etiqueta: "Retirados" },
  { valor: "activa", etiqueta: "Activos" },
];

// ── Convención del nombre del archivo (carga masiva) ─────────────────────────

/** "GÓMEZ RIASCOS ANA LUCÍA - 1061998877.pdf" (por acordar, P-03). */
export const CONVENCION_ARCHIVO = /^(.+?)\s+-\s+(\d{5,12})(?:\s*\(\d+\))?\.(pdf|jpe?g|png|tiff?)$/i;

export interface EstudianteDelArchivo { nombre: string; apellidos: string; nombres: string; cedula: string }

/** Lee apellidos, nombres y cédula del nombre del archivo, o null si no cumple la convención.
 *  Apellidos: las dos primeras palabras (una si el nombre solo tiene dos); nombres: el resto. */
export function leerNombreArchivo(nombreArchivo: string): EstudianteDelArchivo | null {
  const m = nombreArchivo.match(CONVENCION_ARCHIVO);
  if (!m || !/^[\p{L}'. ]+$/u.test(m[1]) || m[1].trim().split(/\s+/).length < 2) return null;
  const palabras = m[1].trim().split(/\s+/);
  const corte = palabras.length >= 3 ? 2 : 1;
  return { nombre: m[1].trim(), apellidos: palabras.slice(0, corte).join(" "), nombres: palabras.slice(corte).join(" "), cedula: m[2] };
}

// ── Niveles y programas del catálogo ─────────────────────────────────────────

/** Programa de Catálogos › Programas académicos (nivel_ref sale de Catálogos › Niveles, migración 27). */
export interface ProgramaHist {
  id: number;
  nombre: string;
  nivel_id?: number | null;
  nivel_ref?: { id: number; nombre: string; tipo: string } | null;
  /** Nivel viejo (antes de la migración 27). */
  nivel?: string | null;
}
export interface NivelHist { clave: string; nombre: string; tipo: string }

const NIVEL_VIEJO: Record<string, NivelHist> = {
  pregrado: { clave: "v:pregrado", nombre: "Pregrado", tipo: "pregrado" },
  tecnico: { clave: "v:tecnico", nombre: "Técnico", tipo: "tecnico" },
  posgrado: { clave: "v:posgrado", nombre: "Posgrado", tipo: "posgrado" },
  especializacion: { clave: "v:especializacion", nombre: "Especialización", tipo: "posgrado" },
  maestria: { clave: "v:maestria", nombre: "Maestría", tipo: "posgrado" },
  doctorado: { clave: "v:doctorado", nombre: "Doctorado", tipo: "posgrado" },
};

/** Nivel de un programa: el del catálogo de niveles o, si aún no existe, el viejo. */
export function nivelDePrograma(p: ProgramaHist): NivelHist | null {
  if (p.nivel_ref) return { clave: `n:${p.nivel_ref.id}`, nombre: p.nivel_ref.nombre, tipo: p.nivel_ref.tipo };
  return p.nivel ? NIVEL_VIEJO[p.nivel] ?? { clave: `v:${p.nivel}`, nombre: p.nivel, tipo: "pregrado" } : null;
}

const ORDEN_TIPO: Record<string, number> = { pregrado: 1, tecnico: 2, posgrado: 3 };

/** Niveles que tienen programas activos, en orden Pregrado, Técnico, Posgrado. */
export function nivelesDeProgramas(programas: ProgramaHist[]): NivelHist[] {
  const m = new Map<string, NivelHist>();
  for (const p of programas) {
    const n = nivelDePrograma(p);
    if (n) m.set(n.clave, n);
  }
  return [...m.values()].sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || a.nombre.localeCompare(b.nombre, "es"));
}

export const programasDelNivel = (programas: ProgramaHist[], clave: string) =>
  programas.filter(p => nivelDePrograma(p)?.clave === clave);

export interface NuevaHistoriaDocumento {
  programa_id: number;
  estado: EstadoHistoria;
  /** Año de grado o retiro (opcional en las activas). */
  anio?: number;
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
