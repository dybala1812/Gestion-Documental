/**
 * @file sgdApi.ts
 * @description Cliente HTTP para el backend SGD (Archivo Central).
 *
 * Reutiliza el JWT de NOVA almacenado por api.ts. El backend SGD valida ese
 * token contra NOVA y sincroniza el usuario en Supabase.
 */
import { tokens, ApiError, tryRefreshToken } from "./api";
import { borrarSesionTemporal, leerSesionTemporal } from "./loginTemporal"; // ⚠️ TEMPORAL

/**
 * URL base del backend SGD. Se lee de VITE_SGD_API_URL.
 * Si no está definida se asume el puerto por defecto de Next.js.
 */
export const SGD_API_BASE = import.meta.env.VITE_SGD_API_URL ?? "http://localhost:3000/api";

/**
 * Texto del error según el contrato del backend SGD (RN-AC-15):
 *  - formulario (4xx): { error: "<descripción>", campo?, tipo? } → la descripción tal cual.
 *  - sistema (5xx): { error: "<número>", motivo: "<por qué>", consecutivo? } → "Error 1001: … (consecutivo …)".
 * Acepta también la forma anterior { error, detalle? }.
 */
export function mensajeErrorSgd(cuerpo: Record<string, unknown> | null | undefined): string | null {
  if (!cuerpo) return null;
  const error = typeof cuerpo.error === "string" ? cuerpo.error : null;
  const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo : null;
  if (motivo) {
    const consecutivo = typeof cuerpo.consecutivo === "string" ? ` (consecutivo ${cuerpo.consecutivo})` : "";
    return `${error ? `Error ${error}: ` : ""}${motivo}${consecutivo}`;
  }
  const detalle = typeof cuerpo.detalle === "string" ? cuerpo.detalle : null;
  return error && detalle && !error.includes(detalle) ? `${error}: ${detalle}` : (error ?? detalle);
}

/**
 * Crea el ApiError con el motivo REAL que devuelve el backend SGD. ApiError (de NOVA/Django) solo
 * lee `detail` y si no lo encuentra muestra un texto genérico por código HTTP ("Los datos enviados
 * no son válidos…"), que oculta la causa. Aquí se copia el mensaje a `detail`.
 */
function errorSgd(status: number, cuerpo: Record<string, unknown>): ApiError {
  const mensaje = mensajeErrorSgd(cuerpo);
  // `campo` y `tipo` van como propiedades del error (no en `data`): así un formulario puede
  // marcar el campo sin que formatApiError los agregue al mensaje.
  return Object.assign(new ApiError(status, mensaje ? { detail: mensaje } : cuerpo), {
    campo: typeof cuerpo.campo === "string" ? cuerpo.campo : undefined,
    tipo: typeof cuerpo.tipo === "string" ? cuerpo.tipo : undefined,
  });
}

/** Campo del formulario que señaló el backend SGD en un error (p. ej. "codigo" repetido). */
export function campoDelError(e: unknown): string | undefined {
  return (e as { campo?: string } | null)?.campo;
}

/**
 * Wrapper de fetch para el backend SGD.
 *
 * Envía el Bearer token de NOVA y Content-Type application/json.
 * Si el backend SGD devuelve 401, intenta refrescar el token de NOVA con la
 * misma lógica de api.ts y reintenta la petición una sola vez.
 *
 * Nota: las rutas deben empezar con "/" (ej. "/comunicaciones").
 */
export async function sgdFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${SGD_API_BASE}${path}`;

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  // ⚠️ TEMPORAL: con el login de pruebas (/login-temporal) se envía su token en lugar del de NOVA.
  const temporal = leerSesionTemporal();
  const token = temporal?.token ?? tokens.getAccess();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && temporal) {
    // La sesión temporal venció o se reinició el backend: hay que volver a entrar.
    borrarSesionTemporal();
    const err = await res.json().catch(() => ({}));
    throw errorSgd(401, err);
  }

  if (res.status === 401) {
    const sentToken = (headers["Authorization"] as string | undefined)?.slice(7) ?? null;
    const ok = await tryRefreshToken();
    if (ok) {
      const newToken = tokens.getAccess();
      if (newToken && newToken !== sentToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        const retry = await fetch(url, { ...options, headers });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw errorSgd(retry.status, err);
        }
        if (retry.status === 204) return undefined as unknown as T;
        return retry.json() as Promise<T>;
      }
    }
    throw new ApiError(401, { detail: "Su sesión ha expirado. Por favor inicie sesión de nuevo." });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw errorSgd(res.status, err);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/**
 * Descarga un binario del backend SGD (p. ej. GET /archivos/{id}) con el mismo
 * token que sgdFetch. Devuelve el Blob y el nombre del archivo (Content-Disposition).
 */
export async function sgdFetchBlob(path: string): Promise<{ blob: Blob; nombre: string | null }> {
  const token = leerSesionTemporal()?.token ?? tokens.getAccess();
  const res = await fetch(`${SGD_API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw errorSgd(res.status, err);
  }
  const cd = res.headers.get("content-disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const simple = /filename="([^"]+)"/i.exec(cd)?.[1];
  const nombre = utf8 ? decodeURIComponent(utf8) : simple ?? null;
  return { blob: await res.blob(), nombre };
}
