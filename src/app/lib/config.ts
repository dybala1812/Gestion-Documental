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
 * Entorno de Vercel inyectado en tiempo de build (vite.config.ts → define).
 * Valores: "production" | "preview" | "development" | "" (build local sin Vercel).
 */
declare const __VERCEL_ENV__: string;
export const VERCEL_ENV: string =
  typeof __VERCEL_ENV__ === "string" ? __VERCEL_ENV__ : "";

/**
 * ⚠️ TEMPORAL — login de pruebas por perfil del Archivo Central en /login-temporal.
 * Deja entrar SIN pasar por NOVA, así que NUNCA debe existir en producción.
 *
 * Solo se activa cuando AMBAS condiciones se cumplen:
 *   1. El entorno es desarrollo local (`npm run dev`) o un *preview* de Vercel.
 *      La producción de Vercel (VERCEL_ENV === "production") queda excluida por
 *      código, aunque alguien active la variable por error.
 *   2. VITE_LOGIN_TEMPORAL === "true" (en `.env.local` local, o en la variable
 *      con alcance SOLO "Preview" dentro de Vercel).
 *
 * La clave vive solo en el backend (SGD_LOGIN_TEMPORAL_CLAVE); aquí no hay secreto.
 * Protege siempre el preview con Deployment Protection (contraseña) de Vercel.
 */
export const LOGIN_TEMPORAL =
  (import.meta.env.DEV || VERCEL_ENV === "preview") &&
  import.meta.env.VITE_LOGIN_TEMPORAL === "true";
