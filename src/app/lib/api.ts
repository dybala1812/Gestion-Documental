/// <reference types="vite/client" />
// ─────────────────────────────────────────────
//  API Service – Sistema PQRSF Institucional
//  Capa de comunicación HTTP con el backend Django REST.
//  Todas las llamadas a la API deben pasar por este módulo.
//  Base: http://localhost:8000 (configurable vía VITE_API_URL)
// ─────────────────────────────────────────────

/**
 * URL base del backend. Se lee de la variable de entorno VITE_API_URL.
 * Si la variable no está definida (entorno local sin .env), se usa http://localhost:8000.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Token helpers ─────────────────────────────
/**
 * Objeto de utilidad para gestionar los JWT almacenados en localStorage.
 *
 * - `getAccess()`  → lee el access token (caduca en minutos).
 * - `getRefresh()` → lee el refresh token (caduca en días).
 * - `set()`        → persiste ambos tokens tras un login o refresco exitoso.
 * - `clear()`      → elimina tokens y datos de sesión; se llama en logout o 401 irrecuperable.
 */
export const tokens = {
  /**
   * Devuelve el access token. Primero busca en sessionStorage (pestaña actual),
   * luego en localStorage (compartido entre pestañas).
   * Esto permite que nuevas pestañas reutilicen el token activo sin un refresh
   * adicional que rotaría (e invalidaría) el refresh_token de las demás.
   */
  getAccess: () =>
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("_at_shared") ||
    null,
  /** Devuelve el refresh token actual o null si no existe. */
  getRefresh: () => localStorage.getItem("refresh_token"),
  /** Guarda ambos tokens: access en sessionStorage + localStorage compartido, refresh en localStorage. */
  set: (access: string, refresh: string) => {
    sessionStorage.setItem("access_token", access);
    localStorage.setItem("_at_shared", access);   // compartido entre pestañas
    localStorage.setItem("refresh_token", refresh);
  },
  /** Elimina tokens y datos de sesión del almacenamiento (cierre de sesión). */
  clear: () => {
    sessionStorage.removeItem("access_token");
    localStorage.removeItem("_at_shared");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("usuario");
  },
};

// ── Core fetch wrapper ────────────────────────
/**
 * Función genérica de fetch centralizada para toda la aplicación.
 *
 * Flujo:
 *  1. Construye las cabeceras (Content-Type + Authorization Bearer si es autenticada).
 *  2. Ejecuta la petición HTTP.
 *  3. Si recibe 401 y la ruta es autenticada, intenta refrescar el token una sola vez.
 *     - Si el refresco es exitoso, reintenta la petición original con el nuevo token.
 *     - Si no, limpia la sesión y redirige al login.
 *  4. Para cualquier otro error HTTP, lanza un `ApiError` con status y datos del error.
 *  5. Las respuestas 204 (No Content) devuelven `undefined`.
 *
 * @template T - Tipo esperado de la respuesta JSON.
 * @param path - Ruta relativa al API_BASE (ej. "/api/pqrs/").
 * @param options - Opciones nativas de RequestInit (method, body, etc.).
 * @param authenticated - Si es true, adjunta el Bearer token en la cabecera.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  // Cabeceras base; se fusionan con las opciones adicionales del llamador
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  // Adjuntar JWT si la ruta requiere autenticación y el token existe
  if (authenticated) {
    const token = tokens.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 → intentar refrescar el token una sola vez antes de desloguear
  if (res.status === 401 && authenticated) {
    // El token exacto que falló en esta petición (extraído del header, no de storage).
    // IMPORTANTE: no usar tokens.getAccess() porque prefiere sessionStorage, lo que
    // haría que tras un refresh cross-tab devolviera el mismo token caducado.
    const sentToken = (headers["Authorization"] as string | undefined)?.slice(7) ?? null;

    await tryRefresh();

    // Buscar explícitamente en cada almacén el token actualizado.
    // - Si ESTA pestaña refrescó → sessionStorage tiene el nuevo token.
    // - Si OTRA pestaña refrescó → localStorage._at_shared tiene el nuevo;
    //   sessionStorage sigue con el caducado hasta que lo sincronicemos.
    const nowSession = sessionStorage.getItem("access_token");
    const nowShared  = localStorage.getItem("_at_shared");

    const newToken =
      (nowSession && nowSession !== sentToken) ? nowSession :
      (nowShared  && nowShared  !== sentToken) ? nowShared  :
      null;

    if (newToken) {
      // Si vino de _at_shared (otra pestaña), sincronizar sessionStorage
      if (nowSession !== newToken) sessionStorage.setItem("access_token", newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new ApiError(retry.status, err);
      }
      return retry.json() as Promise<T>;
    }

    // Sin token nuevo: dar 150 ms de margen por si otra pestaña está terminando
    // su propio refresh y aún no ha escrito _at_shared (ventana de race mínima).
    await new Promise(r => setTimeout(r, 150));
    const lateShared = localStorage.getItem("_at_shared");
    if (lateShared && lateShared !== sentToken) {
      sessionStorage.setItem("access_token", lateShared);
      headers["Authorization"] = `Bearer ${lateShared}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new ApiError(retry.status, err);
      }
      return retry.json() as Promise<T>;
    }
    // Sesión irrecuperable → limpiar SOLO si _at_shared no tiene un token nuevo
    // (si lo tiene, significa que otra pestaña ya refrescó: no destruir su sesión).
    if (!lateShared || lateShared === sentToken) {
      tokens.clear();
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    throw new ApiError(401, { detail: "Su sesión ha expirado. Por favor inicie sesión de nuevo." });
  }

  // Cualquier otro error HTTP → lanzar ApiError con los datos del body
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err);
  }

  // 204 No Content no tiene cuerpo JSON
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/**
 * Intenta renovar el access token usando el refresh token almacenado.
 *
 * - Si no hay refresh token, retorna false.
 * - Actualiza los tokens en localStorage si el refresco es exitoso.
 *
 * @returns `true` si el refresco fue exitoso, `false` en caso contrario.
 */
// Singleton de refresco: evita que múltiples peticiones simultáneas con 401 lancen
// cada una su propio refresh().  La primera inicia la llamada; las demás esperan
// la misma promesa.  Con ROTATE_REFRESH_TOKENS=True, solo la primera usaría el
// refresh token válido; las demás lo invalidarían en la blacklist provocando el
// logout masivo que producía los 401 encadenados.
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refresh = tokens.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/api/login/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      // Guardar el nuevo refresh token que rota con cada uso (ROTATE_REFRESH_TOKENS=True)
      tokens.set(data.access, data.refresh ?? refresh);
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/** Exportado para uso en useTicketChat: refresca el access token (singleton). */
export { tryRefresh as tryRefreshToken };

/** Exportado para módulos que reutilizan el wrapper de fetch autenticado (ej. eleccionesApi). */
export { apiFetch };

// ── HTTP status → mensaje amigable ────────────
const HTTP_MESSAGES: Record<number, string> = {
  400: "Los datos enviados no son válidos. Revise el formulario.",
  401: "Credenciales incorrectas o sesión expirada.",
  403: "No tiene permiso para realizar esta acción.",
  404: "El recurso solicitado no fue encontrado.",
  405: "Operación no permitida.",
  408: "La solicitud tardó demasiado. Intente de nuevo.",
  409: "Conflicto: ya existe un registro con estos datos.",
  419: "La sesión del módulo académico expiró. Recargue la página e inicie sesión nuevamente.",
  422: "Los datos enviados no son válidos.",
  429: "Demasiadas solicitudes. Espere un momento e intente de nuevo.",
  500: "Error interno del servidor. Intente más tarde.",
  502: "El servidor no está disponible en este momento.",
  503: "Servicio temporalmente no disponible.",
  504: "El servidor tardó demasiado en responder.",
};

// ── Nombres amigables para campos DRF ─────────
const FIELD_LABELS: Record<string, string> = {
  email:              "Correo electrónico",
  username:           "Nombre de usuario",
  password:           "Contraseña",
  password2:          "Confirmación de contraseña",
  nombre:             "Nombre",
  apellido:           "Apellido",
  tipo_documento:     "Tipo de documento",
  cedula:             "Número de documento",
  telefono:           "Teléfono",
  direccion:          "Dirección",
  ciudad:             "Ciudad",
  subject:            "Asunto",
  description:        "Descripción",
  pqrs_type:          "Tipo de PQRS",
  name:               "Nombre",
  code:               "Código",
  response_text:      "Respuesta",
  password_actual:    "Contraseña actual",
  password_nuevo:     "Nueva contraseña",
  password_nuevo2:    "Confirmación de nueva contraseña",
  reason:             "Motivo de escalación",
  notes:              "Notas",
  to_dependency:        "Área destino",
  to_user:              "Usuario destino",
  origin_dependency:    "Área de origen",
  target_dependency:    "Área destino",
};

/**
 * Error personalizado que extiende Error con información del backend.
 *
 * @property status - Código HTTP de la respuesta (ej. 400, 401, 422).
 * @property data   - Objeto JSON de error devuelto por el backend (campos de validación, detail, etc.).
 *
 * El mensaje principal se establece desde:
 *  1. `data.detail` (mensaje específico del backend)
 *  2. HTTP_MESSAGES según el código de estado
 *  3. Mensaje genérico con el código
 */
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, data: Record<string, unknown>) {
    const detail = (data as { detail?: string })?.detail;
    const message = detail || HTTP_MESSAGES[status] || `Error inesperado (código ${status})`;
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * Convierte cualquier error de la API en un string legible en español para mostrar al usuario.
 *
 * Casos manejados:
 *  1. `TypeError`  → error de red (backend caído o sin conexión).
 *  2. `ApiError` sin campos → usa HTTP_MESSAGES o el mensaje del error.
 *  3. `ApiError` con campos de validación DRF → itera sobre cada campo,
 *     traduce la clave al nombre visible usando FIELD_LABELS y une los mensajes.
 *  4. Cualquier otro error → mensaje genérico.
 *
 * @param err - Error capturado en un bloque catch.
 * @returns Mensaje de error listo para mostrar al usuario.
 */
export function formatApiError(err: unknown): string {
  // Error de red (backend no disponible o sin internet)
  if (err instanceof TypeError) {
    return "No se pudo conectar con el servidor. Verifique su conexión a internet o intente más tarde.";
  }

  if (err instanceof ApiError) {
    const { data, status } = err;

    // Respuesta sin campos de validación (sólo detail u objeto vacío)
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return HTTP_MESSAGES[status] ?? err.message;
    }

    const msgs: string[] = [];

    // Recorrer cada campo con error devuelto por DRF
    for (const [key, val] of Object.entries(data)) {
      // Normalizar el valor a array de strings
      const values: string[] = Array.isArray(val)
        ? val.map(String)
        : typeof val === "object" && val !== null
          ? Object.values(val).flat().map(String)
          : [String(val)];

      if (key === "detail" || key === "non_field_errors") {
        // Errores generales (no asociados a un campo específico)
        msgs.push(...values);
      } else {
        // Error de campo: mostrar el nombre amigable del campo
        const label = FIELD_LABELS[key] ?? key;
        msgs.push(`${label}: ${values.join(", ")}`);
      }
    }

    return msgs.join("\n") || err.message;
  }

  return "Ocurrió un error inesperado. Intente de nuevo.";
}

// ────────────────────────────────────────────
//  TYPES – aligned with backend models
// ────────────────────────────────────────────

export type PqrsStatus = "RAD" | "PRO" | "RES" | "CER";
/** Estados del ciclo de vida de un ticket interno. */
export type TicketInternoStatus = "ABR" | "PRO" | "RES" | "CER";
export type PqrsType = "P" | "Q" | "R" | "S" | "F";
export type PqrsPriority = "LOW" | "MED" | "HIGH";
export type DocumentType = "CC" | "CE" | "TI" | "PA" | "NIT" | "PPT" | "RC";

export interface Dependency {
  id: string;
  name: string;
  code: string;
  email: string;
  description: string;
  active: boolean;
  inventario_notify_email?: string;
  /** UUID del líder de área, o null si no tiene. */
  lider?: string | null;
  lider_nombre?: string | null;
  lider_apellido?: string | null;
  lider_email?: string | null;
}

export interface UsuarioAPI {
  id: string;
  email: string;
  username: string;
  nombre: string;
  apellido: string;
  tipo_documento: DocumentType;
  cedula: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  /**
   * El backend puede devolver el objeto Dependency completo o sólo el UUID.
   * Usar `resolveDepId` / `resolveDepName` para normalizar.
   */
  dependency: Dependency | string | null;
  is_staff: boolean;
  activo: boolean;
  /** True si el usuario es Líder de Área (designado por admin). */
  is_area_leader?: boolean;
  /** True si el usuario tiene permiso para ver y atender PQRS de su área. */
  can_handle_pqrs?: boolean;
  /** True si el usuario puede consumir la API de Campus (telefonía estudiantil). */
  can_consume_campus_api?: boolean;
  /** Códigos de roles asignados al usuario (ej. ["ADMIN", "GESTOR"]). */
  roles?: string[];
  /** Perfil institucional: externo, estudiante o admin_area. */
  perfil_tipo?: "externo" | "estudiante" | "admin_area";
  /** Programa académico del estudiante. */
  carrera?: string | null;
  /** Semestre cursado actualmente (1-12). */
  semestre?: number | null;
  /** True si el estudiante ya culminó su programa académico (egresado). */
  es_egresado?: boolean;
}

/**
 * Extrae el UUID de una dependencia independientemente de si el backend
 * devolvió el objeto completo o sólo el UUID como string.
 */
export function resolveDepId(dep: Dependency | string | null | undefined): string | undefined {
  if (!dep) return undefined;
  if (typeof dep === "string") return dep;
  return dep.id;
}

/**
 * Extrae el nombre de una dependencia. Devuelve undefined si solo hay UUID.
 */
export function resolveDepName(dep: Dependency | string | null | undefined): string | undefined {
  if (!dep || typeof dep === "string") return undefined;
  return dep.name;
}

export interface PqrsAPI {
  id: string;
  /** Número de radicado generado por el backend. */
  numero_radicado: string;
  /** Alias de compatibilidad — el backend devuelve `numero_radicado`. */
  radicado?: string;
  /** Código de tipo: P, Q, R, S, F (el backend usa `type`). */
  type: PqrsType;
  /** Alias de compatibilidad — el backend devuelve `type`. */
  pqrs_type?: PqrsType;
  /** Representación legible del tipo (del backend o resoluble por PQRS_TYPE_LABEL). */
  type_display?: string;
  /** Representación legible del estado (del backend o resoluble por PQRS_STATUS_LABEL). */
  status_display?: string;
  subject: string;
  description: string;
  status: PqrsStatus;
  priority: PqrsPriority;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  user: UsuarioAPI | null;
  /** @deprecated el backend no expone este campo; usar `anon_info`. */
  anonymous_submitter?: {
    nombre: string;
    email: string;
    telefono?: string;
  } | null;
  /** Datos del remitente anónimo (solo en el detalle, vía `AnonymousSubmitterSerializer`). */
  anon_info?: {
    id: string;
    name: string;
    last_name: string;
    email: string;
    phone?: string;
    city?: string;
  } | null;
  dependency: Dependency | null;
  /** Dependencias activas asignadas (desde PQRSListaSerializer). */
  dependency_names?: { id: string; name: string }[];
  /** Nombre del solicitante (campo aplanado del serializer de lista). */
  submitter?: string;
  /** Email del solicitante (campo aplanado del serializer de lista). */
  submitter_email?: string;
  /** Teléfono del solicitante (campo aplanado del serializer de lista). */
  submitter_phone?: string;
  /** Datos de contacto del usuario registrado (solo en el detalle, vía `registered_user_info`). */
  registered_user_info?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
  } | null;
  /** `true` si la PQRS fue radicada por un ciudadano anónimo. */
  is_anonymous?: boolean;
  /** Canal de ingreso: WEB (en línea), PRESENCIAL (en persona) o VERBAL. */
  canal_ingreso?: "WEB" | "PRESENCIAL" | "VERBAL";
  /** Etiqueta legible del canal de ingreso. */
  canal_ingreso_display?: string;
  /** Nombre del funcionario que registró la PQRS en nombre del ciudadano (presencial/verbal). */
  registrado_por_nombre?: string;
  sla_policy: { id: string; name: string } | null;
  /** Indica si es un ticket interno entre áreas (`true`) o una PQRS ciudadana (`false`). */
  is_internal?: boolean;
  /** Archivos adjuntos embebidos en la respuesta del backend (cuando se incluyen en el serializer). */
  attachments?: Attachment[];
  /** `true` si la PQRS está vencida (due_date < hoy y no cerrada/resuelta). */
  is_overdue?: boolean;
  /** Días restantes hasta el vencimiento SLA (`null` si no tiene SLA o está cerrada). */
  dias_restantes_sla?: number | null;
  /** `true` si un administrador archivó la PQRS (se excluye de listados y estadísticas). */
  is_archived?: boolean;
}

/**
 * Modelo de un ticket interno entre áreas de la organización.
 * Es un modelo independiente de `PqrsAPI`; no tiene tipo P/Q/R/S/F ni remitente ciudadano.
 * Endpoints: GET/POST `/api/pqrs/tickets/`, GET `/api/pqrs/tickets/<id>/`,
 * PATCH `/api/pqrs/tickets/<id>/estado/`.
 */
export interface TicketInternoAPI {
  id: string;
  /** Número de ticket generado automáticamente por el backend. */
  numero_ticket: string;
  subject: string;
  description: string;
  priority: PqrsPriority;
  status: TicketInternoStatus;
  /** UUID del área remitente (quien envía el ticket). */
  origin_dependency: string | null;
  /** Nombre del área remitente (campo aplanado del serializer de lista). */
  origin_dependency_name?: string | null;
  /** Objeto completo del área remitente (serializer de detalle). */
  origin_dependency_info?: Dependency | null;
  /** UUID del área receptora (quien recibe el ticket). */
  target_dependency: string | null;
  /** Nombre del área receptora (campo aplanado del serializer de lista). */
  target_dependency_name?: string | null;
  /** Objeto completo del área receptora (serializer de detalle). */
  target_dependency_info?: Dependency | null;
  /** Usuario que creó el ticket. */
  created_by?: UsuarioAPI | string | null;
  /** Nombre legible del usuario creador, cuando existe. */
  created_by_nombre?: string | null;
  /** Solicitante externo para tickets creados desde correo electrónico. */
  external_requester_name?: string | null;
  external_requester_email?: string | null;
  created_at: string;
  updated_at?: string;
  /** Fecha límite de resolución calculada por el backend desde la política SLA. */
  due_date?: string | null;
  /** `true` cuando `due_date` ya venció y el estado no es RES ni CER. Campo calculado por el backend. */
  is_overdue?: boolean;
  /** Fecha en que el ticket fue cerrado. Solo presente en el serializer de detalle. */
  closed_at?: string | null;
}

export interface CreateTicketInternoPayload {
  subject: string;
  description: string;
  priority?: PqrsPriority;
  /** UUID del área que envía el ticket. Puede ser null/vacío para estudiantes. */
  origin_dependency: string | null;
  /** UUID del área receptora (null = cualquier área). */
  target_dependency: string | null;
}

// ─── Tickets internos: tipos de actividad, asignación, escalación y adjunto ───

/** Entrada de la bitácora de un ticket interno. Generada automáticamente por el backend. */
export interface TicketActivity {
  id: string;
  ticket: string;
  /** Código del tipo de evento (ej. "CREATED", "STATUS_CHANGE", "ASSIGNED", "ESCALATED", "SLA_BREACH", "COMMENT"). */
  activity_type: string;
  /** Etiqueta legible del tipo de evento. */
  activity_type_display?: string;
  /** Detalle textual del evento (para COMMENT: el cuerpo del comentario). */
  detail?: string;
  /** Alias de compatibilidad para versiones anteriores del serializer. */
  description?: string;
  created_at: string;
  /** Para COMMENT, el backend puede devolver el ID numérico del autor junto con su nombre. */
  performed_by?: UsuarioAPI | string | number | null;
  /** Nombre completo del autor o email si no tiene nombre (campo aplanado — presente en todos los eventos). */
  performed_by_nombre?: string | null;
  /** Email del autor (campo aplanado — presente en todos los eventos). */
  performed_by_email?: string | null;
  created_by?: UsuarioAPI | string | null;
}

/** Asignación de responsable a un ticket interno. */
export interface TicketAssignmentAPI {
  id: string;
  ticket: string;
  /** UUID del área asignada. */
  dependency?: string | null;
  /** Nombre del área asignada (campo aplanado del serializer). */
  dependency_name?: string | null;
  assigned_by?: string | null;
  assigned_by_email?: string | null;
  is_active: boolean;
  notes?: string;
  assigned_at: string;
}

/** Payload para asignar un ticket a un área. */
export interface AssignTicketPayload {
  ticket: string;
  /** UUID del área responsable. */
  dependency: string;
  notes?: string;
}

/** Escalación de un ticket interno a otra área o usuario. */
export interface TicketEscalationAPI {
  id: string;
  ticket: string;
  from_dependency?: Dependency | string | null;
  to_dependency?: Dependency | string | null;
  from_user?: UsuarioAPI | string | null;
  to_user?: UsuarioAPI | string | null;
  reason: EscalationReason;
  reason_display?: string;
  notes?: string;
  escalated_at: string;
}

/** Payload para escalar un ticket interno. */
export interface EscalateTicketPayload {
  ticket: string;
  to_dependency?: string;
  to_user?: string;
  reason: EscalationReason;
  notes?: string;
}

/** Adjunto vinculado a un ticket interno. */
export interface TicketAttachment {
  id: string;
  ticket: string;
  file: string;
  filename: string;
  uploaded_by?: UsuarioAPI | string | null;
  created_at: string;
}

export interface PqrsResponseAPI {
  id: string;
  pqrs: string;
  /** Contenido de la respuesta (campo `content` en el backend). */
  content: string;
  response_type: "INTERNAL" | "CITIZEN" | "FINAL";
  /** Si esta respuesta cerró la PQRS como resuelta. */
  is_final: boolean;
  created_at: string;
  /**
   * Usuario que registró la respuesta.
   * El backend puede devolver el objeto completo (`UsuarioAPI`) o sólo el UUID.
   * También puede aparecer bajo el alias `user` o `created_by`.
   */
  responded_by: UsuarioAPI | string | null;
  /** Alias alternativo que algunos serializers usan en lugar de `responded_by`. */
  user?: UsuarioAPI | string | null;
  /** Alias alternativo que algunos serializers usan en lugar de `responded_by`. */
  created_by?: UsuarioAPI | string | null;
}

export interface AssignmentAPI {
  id: string;
  /** UUID de la PQRS asignada. */
  pqrs: string;

  // ── Campos legacy FK (compatibilidad hacia atrás) ──────────────────────
  /**
   * Responsable único (FK legacy). Puede ser UUID o objeto completo.
   * Usar `responsible_users` cuando esté disponible.
   */
  responsible_user: UsuarioAPI | string | null;
  /**
   * Área única (FK legacy). Puede ser UUID u objeto completo.
   * Usar `dependencies` cuando esté disponible.
   */
  dependency: Dependency | string | null;

  // ── Campos M2M (nuevo backend) ─────────────────────────────────────────
  /** Lista de UUIDs de usuarios responsables (M2M multi-usuario). */
  responsible_users: string[];
  /** Lista de emails de los responsables (para mostrar sin resolver UUID). */
  responsible_users_emails: string[];
  /** Lista de UUIDs de áreas responsables (M2M multi-área). */
  dependencies: string[];
  /** Lista de nombres de áreas (para mostrar sin resolver UUID). */
  dependencies_nombres: string[];

  // ── Auditoría ──────────────────────────────────────────────────────────
  /** Usuario que realizó la asignación (inferido desde el JWT). */
  assigned_by_user: UsuarioAPI | string;
  is_active: boolean;
  /** Fecha de asignación. Campo canónico del nuevo backend. */
  assigned_at: string;
  /** Alias de `assigned_at` presente en serializers anteriores — usar con `?? created_at`. */
  created_at?: string;
  notes: string;
}

export interface DashboardAPI {
  resumen: Record<string, unknown>;
  sla: Record<string, unknown>;
  areas: Record<string, unknown>;
  flujo: Record<string, unknown>;
  tendencia: Record<string, unknown>;
  retroalimentacion: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
}

export interface UserRole {
  id: string;
  user: string;
  /**
   * El backend puede devolver el objeto Role completo (nested)
   * o simplemente el UUID del rol como string.
   * Usar `resolveUserRole()` en los componentes para normalizar.
   */
  role: Role | string;
  assigned_at: string;
}

export interface DependencyManager {
  id: string;
  dependency: string | Dependency;
  /**
   * El backend puede devolver el objeto UsuarioAPI completo o sólo el UUID.
   * Usar un helper de resolución en los componentes para normalizar.
   */
  user: UsuarioAPI | string;
  assigned_by: UsuarioAPI | string;
  is_active: boolean;
  notes: string;
  assigned_at: string;
}

export interface SLAPolicy {
  id: string;
  name: string;
  pqrs_type: PqrsType;
  pqrs_type_display?: string;
  priority: PqrsPriority;
  priority_display?: string;
  response_days: number;
  resolution_days: number;
  is_business_days: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  /** @deprecated Alias de compatibilidad — usar resolution_days. */
  business_days?: number;
  description?: string;
}

/** Valores válidos para el campo `reason` de una escalación (choices del backend). */
export type EscalationReason = "SLA" | "COMPLEXITY" | "COMPETENCE" | "OTHER";

/** Etiquetas en español para cada motivo de escalación. */
export const ESCALATION_REASON_LABEL: Record<EscalationReason, string> = {
  SLA:        "Vencimiento SLA",
  COMPLEXITY: "Complejidad del caso",
  COMPETENCE: "Competencia de otra área",
  OTHER:      "Otro",
};

export interface PQRSEscalation {
  id: string;
  pqrs: string;
  from_user: UsuarioAPI | null;
  to_user: UsuarioAPI | null;
  from_dependency: Dependency | null;
  to_dependency: Dependency | null;
  /** Código del motivo (choices del backend). */
  reason: EscalationReason;
  /** Etiqueta legible del motivo (campo `reason_display` del serializer). */
  reason_display?: string;
  /** Texto libre adicional sobre la escalación. */
  notes: string;
  escalated_at: string;
}

export interface PQRSActivity {
  id: string;
  pqrs: string;
  activity_type: string;
  /** Etiqueta legible del tipo de actividad (p.ej. "Asignación"). */
  activity_type_display?: string;
  /** Campo real devuelto por el backend. */
  detail?: string;
  /** Alias de compatibilidad — versiones anteriores del serializer usaban `description`. */
  description?: string;
  created_at: string;
  /** Campo real devuelto por el backend. */
  performed_by?: UsuarioAPI | string | null;
  /** Alias de compatibilidad — versiones anteriores usaban `created_by`. */
  created_by?: UsuarioAPI | string | null;
}

export interface Attachment {
  id: string;
  pqrs?: string;
  file?: string;
  filename: string;
  uploaded_by?: UsuarioAPI | null;
  /** El backend devuelve `created_at`; `uploaded_at` se mantiene como alias de compatibilidad. */
  created_at: string;
  uploaded_at?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ────────────────────────────────────────────
//  STATUS & TYPE LABELS / MAPS
// ────────────────────────────────────────────

export const PQRS_STATUS_LABEL: Record<PqrsStatus, string> = {
  RAD: "Radicado",
  PRO: "En Proceso",
  RES: "Resuelto",
  CER: "Cerrado",
};

export const PQRS_TYPE_LABEL: Record<PqrsType, string> = {
  P: "Petición",
  Q: "Queja",
  R: "Reclamo",
  S: "Sugerencia",
  F: "Felicitación",
};

export const PQRS_PRIORITY_LABEL: Record<PqrsPriority, string> = {
  LOW:  "Baja",
  MED:  "Media",
  HIGH: "Alta",
};

export const PQRS_CANAL_LABEL: Record<"WEB" | "PRESENCIAL" | "VERBAL", string> = {
  WEB:        "En línea (web)",
  PRESENCIAL: "Presencial",
  VERBAL:     "Verbal",
};

export const TICKET_STATUS_LABEL: Record<TicketInternoStatus, string> = {
  ABR: "Abierto",
  PRO: "En proceso",
  RES: "Resuelto",
  CER: "Cerrado",
};

// ────────────────────────────────────────────
//  AUTH
// ────────────────────────────────────────────

/**
 * Forma completa de la respuesta del endpoint /api/login/.
 * El backend devuelve los tokens JWT junto con los datos básicos del usuario,
 * lo que evita tener que hacer una llamada adicional a /api/users/perfil/
 * para determinar el rol en el momento del login.
 */
export interface LoginResponse {
  access: string;
  refresh: string;
  user_id: string;
  email: string;
  username: string;
  nombre: string;
  apellido: string;
  /** Array de códigos de roles asignados al usuario (ej. ["ADMIN"]). */
  roles: string[];
  is_staff: boolean;
  /** Tipo de perfil del usuario. */
  perfil_tipo?: "externo" | "estudiante" | "admin_area";
  /** True si el usuario es Líder de Área. */
  is_area_leader?: boolean;
  /** True si el usuario puede atender PQRS de su área. */
  can_handle_pqrs?: boolean;
  /** True si el usuario puede consumir la API de Campus (telefonía estudiantil). */
  can_consume_campus_api?: boolean;
  // Campos opcionales que el backend puede incluir o no
  tipo_documento?: DocumentType;
  cedula?: string;
  telefono?: string;
  ciudad?: string;
  dependency?: Dependency | null;
}

/**
 * Autentica al usuario contra el backend Django REST.
 * Almacena los tokens JWT en localStorage tras un login exitoso.
 * El backend incluye datos básicos del usuario en la respuesta (is_staff, nombre, etc.).
 *
 * @param email    - Correo electrónico del usuario.
 * @param password - Contraseña en texto plano.
 * @returns Objeto `LoginResponse` con tokens y datos del usuario.
 * @throws ApiError si las credenciales son incorrectas o el servidor no responde.
 */
export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>(
    "/api/login/",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  tokens.set(data.access, data.refresh);
  return data;
}

/**
 * Respuesta del endpoint de Google Sign-In del backend.
 */
export interface GoogleLoginResponse {
  access: string;
  refresh: string;
  /** `true` si se creó una cuenta nueva con los datos del perfil de Google. */
  created: boolean;
}

/**
 * Autentica al usuario mediante el `credential` (id_token) emitido por Google Identity Services.
 * El backend verifica el token con Google, crea la cuenta si no existe,
 * y retorna un par de tokens JWT propios.
 *
 * @param credential - El `id_token` JWT del callback de Google Sign-In.
 * @returns Objeto con `access`, `refresh` y `created`.
 * @throws ApiError si el token de Google es inválido o el servidor no responde.
 */
export async function apiGoogleLogin(credential: string): Promise<GoogleLoginResponse> {
  const data = await apiFetch<GoogleLoginResponse>(
    "/api/users/auth/google/",
    { method: "POST", body: JSON.stringify({ credential }) },
    false,
  );
  tokens.set(data.access, data.refresh);
  return data;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  password2: string;
  nombre: string;
  apellido?: string;
  tipo_documento: DocumentType;
  cedula: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
}

/**
 * Registra un nuevo usuario ciudadano en el backend.
 *
 * @param payload - Datos del formulario de registro.
 * @returns El objeto `UsuarioAPI` del usuario recién creado.
 * @throws ApiError 400 si la validación del backend falla (email duplicado, contraseñas débiles, etc.).
 */
export async function apiRegister(payload: RegisterPayload) {
  return apiFetch<UsuarioAPI>(
    "/api/users/registro/",
    { method: "POST", body: JSON.stringify(payload) },
    false,
  );
}

/**
 * Obtiene el perfil del usuario autenticado desde el backend.
 *
 * @returns Objeto `UsuarioAPI` con los datos del usuario actual.
 * @throws ApiError 401 si el token ha expirado o es inválido.
 */
export async function apiGetPerfil() {
  return apiFetch<UsuarioAPI>("/api/users/perfil/");
}

/**
 * Actualiza parcialmente los datos del perfil del usuario autenticado.
 *
 * @param data - Campos a actualizar (parcial de UsuarioAPI).
 * @returns El objeto `UsuarioAPI` actualizado.
 */
export async function apiUpdatePerfil(data: Partial<UsuarioAPI>) {
  return apiFetch<UsuarioAPI>("/api/users/perfil/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Cambia la contraseña del usuario autenticado.
 * El backend valida que `password_actual` sea correcto y que `password_nuevo`
 * y `password_nuevo2` coincidan.
 */
export async function apiChangePassword(payload: {
  password_actual: string;
  password_nuevo: string;
  password_nuevo2: string;
}) {
  return apiFetch<{ detail: string }>("/api/users/change-password/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Solicita un enlace de recuperación de contraseña al correo del usuario.
 * Siempre devuelve 200 sin revelar si el email existe (previene enumeración).
 *
 * Rate limit del backend: 5 peticiones/hora por IP.
 *
 * @param email - Correo del usuario que olvidó su contraseña.
 */
export async function apiPasswordResetRequest(email: string) {
  return apiFetch<{ detail: string }>(
    "/api/users/password-reset/",
    { method: "POST", body: JSON.stringify({ email }) },
    false,
  );
}

/**
 * Establece una nueva contraseña usando el `uid` y `token` del enlace enviado por correo.
 *
 * El enlace tiene el formato: `{FRONTEND_URL}/reset-password?uid=<uid>&token=<token>`
 *
 * @param uid           - UID codificado en base64 (del link del correo).
 * @param token         - Token de un solo uso (del link del correo).
 * @param new_password  - Nueva contraseña (mín. 8 chars, mayúscula, símbolo).
 * @param new_password2 - Confirmación — debe ser idéntica a `new_password`.
 */
export async function apiPasswordResetConfirm(payload: {
  uid: string;
  token: string;
  new_password: string;
  new_password2: string;
}) {
  return apiFetch<{ detail: string }>(
    "/api/users/password-reset/confirm/",
    { method: "POST", body: JSON.stringify(payload) },
    false,
  );
}

// ────────────────────────────────────────────
//  SELECCIÓN DE ROL INSTITUCIONAL
// ────────────────────────────────────────────
export type PerfilTipo = "externo" | "estudiante" | "admin_area" | "docente";

export interface SolicitarRolPayload {
  tipo: PerfilTipo;
  carrera?: string;
  semestre?: number;
  es_egresado?: boolean;
  dependency?: string;
}

export interface SolicitudRolAPI {
  id: string;
  user_email: string;
  user_nombre: string;
  dep_name: string;
  dep_code: string;
  dependency: string;
  /** Tipo de rol solicitado. */
  tipo: "ADMIN_AREA" | "DOCENTE";
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  notas_admin: string | null;
  revisado_por_email: string | null;
  revisado_en: string | null;
  creado_en: string;
}

/** Solicita un cambio de perfil institucional (externo/estudiante/admin_area). */
export async function apiSolicitarRol(payload: SolicitarRolPayload) {
  return apiFetch<{ mensaje: string; perfil_tipo?: PerfilTipo; solicitud_id?: string }>(
    "/api/users/solicitar-rol/",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

/** Lista solicitudes de rol admin_area. Solo accesible para staff. */
export async function apiListSolicitudesRol(estado: "PENDIENTE" | "APROBADA" | "RECHAZADA" = "PENDIENTE") {
  return apiFetch<SolicitudRolAPI[]>(`/api/users/solicitudes-rol/?estado=${estado}`);
}

/** Aprueba o rechaza una solicitud de rol. Solo accesible para staff. */
export async function apiRevisarSolicitudRol(
  id: string,
  payload: { accion: "APROBAR" | "RECHAZAR"; notas_admin?: string }
) {
  return apiFetch<{ mensaje: string }>(
    `/api/users/solicitudes-rol/${id}/`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

// ────────────────────────────────────────────
//  PQRS
// ────────────────────────────────────────────

export interface CreatePqrsPayload {
  /** El backend espera `type`, no `pqrs_type`. */
  type: PqrsType;
  subject: string;
  description: string;
  priority?: PqrsPriority;
  // Campos del remitente anónimo — todos opcionales; el backend los acepta sin ninguno.
  /** Nombre del remitente (opcional). */
  anon_name?: string;
  /** Apellido del remitente (opcional). */
  anon_last_name?: string;
  /** Tipo de documento: CC, CE, TI, PA, PPT, RC (opcional, defecto CC). */
  anon_tipo_documento?: "CC" | "CE" | "TI" | "PA" | "PPT" | "RC";
  /** Número de documento (opcional). */
  anon_document_number?: string;
  /** Correo para notificaciones (opcional). Si se proporciona, se usará para verificar consultas. */
  anon_email?: string;
  /** Teléfono (opcional). */
  anon_phone?: string;
  /** Ciudad del remitente (opcional). */
  anon_city?: string;
  /** Si es `true`, crea un ticket interno entre áreas. Solo pueden usarlo staff o encargados de dependencia. */
  is_internal?: boolean;
  /** UUID de la dependencia destino (para tickets internos o enrutamiento explícito). */
  dependency?: string;
  /** Canal por el que llega la PQRS. Solo PRESENCIAL y VERBAL pueden usarlos los funcionarios de área.
   * WEB es el valor por defecto para ciudadanos en línea. */
  canal_ingreso?: "WEB" | "PRESENCIAL" | "VERBAL";
}

/**
 * Crea una nueva solicitud PQRS.
 *
 * @param payload       - Datos del formulario de radicación.
 * @param authenticated - `true` si el ciudadano está logueado; `false` para envíos anónimos.
 *                        Esto controla si se envía el Bearer token en la petición.
 * @returns El objeto `PqrsAPI` recién creado con su número de radicado.
 */
/**
 * Respuesta real del backend al crear una PQRS.
 * El endpoint POST /api/pqrs/ devuelve este objeto (sin UUID directo).
 * Para obtener el UUID usa `apiConsultarRadicado(numero_radicado)`.
 */
export interface CreatePQRSResponse {
  id: string;
  mensaje: string;
  numero_radicado: string;
  estado: string;
  fecha_limite: string | null;
}

/**
 * Crea una nueva PQRSF. Si el tercer parámetro es true, espera un FormData (multipart/form-data).
 * @param payload - Objeto con los datos o FormData
 * @param authenticated - Si debe enviar el token
 * @param isFormData - true si el payload es FormData
 */
export async function apiCreatePQRS(payload: CreatePqrsPayload | FormData, authenticated: boolean, isFormData = false) {
  if (isFormData) {
    return apiFetch<CreatePQRSResponse>(
      "/api/pqrs/",
      { method: "POST", body: payload as FormData },
      authenticated
    );
  } else {
    return apiFetch<CreatePQRSResponse>(
      "/api/pqrs/",
      { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } },
      authenticated
    );
  }
}

/** Crea una PQRS y guarda sus adjuntos antes de enviar la confirmación por correo. */
export async function apiCreatePQRSWithAttachments(
  payload: CreatePqrsPayload,
  attachments: File[],
  authenticated: boolean,
) {
  if (attachments.length === 0) return apiCreatePQRS(payload, authenticated);

  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  attachments.forEach((file) => form.append("adjuntos", file));
  return apiCreatePQRS(form, authenticated, true);
}

/**
 * Obtiene la lista paginada de PQRS del usuario autenticado (o todas si es admin/área).
 *
 * Construye los query params a partir de los filtros opcionales
 * antes de llamar al endpoint de listado.
 *
 * @param params - Filtros opcionales: estado, tipo, prioridad, página y tamaño de página.
 * @returns Respuesta paginada con el array de PQRS en `results`.
 */
export async function apiListPQRS(params?: {
  status?: PqrsStatus;
  type?: PqrsType;
  priority?: PqrsPriority;
  /** Si es `true`, filtra solo las PQRS activas sin responsable asignado. */
  sin_asignar?: boolean;
  /** Texto libre para buscar por radicado, asunto u otros campos. */
  search?: string;
  /** UUID de la dependencia/área para filtrar PQRS asignadas a esa área. */
  dependency?: string;
  /** Filtra por tipo: `true` = tickets internos, `false` = PQRS ciudadanas, `undefined` = todos. */
  is_internal?: boolean;
  /** UUID del usuario creador. Útil para obtener tickets enviados por un funcionario. */
  created_by_user?: string;
  /** Filtro SLA: 'vencida' | 'por_vencer' | 'en_tiempo' | 'sin_sla' */
  sla_status?: string;
  /** Filtrar PQRS que vencen dentro de N días. */
  vence_en_dias?: number;
  /** Fecha límite mínima (formato YYYY-MM-DD). */
  due_date_from?: string;
  /** Fecha límite máxima (formato YYYY-MM-DD). */
  due_date_to?: string;
  /** Si es `true` (solo admin), lista únicamente las PQRS archivadas. */
  archived?: boolean;
  page?: number;
  page_size?: number;
}) {
  // Construir query string solo con los parámetros definidos
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.type) q.set("type", params.type);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.sin_asignar) q.set("sin_asignar", "true");
  if (params?.archived) q.set("archived", "true");
  if (params?.search) q.set("search", params.search);
  if (params?.dependency) q.set("dependency", params.dependency);
  if (params?.is_internal !== undefined) q.set("is_internal", String(params.is_internal));
  if (params?.created_by_user) q.set("created_by_user", params.created_by_user);
  if (params?.sla_status) q.set("sla_status", params.sla_status);
  if (params?.vence_en_dias !== undefined) q.set("vence_en_dias", String(params.vence_en_dias));
  if (params?.due_date_from) q.set("due_date_from", params.due_date_from);
  if (params?.due_date_to) q.set("due_date_to", params.due_date_to);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<PqrsAPI>>(`/api/pqrs/lista/${qs}`);
}

/**
 * Obtiene el detalle completo de una PQRS por su ID interno.
 *
 * @param id - UUID de la PQRS.
 */
export async function apiGetPQRS(id: string) {
  return apiFetch<PqrsAPI>(`/api/pqrs/${id}/`);
}

/**
 * Lista paginada de tickets internos usando el endpoint dedicado `/api/pqrs/tickets/`.
 * Devuelve todos los tickets visibles para el usuario autenticado (recibidos y enviados).
 */
export async function apiListTickets(params?: {
  dependency?: string;
  status?: TicketInternoStatus;
  page?: number;
  page_size?: number;
}) {
  const q = new URLSearchParams();
  if (params?.dependency) q.set("dependency", params.dependency);
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<TicketInternoAPI>>(`/api/pqrs/tickets/${qs}`);
}

/** Obtiene el detalle de un ticket interno por su UUID. */
export async function apiGetTicketInterno(id: string) {
  return apiFetch<TicketInternoAPI>(`/api/pqrs/tickets/${id}/`);
}

/**
 * Crea un nuevo ticket interno entre áreas.
 * Usa el endpoint dedicado `POST /api/pqrs/tickets/`.
 */
export async function apiCreateTicketInterno(payload: CreateTicketInternoPayload) {
  return apiFetch<TicketInternoAPI>("/api/pqrs/tickets/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Cambia el estado (y/o prioridad) de un ticket interno.
 * Usa `PATCH /api/pqrs/tickets/<id>/estado/`.
 */
export async function apiUpdateTicketInternoEstado(
  id: string,
  payload: { status?: TicketInternoStatus; priority?: PqrsPriority },
) {
  return apiFetch<TicketInternoAPI>(`/api/pqrs/tickets/${id}/estado/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ── Tickets internos: bitácora, asignaciones, escalaciones y adjuntos ─────────

/**
 * Obtiene la bitácora de actividades de un ticket interno.
 * `GET /api/pqrs/tickets/<id>/activities/`
 */
export async function apiGetTicketActivities(ticketId: string): Promise<TicketActivity[]> {
  const res = await apiFetch<PaginatedResponse<TicketActivity> | TicketActivity[]>(
    `/api/pqrs/tickets/${ticketId}/activities/`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/**
 * Feed global de comentarios/notas recientes en todos los tickets visibles.
 * `GET /api/pqrs/tickets/activity-feed/?since=<ISO8601>`
 */
export async function apiGetTicketActivityFeed(since: string): Promise<TicketActivity[]> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiFetch<TicketActivity[]>(`/api/pqrs/tickets/activity-feed/${qs}`);
}

/**
 * Lista las asignaciones de responsable de un ticket interno.
 * `GET /api/pqrs/tickets/<id>/assignments/`
 */
export async function apiGetTicketAssignments(ticketId: string): Promise<TicketAssignmentAPI[]> {
  const res = await apiFetch<PaginatedResponse<TicketAssignmentAPI> | TicketAssignmentAPI[]>(
    `/api/pqrs/tickets/${ticketId}/assignments/`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/**
 * Asigna un ticket a un área.
 * `POST /api/pqrs/tickets/assign/`
 */
export async function apiAssignTicket(
  ticketId: string,
  dependencyId: string,
  notes?: string,
): Promise<TicketAssignmentAPI> {
  return apiFetch<TicketAssignmentAPI>("/api/pqrs/tickets/assign/", {
    method: "POST",
    body: JSON.stringify({ ticket: ticketId, dependency: dependencyId, ...(notes?.trim() && { notes: notes.trim() }) }),
  });
}

/**
 * Lista el historial de escalaciones de un ticket interno.
 * `GET /api/pqrs/tickets/<id>/escalations/`
 */
export async function apiGetTicketEscalations(ticketId: string): Promise<TicketEscalationAPI[]> {
  const res = await apiFetch<PaginatedResponse<TicketEscalationAPI> | TicketEscalationAPI[]>(
    `/api/pqrs/tickets/${ticketId}/escalations/`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/**
 * Escala un ticket interno a otra área o usuario.
 * `POST /api/pqrs/tickets/escalate/`
 */
export async function apiEscalateTicket(payload: EscalateTicketPayload) {
  return apiFetch<TicketEscalationAPI>("/api/pqrs/tickets/escalate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Lista los adjuntos de un ticket interno.
 * `GET /api/pqrs/tickets/<id>/attachments/`
 */
export async function apiGetTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const res = await apiFetch<PaginatedResponse<TicketAttachment> | TicketAttachment[]>(
    `/api/pqrs/tickets/${ticketId}/attachments/`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/**
 * Sube un adjunto a un ticket interno.
 * `POST /api/pqrs/tickets/<id>/attachments/create/`
 */
export async function apiUploadTicketAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<TicketAttachment>(
    `/api/pqrs/tickets/${ticketId}/attachments/create/`,
    { method: "POST", body: form },
  );
}

// ── Tickets internos: tareas ──────────────────────────────────────────────────

export type TicketTaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

/** Tarea asociada a un ticket interno. */
export interface TicketTaskAPI {
  id: string;
  ticket: string;
  title: string;
  description?: string | null;
  status: TicketTaskStatus;
  status_display?: string;
  /** UUID del área responsable de la tarea. */
  dependency?: string | null;
  /** Nombre del área responsable (campo aplanado del serializer). */
  dependency_name?: string | null;
  /** UUIDs de los usuarios asignados. */
  assigned_to?: string[];
  /** Nombres completos de los asignados (campo aplanado del serializer). */
  assigned_to_nombres?: string[];
  /** UUID del usuario que creó la tarea. */
  created_by?: string | null;
  /** Nombre completo del creador (campo aplanado del serializer). */
  created_by_nombre?: string | null;
  due_date?: string | null;
  is_overdue?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateTicketTaskPayload {
  title: string;
  description?: string;
  dependency?: string;
  /** UUIDs de los usuarios a asignar. */
  assigned_to?: string[];
  due_date?: string;
}

/**
 * Usuario elegible para ser asignado a una tarea de un ticket.
 * Devuelto por `GET /api/pqrs/tickets/<id>/eligible-assignees/`.
 */
export interface EligibleAssigneeAPI {
  id: string;
  nombre_completo: string;
  email: string;
  dependency_id: string;
  dependency_name: string;
}

/**
 * Obtiene los usuarios elegibles (activos del área origen o destino) para asignar
 * a las tareas de un ticket.
 *
 * `GET /api/pqrs/tickets/<id>/eligible-assignees/[?dependency=<uuid>]`
 *
 * @param ticketId     - UUID del ticket interno.
 * @param dependencyId - UUID opcional para filtrar por una de las dos áreas.
 */
export async function apiGetEligibleAssignees(
  ticketId: string,
  dependencyId?: string,
): Promise<EligibleAssigneeAPI[]> {
  const params = dependencyId ? `?dependency=${dependencyId}` : "";
  const res = await apiFetch<EligibleAssigneeAPI[] | PaginatedResponse<EligibleAssigneeAPI>>(
    `/api/pqrs/tickets/${ticketId}/eligible-assignees/${params}`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/** Parámetros de filtro para listar tareas de un ticket. */
export interface ListTicketTasksParams {
  /** Filtrar por estado: PENDING | IN_PROGRESS | DONE | CANCELLED */
  status?: TicketTaskStatus;
  /** Si true, devuelve solo las tareas asignadas al usuario autenticado. */
  assigned_to_me?: boolean;
}

/** Lista las tareas de un ticket con filtros opcionales.
 * `GET /api/pqrs/tickets/<id>/tasks/?status=...&assigned_to_me=true` */
export async function apiListTicketTasks(
  ticketId: string,
  params?: ListTicketTasksParams,
): Promise<TicketTaskAPI[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.assigned_to_me) qs.set("assigned_to_me", "true");
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<PaginatedResponse<TicketTaskAPI> | TicketTaskAPI[]>(
    `/api/pqrs/tickets/${ticketId}/tasks/${query}`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/** Crea una nueva tarea en un ticket. `POST /api/pqrs/tickets/<id>/tasks/` */
export async function apiCreateTicketTask(
  ticketId: string,
  payload: CreateTicketTaskPayload,
): Promise<TicketTaskAPI> {
  return apiFetch<TicketTaskAPI>(`/api/pqrs/tickets/${ticketId}/tasks/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Actualiza parcialmente una tarea. `PATCH /api/pqrs/tickets/<id>/tasks/<pk>/` */
export async function apiUpdateTicketTask(
  ticketId: string,
  taskId: string,
  payload: Partial<Pick<TicketTaskAPI, "title" | "status" | "description" | "due_date" | "assigned_to">>,
): Promise<TicketTaskAPI> {
  return apiFetch<TicketTaskAPI>(`/api/pqrs/tickets/${ticketId}/tasks/${taskId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Publica un comentario en un ticket interno.
 * `POST /api/pqrs/tickets/<ticket_id>/comments/`
 *
 * Pasa `isInternalNote: true` para guardar como `INTERNAL_NOTE` (solo visible
 * para el equipo interno); omitirlo o `false` guarda como `COMMENT` público.
 */
export async function apiCommentTicket(
  ticketId: string,
  detail: string,
  isInternalNote = false,
): Promise<TicketActivity> {
  return apiFetch<TicketActivity>(`/api/pqrs/tickets/${ticketId}/comments/`, {
    method: "POST",
    body: JSON.stringify({ detail, is_internal_note: isInternalNote }),
  });
}


/**
 * El endpoint `/api/pqrs/consultar/` puede devolver un objeto directo o
 * una respuesta paginada, y los nombres de campo pueden variar entre el
 * serializer público (a veces en español) y el serializer privado (inglés).
 * Esta función aplana ambos casos y mapea todos los alias conocidos.
 */
function normalizePqrsPublica(raw: Record<string, unknown>): PqrsAPI {
  // Si es respuesta paginada, tomar el primer resultado
  const src: Record<string, unknown> =
    Array.isArray((raw as { results?: unknown[] }).results) && (raw as { results: unknown[] }).results.length > 0
      ? (raw as { results: Record<string, unknown>[] }).results[0]
      : raw;

  // eslint-disable-next-line no-console
  console.debug("[ConsultaRadicado] raw API payload:", src);

  const pick = (...keys: string[]) => {
    for (const k of keys) if (src[k] !== undefined && src[k] !== null) return src[k];
    return undefined;
  };

  return {
    id:              (pick("id") as string) ?? "",
    numero_radicado: (pick("numero_radicado", "radicado") as string) ?? "",
    radicado:        pick("radicado", "numero_radicado") as string | undefined,
    type:            (pick("type", "pqrs_type") as PqrsType) ?? ("" as PqrsType),
    pqrs_type:       pick("pqrs_type", "type") as PqrsType | undefined,
    type_display:    (pick("type_display", "tipo") as string) ?? undefined,
    status_display:  (pick("status_display", "estado") as string) ?? undefined,
    subject:         (pick("subject", "asunto") as string) ?? "",
    description:     (pick("description", "descripcion", "descripci\u00f3n") as string) ?? "",
    status:          (pick("status") as PqrsStatus) ?? ("" as PqrsStatus),
    priority:        (pick("priority", "prioridad") as PqrsPriority) ?? ("MED" as PqrsPriority),
    created_at:      (pick("created_at", "creado_en", "fecha_creacion", "fecha_radicacion") as string) ?? "",
    updated_at:      (pick("updated_at", "actualizado_en", "fecha_actualizacion") as string) ?? "",
    due_date:        (pick("due_date", "fecha_limite", "fecha_vencimiento") as string | null) ?? null,
    user:            (pick("user", "usuario") as PqrsAPI["user"]) ?? null,
    anonymous_submitter:
      (pick("anonymous_submitter", "remitente_anonimo", "datos_anonimos") as PqrsAPI["anonymous_submitter"]) ?? null,
    dependency:      (pick("dependency", "dependencia", "area") as PqrsAPI["dependency"]) ?? null,
    sla_policy:      (pick("sla_policy", "sla") as PqrsAPI["sla_policy"]) ?? null,
  };
}

/**
 * Consulta pública de una PQRS por número de radicado.
 * No requiere autenticación; cualquier ciudadano puede usarla.
 *
 * El backend (ConsultaRadicadoView) acepta ambos métodos:
 *  - GET  /api/pqrs/consultar/?numero_radicado=X[&anon_email=Y]
 *  - POST /api/pqrs/consultar/ { "numero_radicado": "X", "anon_email": "Y" }
 *
 * El campo de verificación se llama `anon_email` (no `email`), coincidiendo con
 * el campo `anon_email` usado al radicar la PQRS de forma anónima.
 * Se envía en minúsculas ya que el backend hace `.lower().strip()` al comparar.
 *
 * @param radicado  - Número de radicado (ej. "PQRS-20260306-XXXXXXXX").
 * @param anonEmail - Correo de verificación; solo se envía cuando el backend lo exige.
 */
export async function apiConsultarRadicado(radicado: string, anonEmail?: string) {
  const params = new URLSearchParams({ numero_radicado: radicado });
  if (anonEmail) {
    params.set("anon_email", anonEmail.trim().toLowerCase());
  }
  const raw = await apiFetch<Record<string, unknown>>(
    `/api/pqrs/consultar/?${params.toString()}`,
    {},
    true, // enviar token si está disponible
  );
  return normalizePqrsPublica(raw);
}

/**
 * Actualiza el estado de una PQRS (admin o funcionario de área).
 *
 * @param id     - UUID de la PQRS.
 * @param status - Nuevo estado: RAD | PRO | RES | CER.
 * @param notes  - Nota interna opcional sobre el cambio de estado.
 */
export async function apiUpdateEstado(id: string, status: PqrsStatus, notes?: string) {
  return apiFetch<PqrsAPI>(`/api/pqrs/${id}/estado/`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

/**
 * Archiva o desarchiva varias PQRS a la vez (solo administradores).
 * Las PQRS archivadas se excluyen de listados, estadísticas, exportaciones y alertas SLA.
 * `POST /api/pqrs/archivar/`
 *
 * @param ids      - UUIDs de las PQRS (máx. 500 por solicitud).
 * @param archived - `true` para archivar (por defecto), `false` para restaurar.
 * @returns Cantidad de PQRS cuyo estado cambió realmente.
 */
export async function apiArchivePQRS(ids: string[], archived = true) {
  return apiFetch<{ actualizadas: number; archived: boolean }>("/api/pqrs/archivar/", {
    method: "POST",
    body: JSON.stringify({ ids, archived }),
  });
}

/**
 * Actualiza campos del PQRS directamente (PATCH parcial).
 * Útil para sincronizar el campo `dependency` después de una asignación,
 * de modo que el filtro `?dependency=` del backend devuelva resultados correctos.
 *
 * @param id    - UUID de la PQRS.
 * @param patch - Campos a actualizar (p. ej. `{ dependency: uuid }`).
 */
export async function apiPatchPQRS(id: string, patch: { dependency?: string | null; [key: string]: unknown }) {
  return apiFetch<PqrsAPI>(`/api/pqrs/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/**
 * Asigna una PQRS a un área/dependencia o usuario responsable.
 *
 * Endpoint del backend: POST /api/pqrs/assign/
 * El backend infiere `assigned_by_user` desde el JWT; no hay que enviarlo.
 * Soporta multi-usuario y multi-área: se crean registros individuales por cada
 * combinación de responsable × área y se desactivan asignaciones anteriores.
 *
 * @param payload.pqrs              - UUID de la PQRS a asignar.
 * @param payload.responsible_users - UUIDs de los usuarios responsables (requerido, ≥ 1).
 * @param payload.dependencies      - UUIDs de las dependencias destino (opcional).
 * @param payload.notes             - Nota interna sobre la asignación (opcional).
 */
export async function apiAssignPQRS(payload: {
  pqrs: string;
  /** UUIDs de los usuarios responsables. Campo REQUERIDO por el backend. */
  responsible_users: string[];
  /** UUIDs de las dependencias/áreas destino. */
  dependencies?: string[];
  notes?: string;
}) {
  return apiFetch<AssignmentAPI[]>("/api/pqrs/assign/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Registra una respuesta sobre una PQRS.
 *
 * @param payload.pqrs          - UUID de la PQRS.
 * @param payload.response_text - Texto de la respuesta.
 * @param payload.response_type - INTERNAL (solo funcionarios), CITIZEN (visible al ciudadano) o FINAL.
 */
export async function apiRespondPQRS(payload: {
  pqrs: string;
  /** Texto de la respuesta. El backend lo recibe en el campo `content`. */
  content: string;
  response_type?: "INTERNAL" | "CITIZEN" | "FINAL";
  /** Si es true, cierra la PQRS como resuelta. */
  is_final?: boolean;
  /** IDs (UUID) de adjuntos ya subidos a la PQRS que se incluirán en el correo. */
  attachment_ids?: string[];
}) {
  return apiFetch<PqrsResponseAPI>("/api/pqrs/respond/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Obtiene todas las respuestas registradas para una PQRS.
 *
 * @param pqrsId - UUID de la PQRS.
 */
export async function apiGetResponses(pqrsId: string, pageSize = 50) {
  const qs = pageSize !== 50 ? `?page_size=${pageSize}` : "";
  return apiFetch<PaginatedResponse<PqrsResponseAPI>>(
    `/api/pqrs/${pqrsId}/responses/${qs}`,
  );
}

/**
 * Obtiene las respuestas públicas (CITIZEN y FINAL) de una PQRS sin requerir autenticación.
 * Se usa como fallback para ciudadanos que consultan de forma anónima.
 */
export async function apiGetResponsesPublic(pqrsId: string) {
  return apiFetch<PaginatedResponse<PqrsResponseAPI>>(
    `/api/pqrs/${pqrsId}/responses/`,
    {},
    false, // sin autenticación
  );
}

/**
 * Respuesta individual del endpoint público de consulta de respuestas por radicado.
 */
interface PublicResponseItem {
  id: string;
  /** Etiqueta legible del tipo (ej. "Respuesta al ciudadano", "Respuesta final"). */
  tipo: string;
  response_type: "CITIZEN" | "FINAL";
  /** Texto de la respuesta. */
  contenido: string;
  /** Si es true, esta respuesta cierra la PQRS como resuelta. */
  es_final: boolean;
  /** Fecha de creación en formato ISO 8601. */
  fecha: string;
}

/**
 * Estructura completa de la respuesta del endpoint público de respuestas por radicado.
 */
interface PublicResponsesPayload {
  numero_radicado: string;
  estado: string;
  total: number;
  respuestas: PublicResponseItem[];
}

/**
 * Consulta pública de las respuestas (CITIZEN y FINAL) de una PQRS por número de radicado.
 * No requiere autenticación; disponible para ciudadanos anónimos.
 *
 * Endpoint: GET /api/pqrs/consultar/responses/?numero_radicado=X[&anon_email=Y]
 *
 * @param radicado  - Número de radicado (ej. "PQRS-2026-0001").
 * @param anonEmail - Correo de verificación; solo se envía cuando la PQRS requirió verificación previa.
 */
export async function apiGetResponsesPublicByRadicado(
  radicado: string,
  anonEmail?: string,
): Promise<PqrsResponseAPI[]> {
  const params = new URLSearchParams({ numero_radicado: radicado });
  if (anonEmail) params.set("anon_email", anonEmail.trim().toLowerCase());

  const data = await apiFetch<PublicResponsesPayload>(
    `/api/pqrs/consultar/responses/?${params.toString()}`,
    {},
    true, // adjuntar JWT si existe para validar PQRS vinculadas a una cuenta
  );

  // Mapear el formato del backend público al tipo interno PqrsResponseAPI
  return (data.respuestas ?? []).map((r) => ({
    id: r.id,
    pqrs: radicado,
    content: r.contenido,
    response_type: r.response_type,
    is_final: r.es_final,
    created_at: r.fecha,
    responded_by: null,
  }));
}

/**
 * Obtiene el historial de asignaciones de una PQRS.
 *
 * @param pqrsId - UUID de la PQRS.
 */
export async function apiGetAssignments(pqrsId: string) {
  return apiFetch<PaginatedResponse<AssignmentAPI>>(
    `/api/pqrs/${pqrsId}/assignments/`,
  );
}

// ────────────────────────────────────────────
//  DEPENDENCIES (areas)
// ────────────────────────────────────────────

/**
 * Obtiene la lista de dependencias/áreas institucionales.
 *
 * @param all    - Si es `true`, solicita hasta 200 registros (para selectores/combos);
 *                 si es `false` usa la paginación por defecto del backend.
 * @param active - `true` solo activas, `false` solo inactivas, `undefined` todas (sin filtro).
 */
export async function apiListDependencies(all = false, active?: boolean) {
  const q = new URLSearchParams();
  if (all) q.set("page_size", "200");
  if (active !== undefined) {
    // Enviamos el filtro con ambos nombres habituales en backends Django
    // (el backend ignora el parámetro que no reconozca).
    q.set("active", String(active));
    q.set("is_active", String(active));
  }
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<Dependency>>(`/api/pqrs/dependencies/${qs}`);
}

export interface DependencyPayload {
  name: string;
  code: string;
  email: string;
  description: string;
  active?: boolean;
  inventario_notify_email?: string;
  /** UUID del líder de área, o null para quitar el líder. */
  lider?: string | null;
}

/** Crea una nueva dependencia/área institucional. Solo accesible para administradores. */
export async function apiCreateDependency(payload: DependencyPayload) {
  return apiFetch<Dependency>("/api/pqrs/dependencies/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Actualiza parcialmente una dependencia existente.
 *
 * @param id      - UUID de la dependencia.
 * @param payload - Campos a actualizar.
 */
export async function apiUpdateDependency(id: string, payload: Partial<DependencyPayload>) {
  return apiFetch<Dependency>(`/api/pqrs/dependencies/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Elimina una dependencia. Esta acción puede fallar si la dependencia
 * tiene PQRS o usuarios asociados.
 *
 * @param id - UUID de la dependencia a eliminar.
 */
export async function apiDeleteDependency(id: string) {
  return apiFetch<void>(`/api/pqrs/dependencies/${id}/`, { method: "DELETE" });
}

// ────────────────────────────────────────────
//  USERS (admin management)
// ────────────────────────────────────────────

/**
 * Lista todos los usuarios del sistema (solo administradores).
 *
 * @param params.page      - Número de página.
 * @param params.page_size - Registros por página.
 */
export async function apiListUsers(params?: { page?: number; page_size?: number; search?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<UsuarioAPI>>(`/api/users/${qs}`);
}

/** Recorre todas las páginas de `/api/users/` (el backend limita page_size a 200) y devuelve un arreglo. */
export async function apiListAllUsers(search?: string): Promise<UsuarioAPI[]> {
  const all: UsuarioAPI[] = [];
  for (let page = 1; page <= 500; page++) {
    const res: any = await apiListUsers({ page, page_size: 200, search });
    if (Array.isArray(res)) return res;
    all.push(...(res.results ?? []));
    if (!res.next) break;
  }
  return all;
}

/**
 * Actualiza datos de un usuario específico (uso administrativo).
 * Uso típico: asignar o reasignar la dependencia de un funcionario desde
 * el panel de administración (`GestionAreas`).
 *
 * Endpoint: `PATCH /api/users/<uuid>/`
 * Requiere `is_staff = true` en el token.
 *
 * @param id      - UUID del usuario a actualizar.
 * @param payload - Campos a actualizar (p. ej. `{ dependency: "<uuid>" }`).
 */
export async function apiUpdateUser(id: string, payload: Partial<Omit<UsuarioAPI, "dependency"> & { dependency: string | Dependency | null } & Record<string, unknown>>) {
  return apiFetch<UsuarioAPI>(`/api/users/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export interface ApiAccessTokenAPI {
  id: string;
  name: string;
  user: string;
  user_email?: string;
  created_by?: string | null;
  created_by_email?: string | null;
  token_prefix: string;
  expires_at: string;
  is_active: boolean;
  is_expired: boolean;
  is_valid: boolean;
  last_used_at: string | null;
  last_used_ip: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  access_token?: string;
  token_type?: "Bearer";
}

export async function apiIssueApiAccessToken(payload: {
  user_email?: string;
  user_id?: string;
  name?: string;
  days_valid?: number;
  notes?: string;
}) {
  return apiFetch<ApiAccessTokenAPI>("/api/users/api-tokens/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────
//  DASHBOARD (admin)
// ────────────────────────────────────────────

/**
 * Obtiene los datos agregados del dashboard de administrador.
 *
 * Incluye: resumen de estados, métricas SLA, distribución por áreas,
 * flujo de PQRS, tendencia temporal y retroalimentación.
 *
 * @returns Objeto `DashboardAPI` con todas las secciones del panel.
 */
export async function apiGetDashboard() {
  return apiFetch<DashboardAPI>("/api/pqrs/dashboard/");
}

// ────────────────────────────────────────────
//  TOKEN VERIFY
// ────────────────────────────────────────────

/**
 * Verifica si un token (access o refresh) sigue siendo válido.
 * No devuelve datos adicionales; retorna `{}` si es válido.
 *
 * @param token - Access o Refresh token a verificar.
 * @throws ApiError 401 si el token ha expirado o es inválido.
 */
export async function apiVerifyToken(token: string) {
  return apiFetch<Record<string, never>>(
    "/api/login/verify/",
    { method: "POST", body: JSON.stringify({ token }) },
    false,
  );
}

// ────────────────────────────────────────────
//  ROLES
// ────────────────────────────────────────────

/**
 * Obtiene el catálogo completo de roles del sistema.
 */
export async function apiListRoles() {
  return apiFetch<PaginatedResponse<Role>>("/api/users/roles/");
}

export interface RolePayload {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}

/**
 * Crea un nuevo rol en el catálogo. Solo admin.
 *
 * @param payload - Datos del nuevo rol.
 */
export async function apiCreateRole(payload: RolePayload) {
  return apiFetch<Role>("/api/users/roles/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Obtiene los roles asignados a un usuario.
 *
 * @param userId - UUID del usuario.
 */
export async function apiGetUserRoles(userId: string) {
  return apiFetch<PaginatedResponse<UserRole>>(`/api/users/${userId}/roles/`);
}

/**
 * Asigna un rol a un usuario. Solo admin.
 *
 * @param userId - UUID del usuario destino.
 * @param roleId - UUID del rol a asignar.
 */
export async function apiAssignRole(userId: string, roleId: string) {
  return apiFetch<UserRole>(`/api/users/${userId}/roles/assign/`, {
    method: "POST",
    body: JSON.stringify({ role: roleId }),
  });
}

/**
 * Quita (elimina) un rol de un usuario. Solo admin.
 *
 * @param userRoleId - UUID del registro UserRole a eliminar.
 */
export async function apiRemoveRole(userRoleId: string) {
  return apiFetch<void>(`/api/users/roles/${userRoleId}/remove/`, {
    method: "DELETE",
  });
}

// ────────────────────────────────────────────
//  DEPENDENCY MANAGERS
// ────────────────────────────────────────────

/**
 * Obtiene el detalle de una dependencia por su ID.
 *
 * @param id - UUID de la dependencia.
 */
export async function apiGetDependency(id: string) {
  return apiFetch<Dependency>(`/api/pqrs/dependencies/${id}/`);
}

/**
 * Lista los encargados activos (y desactivados) de una dependencia.
 *
 * @param depId - UUID de la dependencia.
 */
export async function apiListManagers(depId: string) {
  return apiFetch<PaginatedResponse<DependencyManager>>(
    `/api/pqrs/dependencies/${depId}/managers/`,
  );
}

/**
 * Asigna un usuario como encargado de una dependencia. Solo admin.
 *
 * @param depId   - UUID de la dependencia.
 * @param userId  - UUID del usuario a asignar.
 * @param notes   - Notas opcionales sobre la asignación.
 */
export async function apiAssignManager(depId: string, userId: string, notes = "") {
  return apiFetch<DependencyManager>(`/api/pqrs/dependencies/${depId}/managers/`, {
    method: "POST",
    body: JSON.stringify({ user: userId, notes }),
  });
}

/**
 * Desactiva (soft-delete) un encargado de una dependencia. Solo admin.
 *
 * @param depId     - UUID de la dependencia.
 * @param managerId - UUID del registro DependencyManager a desactivar.
 */
export async function apiRemoveManager(depId: string, managerId: string) {
  return apiFetch<void>(
    `/api/pqrs/dependencies/${depId}/managers/${managerId}/`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────
//  SLA POLICIES
// ────────────────────────────────────────────

/**
 * Lista todas las políticas SLA registradas.
 */
export async function apiListSLA() {
  return apiFetch<PaginatedResponse<SLAPolicy>>("/api/pqrs/sla/");
}

export interface SLAPayload {
  name: string;
  pqrs_type: PqrsType;
  priority: PqrsPriority;
  response_days: number;
  resolution_days: number;
  is_business_days?: boolean;
  active?: boolean;
}

/**
 * Crea una nueva política SLA. Solo admin.
 *
 * @param payload - Datos de la política.
 */
export async function apiCreateSLA(payload: SLAPayload) {
  return apiFetch<SLAPolicy>("/api/pqrs/sla/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Obtiene el detalle de una política SLA.
 *
 * @param id - UUID de la política SLA.
 */
export async function apiGetSLA(id: string) {
  return apiFetch<SLAPolicy>(`/api/pqrs/sla/${id}/`);
}

/**
 * Actualiza parcialmente una política SLA. Solo admin.
 *
 * @param id      - UUID de la política.
 * @param payload - Campos a actualizar.
 */
export async function apiUpdateSLA(id: string, payload: Partial<SLAPayload>) {
  return apiFetch<SLAPolicy>(`/api/pqrs/sla/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Elimina una política SLA. Solo admin.
 *
 * @param id - UUID de la política a eliminar.
 */
export async function apiDeleteSLA(id: string) {
  return apiFetch<void>(`/api/pqrs/sla/${id}/`, { method: "DELETE" });
}

// ────────────────────────────────────────────
//  PQRS – ESCALACIONES
// ────────────────────────────────────────────

export interface EscalatePayload {
  pqrs: string;
  to_user?: string;
  to_dependency?: string;
  /** Código del motivo: SLA | COMPLEXITY | COMPETENCE | OTHER (campo choices del backend). */
  reason: EscalationReason;
  /** Texto libre adicional (campo `notes` del backend). */
  notes?: string;
}

/**
 * Escala una PQRS a otra dependencia o usuario.
 * Dispara automáticamente un correo de notificación al área/usuario destino.
 *
 * @param payload - Datos de la escalación.
 */
export async function apiEscalatePQRS(payload: EscalatePayload) {
  return apiFetch<PQRSEscalation>("/api/pqrs/escalate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Obtiene el historial de escalaciones de una PQRS.
 *
 * @param pqrsId - UUID de la PQRS.
 */
export async function apiGetEscalations(pqrsId: string) {
  return apiFetch<PaginatedResponse<PQRSEscalation>>(
    `/api/pqrs/${pqrsId}/escalations/`,
  );
}

// ────────────────────────────────────────────
//  PQRS – BITÁCORA DE ACTIVIDADES
// ────────────────────────────────────────────

/**
 * Obtiene el registro cronológico de todos los eventos de una PQRS.
 * El backend genera este registro automáticamente; no puede ser creado
 * ni modificado desde el cliente.
 *
 * @param pqrsId - UUID de la PQRS.
 */
export async function apiGetActivities(pqrsId: string) {
  return apiFetch<PaginatedResponse<PQRSActivity>>(
    `/api/pqrs/${pqrsId}/activities/`,
  );
}

// ────────────────────────────────────────────
//  PQRS – ADJUNTOS
// ────────────────────────────────────────────

/**
 * Sube un archivo adjunto vinculado a una PQRS.
 * Usa `multipart/form-data`; NO envía Content-Type: application/json.
 *
 * @param pqrsId - UUID de la PQRS a la que se adjunta el archivo.
 * @param file   - Objeto `File` proveniente de un `<input type="file">`.
 */
export async function apiUploadAttachment(pqrsId: string, file: File, authenticated = true) {
  const form = new FormData();
  form.append("file", file);

  // Si se solicita auth pero no hay token activo (usuario anónimo), se envía sin token
  // para no disparar el flujo de refresco y evitar errores innecesarios.
  const useAuth = authenticated && !!tokens.getAccess();

  console.log(
    `[apiUploadAttachment] pqrsId=${pqrsId} | file="${file.name}" | size=${file.size}B | useAuth=${useAuth} | url=${API_BASE}/api/pqrs/${pqrsId}/attachments/create/`
  );

  try {
    const result = await apiFetch<Attachment>(
      `/api/pqrs/${pqrsId}/attachments/create/`,
      { method: "POST", body: form },
      useAuth,
    );
    console.log(`[apiUploadAttachment] ✓ OK file="${file.name}"`, result);
    return result;
  } catch (err) {
    console.error(`[apiUploadAttachment] ✗ ERROR file="${file.name}"`, err);
    throw err;
  }
}

/**
 * Lista todos los archivos adjuntos de una PQRS.
 *
 * @param pqrsId - UUID de la PQRS.
 */
export async function apiGetAttachments(pqrsId: string): Promise<Attachment[]> {
  const res = await apiFetch<PaginatedResponse<Attachment> | Attachment[]>(
    `/api/pqrs/${pqrsId}/attachments/`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

/** Descarga un adjunto PQRS mediante el endpoint protegido del backend. */
export async function apiDownloadAttachment(pqrsId: string, attachmentId: string, anonEmail?: string) {
  const query = anonEmail ? `?anon_email=${encodeURIComponent(anonEmail)}` : "";
  return apiFetchBlob(
    `/api/pqrs/${pqrsId}/attachments/${attachmentId}/download/${query}`,
    `adjunto-${attachmentId}`,
  );
}

// ────────────────────────────────────────────
//  PQRS – EXPORTACIÓN DE REPORTES
// ────────────────────────────────────────────

/** Filtros opcionales compartidos por los endpoints de exportación. */
export interface ExportFilters {
  /** Código de estado: RAD | PRO | RES | CER */
  status?: string;
  /** Código de tipo: P | Q | R | S | F */
  type?: string;
  /** Prioridad: LOW | MED | HIGH */
  priority?: string;
  /** Fecha de inicio (YYYY-MM-DD) */
  date_from?: string;
  /** Fecha de fin (YYYY-MM-DD) */
  date_to?: string;
  /** UUID de dependencia — solo para reportes por área y solo visible a admins. */
  dependency_id?: string;
}

/** Lee el nombre de archivo de la cabecera Content-Disposition. */
function extractFilename(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename[^;=\n]*=([^;\n]*)/);
  if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  return fallback;
}

/** Construye el query string a partir de los filtros de exportación. */
function buildExportParams(filters?: ExportFilters): string {
  if (!filters) return "";
  const p = new URLSearchParams();
  if (filters.status)        p.set("status",        filters.status);
  if (filters.type)          p.set("type",          filters.type);
  if (filters.priority)      p.set("priority",      filters.priority);
  if (filters.date_from)     p.set("date_from",     filters.date_from);
  if (filters.date_to)       p.set("date_to",       filters.date_to);
  if (filters.dependency_id) p.set("dependency_id", filters.dependency_id);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Fetch especializado para respuestas binarias (blob).
 * Reutiliza el mecanismo de refresco de token de `apiFetch`.
 */
async function apiFetchBlob(
  path: string,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  const makeHeaders = (): Record<string, string> => {
    const token = tokens.getAccess();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  let res = await fetch(`${API_BASE}${path}`, { headers: makeHeaders() });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, { headers: makeHeaders() });
    } else {
      tokens.clear();
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
      throw new ApiError(401, { detail: "Su sesión ha expirado. Por favor inicie sesión de nuevo." });
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errData);
  }

  const blob = await res.blob();
  const filename = extractFilename(res, fallbackFilename);
  return { blob, filename };
}

/**
 * Exporta todas las PQRS (filtradas opcionalmente) en formato CSV.
 * Requiere rol ADMIN.
 *
 * @param filters - Filtros opcionales de estado, tipo, prioridad y fechas.
 * @returns `{ blob, filename }` — usa `URL.createObjectURL` para forzar la descarga.
 */
export async function apiExportCSV(filters?: ExportFilters) {
  const qs = buildExportParams(filters);
  return apiFetchBlob(`/api/pqrs/exportar_csv/${qs}`, "pqrs_export.csv");
}

/**
 * Exporta todas las PQRS (filtradas opcionalmente) en formato Excel (.xlsx).
 * Requiere rol ADMIN.
 *
 * @param filters - Filtros opcionales de estado, tipo, prioridad y fechas.
 * @returns `{ blob, filename }` — usa `URL.createObjectURL` para forzar la descarga.
 */
export async function apiExportExcel(filters?: ExportFilters) {
  const qs = buildExportParams(filters);
  return apiFetchBlob(`/api/pqrs/exportar_excel/${qs}`, "pqrs_export.xlsx");
}

/**
 * Exporta las PQRS del área propia (filtradas opcionalmente) en formato CSV.
 * Accesible para encargados de dependencia activos (DependencyManager) y admins.
 * Los admins pueden filtrar adicionalmente por `dependency_id`.
 *
 * @param filters - Filtros opcionales de estado, tipo, prioridad, fechas y dependency_id.
 * @returns `{ blob, filename }` — usa `URL.createObjectURL` para forzar la descarga.
 */
export async function apiExportCSVArea(filters?: ExportFilters) {
  const qs = buildExportParams(filters);
  return apiFetchBlob(`/api/pqrs/exportar_csv_area/${qs}`, "pqrs_area_export.csv");
}

/**
 * Exporta las PQRS del área propia (filtradas opcionalmente) en formato Excel (.xlsx).
 * Accesible para encargados de dependencia activos (DependencyManager) y admins.
 * Los admins pueden filtrar adicionalmente por `dependency_id`.
 *
 * @param filters - Filtros opcionales de estado, tipo, prioridad, fechas y dependency_id.
 * @returns `{ blob, filename }` — usa `URL.createObjectURL` para forzar la descarga.
 */
export async function apiExportExcelArea(filters?: ExportFilters) {
  const qs = buildExportParams(filters);
  return apiFetchBlob(`/api/pqrs/exportar_excel_area/${qs}`, "pqrs_area_export.xlsx");
}

// ────────────────────────────────────────────
//  CONTACTOS INSTITUCIONALES
// ────────────────────────────────────────────

/**
 * Datos de un contacto institucional.
 * GET público; mutaciones solo admin.
 */
export interface Contact {
  id: string;
  nombre: string;
  cargo: string;
  /** UUID de la dependencia a la que pertenece. */
  dependencia: string;
  /** Nombre de la dependencia (puede devolverlo el backend como valor de lectura). */
  dependencia_nombre?: string;
  correo: string;
  /** Teléfono de contacto (opcional). */
  telefono?: string;
}

/** Payload para crear o actualizar un contacto. */
export interface ContactPayload {
  nombre: string;
  cargo: string;
  /** UUID de la dependencia. */
  dependencia: string;
  correo: string;
  /** Teléfono de contacto (opcional). */
  telefono?: string;
}

/**
 * Lista todos los contactos institucionales. Acceso público.
 */
export async function apiListContacts() {
  return apiFetch<PaginatedResponse<Contact> | Contact[]>(
    "/api/pqrs/contacts/",
    {},
    false,
  );
}

/**
 * Obtiene el detalle de un contacto institucional. Acceso público.
 *
 * @param id - UUID del contacto.
 */
export async function apiGetContact(id: string) {
  return apiFetch<Contact>(`/api/pqrs/contacts/${id}/`, {}, false);
}

/**
 * Crea un nuevo contacto institucional. Solo admin.
 *
 * @param payload - Datos del contacto.
 */
export async function apiCreateContact(payload: ContactPayload) {
  return apiFetch<Contact>("/api/pqrs/contacts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Actualiza parcialmente un contacto institucional. Solo admin.
 *
 * @param id      - UUID del contacto.
 * @param payload - Campos a actualizar.
 */
export async function apiUpdateContact(id: string, payload: Partial<ContactPayload>) {
  return apiFetch<Contact>(`/api/pqrs/contacts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Elimina un contacto institucional. Solo admin.
 *
 * @param id - UUID del contacto a eliminar.
 */
export async function apiDeleteContact(id: string) {
  return apiFetch<void>(`/api/pqrs/contacts/${id}/`, { method: "DELETE" });
}

// ────────────────────────────────────────────
//  HERO IMAGES – IMÁGENES DEL LANDING
// ────────────────────────────────────────────

/** Imagen del hero de la landing page. */
export interface HeroImage {
  id: number;
  image: string;
  alt_text: string;
  order: number;
  is_active: boolean;
}

/** Lista las imágenes del hero activas. Acceso público. */
export async function apiListHeroImages() {
  return apiFetch<HeroImage[]>("/api/pqrs/hero-images/", {}, false);
}

/** Lista TODAS las imágenes del hero (activas e inactivas). Solo admin. */
export async function apiAdminListHeroImages() {
  return apiFetch<HeroImage[]>("/api/pqrs/hero-images/?all=1");
}

/**
 * Crea una nueva imagen del hero. Solo admin.
 * Usa FormData porque incluye un archivo binario.
 */
export async function apiCreateHeroImage(formData: FormData) {
  const access = tokens.getAccess();
  const headers: Record<string, string> = {};
  if (access) headers["Authorization"] = `Bearer ${access}`;
  const res = await fetch(`${API_BASE}/api/pqrs/hero-images/`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json() as Promise<HeroImage>;
}

/**
 * Actualiza parcialmente una imagen del hero. Solo admin.
 * Soporta FormData (para reemplazar la imagen) o JSON (solo metadatos).
 */
export async function apiUpdateHeroImage(id: number, payload: FormData | Partial<Omit<HeroImage, "id" | "image">>) {
  if (payload instanceof FormData) {
    const access = tokens.getAccess();
    const headers: Record<string, string> = {};
    if (access) headers["Authorization"] = `Bearer ${access}`;
    const res = await fetch(`${API_BASE}/api/pqrs/hero-images/${id}/`, {
      method: "PATCH",
      headers,
      body: payload,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    return res.json() as Promise<HeroImage>;
  }
  return apiFetch<HeroImage>(`/api/pqrs/hero-images/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Elimina una imagen del hero. Solo admin. */
export async function apiDeleteHeroImage(id: number) {
  return apiFetch<void>(`/api/pqrs/hero-images/${id}/`, { method: "DELETE" });
}

// ────────────────────────────────────────────
//  MANUAL DE USUARIO – VIDEOS INSTRUCTIVOS Y PDFs
// ────────────────────────────────────────────

/** Recurso del manual de usuario público (video instructivo o PDF). */
export interface ManualResource {
  id: number;
  resource_type: "VIDEO" | "PDF";
  title: string;
  description: string;
  file: string | null;
  external_url: string;
  order: number;
  is_active: boolean;
  created_at: string;
}

/** Lista los recursos del manual activos. Acceso público. */
export async function apiListManualResources() {
  return apiFetch<ManualResource[]>("/api/pqrs/manual-resources/", {}, false);
}

/** Lista TODOS los recursos del manual (activos e inactivos). Solo admin. */
export async function apiAdminListManualResources() {
  return apiFetch<ManualResource[]>("/api/pqrs/manual-resources/?all=1");
}

/**
 * Crea un nuevo recurso del manual. Solo admin.
 * Usa FormData porque puede incluir un archivo binario (video o PDF).
 */
export async function apiCreateManualResource(formData: FormData) {
  const doUpload = async () => {
    const access = tokens.getAccess();
    const headers: Record<string, string> = {};
    if (access) headers["Authorization"] = `Bearer ${access}`;
    return fetch(`${API_BASE}/api/pqrs/manual-resources/`, {
      method: "POST",
      headers,
      body: formData,
    });
  };
  let res = await doUpload();
  // El access token dura poco (15 min); si expiró mientras se armaba el archivo,
  // se refresca una vez y se reintenta (misma lógica de apiFetch).
  if (res.status === 401 && (await tryRefresh())) {
    res = await doUpload();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json() as Promise<ManualResource>;
}

/**
 * Actualiza parcialmente un recurso del manual. Solo admin.
 * Soporta FormData (para reemplazar el archivo) o JSON (solo metadatos).
 */
export async function apiUpdateManualResource(id: number, payload: FormData | Partial<Omit<ManualResource, "id" | "file">>) {
  if (payload instanceof FormData) {
    const doUpload = async () => {
      const access = tokens.getAccess();
      const headers: Record<string, string> = {};
      if (access) headers["Authorization"] = `Bearer ${access}`;
      return fetch(`${API_BASE}/api/pqrs/manual-resources/${id}/`, {
        method: "PATCH",
        headers,
        body: payload,
      });
    };
    let res = await doUpload();
    if (res.status === 401 && (await tryRefresh())) {
      res = await doUpload();
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    return res.json() as Promise<ManualResource>;
  }
  return apiFetch<ManualResource>(`/api/pqrs/manual-resources/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Elimina un recurso del manual. Solo admin. */
export async function apiDeleteManualResource(id: number) {
  return apiFetch<void>(`/api/pqrs/manual-resources/${id}/`, { method: "DELETE" });
}

// ────────────────────────────────────────────
//  GEO – DEPARTAMENTOS Y MUNICIPIOS
// ────────────────────────────────────────────

/** Departamento colombiano devuelto por el endpoint de geo. */
export interface Departamento {
  codigo: string;
  nombre: string;
}

/** Municipio colombiano devuelto por el endpoint de geo. */
export interface Municipio {
  codigo: string;
  nombre: string;
  departamento: number;
  departamento_nombre: string;
}

/**
 * Lista todos los departamentos de Colombia.
 * Endpoint público — no requiere autenticación.
 */
export async function apiGetDepartamentos(): Promise<Departamento[]> {
  return apiFetch<Departamento[]>("/api/pqrs/geo/departamentos/", {}, false);
}

/**
 * Lista municipios, opcionalmente filtrados por departamento y/o búsqueda.
 * Endpoint público — no requiere autenticación.
 *
 * @param params.departamento - Código del departamento (ej. "08").
 * @param params.search       - Término de búsqueda por nombre (ej. "barranquilla").
 */
export async function apiGetMunicipios(params?: {
  departamento?: string;
  search?: string;
}): Promise<Municipio[]> {
  const qs = new URLSearchParams();
  if (params?.departamento) qs.set("departamento", params.departamento);
  if (params?.search)       qs.set("search",       params.search);
  const q = qs.toString();
  return apiFetch<Municipio[]>(`/api/pqrs/geo/municipios/${q ? `?${q}` : ""}`, {}, false);
}


// ────────────────────────────────────────────
//  SOLICITUDES DE CERTIFICADOS (MESA DE AYUDA)
// ────────────────────────────────────────────

/** Recurso asociado a un tema de ayuda. */
export interface HelpTopicResource {
  id: string;
  name: string;
  file: string | null;
  url: string;
  order: number;
}

/** Tema de ayuda (ej. "Solicitudes de certificados"). */
export interface HelpTopicAPI {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  order: number;
  resources: HelpTopicResource[];
}

/** Tipos de certificado disponibles. */
export type CertificateType = "CONSTANCIA" | "NOTAS" | "CONTENIDOS" | "OTRO";

/** Estados de una solicitud de certificado. */
export type CertificateStatus = "PEN" | "REV" | "APR" | "REC" | "ENT";

/** Solicitud de certificado en vista de lista. */
export interface CertificateRequestListAPI {
  id: string;
  numero_solicitud: string;
  certificate_type: CertificateType;
  certificate_type_display: string;
  status: CertificateStatus;
  status_display: string;
  nombres: string;
  apellidos: string;
  solicitante: string;
  correo_personal: string;
  programa_academico: string;
  created_at: string;
  updated_at: string;
}

/** Adjunto de solicitud de certificado. */
export interface CertificateAttachmentAPI {
  id: string;
  attachment_type: string;
  file: string;
  filename: string;
  uploaded_by: string | null;
  created_at: string;
}

/** Tipo de respuesta sobre una solicitud de certificado. */
export type CertificateResponseType = "INSTRUCCION" | "RESPUESTA" | "INTERNA";

/** Respuesta / indicación sobre una solicitud de certificado. */
export interface CertificateResponseAPI {
  id: string;
  response_type: CertificateResponseType;
  response_type_display: string;
  content: string;
  author: string | null;
  author_name: string;
  attachments: CertificateAttachmentAPI[];
  created_at: string;
}

/** Solicitud de certificado en vista de detalle. */
export interface CertificateRequestDetailAPI extends CertificateRequestListAPI {
  topic: string | null;
  topic_info: HelpTopicAPI | null;
  celular: string;
  correo_institucional: string;
  observaciones: string;
  notas_internas: string;
  respuesta: string;
  registered_user: string | null;
  attachments: CertificateAttachmentAPI[];
  responses: CertificateResponseAPI[];
  assigned_dependencies: string[];
  assigned_dependencies_detail: { id: string; name: string; code: string }[];
  assigned_by: string | null;
  resolved_at: string | null;
}

/** Payload para crear una solicitud de certificado. */
export interface CreateCertificatePayload {
  topic?: string;
  certificate_type: CertificateType;
  nombres: string;
  apellidos: string;
  correo_personal: string;
  celular: string;
  correo_institucional?: string;
  programa_academico: string;
  observaciones?: string;
}

/** Respuesta tras crear una solicitud de certificado. */
export interface CreateCertificateResponse {
  id: string;
  mensaje: string;
  numero_solicitud: string;
  estado: string;
}

/** Respuesta de consulta pública de solicitud de certificado. */
export interface ConsultaCertificadoResponse {
  numero_solicitud: string;
  estado: string;
  tipo_certificado: string;
  programa_academico: string;
  respuesta: string | null;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
}

export interface DiplomaTemplateAPI {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  body_template: string;
  footer_text: string;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
  signer_primary_name: string;
  signer_primary_role: string;
  signer_primary_image: string | null;
  signer_secondary_name: string;
  signer_secondary_role: string;
  signer_secondary_image: string | null;
  logo_image: string | null;
  background_image: string | null;
  signers: Array<{
    id: string;
    name: string;
    role: string;
    signature_image: string;
    order: number;
  }>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiplomaBatchListAPI {
  id: string;
  template: string;
  template_name: string;
  original_filename: string;
  status: string;
  status_display: string;
  send_email: boolean;
  issue_date: string;
  total_records: number;
  generated_records: number;
  emailed_records: number;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  processed_at: string | null;
}

export interface DiplomaBatchDetailAPI extends DiplomaBatchListAPI {
  source_file: string;
  output_zip: string | null;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
  signer_primary_name: string;
  signer_primary_role: string;
  signer_secondary_name: string;
  signer_secondary_role: string;
  error_log: string;
}

export interface CreateDiplomaBatchPayload {
  template: string;
  issue_date: string;
  send_email: boolean;
  issuer_name?: string;
  issuer_title?: string;
  organization_name?: string;
  signer_primary_name?: string;
  signer_primary_role?: string;
  signer_secondary_name?: string;
  signer_secondary_role?: string;
  source_file: File;
}

export interface CreateSingleDiplomaPayload {
  template: string;
  full_name: string;
  document_number: string;
  city: string;
  email?: string;
  issue_date?: string;
  send_email?: boolean;
  issuer_name?: string;
  issuer_title?: string;
  organization_name?: string;
}

export interface IssuedDiplomaAPI {
  id: string;
  template: string;
  template_name: string;
  verification_code: string;
  document_number: string;
  full_name: string;
  city: string;
  email: string;
  issue_date: string;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
  pdf_file: string;
  pdf_filename: string;
  status: string;
  issued_by: string | null;
  issued_by_name: string;
  generated_at: string;
  emailed_at: string | null;
}

export interface CreateSingleDiplomaResponse {
  batch: DiplomaBatchDetailAPI;
  diploma: IssuedDiplomaAPI | null;
}

/**
 * Obtiene la lista de temas de ayuda activos (público).
 */
export async function apiGetHelpTopics(): Promise<HelpTopicAPI[]> {
  return apiFetch<HelpTopicAPI[]>("/api/pqrs/help-topics/", {}, false);
}

/**
 * Obtiene el detalle de un tema de ayuda por slug (público).
 */
export async function apiGetHelpTopic(slug: string): Promise<HelpTopicAPI> {
  return apiFetch<HelpTopicAPI>(`/api/pqrs/help-topics/${slug}/`, {}, false);
}

/**
 * Crea una nueva solicitud de certificado (público).
 * Envía como multipart/form-data para incluir los adjuntos.
 */
export async function apiCreateCertificateRequest(
  payload: CreateCertificatePayload,
  adjuntosIdentidad: File[],
  authenticated: boolean,
): Promise<CreateCertificateResponse> {
  const formData = new FormData();
  if (payload.topic) formData.append("topic", payload.topic);
  formData.append("certificate_type", payload.certificate_type);
  formData.append("nombres", payload.nombres);
  formData.append("apellidos", payload.apellidos);
  formData.append("correo_personal", payload.correo_personal);
  formData.append("celular", payload.celular);
  if (payload.correo_institucional) formData.append("correo_institucional", payload.correo_institucional);
  formData.append("programa_academico", payload.programa_academico);
  if (payload.observaciones) formData.append("observaciones", payload.observaciones);
  for (const file of adjuntosIdentidad) {
    formData.append("adjuntos_identidad", file);
  }

  return apiFetch<CreateCertificateResponse>(
    "/api/pqrs/certificates/",
    { method: "POST", body: formData },
    authenticated,
  );
}

/**
 * Lista solicitudes de certificado (autenticado: admin ve todas, usuario las suyas).
 */
export async function apiListCertificateRequests(params?: {
  status?: CertificateStatus;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<CertificateRequestListAPI>> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<CertificateRequestListAPI>>(`/api/pqrs/certificates/lista/${qs}`);
}

/**
 * Obtiene el detalle de una solicitud de certificado.
 */
export async function apiGetCertificateRequest(id: string): Promise<CertificateRequestDetailAPI> {
  return apiFetch<CertificateRequestDetailAPI>(`/api/pqrs/certificates/${id}/`);
}

/**
 * Cambia estado / añade notas / respuesta a una solicitud (solo staff).
 */
export async function apiUpdateCertificateStatus(
  id: string,
  payload: { status?: CertificateStatus; notas_internas?: string; respuesta?: string },
): Promise<CertificateRequestDetailAPI> {
  return apiFetch<CertificateRequestDetailAPI>(`/api/pqrs/certificates/${id}/estado/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Consulta pública de una solicitud de certificado por número + correo.
 */
export async function apiConsultarCertificado(
  numero_solicitud: string,
  correo: string,
): Promise<ConsultaCertificadoResponse> {
  return apiFetch<ConsultaCertificadoResponse>(
    "/api/pqrs/certificates/consultar/",
    {
      method: "POST",
      body: JSON.stringify({ numero_solicitud, correo }),
    },
    false,
  );
}

/**
 * Lista las respuestas/indicaciones de una solicitud de certificado.
 */
export async function apiListCertificateResponses(
  certId: string,
): Promise<CertificateResponseAPI[]> {
  return apiFetch<CertificateResponseAPI[]>(
    `/api/pqrs/certificates/${certId}/responses/`,
  );
}

/**
 * Crea una respuesta/indicación en una solicitud de certificado (staff).
 * Soporta archivos adjuntos vía multipart/form-data.
 */
export async function apiCreateCertificateResponse(
  certId: string,
  payload: { response_type: CertificateResponseType; content: string },
  adjuntos?: File[],
): Promise<CertificateResponseAPI> {
  const formData = new FormData();
  formData.append("response_type", payload.response_type);
  formData.append("content", payload.content);
  if (adjuntos) {
    for (const f of adjuntos) {
      formData.append("adjuntos", f);
    }
  }
  return apiFetch<CertificateResponseAPI>(
    `/api/pqrs/certificates/${certId}/responses/create/`,
    { method: "POST", body: formData },
  );
}

/**
 * Asigna una solicitud de certificado a una o más áreas/dependencias (staff).
 */
export async function apiAssignCertificate(
  certId: string,
  dependencies: string[],
  notes = '',
): Promise<CertificateRequestDetailAPI> {
  return apiFetch<CertificateRequestDetailAPI>(
    `/api/pqrs/certificates/${certId}/assign/`,
    {
      method: "POST",
      body: JSON.stringify({ dependencies, notes }),
    },
  );
}

export async function apiListDiplomaTemplates(params?: { page?: number; page_size?: number }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<PaginatedResponse<DiplomaTemplateAPI>>(`/api/pqrs/diplomas/templates/${qs}`);
}

export async function apiCreateDiplomaTemplate(formData: FormData) {
  return apiFetch<DiplomaTemplateAPI>("/api/pqrs/diplomas/templates/", {
    method: "POST",
    body: formData,
  });
}

export async function apiListDiplomaBatches() {
  return apiFetch<DiplomaBatchListAPI[]>("/api/pqrs/diplomas/batches/");
}

export async function apiCreateDiplomaBatch(payload: CreateDiplomaBatchPayload) {
  const formData = new FormData();
  formData.append("template", payload.template);
  formData.append("issue_date", payload.issue_date);
  formData.append("send_email", payload.send_email ? "true" : "false");
  formData.append("source_file", payload.source_file);
  if (payload.issuer_name) formData.append("issuer_name", payload.issuer_name);
  if (payload.issuer_title) formData.append("issuer_title", payload.issuer_title);
  if (payload.organization_name) formData.append("organization_name", payload.organization_name);
  if (payload.signer_primary_name) formData.append("signer_primary_name", payload.signer_primary_name);
  if (payload.signer_primary_role) formData.append("signer_primary_role", payload.signer_primary_role);
  if (payload.signer_secondary_name) formData.append("signer_secondary_name", payload.signer_secondary_name);
  if (payload.signer_secondary_role) formData.append("signer_secondary_role", payload.signer_secondary_role);
  return apiFetch<DiplomaBatchDetailAPI>("/api/pqrs/diplomas/batches/", {
    method: "POST",
    body: formData,
  });
}

export async function apiDownloadDiplomaBatch(batchId: string) {
  return apiFetchBlob(`/api/pqrs/diplomas/batches/${batchId}/download/`, `diplomas_${batchId}.zip`);
}

export async function apiDownloadIssuedDiplomaPdf(diplomaId: string) {
  return apiFetchBlob(`/api/pqrs/diplomas/${diplomaId}/pdf/`, `diploma_${diplomaId}.pdf`);
}

export async function apiCreateSingleDiploma(payload: CreateSingleDiplomaPayload) {
  return apiFetch<CreateSingleDiplomaResponse>("/api/pqrs/diplomas/issue-one/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiSendDiplomaEmail(diplomaId: string) {
  return apiFetch<IssuedDiplomaAPI>(`/api/pqrs/diplomas/${diplomaId}/send-email/`, {
    method: "POST",
  });
}

// ────────────────────────────────────────────
//  CHATBOT IA (Gemini)
// ────────────────────────────────────────────

export type ChatSection = "info" | "documentos" | "comunicados" | "atencion";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatBotResponse {
  reply: string;
}

export interface WhatsAppBulkRecipient {
  phone: string;
  name?: string;
}

export interface WhatsAppBulkSendPayload {
  message_template: string;
  recipients: WhatsAppBulkRecipient[];
  fallback_name?: string;
  phone_number_id?: string;
  /** "auto" | "meta" | "twilio" — default "auto" */
  provider?: string;
}

export interface WhatsAppBulkSendResult {
  phone?: string;
  name?: string;
  status: "sent" | "failed" | "invalid" | "skipped";
  error?: string;
}

export interface WhatsAppBulkSendResponse {
  provider?: "meta" | "twilio";
  summary: {
    total: number;
    sent: number;
    failed: number;
    invalid: number;
  };
  results: WhatsAppBulkSendResult[];
}

export interface CampusStudentPhonesPayload {
  government_ids: string[];
  emails?: string[];
  academic_year?: string;
  academic_term?: string;
  academic_session?: string;
  min_average?: number;
}

export interface CampusSubjectSchedule {
  dia?: string;
  hora_inicio?: string;
  hora_fin?: string;
  aula?: string;
}

export interface CampusSubjectTeacher {
  codigo_docente?: string;
  nombre_docente?: string;
  email_docente?: string;
}

export interface CampusSubjectRow {
  codigo_asignatura: string;
  nombre_asignatura: string;
  creditos?: number | null;
  grupo_seccion?: string;
  anio_academico?: string;
  periodo_academico?: string;
  sesion_academica?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  jornada?: string;
  estado_materia?: string;
  horarios?: CampusSubjectSchedule[];
  docente?: CampusSubjectTeacher;
}

export interface CampusStudentProgram {
  codigo?: string;
  nombre?: string;
  facultad?: string;
}

export interface CampusStudentPhoneRow {
  rn?: number;
  codigo: string;
  codigo_estudiante?: string;
  cedula: string;
  nombre_completo: string;
  telefono: string;
  email_institucional?: string;
  anio_renovacion?: string;
  periodo_renovacion?: string;
  sesion_renovacion?: string;
  programa_academico?: CampusStudentProgram;
  semestre?: string;
  semestre_actual?: string;
  estado_matricula?: string;
  promedio_periodo_anterior?: number | null;
  promedio_general_carrera?: number | null;
  cumple_promedio?: boolean | null;
  cumple_permanencia?: boolean | null;
  detalle_permanencia?: string;
  recibo_generado?: boolean | null;
  creditos_matriculados?: number | null;
  creditos_plan?: number | null;
  cumple_creditos?: boolean | null;
  valor_matricula?: number | null;
  valor_renovar?: number | null;
  valor_asume_estudiante?: number | null;
  renovacion_exitosa?: boolean | null;
  asignaturas_matriculadas?: CampusSubjectRow[];
  total_asignaturas_matriculadas?: number;
}

export interface CampusStudentPhonesResponse {
  summary: {
    requested: number;
    found: number;
    missing: number;
    renewal_ready?: number;
  };
  results: CampusStudentPhoneRow[];
  unresolved_emails?: string[];
}

export interface ChatBotConfigAPI {
  nombre_institucion: string;
  direccion: string;
  telefono: string;
  correo_pqrs: string;
  sitio_web: string;
  horario_atencion: string;
  informacion_adicional: string;
  documento: string | null;
  documento_url: string | null;
  documento_texto_extraido: string;
  knowledge_documents: ChatBotKnowledgeDocumentAPI[];
  web_sources: ChatBotWebSourceAPI[];
  activo: boolean;
  inventario_notify_email?: string;
  updated_at: string;
}

export interface ChatBotKnowledgeDocumentAPI {
  id: number;
  title: string;
  file_name: string;
  documento_url: string | null;
  texto_extraido: string;
  estado: "pendiente" | "procesando" | "listo" | "error";
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatBotWebSourceAPI {
  id: number;
  url: string;
  title: string;
  texto_extraido: string;
  activo: boolean;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function apiGetChatBotConfig(): Promise<ChatBotConfigAPI> {
  return apiFetch<ChatBotConfigAPI>("/api/pqrs/chatbot-config/");
}

export async function apiUpdateChatBotConfig(payload: FormData): Promise<ChatBotConfigAPI> {
  return apiFetch<ChatBotConfigAPI>(
    "/api/pqrs/chatbot-config/",
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function apiUploadChatBotDocuments(files: File[]): Promise<ChatBotKnowledgeDocumentAPI[]> {
  const form = new FormData();
  for (const file of files) form.append('documents', file);
  return apiFetch<ChatBotKnowledgeDocumentAPI[]>(
    "/api/pqrs/chatbot-config/documents/",
    {
      method: "POST",
      body: form,
    },
  );
}

export interface TicketEmailConfigAPI {
  enabled: boolean;
  imap_host: string;
  imap_port: number;
  use_ssl: boolean;
  imap_user: string;
  has_password: boolean;
  inbox_folder: string;
  processed_folder: string;
  max_batch: number;
  default_dependency: string | null;
  default_dependency_name: string | null;
  updated_at: string;
}

export async function apiGetTicketEmailConfig(): Promise<TicketEmailConfigAPI> {
  return apiFetch<TicketEmailConfigAPI>("/api/pqrs/ticket-email-config/");
}

export async function apiUpdateTicketEmailConfig(
  payload: Partial<TicketEmailConfigAPI> & { imap_password?: string },
): Promise<TicketEmailConfigAPI> {
  return apiFetch<TicketEmailConfigAPI>(
    "/api/pqrs/ticket-email-config/",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export interface SmtpConfigAPI {
  enabled: boolean;
  host: string;
  port: number;
  use_tls: boolean;
  use_ssl: boolean;
  username: string;
  has_password: boolean;
  default_from_email: string;
  sistema_nombre: string;
  updated_at: string;
}

export async function apiGetSmtpConfig(): Promise<SmtpConfigAPI> {
  return apiFetch<SmtpConfigAPI>("/api/pqrs/smtp-config/");
}

export async function apiUpdateSmtpConfig(
  payload: Partial<SmtpConfigAPI> & { password?: string },
): Promise<SmtpConfigAPI> {
  return apiFetch<SmtpConfigAPI>(
    "/api/pqrs/smtp-config/",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

// ────────────────────────────────────────────
//  CONTRASEÑA DE ELIMINACIÓN DE TICKETS
// ────────────────────────────────────────────

export interface TicketDeleteConfigAPI {
  has_password: boolean;
  updated_at: string;
}

export async function apiGetTicketDeleteConfig(): Promise<TicketDeleteConfigAPI> {
  return apiFetch<TicketDeleteConfigAPI>("/api/pqrs/ticket-delete-config/");
}

export async function apiSetTicketDeletePassword(password: string): Promise<TicketDeleteConfigAPI> {
  return apiFetch<TicketDeleteConfigAPI>(
    "/api/pqrs/ticket-delete-config/",
    {
      method: "PATCH",
      body: JSON.stringify({ password }),
    },
  );
}

/** Elimina definitivamente un ticket interno, previa validación de la contraseña de eliminación. */
export async function apiDeleteInternalTicket(ticketId: string, password: string): Promise<{ mensaje: string }> {
  return apiFetch<{ mensaje: string }>(
    `/api/pqrs/tickets/${ticketId}/eliminar/`,
    {
      method: "DELETE",
      body: JSON.stringify({ password }),
    },
  );
}

export async function apiListChatBotDocuments(): Promise<ChatBotKnowledgeDocumentAPI[]> {
  return apiFetch<ChatBotKnowledgeDocumentAPI[]>("/api/pqrs/chatbot-config/documents/");
}

export async function apiDeleteChatBotDocument(id: number): Promise<void> {
  return apiFetch<void>(
    `/api/pqrs/chatbot-config/documents/${id}/`,
    { method: 'DELETE' },
  );
}

export async function apiCreateChatBotWebSource(data: { url: string; title?: string; activo?: boolean }): Promise<ChatBotWebSourceAPI> {
  return apiFetch<ChatBotWebSourceAPI>(
    "/api/pqrs/chatbot-config/web-sources/",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function apiUpdateChatBotWebSource(id: number, data: Partial<ChatBotWebSourceAPI>): Promise<ChatBotWebSourceAPI> {
  return apiFetch<ChatBotWebSourceAPI>(
    `/api/pqrs/chatbot-config/web-sources/${id}/`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export async function apiDeleteChatBotWebSource(id: number): Promise<void> {
  return apiFetch<void>(
    `/api/pqrs/chatbot-config/web-sources/${id}/`,
    { method: 'DELETE' },
  );
}

export async function apiRefetchChatBotWebSource(id: number): Promise<ChatBotWebSourceAPI> {
  return apiFetch<ChatBotWebSourceAPI>(
    `/api/pqrs/chatbot-config/web-sources/${id}/refetch/`,
    { method: 'POST' },
  );
}

/**
 * Envía un mensaje al chatbot IA vía el backend (proxy a Google Gemini).
 * Endpoint público — no requiere autenticación.
 *
 * @param message - Texto del usuario (máx. 1000 caracteres).
 * @param section - Sección activa del chatbot.
 * @param history - Últimos mensajes de la conversación para contexto.
 */
export async function apiChatBot(
  message: string,
  section: ChatSection,
  history: ChatMessage[] = [],
): Promise<ChatBotResponse> {
  return apiFetch<ChatBotResponse>(
    "/api/pqrs/chatbot/",
    {
      method: "POST",
      body: JSON.stringify({ message, section, history }),
    },
    false,
  );
}

/**
 * Envía mensajes masivos por WhatsApp Cloud API.
 * Endpoint protegido para administradores.
 */
export async function apiSendWhatsAppBulkMessage(
  payload: WhatsAppBulkSendPayload,
): Promise<WhatsAppBulkSendResponse> {
  return apiFetch<WhatsAppBulkSendResponse>(
    "/api/pqrs/chatbot/whatsapp/bulk-send/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Consulta teléfonos de estudiantes en Campus SQL Server por lista de cédulas.
 * Endpoint protegido: requiere JWT + permisos de Campus.
 */
export async function apiCampusStudentPhones(
  payload: CampusStudentPhonesPayload,
): Promise<CampusStudentPhonesResponse> {
  return apiFetch<CampusStudentPhonesResponse>(
    "/api/pqrs/campus/students/phones/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INVENTARIO DE ÁREA
// ═══════════════════════════════════════════════════════════════════════════

// ── Tipos ────────────────────────────────────────────────────────────────────

export type LicenseStatus = "VIGENTE" | "POR_VENCER" | "VENCIDA";
export type AssetCondicion = "BUENO" | "REGULAR" | "MALO" | "EN_REPARACION";
export type ProblemEstado = "ABIERTO" | "EN_REVISION" | "RESUELTO";
export type ItemTipo = "software" | "material";

export interface SoftwareLicenseAPI {
  id: string;
  dependency: string;
  nombre: string;
  proveedor: string;
  tipo: string;
  puestos: number;
  fecha_vencimiento: string | null;
  notas: string;
  status: LicenseStatus;
  dias_hasta_vencimiento: number | null;
  created_by: number | null;
  created_by_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysicalAssetImageAPI {
  id: string;
  asset: string;
  image_url: string | null;
  caption: string;
  uploaded_by: number | null;
  uploaded_by_nombre: string | null;
  created_at: string;
}

export interface PhysicalAssetAPI {
  id: string;
  dependency: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  condicion: AssetCondicion;
  condicion_display: string;
  numero_serie: string;
  descripcion: string;
  images: PhysicalAssetImageAPI[];
  /** Cantidad de entradas de bitácora del activo (calculado por el backend). */
  log_entries_count?: number;
  created_by: number | null;
  created_by_nombre: string | null;
  created_at: string;
  updated_at: string;
}

/** Tipos de evento posibles en la bitácora de un activo físico. */
export type AssetLogType =
  | "MANTENIMIENTO"
  | "REPARACION"
  | "TRASLADO"
  | "CAMBIO_ESTADO"
  | "ADQUISICION"
  | "BAJA"
  | "OTRO";

/** Etiquetas en español para cada tipo de entrada de bitácora. */
export const ASSET_LOG_TYPE_LABEL: Record<AssetLogType, string> = {
  MANTENIMIENTO: "Mantenimiento",
  REPARACION:    "Reparación",
  TRASLADO:      "Traslado / Cambio de oficina",
  CAMBIO_ESTADO: "Cambio de condición",
  ADQUISICION:   "Adquisición / Alta",
  BAJA:          "Baja / Retiro",
  OTRO:          "Otro",
};

export interface PhysicalAssetLogEntryAPI {
  id: string;
  asset: string;
  entry_type: AssetLogType;
  entry_type_display: string;
  titulo: string;
  descripcion: string;
  ubicacion_anterior: string;
  ubicacion_nueva: string;
  occurred_at: string;
  created_by: number | null;
  created_by_nombre: string | null;
  created_at: string;
}

/** Vista pública de un activo físico (devuelta al escanear el QR). */
export interface PhysicalAssetPublicAPI {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  condicion: AssetCondicion;
  condicion_display: string;
  numero_serie: string;
  descripcion: string;
  dependency: string | null;
  dependency_nombre: string | null;
  created_at: string;
  updated_at: string;
  images: PhysicalAssetImageAPI[];
  log_entries: PhysicalAssetLogEntryAPI[];
}

export interface InventoryProblemAPI {
  id: string;
  dependency: string;
  item_tipo: ItemTipo;
  item_tipo_display: string;
  item_nombre: string;
  software_license: string | null;
  physical_asset: string | null;
  descripcion: string;
  estado: ProblemEstado;
  estado_display: string;
  reported_by: number | null;
  reported_by_nombre: string | null;
  resolved_by: number | null;
  resolved_by_nombre: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventorySummaryAPI {
  licencias_vencidas: number;
  licencias_por_vencer: number;
  problemas_abiertos: number;
}

// ── Licencias de Software ────────────────────────────────────────────────────

export async function apiListSoftwareLicenses(depId?: string): Promise<SoftwareLicenseAPI[]> {
  const q = depId ? `?dependency_id=${depId}` : "";
  return apiFetch<SoftwareLicenseAPI[]>(`/api/pqrs/inventory/licenses/${q}`);
}

export async function apiCreateSoftwareLicense(
  data: Omit<SoftwareLicenseAPI, "id" | "status" | "dias_hasta_vencimiento" | "created_by" | "created_by_nombre" | "created_at" | "updated_at">,
): Promise<SoftwareLicenseAPI> {
  return apiFetch<SoftwareLicenseAPI>(
    "/api/pqrs/inventory/licenses/",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function apiUpdateSoftwareLicense(
  id: string,
  data: Partial<SoftwareLicenseAPI>,
): Promise<SoftwareLicenseAPI> {
  return apiFetch<SoftwareLicenseAPI>(
    `/api/pqrs/inventory/licenses/${id}/`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export async function apiDeleteSoftwareLicense(id: string): Promise<void> {
  return apiFetch<void>(`/api/pqrs/inventory/licenses/${id}/`, { method: "DELETE" });
}

// ── Activos Físicos ──────────────────────────────────────────────────────────

export async function apiListPhysicalAssets(depId?: string): Promise<PhysicalAssetAPI[]> {
  const q = depId ? `?dependency_id=${depId}` : "";
  return apiFetch<PhysicalAssetAPI[]>(`/api/pqrs/inventory/assets/${q}`);
}

export async function apiCreatePhysicalAsset(
  data: Omit<PhysicalAssetAPI, "id" | "condicion_display" | "images" | "log_entries_count" | "created_by" | "created_by_nombre" | "created_at" | "updated_at">,
): Promise<PhysicalAssetAPI> {
  return apiFetch<PhysicalAssetAPI>(
    "/api/pqrs/inventory/assets/",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function apiUpdatePhysicalAsset(
  id: string,
  data: Partial<PhysicalAssetAPI>,
): Promise<PhysicalAssetAPI> {
  return apiFetch<PhysicalAssetAPI>(
    `/api/pqrs/inventory/assets/${id}/`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export async function apiDeletePhysicalAsset(id: string): Promise<void> {
  return apiFetch<void>(`/api/pqrs/inventory/assets/${id}/`, { method: "DELETE" });
}

// ── Imágenes de Activos Físicos ─────────────────────────────────────────────

export async function apiListAssetImages(assetId: string): Promise<PhysicalAssetImageAPI[]> {
  return apiFetch<PhysicalAssetImageAPI[]>(`/api/pqrs/inventory/assets/${assetId}/images/`);
}

export async function apiUploadAssetImage(
  assetId: string,
  file: File,
  caption = "",
): Promise<PhysicalAssetImageAPI> {
  const fd = new FormData();
  fd.append("image", file);
  if (caption) fd.append("caption", caption);
  return apiFetch<PhysicalAssetImageAPI>(
    `/api/pqrs/inventory/assets/${assetId}/images/`,
    { method: "POST", body: fd },
  );
}

export async function apiDeleteAssetImage(imageId: string): Promise<void> {
  return apiFetch<void>(
    `/api/pqrs/inventory/assets/images/${imageId}/`,
    { method: "DELETE" },
  );
}

/**
 * Obtiene el código QR del activo (PNG) como Blob URL listo para <img src>.
 * El consumidor debe llamar a URL.revokeObjectURL() cuando ya no lo necesite.
 *
 * Envía el header `Origin` natural del navegador para que el backend pueda
 * codificar la URL del frontend correcta (incluso si FRONTEND_URL no está
 * configurada en el servidor).
 */
export async function apiFetchAssetQRBlobUrl(assetId: string): Promise<{ url: string; targetUrl: string | null }> {
  const token = tokens.getAccess();
  // Pasamos el origen actual como query param ?front= para que el backend
  // tenga un fallback robusto en caso de que algunos proxies eliminen el
  // header Origin/Referer.
  const front = encodeURIComponent(window.location.origin);
  const res = await fetch(
    `${API_BASE}/api/pqrs/inventory/assets/${assetId}/qr/?front=${front}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    throw new ApiError(res.status, { detail: `Error al obtener QR (${res.status})` });
  }
  const targetUrl = res.headers.get("X-QR-Url");
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), targetUrl };
}

// ── Bitácora del activo físico ──────────────────────────────────────────────

export async function apiListAssetLogs(assetId: string): Promise<PhysicalAssetLogEntryAPI[]> {
  return apiFetch<PhysicalAssetLogEntryAPI[]>(`/api/pqrs/inventory/assets/${assetId}/logs/`);
}

export interface CreateAssetLogPayload {
  entry_type: AssetLogType;
  titulo: string;
  descripcion?: string;
  ubicacion_anterior?: string;
  ubicacion_nueva?: string;
  /** Fecha del evento en ISO 8601. Si se omite, el backend usa la hora actual. */
  occurred_at?: string;
}

export async function apiCreateAssetLog(
  assetId: string,
  payload: CreateAssetLogPayload,
): Promise<PhysicalAssetLogEntryAPI> {
  return apiFetch<PhysicalAssetLogEntryAPI>(
    `/api/pqrs/inventory/assets/${assetId}/logs/`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function apiDeleteAssetLog(entryId: string): Promise<void> {
  return apiFetch<void>(
    `/api/pqrs/inventory/assets/logs/${entryId}/`,
    { method: "DELETE" },
  );
}

/**
 * Vista pública de un activo (sin autenticación) — destino del QR.
 * No envía Bearer token para soportar escaneos desde dispositivos sin sesión.
 */
export async function apiGetAssetPublic(assetId: string): Promise<PhysicalAssetPublicAPI> {
  return apiFetch<PhysicalAssetPublicAPI>(
    `/api/pqrs/inventory/public/assets/${assetId}/`,
    {},
    false,
  );
}

// ── Problemas de Inventario ──────────────────────────────────────────────────

export async function apiListInventoryProblems(params?: {
  depId?: string;
  estado?: ProblemEstado;
  item_tipo?: ItemTipo;
}): Promise<InventoryProblemAPI[]> {
  const sp = new URLSearchParams();
  if (params?.depId)     sp.set("dependency_id", params.depId);
  if (params?.estado)    sp.set("estado", params.estado);
  if (params?.item_tipo) sp.set("item_tipo", params.item_tipo);
  const q = sp.toString() ? `?${sp.toString()}` : "";
  return apiFetch<InventoryProblemAPI[]>(`/api/pqrs/inventory/problems/${q}`);
}

export async function apiCreateInventoryProblem(
  data: Omit<InventoryProblemAPI, "id" | "item_tipo_display" | "estado_display" | "reported_by" | "reported_by_nombre" | "resolved_by" | "resolved_by_nombre" | "resolved_at" | "created_at" | "updated_at">,
): Promise<InventoryProblemAPI> {
  return apiFetch<InventoryProblemAPI>(
    "/api/pqrs/inventory/problems/",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function apiUpdateInventoryProblemEstado(
  id: string,
  estado: ProblemEstado,
): Promise<InventoryProblemAPI> {
  return apiFetch<InventoryProblemAPI>(
    `/api/pqrs/inventory/problems/${id}/estado/`,
    { method: "PATCH", body: JSON.stringify({ estado }) },
  );
}

export async function apiDeleteInventoryProblem(id: string): Promise<void> {
  return apiFetch<void>(`/api/pqrs/inventory/problems/${id}/`, { method: "DELETE" });
}

// ── Notas de Problema ────────────────────────────────────────────────────────

export interface InventoryProblemNoteAPI {
  id: string;
  problem: string;
  texto: string;
  created_by: number | null;
  created_by_nombre: string | null;
  created_at: string;
}

export async function apiListProblemNotes(problemId: string): Promise<InventoryProblemNoteAPI[]> {
  return apiFetch<InventoryProblemNoteAPI[]>(`/api/pqrs/inventory/problems/${problemId}/notes/`);
}

export async function apiCreateProblemNote(problemId: string, texto: string): Promise<InventoryProblemNoteAPI> {
  return apiFetch<InventoryProblemNoteAPI>(
    `/api/pqrs/inventory/problems/${problemId}/notes/`,
    { method: "POST", body: JSON.stringify({ texto }) },
  );
}

// ── Resumen de alertas ───────────────────────────────────────────────────────

export async function apiInventorySummary(depId?: string): Promise<InventorySummaryAPI> {
  const q = depId ? `?dependency_id=${depId}` : "";
  return apiFetch<InventorySummaryAPI>(`/api/pqrs/inventory/summary/${q}`);
}

// ────────────────────────────────────────────
//  SSO QUIZ
// ────────────────────────────────────────────
export interface QuizSSOResponse {
  token: string;
  rol: "docente" | "estudiante";
}

/**
 * Solicita un token SSO de corta duración (120s) para autenticar al usuario
 * actual en ElectroQuiz sin necesidad de login adicional.
 * `GET /api/users/quiz-sso/`
 */
export async function apiQuizSSO(): Promise<QuizSSOResponse> {
  return apiFetch<QuizSSOResponse>("/api/users/quiz-sso/");
}

// ────────────────────────────────────────────
//  SSO UNIDOC
// ────────────────────────────────────────────
export interface UniDocSSOResponse {
  token: string;
  expires_in: number;
  role_id: 1 | 2 | 3 | 4;
  unidoc_role:
    | "admin"
    | "talento_humano"
    | "vicerrectoria"
    | "rectoria"
    | "coordinacion"
    | "administrativo"
    | "docente"
    | "aspirante";
}

/**
 * Solicita un token SSO de corta duración para autenticar al usuario
 * actual en UniDoc sin exigir login adicional.
 * `GET /api/users/unidoc-sso/`
 */
export async function apiUniDocSSO(): Promise<UniDocSSOResponse> {
  return apiFetch<UniDocSSOResponse>("/api/users/unidoc-sso/");
}
