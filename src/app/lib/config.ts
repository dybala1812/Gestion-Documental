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
 * Deja entrar SIN pasar por NOVA. Pensado para entornos de prueba con backend
 * ficticio; NO debe quedar abierto en el despliegue real con datos reales.
 *
 * Interruptor maestro: VITE_LOGIN_TEMPORAL === "true". Según el entorno:
 *   - Desarrollo local (`npm run dev`) y *preview* de Vercel: basta el maestro.
 *   - Producción de Vercel (VERCEL_ENV === "production"): el maestro NO alcanza;
 *     además hay que activar explícitamente VITE_LOGIN_TEMPORAL_ALLOW_PROD === "true".
 *     Este doble flag evita que el backdoor se cuele por accidente si este mismo
 *     código llega al despliegue real: ahí simplemente no se define ninguno.
 *
 * La clave vive solo en el backend (SGD_LOGIN_TEMPORAL_CLAVE); aquí no hay secreto.
 * Donde se active, protege el deploy con Deployment Protection de Vercel.
 */
const ENTORNO_PERMITE_LOGIN_TEMPORAL =
  import.meta.env.DEV ||
  VERCEL_ENV === "preview" ||
  (VERCEL_ENV === "production" &&
    import.meta.env.VITE_LOGIN_TEMPORAL_ALLOW_PROD === "true");

export const LOGIN_TEMPORAL =
  ENTORNO_PERMITE_LOGIN_TEMPORAL &&
  import.meta.env.VITE_LOGIN_TEMPORAL === "true";
