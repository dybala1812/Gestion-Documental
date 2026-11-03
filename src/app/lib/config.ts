// ─────────────────────────────────────────────────────────────────────────────
//  Configuración global de la aplicación derivada de variables de entorno Vite
//  Importar desde aquí para centralizar el acceso a import.meta.env
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indica si el reCAPTCHA está deshabilitado.
 *
 * Se activa cuando VITE_DISABLE_CAPTCHA === "true" en el archivo .env.local
 * (o cualquier archivo .env cargado por Vite).
 *
 * - `true`  → entorno local/desarrollo: el formulario no exige CAPTCHA.
 * - `false` → producción: el widget reCAPTCHA es obligatorio para enviar.
 *
 * Uso:
 *   import { CAPTCHA_DISABLED } from "@/app/lib/config";
 */
export const CAPTCHA_DISABLED =
  import.meta.env.VITE_DISABLE_CAPTCHA === "true";

/**
 * Client ID de Google OAuth 2.0.
 *
 * Se lee de la variable de entorno VITE_GOOGLE_CLIENT_ID.
 * Configúrela en el archivo .env.local:
 *   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
 */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

/**
 * ⚠️ TEMPORAL — BORRAR ANTES DEL DESPLIEGUE (ver ia_contexto/login-temporal.md).
 * Login de pruebas por perfil del módulo Archivo Central en /login-temporal. Requiere `npm run dev`
 * (import.meta.env.DEV) y en `.env.local`: VITE_LOGIN_TEMPORAL=true. La clave vive solo en el
 * backend (SGD_LOGIN_TEMPORAL_CLAVE); aquí no hay ningún secreto. En el build de producción
 * import.meta.env.DEV es false: la ruta ni siquiera se incluye.
 */
export const LOGIN_TEMPORAL =
  import.meta.env.DEV && import.meta.env.VITE_LOGIN_TEMPORAL === "true";
