/**
 * @file alertasCarga.ts
 * @description Alertas de estado (estilo Sileo) del Centro de cargas: procesando → listo / aviso / error.
 * Todas las pantallas de carga usan estas funciones para que se vean y se comporten igual.
 * Requiere el <Toaster> de Sileo montado (ver ArchivoCentralArea).
 */
import { sileo } from "sileo";

/** Segundos que se queda visible cada alerta (la de "procesando" no se cierra sola). */
const DURACION = { ok: 5000, info: 5000, aviso: 8000, error: 10000 } as const;

export const alertaCarga = {
  /** Trabajo en curso. No se cierra a mano: Sileo muestra una alerta a la vez, así que la de resultado
   *  (ok / aviso / error) la reemplaza. Cerrarla con `sileo.dismiss` hace desaparecer también la siguiente. */
  procesando: (titulo: string, descripcion?: string) =>
    sileo.show({ type: "loading", title: titulo, description: descripcion, duration: null }),

  ok: (titulo: string, descripcion?: string) =>
    sileo.success({ title: titulo, description: descripcion, duration: DURACION.ok }),

  info: (titulo: string, descripcion?: string) =>
    sileo.info({ title: titulo, description: descripcion, duration: DURACION.info }),

  aviso: (titulo: string, descripcion?: string) =>
    sileo.warning({ title: titulo, description: descripcion, duration: DURACION.aviso }),

  error: (titulo: string, descripcion?: string) =>
    sileo.error({ title: titulo, description: descripcion, duration: DURACION.error }),
};

/** Texto de un error cualquiera, sin exponer objetos ni rutas internas. */
export const motivoError = (e: unknown, porDefecto = "Error desconocido") => {
  const msg = e instanceof Error ? e.message : "";
  // Errores de red del navegador (vienen en inglés y no le sirven al usuario).
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
  }
  return msg || porDefecto;
};

/** "1 archivo" / "3 archivos". */
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
