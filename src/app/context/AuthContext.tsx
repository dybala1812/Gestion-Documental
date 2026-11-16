import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  apiLogin,
  apiGoogleLogin,
  apiGetPerfil,
  tokens,
  tryRefreshToken,
  UsuarioAPI,
  LoginResponse,
  formatApiError,
  resolveDepId,
  resolveDepName,
} from "../lib/api";
import { clearClassroomSession } from "../lib/classroomApi";
import { borrarSesionTemporal, leerSesionTemporal } from "../lib/loginTemporal"; // ⚠️ TEMPORAL

// ── Modelo de usuario normalizado para el frontend ──────────────────────
/**
 * Representación del usuario autenticado usada por todos los componentes.
 * Es una versión simplificada y enriquecida de `UsuarioAPI` del backend.
 *
 * El campo `rol` se deriva automáticamente:
 *  - `is_staff === true`       → "admin"
 *  - tiene `dependency`        → "area" (funcionario de área)
 *  - ninguno de los anteriores → "usuario" (ciudadano)
 */
export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  tipo_documento: string;
  cedula: string;
  telefono: string;
  ciudad: string;
  /** Rol derivado: controla el acceso a rutas protegidas. */
  rol: "admin" | "usuario" | "area";
  /** Códigos de roles asignados por el sistema de roles (ej. ["ADMIN"]). */
  roles?: string[];
  /** ID de la dependencia asignada (solo rol "area"). */
  dependencyId?: string;
  /** Nombre de la dependencia asignada (solo rol "area"). */
  dependencyName?: string;
  is_staff: boolean;
  /** Tipo de perfil institucional vigente del usuario. */
  perfil_tipo?: "externo" | "estudiante" | "admin_area" | "docente";
  /** True si el usuario es Líder de Área (ve y reasigna todo). */
  is_area_leader?: boolean;
  /** True si el usuario puede ver y atender PQRS de su área. */
  can_handle_pqrs?: boolean;
  /** True si el usuario puede consumir la API de Campus (telefonía estudiantil). */
  can_consume_campus_api?: boolean;
}

/**
 * Convierte el modelo `UsuarioAPI` (respuesta del backend) al modelo `Usuario`
 * utilizado por la aplicación frontend.
 *
 * La lógica de rol:
 *  1. Si `is_staff` es true → rol "admin".
 *  2. Si tiene dependencia asignada → rol "area".
 *  3. En caso contrario → rol "usuario" (ciudadano).
 *
 * @param u - Objeto UsuarioAPI del endpoint /api/users/perfil/.
 * @returns Objeto Usuario normalizado.
 */
/**
 * Construye un `Usuario` parcial directamente desde la respuesta del endpoint /api/login/.
 * Se usa cuando el backend ya devuelve datos del usuario en el login, evitando la
 * llamada adicional a /api/users/perfil/ para usuarios administradores.
 *
 * Limitación: la respuesta de login no incluye `dependency`, por lo que los usuarios
 * de área (rol "area") aún requieren `apiGetPerfil()` para obtener ese dato.
 *
 * @param d - Payload completo de la respuesta del endpoint /api/login/.
 * @returns Objeto `Usuario` normalizado (rol siempre "admin" si is_staff=true).
 */
/**
 * ⚠️ TEMPORAL — usuario de NOVA armado con la sesión del login de pruebas (/login-temporal, ver
 * lib/loginTemporal.ts). Rol "area" para entrar al módulo Archivo Central; los permisos reales los
 * decide el backend según el perfil del SGD.
 */
const NOMBRE_PERFIL: Record<string, string> = {
  archivo_central: "Archivo Central", administrador: "Administrador", dependencia: "Dependencia",
  registro_academico: "Registro Académico", secretaria_general: "Secretaría General",
};
function usuarioDeSesionTemporal(): Usuario | null {
  const s = leerSesionTemporal();
  if (!s) return null;
  const u = s.usuario;
  return {
    id: `sgd-prueba-${u.id}`,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    username: u.email,
    tipo_documento: "CC",
    cedula: "",
    telefono: "",
    ciudad: "",
    rol: "area",
    roles: [],
    dependencyId: u.dependencia_id ? String(u.dependencia_id) : undefined,
    dependencyName: u.dependencia ?? `${NOMBRE_PERFIL[u.perfil] ?? u.perfil} (prueba)`,
    is_staff: false,
    perfil_tipo: "admin_area",
    is_area_leader: false,
    can_handle_pqrs: false,
    can_consume_campus_api: false,
  };
}

/** Determina si el usuario tiene capacidades de administrador. */
function hasAdminPrivilege(is_staff: boolean, roles?: string[]): boolean {
  return is_staff || (roles?.includes("ADMIN") ?? false);
}

function mapLoginUser(d: LoginResponse): Usuario {
  const esAdmin = hasAdminPrivilege(d.is_staff, d.roles);
  const rol: Usuario["rol"] = esAdmin ? "admin" : "usuario";
  return {
    id: d.user_id,
    nombre: d.nombre,
    apellido: d.apellido ?? "",
    email: d.email,
    username: d.username,
    tipo_documento: (d.tipo_documento ?? "CC") as UsuarioAPI["tipo_documento"],
    cedula: d.cedula ?? "",
    telefono: d.telefono ?? "",
    ciudad: d.ciudad ?? "",
    rol,
    roles: d.roles,
    dependencyId: d.dependency?.id,
    dependencyName: d.dependency?.name,
    is_staff: d.is_staff,
    perfil_tipo: d.perfil_tipo,
    is_area_leader: d.is_area_leader ?? false,
    can_handle_pqrs: d.can_handle_pqrs ?? false,
    can_consume_campus_api: d.can_consume_campus_api ?? false,
  };
}

function mapApiUser(u: UsuarioAPI): Usuario {
  const is_staff = u.is_staff;
  const esAdmin = hasAdminPrivilege(is_staff, u.roles);
  const hasDep = !!u.dependency;
  const userRoleCodes = (u.roles ?? []).map(r => String(r).trim().toUpperCase());
  // Roles que NO deben ser elevados a "area" aunque tengan dependencia asignada:
  // - DOCENTE/* → van a UserDashboard con panel de planes de aula (solo visualización)
  // - VICERRECTOR/RECTOR → van a UserDashboard para aprobar planes de aula
  // - COORDINATOR/COORDINACION → van a UserDashboard para asignar/revisar planes de aula
  // REGISTRO_CONTROL con dependencia asignada SÍ se eleva a "area": el Panel de Área
  // ya tiene su propio acceso a Elecciones (badge, aviso y botón).
  const skipAreaElevation = userRoleCodes.some(r =>
    r === "DOCENTE" || r.startsWith("DOCENTE_") ||
    r === "VICERRECTOR" || r === "VICERRECTORIA" || r === "RECTOR" ||
    r === "COORDINATOR" || r === "COORDINACION" || r.includes("COORDINADOR")
  );
  const rol: Usuario["rol"] = esAdmin ? "admin" : (hasDep && !skipAreaElevation) ? "area" : "usuario";
  return {
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido ?? "",
    email: u.email,
    username: u.username,
    tipo_documento: u.tipo_documento,
    cedula: u.cedula,
    telefono: u.telefono ?? "",
    ciudad: u.ciudad ?? "",
    rol,
    roles: u.roles,
    dependencyId: resolveDepId(u.dependency),
    dependencyName: resolveDepName(u.dependency),
    is_staff,
    perfil_tipo: u.perfil_tipo,
    is_area_leader: u.is_area_leader ?? false,
    can_handle_pqrs: u.can_handle_pqrs ?? false,
    can_consume_campus_api: u.can_consume_campus_api ?? false,
  };
}

/**
 * Forma del contexto de autenticación expuesto a los componentes.
 *
 * @property usuario         - Objeto del usuario autenticado o null si no hay sesión.
 * @property loading         - true mientras se verifica/restaura la sesión inicial.
 * @property login           - Autentica al usuario; retorna { ok, error? }.
 * @property logout          - Cierra la sesión y limpia el estado.
 * @property refreshPerfil   - Recarga el perfil desde el backend (ej. tras actualizar datos).
 * @property isAuthenticated - Atajos booleano: !!usuario.
 * @property isAdmin         - true si rol === "admin".
 * @property isArea          - true si rol === "area".
 */
interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; rol?: Usuario["rol"] }>;
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string; created?: boolean; rol?: Usuario["rol"] }>;
  logout: () => void;
  refreshPerfil: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isArea: boolean;
}

/** Valor por defecto del contexto: estado de sesión cerrada.
 * Evita que `useAuth` lance durante la recuperación de errores de HMR
 * o cuando un componente se renderiza fuera del proveedor accidentalmente. */
const defaultAuthContext: AuthContextType = {
  usuario: null,
  loading: false,
  isAuthenticated: false,
  isAdmin: false,
  isArea: false,
  login:         async () => ({ ok: false, error: "AuthProvider no disponible" }),
  loginWithGoogle: async () => ({ ok: false, error: "AuthProvider no disponible" }),
  logout:        () => {},
  refreshPerfil: async () => {},
};

/**
 * Contexto React como singleton estable.
 * Al usar `globalThis` para almacenar la referencia, el mismo objeto de contexto
 * sobrevive los recargas de módulos de Vite HMR. Esto evita que `useAuth` falle
 * cuando HMR crea una nueva instancia del módulo pero el proveedor y el consumidor
 * aún no han sido re-renderizados con el mismo módulo.
 */
declare global { var __PQRS_AUTH_CONTEXT__: React.Context<AuthContextType> | undefined; }
const AuthContext: React.Context<AuthContextType> =
  globalThis.__PQRS_AUTH_CONTEXT__ ??
  (globalThis.__PQRS_AUTH_CONTEXT__ = createContext<AuthContextType>(defaultAuthContext));

/**
 * Proveedor del contexto de autenticación.
 * Debe envolver toda la aplicación (normalmente en App.tsx).
 *
 * Al montar:
 *  1. Intenta restaurar la sesión desde localStorage si hay un token y usuario guardados.
 *  2. Revalida el perfil contra el backend en segundo plano.
 *  3. Si el token es inválido o el backend rechaza la sesión, la limpia automáticamente.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ⚠️ TEMPORAL: con sesión del login de pruebas no se restaura ni valida la sesión de NOVA.
  const [sesionTemporal] = useState(() => usuarioDeSesionTemporal());
  const [usuario, setUsuario] = useState<Usuario | null>(sesionTemporal);
  const [loading, setLoading] = useState(!sesionTemporal); // bloquea el render hasta tener estado de sesión
  const navigate = useNavigate();

  // ── Escuchar evento de sesión expirada (emitido por apiFetch al recibir 401 irrecuperable) ──
  useEffect(() => {
    if (sesionTemporal) {
      console.warn("[TEMPORAL] Sesión del login de pruebas por perfil. Solo en npm run dev.");
      return; // los 401 de NOVA no cierran la sesión temporal (el SGD la valida con su propio token)
    }
    const handleSessionExpired = () => {
      setUsuario(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [navigate, sesionTemporal]);

  // ── Refresco proactivo del access token ─────────────────────────────────
  // ACCESS_TOKEN_LIFETIME es de 15 min. En lugar de esperar a que expire y
  // reaccionar a un 401 (que con múltiples pollers/pestañas simultáneas puede
  // provocar carreras de rotación de refresh token y un logout espurio),
  // renovamos el access token cada 5 min mientras haya una sesión activa.
  useEffect(() => {
    if (!usuario || sesionTemporal) return;
    const interval = setInterval(() => {
      tryRefreshToken();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [usuario, sesionTemporal]);

  // ── Restaurar sesión al montar el proveedor ────────────────────────────────
  useEffect(() => {
    if (sesionTemporal) return; // sesión temporal: no restaurar ni validar contra NOVA
    const stored = localStorage.getItem("usuario");
    const hasUser = !!stored;
    const hasAccess = !!tokens.getAccess();
    const hasRefresh = !!tokens.getRefresh();

    if (!hasUser && !hasRefresh) {
      // Sin ningún dato de sesión → estado limpio
      setLoading(false);
      return;
    }

    const restoreWithPerfil = () => {
      // Carga inmediata desde localStorage para evitar pantalla en blanco
      if (stored) {
        setUsuario(JSON.parse(stored) as Usuario);
      }
      // Validación en background: sincroniza con el backend
      apiGetPerfil()
        .then((u) => {
          const mapped = mapApiUser(u);
          const mergedIsStaff = mapped.is_staff;
          const mergedRoles = u.roles ?? mapped.roles ?? [];
          const mergedIsAdmin = hasAdminPrivilege(mergedIsStaff, mergedRoles);
          const merged: Usuario = {
            ...mapped,
            is_staff: mergedIsStaff,
            rol: mergedIsAdmin ? "admin" : mapped.rol,
            roles: mergedRoles.length > 0 ? mergedRoles : undefined,
          };
          setUsuario(merged);
          localStorage.setItem("usuario", JSON.stringify(merged));
        })
        .catch(() => {
          // Token inválido o backend rechazó: limpiar sesión
          tokens.clear();
          setUsuario(null);
        })
        .finally(() => setLoading(false));
    };

    if (hasAccess) {
      // Caso normal: sameTab con access token válido
      restoreWithPerfil();
    } else if (hasRefresh) {
      // Nueva pestaña / ventana: sessionStorage vacío pero refresh token en localStorage.
      // Intentamos renovar; puede fallar si otra pestaña rotó el token primero.
      tryRefreshToken().then((ok) => {
        if (ok) {
          restoreWithPerfil();
        } else {
          // tryRefresh falló en esta pestaña, pero otra puede haberlo completado ya.
          // tokens.getAccess() busca también en localStorage._at_shared (token compartido).
          const crossTabToken = tokens.getAccess();
          if (crossTabToken) {
            // Otra pestaña renovó el token: copiar a sessionStorage para esta pestaña
            sessionStorage.setItem("access_token", crossTabToken);
            restoreWithPerfil();
          } else {
            // Refresh irrecuperable → limpiar y pedir login
            tokens.clear();
            setLoading(false);
          }
        }
      });
    } else {
      // Hay datos de usuario pero no hay ningún token → limpiar
      tokens.clear();
      setLoading(false);
    }
  }, []);

  /**
   * Inicia sesión con email y contraseña.
   *
   * Flujo optimizado:
   *  1. Llama a `apiLogin` → obtiene tokens + datos del usuario desde el mismo endpoint.
   *  2. Si el usuario es admin (`is_staff: true`): mapea el usuario desde la respuesta
   *     del login de forma inmediata, sin llamada adicional al backend.
   *     En paralelo refresca el perfil en background para completar campos opcionales.
   *  3. Si no es admin: llama a `apiGetPerfil` para obtener la `dependency` asignada,
   *     necesaria para determinar si el rol es "area" o "usuario".
   *
   * @returns `{ ok: true }` si fue exitoso, `{ ok: false, error: string }` si hubo un error.
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      const loginData = await apiLogin(email, password); // 1. Auth + tokens + datos usuario

      const loginIsAdmin = hasAdminPrivilege(loginData.is_staff, loginData.roles);
      let loginRol: Usuario["rol"] = "usuario";

      if (loginIsAdmin) {
        // Admin: rol determinado desde el login, no necesitamos otra llamada
        const mapped = mapLoginUser(loginData);
        loginRol = mapped.rol;
        setUsuario(mapped);
        localStorage.setItem("usuario", JSON.stringify(mapped));
        // Refresco en background para rellenar campos opcionales del perfil.
        // El backend es siempre fuente de verdad en el refresco.
        apiGetPerfil()
          .then(p => {
            const full = mapApiUser(p);
            // El perfil fresco del backend es la fuente de verdad
            const freshIsStaff = full.is_staff;
            const freshRoles = p.roles ?? full.roles ?? [];
            const freshIsAdmin = hasAdminPrivilege(freshIsStaff, freshRoles);
            const merged: Usuario = {
              ...full,
              is_staff: freshIsStaff,
              rol: freshIsAdmin ? "admin" : full.rol,
              roles: freshRoles.length > 0 ? freshRoles : undefined,
            };
            setUsuario(merged);
            localStorage.setItem("usuario", JSON.stringify(merged));
          })
          .catch(() => { /* ignorar: el usuario ya está seteado */ });
      } else {
        // No-admin: necesitamos apiGetPerfil para obtener la dependencia (rol "area" vs "usuario")
        const perfil = await apiGetPerfil();
        const mapped = mapApiUser(perfil);
        loginRol = mapped.rol;
        setUsuario(mapped);
        localStorage.setItem("usuario", JSON.stringify(mapped));
      }

      return { ok: true, rol: loginRol };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  }, []);

  /**
   * Inicia sesión con Google Identity Services.
   *
   * Flujo:
   *  1. Llama a `apiGoogleLogin` con el `credential` (id_token de Google).
   *  2. Llama a `apiGetPerfil` para obtener rol y dependencia del usuario.
   *
   * @param credential - El id_token JWT del callback de Google Sign-In.
   * @returns `{ ok: true, created }` si fue exitoso, `{ ok: false, error }` si hubo un error.
   */
  const loginWithGoogle = useCallback(async (credential: string) => {
    try {
      const googleData = await apiGoogleLogin(credential);
      const perfil = await apiGetPerfil();
      const mapped = mapApiUser(perfil);
      setUsuario(mapped);
      localStorage.setItem("usuario", JSON.stringify(mapped));
      return { ok: true, created: googleData.created, rol: mapped.rol };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  }, []);

  /** Cierra la sesión: limpia el estado React y elimina todos los datos de localStorage. */
  const logout = useCallback(() => {
    setUsuario(null);
    borrarSesionTemporal(); // ⚠️ TEMPORAL
    tokens.clear(); // elimina access_token, refresh_token y usuario de localStorage
    clearClassroomSession();
  }, []);

  /**
   * Recarga el perfil del usuario desde el backend y actualiza el estado y localStorage.
   * Útil tras modificar el perfil (nombre, teléfono, dependencia, etc.).
   * Los errores se ignoran silenciosamente para no interrumpir la experiencia.
   */
  const refreshPerfil = useCallback(async () => {
    try {
      const perfil = await apiGetPerfil();
      const mapped = mapApiUser(perfil);
      setUsuario(mapped);
      localStorage.setItem("usuario", JSON.stringify(mapped));
    } catch {
      // ignore: no interrumpir al usuario si falla el refresco en background
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        loginWithGoogle,
        logout,
        refreshPerfil,
        isAuthenticated: !!usuario,
        isAdmin: usuario?.rol === "admin",
        isArea: usuario?.rol === "area",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook personalizado para consumir el contexto de autenticación.
 *
 * Lanza un error descriptivo si se usa fuera de un `AuthProvider`,
 * lo que facilita la detección temprana de errores de estructura.
 *
 * @example
 * const { usuario, login, logout, isAdmin } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (import.meta.env.DEV && context === defaultAuthContext) {
    // Solo en desarrollo: avisa si se usa fuera del proveedor (ej. durante HMR)
    // pero NO lanza para no crashear la app durante la recuperación de error.
    console.warn("[useAuth] Llamado fuera de AuthProvider — devolviendo estado de sesión cerrada.");
  }
  return context;
}