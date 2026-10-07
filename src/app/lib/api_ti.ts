/**
 * api_ti.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Tipos y funciones de API para el módulo de Inventario TI.
 * Importa `apiFetch` reutilizando el wrapper central del proyecto.
 */

import { API_BASE, tokens, formatApiError } from "./api";

// ── Fetch helper reutilizable (copia del patrón local de api.ts) ──────────
async function tiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  const token = tokens.getAccess();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiError(err));
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/** Para endpoints paginados: extrae `.results` del envelope {count, results, ...} */
async function tiListFetch<T>(path: string): Promise<T[]> {
  // page_size=200 trae todos los registros en una sola llamada
  const sep = path.includes("?") ? "&" : "?";
  const data = await tiFetch<{ results: T[] } | T[]>(`${path}${sep}page_size=200`);
  if (Array.isArray(data)) return data;
  return (data as { results: T[] }).results ?? [];
}

const BASE = "/api/pqrs/ti";

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface EquipoComputoListItem {
  id: string;
  dependency: string;
  dependency_nombre: string;
  empleado_nombre: string;
  perfil_laboral: string;
  hostname: string;
  tipo: string;
  tipo_display: string;
  nivel: string;
  nivel_display: string;
  serial: string;
  marca: string;
  no_activo: string;
  direccion_ip: string;
  estado_backup: string;
  activo: boolean;
  updated_at: string;
}

export interface Periferico {
  id: string;
  equipo: string;
  tipo: string;
  tipo_display: string;
  serial: string;
  marca: string;
  modelo: string;
  observaciones: string;
}

export interface EquipoComputo extends EquipoComputoListItem {
  procesador: string;
  disco_duro: string;
  memoria_ram: string;
  sistema_operativo: string;
  estado_backup_display: string;
  observaciones: string;
  fecha_compra: string | null;
  perifericos: Periferico[];
  created_by: string;
  created_by_nombre: string;
  created_at: string;
}

export interface EquipoAV {
  id: string;
  dependency: string;
  dependency_nombre: string;
  tipo_av: string;
  tipo_av_display: string;
  elemento: string;
  descripcion: string;
  cantidad: number;
  serial: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  estado: string;
  estado_display: string;
  observaciones: string;
  created_by: string;
  created_by_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface ServidorVirtual {
  id: string;
  servidor_fisico: string;
  vm_id: number;
  vm_name: string;
  direccion_ip: string;
  mac_address: string;
  vcpu: number;
  vram: string;
  vstorage: string;
  tipo: string;
  status: string;
  status_display: string;
  url_acceso: string;
  descripcion: string;
  observaciones: string;
  created_by: string;
  created_by_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface ServidorFisicoListItem {
  id: string;
  node_id: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  procesador: string;
  memoria_ram: string;
  almacenamiento: string;
  pve_version: string;
  activo: boolean;
  vms_count: number;
  updated_at: string;
}

export interface ServidorFisico extends ServidorFisicoListItem {
  responsable: string;
  url_gestion: string;
  kernel: string;
  boot_mode: string;
  repositorio: string;
  observaciones: string;
  vms: ServidorVirtual[];
  created_by: string;
  created_by_nombre: string;
  created_at: string;
}

export interface PuertoRack {
  id: string;
  rack_id: string;
  piso: string;
  patch_panel_id: string;
  puerto_numero: number;
  ubicacion: string;
  usuario_asignado: string;
  estado: string;
  estado_display: string;
  observaciones: string;
  updated_at: string;
}

export interface ExtensionPBX {
  id: string;
  extension: string;
  nombre: string;
  dependency: string;
  dependency_nombre: string;
  tipo: string;
  email: string;
  activo: boolean;
  observaciones: string;
  updated_at: string;
}

export interface TelefonoCorporativo {
  id: string;
  dependency: string;
  dependency_nombre: string;
  tipo: string;
  tipo_display: string;
  numero: string;
  imei: string;
  serial: string;
  marca: string;
  modelo: string;
  asignado_a: string;
  estado: string;
  estado_display: string;
  observaciones: string;
  created_by: string;
  created_by_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface AsignacionSoftware {
  id: string;
  dependency: string;
  dependency_nombre: string;
  empleado_nombre: string;
  perfil_laboral: string;
  software: string;
  software_display: string;
  activo: boolean;
  observaciones: string;
  created_at: string;
  updated_at: string;
}

export interface SoftwareMatriz {
  dependency_id: string;
  dependency_nombre: string;
  softwares: string[];
  empleados: Array<{ nombre: string; perfil_laboral: string; [sw: string]: string | boolean }>;
}

export interface TIBitacoraEntry {
  id: string;
  modelo: string;
  objeto_id: string;
  objeto_repr: string;
  accion: "CREAR" | "EDITAR" | "ELIMINAR";
  accion_display: string;
  usuario_nombre: string;
  timestamp: string;
  cambios: Record<string, { antes: string | null; despues: string | null }>;
}

export interface TIResumen {
  equipos_computo:  { total: number; activos: number; inactivos: number };
  equipos_av:       { total: number; buenos: number; reparacion: number };
  servidores:       { total: number; activos: number };
  vms:              { total: number; running: number; stopped: number };
  puertos_rack:     { total: number; activos: number; inactivos: number; libres: number };
  telefonos:        { total: number; buenos: number };
  extensiones_pbx:  { total: number; activas: number };
  equipos_por_area: Array<{ dependency__name: string; dependency__code: string; total: number }>;  alertas: {
    backup_pendiente:   number;
    equipos_inactivos:  number;
    av_reparacion:      number;
    telefonos_dañados:  number;
    vms_detenidas:      number;
    rack_inactivos:     number;
  };}

// ── Equipos de Cómputo ────────────────────────────────────────────────────

export async function apiGetEquipos(params?: Record<string, string>): Promise<EquipoComputoListItem[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/equipos/${qs}`);
}

export async function apiGetEquipo(id: string): Promise<EquipoComputo> {
  return tiFetch(`${BASE}/equipos/${id}/`);
}

export async function apiCreateEquipo(data: Partial<EquipoComputo>): Promise<EquipoComputo> {
  return tiFetch(`${BASE}/equipos/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateEquipo(id: string, data: Partial<EquipoComputo>): Promise<EquipoComputo> {
  return tiFetch(`${BASE}/equipos/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteEquipo(id: string): Promise<void> {
  return tiFetch(`${BASE}/equipos/${id}/`, { method: "DELETE" });
}

export async function apiGetPerifericos(equipoId: string): Promise<Periferico[]> {
  return tiListFetch(`${BASE}/equipos/${equipoId}/perifericos/`);
}

export async function apiCreatePeriferico(equipoId: string, data: Partial<Periferico>): Promise<Periferico> {
  return tiFetch(`${BASE}/equipos/${equipoId}/perifericos/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiDeletePeriferico(id: string): Promise<void> {
  return tiFetch(`${BASE}/perifericos/${id}/`, { method: "DELETE" });
}

// ── Equipos AV ────────────────────────────────────────────────────────────

export async function apiGetEquiposAV(params?: Record<string, string>): Promise<EquipoAV[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/av/${qs}`);
}

export async function apiGetEquipoAV(id: string): Promise<EquipoAV> {
  return tiFetch(`${BASE}/av/${id}/`);
}

export async function apiCreateEquipoAV(data: Partial<EquipoAV>): Promise<EquipoAV> {
  return tiFetch(`${BASE}/av/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateEquipoAV(id: string, data: Partial<EquipoAV>): Promise<EquipoAV> {
  return tiFetch(`${BASE}/av/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteEquipoAV(id: string): Promise<void> {
  return tiFetch(`${BASE}/av/${id}/`, { method: "DELETE" });
}

// ── Servidores ────────────────────────────────────────────────────────────

export async function apiGetServidores(params?: Record<string, string>): Promise<ServidorFisicoListItem[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/servidores/${qs}`);
}

export async function apiGetServidor(id: string): Promise<ServidorFisico> {
  return tiFetch(`${BASE}/servidores/${id}/`);
}

export async function apiCreateServidor(data: Partial<ServidorFisico>): Promise<ServidorFisico> {
  return tiFetch(`${BASE}/servidores/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateServidor(id: string, data: Partial<ServidorFisico>): Promise<ServidorFisico> {
  return tiFetch(`${BASE}/servidores/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteServidor(id: string): Promise<void> {
  return tiFetch(`${BASE}/servidores/${id}/`, { method: "DELETE" });
}

export async function apiGetVMs(servidorId: string): Promise<ServidorVirtual[]> {
  return tiListFetch(`${BASE}/servidores/${servidorId}/vms/`);
}

export async function apiCreateVM(servidorId: string, data: Partial<ServidorVirtual>): Promise<ServidorVirtual> {
  return tiFetch(`${BASE}/servidores/${servidorId}/vms/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateVM(id: string, data: Partial<ServidorVirtual>): Promise<ServidorVirtual> {
  return tiFetch(`${BASE}/vms/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteVM(id: string): Promise<void> {
  return tiFetch(`${BASE}/vms/${id}/`, { method: "DELETE" });
}

// ── Rack ─────────────────────────────────────────────────────────────────

export async function apiGetRack(params?: Record<string, string>): Promise<PuertoRack[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/rack/${qs}`);
}

export async function apiCreatePuerto(data: Partial<PuertoRack>): Promise<PuertoRack> {
  return tiFetch(`${BASE}/rack/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdatePuerto(id: string, data: Partial<PuertoRack>): Promise<PuertoRack> {
  return tiFetch(`${BASE}/rack/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeletePuerto(id: string): Promise<void> {
  return tiFetch(`${BASE}/rack/${id}/`, { method: "DELETE" });
}

// ── PBX ──────────────────────────────────────────────────────────────────

export async function apiGetExtensiones(params?: Record<string, string>): Promise<ExtensionPBX[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/pbx/${qs}`);
}

export async function apiCreateExtension(data: Partial<ExtensionPBX>): Promise<ExtensionPBX> {
  return tiFetch(`${BASE}/pbx/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateExtension(id: string, data: Partial<ExtensionPBX>): Promise<ExtensionPBX> {
  return tiFetch(`${BASE}/pbx/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteExtension(id: string): Promise<void> {
  return tiFetch(`${BASE}/pbx/${id}/`, { method: "DELETE" });
}

// ── Teléfonos ─────────────────────────────────────────────────────────────

export async function apiGetTelefonos(params?: Record<string, string>): Promise<TelefonoCorporativo[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/telefonos/${qs}`);
}

export async function apiCreateTelefono(data: Partial<TelefonoCorporativo>): Promise<TelefonoCorporativo> {
  return tiFetch(`${BASE}/telefonos/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateTelefono(id: string, data: Partial<TelefonoCorporativo>): Promise<TelefonoCorporativo> {
  return tiFetch(`${BASE}/telefonos/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteTelefono(id: string): Promise<void> {
  return tiFetch(`${BASE}/telefonos/${id}/`, { method: "DELETE" });
}

// ── Software ──────────────────────────────────────────────────────────────

export async function apiGetSoftwareAsignaciones(params?: Record<string, string>): Promise<AsignacionSoftware[]> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return tiListFetch(`${BASE}/software/${qs}`);
}

export async function apiCreateAsignacionSoftware(data: Partial<AsignacionSoftware>): Promise<AsignacionSoftware> {
  return tiFetch(`${BASE}/software/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiDeleteAsignacionSoftware(id: string): Promise<void> {
  return tiFetch(`${BASE}/software/${id}/`, { method: "DELETE" });
}

export async function apiGetSoftwareMatriz(dependencyId: string): Promise<SoftwareMatriz> {
  return tiFetch(`${BASE}/software/matriz/?dependency_id=${dependencyId}`);
}

// ── Resumen global ────────────────────────────────────────────────────────

export async function apiGetTIResumen(): Promise<TIResumen> {
  return tiFetch(`${BASE}/resumen/`);
}

// ── Bitácora ──────────────────────────────────────────────────────────────

export async function apiGetBitacora(modelo: string, objetoId: string): Promise<TIBitacoraEntry[]> {
  return tiListFetch(`${BASE}/bitacora/?modelo=${encodeURIComponent(modelo)}&objeto_id=${encodeURIComponent(objetoId)}`);
}

// ── Movimientos ───────────────────────────────────────────────────────────

export interface TIMovimiento {
  id: string;
  modelo: string;
  objeto_id: string;
  tipo: "MANTENIMIENTO" | "TRANSFERENCIA" | "REPARACION" | "INSPECCION" | "BAJA" | "OTRO";
  tipo_display: string;
  descripcion: string;
  fecha: string;          // YYYY-MM-DD
  usuario_nombre: string;
  created_at: string;
}

export interface TIMovimientoCreate {
  modelo: string;
  objeto_id: string;
  tipo: TIMovimiento["tipo"];
  descripcion: string;
  fecha: string;
}

export async function apiGetMovimientos(modelo: string, objetoId: string): Promise<TIMovimiento[]> {
  return tiListFetch(
    `${BASE}/movimientos/?modelo=${encodeURIComponent(modelo)}&objeto_id=${encodeURIComponent(objetoId)}`
  );
}

export async function apiCreateMovimiento(data: TIMovimientoCreate): Promise<TIMovimiento> {
  return tiFetch(`${BASE}/movimientos/`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiDeleteMovimiento(id: string): Promise<void> {
  return tiFetch(`${BASE}/movimientos/${id}/`, { method: "DELETE" });
}
