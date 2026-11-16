/**
 * @file loginTemporal.ts
 * @description ⚠️ TEMPORAL — BORRAR ANTES DEL DESPLIEGUE (ver ia_contexto/login-temporal.md).
 *
 * Sesión del login de pruebas por perfil (/login-temporal). El backend entrega un token firmado
 * que vence en 8 horas (o al reiniciar el backend); se guarda en sessionStorage (solo esta pestaña)
 * y sgdApi lo envía en lugar del token de NOVA. Aquí no hay ninguna clave ni token fijo.
 */
import { LOGIN_TEMPORAL } from "./config";
import { SGD_API_BASE, mensajeErrorSgd } from "./sgdApi";

export type PerfilSGD = "archivo_central" | "administrador" | "dependencia" | "registro_academico" | "secretaria_general";

export interface SesionTemporal {
  token: string;
  expira: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    perfil: PerfilSGD;
    dependencia_id: number | null;
    dependencia: string | null;
  };
}

export interface OpcionesLoginTemporal {
  perfiles: { perfil: PerfilSGD; nombre: string; descripcion: string }[];
  dependencias: { id: number; codigo: string; nombre: string }[];
}

const CLAVE_ALMACEN = "sgd_sesion_temporal";

export function leerSesionTemporal(): SesionTemporal | null {
  if (!LOGIN_TEMPORAL) return null;
  try {
    const raw = sessionStorage.getItem(CLAVE_ALMACEN);
    if (!raw) return null;
    const s = JSON.parse(raw) as SesionTemporal;
    if (!s.token || Date.parse(s.expira) <= Date.now()) {
      sessionStorage.removeItem(CLAVE_ALMACEN);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function guardarSesionTemporal(s: SesionTemporal): void {
  if (!LOGIN_TEMPORAL) return;
  sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(s));
}

export function borrarSesionTemporal(): void {
  if (!LOGIN_TEMPORAL) return; // en producción no existe la sesión temporal
  try {
    sessionStorage.removeItem(CLAVE_ALMACEN);
  } catch {
    // sin almacenamiento disponible: no hay nada que borrar
  }
}

async function pedir<T>(init?: RequestInit): Promise<T> {
  const res = await fetch(`${SGD_API_BASE}/login-temporal`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 404) throw new Error("El login temporal no está activo en el backend (SGD_LOGIN_TEMPORAL y SGD_LOGIN_TEMPORAL_CLAVE en su .env.local).");
    throw Object.assign(new Error(mensajeErrorSgd(cuerpo) ?? `Error ${res.status}`), { campo: cuerpo?.campo as string | undefined });
  }
  return cuerpo as T;
}

export function apiOpcionesLoginTemporal(): Promise<OpcionesLoginTemporal> {
  return pedir<OpcionesLoginTemporal>();
}

export async function apiLoginTemporal(perfil: PerfilSGD, clave: string, dependenciaId?: number): Promise<SesionTemporal> {
  const s = await pedir<SesionTemporal>({
    method: "POST",
    body: JSON.stringify({ perfil, clave, ...(dependenciaId ? { dependencia_id: dependenciaId } : {}) }),
  });
  guardarSesionTemporal(s);
  return s;
}
