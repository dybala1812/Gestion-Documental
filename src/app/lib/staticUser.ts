/**
 * @file staticUser.ts
 * @description Usuario y token estáticos para pruebas sin login.
 *
 * En este modo el frontend NO redirige a /login, NO llama a NOVA y envía siempre
 * el mismo Bearer token. El backend SGD debe tener configurado SGD_DEV_TOKEN
 * con el mismo valor para que la sincronización funcione.
 */

export const STATIC_SGD_TOKEN = "sgd-dev-token-pruebas-2026";

export interface StaticUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  tipo_documento: "CC" | "CE" | "TI" | "PA" | "NIT" | "PPT" | "RC";
  cedula: string;
  telefono: string;
  ciudad: string;
  rol: "admin" | "usuario" | "area";
  roles: string[];
  dependencyId?: string;
  dependencyName?: string;
  is_staff: boolean;
  perfil_tipo: "externo" | "estudiante" | "admin_area" | "docente";
  is_area_leader: boolean;
  can_handle_pqrs: boolean;
  can_consume_campus_api: boolean;
}

export const STATIC_USUARIO: StaticUsuario = {
  id: "sgd-prueba-archivo-central",
  nombre: "Prueba",
  apellido: "Archivo Central",
  email: "archivo.central@prueba.sgd.test",
  username: "archivo.central@prueba.sgd.test",
  tipo_documento: "CC",
  cedula: "1234567890",
  telefono: "",
  ciudad: "Popayán",
  rol: "area",
  roles: [],
  dependencyId: undefined,
  dependencyName: "Archivo Central",
  is_staff: false,
  perfil_tipo: "admin_area",
  is_area_leader: false,
  can_handle_pqrs: false,
  can_consume_campus_api: false,
};

const CLAVE_USUARIO = "usuario";
const CLAVE_ACCESS = "access_token";
const CLAVE_SHARED = "_at_shared";

/** Persiste el usuario y token estáticos en localStorage/sessionStorage. */
export function guardarUsuarioEstatico(): void {
  try {
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(STATIC_USUARIO));
    sessionStorage.setItem(CLAVE_ACCESS, STATIC_SGD_TOKEN);
    localStorage.setItem(CLAVE_SHARED, STATIC_SGD_TOKEN);
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando con el objeto en memoria.
  }
}

/** Lee el usuario estático del storage si existe. */
export function leerUsuarioEstatico(): StaticUsuario | null {
  try {
    const raw = localStorage.getItem(CLAVE_USUARIO);
    if (!raw) return null;
    return JSON.parse(raw) as StaticUsuario;
  } catch {
    return null;
  }
}
