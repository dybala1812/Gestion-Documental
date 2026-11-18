import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { STATIC_USUARIO, guardarUsuarioEstatico, leerUsuarioEstatico } from "../lib/staticUser";
import { tokens } from "../lib/api";
import { clearClassroomSession } from "../lib/classroomApi";

// ── Modelo de usuario normalizado para el frontend ──────────────────────
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

const defaultAuthContext: AuthContextType = {
  usuario: null,
  loading: false,
  isAuthenticated: false,
  isAdmin: false,
  isArea: false,
  login: async () => ({ ok: false, error: "AuthProvider no disponible" }),
  loginWithGoogle: async () => ({ ok: false, error: "AuthProvider no disponible" }),
  logout: () => {},
  refreshPerfil: async () => {},
};

declare global { var __PQRS_AUTH_CONTEXT__: React.Context<AuthContextType> | undefined; }
const AuthContext: React.Context<AuthContextType> =
  globalThis.__PQRS_AUTH_CONTEXT__ ??
  (globalThis.__PQRS_AUTH_CONTEXT__ = createContext<AuthContextType>(defaultAuthContext));

/**
 * Proveedor de autenticación simplificado para pruebas.
 *
 * No hay login real: siempre expone el usuario estático definido en
 * lib/staticUser.ts. El token estático se envía en cada petición al backend SGD.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerUsuarioEstatico() ?? STATIC_USUARIO);
  const [loading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    guardarUsuarioEstatico();
  }, []);

  // En pruebas un 401 no redirige al login; simplemente se ignora para no cortar el flujo.
  useEffect(() => {
    const handleSessionExpired = () => {
      guardarUsuarioEstatico();
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  const login = useCallback(async () => {
    guardarUsuarioEstatico();
    setUsuario(STATIC_USUARIO);
    return { ok: true as const, rol: STATIC_USUARIO.rol };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    guardarUsuarioEstatico();
    setUsuario(STATIC_USUARIO);
    return { ok: true as const, created: false, rol: STATIC_USUARIO.rol };
  }, []);

  const logout = useCallback(() => {
    tokens.clear();
    clearClassroomSession();
    // Se vuelve a setear el usuario estático para no quedar en pantalla de login.
    guardarUsuarioEstatico();
    setUsuario(STATIC_USUARIO);
    navigate("/", { replace: true });
  }, [navigate]);

  const refreshPerfil = useCallback(async () => {
    setUsuario(STATIC_USUARIO);
    guardarUsuarioEstatico();
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
        isAuthenticated: true,
        isAdmin: usuario?.rol === "admin",
        isArea: usuario?.rol === "area",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (import.meta.env.DEV && context === defaultAuthContext) {
    console.warn("[useAuth] Llamado fuera de AuthProvider — devolviendo estado de sesión cerrada.");
  }
  return context;
}
