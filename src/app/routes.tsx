import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/layout/Layout";
import { Home } from "./pages/Home";
import { NovaLanding } from "./pages/NovaLanding";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ConsultaRadicado } from "./pages/pqrs/ConsultaRadicado";
import { UserDashboard } from "./pages/pqrs/UserDashboard";
import { AdminDashboard } from "./pages/pqrs/AdminDashboard";
import { AreaDashboard } from "./pages/tickets/AreaDashboard";
import { CampusStudentLookup } from "./pages/tickets/CampusStudentLookup";
import { GestionAreas } from "./pages/admin/GestionAreas";
import { GestionRoles } from "./pages/admin/GestionRoles";
import { GestionElecciones } from "./pages/admin/GestionElecciones";
import { GestionSLA } from "./pages/admin/GestionSLA";
import { GestionContactos } from "./pages/admin/GestionContactos";
import { GestionChatbot } from "./pages/admin/GestionChatbot";
import { GestionCorreoTickets } from "./pages/admin/GestionCorreoTickets";
import { GestionCorreoSaliente } from "./pages/admin/GestionCorreoSaliente";
import { GestionHeroImages } from "./pages/admin/GestionHeroImages";
import { GestionManual } from "./pages/admin/GestionManual";
import { GestionWhatsAppMasivo } from "./pages/admin/GestionWhatsAppMasivo";
import { Contactos } from "./pages/Contactos";
import { Perfil } from "./pages/Perfil";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { NotFound } from "./pages/NotFound";
import { PoliticaTratamientoDatos } from "./pages/PoliticaTratamientoDatos";
import { PoliticaPQRS } from "./pages/PoliticaPQRS";
import { Manual } from "./pages/Manual";
import { SolicitudCertificados } from "./pages/certificates/SolicitudCertificados";
import { ConsultaCertificado } from "./pages/certificates/ConsultaCertificado";
import { AdminCertificados } from "./pages/certificates/AdminCertificados";
import { AdminDiplomas } from "./pages/diplomas/AdminDiplomas";
import { RadicarPresencial } from "./pages/pqrs/RadicarPresencial";
import { InventarioActivoPublico } from "./pages/inventario/InventarioActivoPublico";
import { TIDashboard } from "./pages/inventario/ti/TIDashboard";
import { EquiposComputoList } from "./pages/inventario/ti/EquiposComputoList";
import { EquiposAVList } from "./pages/inventario/ti/EquiposAVList";
import { ServidoresList } from "./pages/inventario/ti/ServidoresList";
import { RackList } from "./pages/inventario/ti/RackList";
import { ExtencionesPBXList } from "./pages/inventario/ti/ExtencionesPBXList";
import { TelefonosList } from "./pages/inventario/ti/TelefonosList";
import { SoftwareMatrizPage } from "./pages/inventario/ti/SoftwareMatriz";
import { SeleccionRol } from "./pages/SeleccionRol";
import { GestionSolicitudesRol } from "./pages/admin/GestionSolicitudesRol";
import { QuizCentral } from "./pages/integrations/QuizCentral";
import { ConvocatoriasCentral } from "./pages/integrations/ConvocatoriasCentral";
import { EleccionesPanel } from "./components/elecciones/EleccionesPanel";
import { ArchivoCentralArea } from "./pages/archivo-central/ArchivoCentralArea";
// import { TIInventarioAreas } from "./pages/inventario/TIInventarioAreas";

// ── Spinner compartido ────────────────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

// ── Guardia de rutas protegidas ───────────────────────────────────────────────
/**
 * Componente guardia que protege rutas según autenticación y rol.
 *
 * Usa el contexto `useAuth()` en lugar de leer localStorage directamente,
 * lo que garantiza que la decisión de acceso se toma con el estado de sesión
 * más actualizado (incluyendo la revalidación en background del perfil).
 *
 * Comportamiento:
 *  1. Mientras `loading=true` (revalidando token), muestra un spinner.
 *  2. Sin sesión activa → redirige a `/login`.
 *  3. `adminOnly=true` y el rol no es "admin" → redirige a la home del rol actual.
 *  4. `areaOnly=true` y el rol no es "area"   → redirige a la home del rol actual.
 *  5. Pasa todas las validaciones → renderiza `children`.
 */
function ProtectedRoute({
  children,
  adminOnly = false,
  areaOnly  = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  areaOnly?:  boolean;
}) {
  const { usuario, loading } = useAuth();

  // Aguardar mientras AuthContext verifica/refresca la sesión
  if (loading) return <AuthSpinner />;

  // Sin sesión activa → login
  if (!usuario) return <Navigate to="/login" replace />;

  // Ruta exclusiva para admin.
  // Se comprueba tanto rol como is_staff para resistir condiciones de carrera
  // donde el background refresh pudo haber llegado con datos inconsistentes.
  const esAdmin = usuario.rol === "admin" || usuario.is_staff;
  if (adminOnly && !esAdmin) {
    return <Navigate to={usuario.rol === "area" ? "/area" : "/dashboard"} replace />;
  }

  // Ruta exclusiva para área — también redirige si el usuario es admin (por rol o is_staff)
  if (areaOnly && (usuario.rol !== "area" || esAdmin)) {
    return <Navigate to={esAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}

function hasDiplomaAccess(user: { rol?: string; is_staff?: boolean; roles?: string[] } | null) {
  if (!user) return false;
  const roleCodes = (user.roles ?? []).map((role) => String(role).trim().toUpperCase());
  return !!user.is_staff || user.rol === "admin" || roleCodes.includes("ADMIN") || roleCodes.includes("COORDINATOR") || roleCodes.includes("COORDINACION");
}

function DiplomaRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!hasDiplomaAccess(usuario)) {
    return <Navigate to={usuario.rol === "area" ? "/area" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

// ── Guardia inteligente para /dashboard ──────────────────────────────────────
/**
 * Redirige automáticamente a la vista correcta según el rol:
 *  - admin → /admin
 *  - área  → /area
 *  - usuario → muestra UserDashboard normalmente
 * Evita que un admin quede "atrapado" en el panel de usuario.
 */

// ── Guardia para rutas TI ─────────────────────────────────────────────────────
/**
 * Protege rutas del módulo de Inventario TI.
 * Solo pueden acceder usuarios con is_staff = true o rol TI_STAFF.
 */
function TIRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;
  const tiAccess = usuario.is_staff || (usuario.roles ?? []).includes("TI_STAFF");
  if (!tiAccess) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── Guardia para /elecciones (acceso independiente del panel) ────────────────
/**
 * Permite abrir el módulo de Elecciones fuera del panel de usuario, para
 * usuarios que aterrizan en el panel de área (admin_area / is_area_leader)
 * pero además tienen el rol REGISTRO_CONTROL, igual que se maneja TI_STAFF.
 */
function EleccionesRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login?redirect=/elecciones" replace />;
  const perfilHabilitado = ["estudiante", "docente", "admin_area"].includes(usuario.perfil_tipo ?? "");
  const acceso = usuario.is_staff || usuario.dependencyId || (usuario.roles ?? []).includes("REGISTRO_CONTROL") || (usuario.roles ?? []).includes("ADMIN") || perfilHabilitado;
  if (!acceso) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── Guardia para el módulo Archivo Central (SGD) ─────────────────────────────
/**
 * Acceso al módulo superior Archivo Central. Por el momento solo expone
 * Comunicaciones, pero aquí se centralizarán documentos, transferencias,
 * historias académicas e histórico. Permite admin, funcionarios de área y
 * perfiles institucionales vinculados al SGD.
 */
function ArchivoCentralRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login?redirect=/archivo-central" replace />;

  // Archivo Central es un módulo del Panel de Área de NOVA: solo entra el rol "area".
  // Qué puede hacer cada persona dentro lo decide el backend según su perfil del SGD.
  if (usuario.rol !== "area") {
    return <Navigate to={usuario.rol === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

function DashboardGuard() {
  const { usuario, loading } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;
  // Comprueba rol Y is_staff para resistir condiciones de carrera del background refresh
  if (usuario.rol === "admin" || usuario.is_staff) return <Navigate to="/admin" replace />;
  if (usuario.rol === "area")  return <Navigate to="/area"  replace />;
  return <UserDashboard />;
}

// ── Guardia para /docente ─────────────────────────────────────────────────────
/**
 * URL de acceso directo para docentes (ej. nova.uniautonoma.edu.co/docente).
 * Si no hay sesión activa, redirige a login preservando el destino original
 * (?redirect=/docente) para volver aquí automáticamente tras autenticarse.
 */
function DocenteGuard() {
  const { usuario, loading } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login?redirect=/docente" replace />;
  if (usuario.rol === "admin" || usuario.is_staff) return <Navigate to="/admin" replace />;
  if (usuario.rol === "area")  return <Navigate to="/area"  replace />;
  return <UserDashboard />;
}

function WhatsAppBulkGuard() {
  const { usuario, loading } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;

  const hasAdminPrivileges = usuario.rol === "admin" || usuario.is_staff;
  const isAdministrativeArea =
    usuario.perfil_tipo === "admin_area" ||
    !!usuario.is_area_leader ||
    !!usuario.can_handle_pqrs ||
    !!usuario.can_consume_campus_api;

  if (!hasAdminPrivileges && !isAdministrativeArea) {
    return <Navigate to={usuario.rol === "area" ? "/area" : "/dashboard"} replace />;
  }

  return <GestionWhatsAppMasivo />;
}

function CampusLookupGuard() {
  const { usuario, loading } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;

  const isAllowed =
    usuario.rol === "admin" ||
    usuario.is_staff ||
    (usuario.roles ?? []).includes("ADMIN") ||
    !!usuario.can_consume_campus_api;

  if (!isAllowed) {
    return <Navigate to={usuario.rol === "area" ? "/area" : "/dashboard"} replace />;
  }

  return <CampusStudentLookup />;
}


// Archivo Central · app del celular (PWA, RF-AC-022). Fuera del Layout: pantalla completa en el celular.
const AppMovil = lazy(() => import("./pages/archivo-central/movil/AppMovil"));

export const router = createBrowserRouter([
  {
    path: "/movil",
    element: <Suspense fallback={<AuthSpinner />}><AppMovil /></Suspense>,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: NovaLanding,
      },
      {
        path: "pqrs",
        Component: Home,
      },
      {
        path: "login",
        Component: Login,
      },
      {
        path: "registro",
        Component: Register,
      },
      {
        path: "forgot-password",
        Component: ForgotPassword,
      },
      {
        path: "reset-password",
        Component: ResetPassword,
      },
      {
        path: "politica-datos",
        Component: PoliticaTratamientoDatos,
      },
      {
        path: "politica-pqrs",
        Component: PoliticaPQRS,
      },
      {
        path: "manual",
        Component: Manual,
      },
      {
        path: "crear-pqrs",
        element: <Navigate to="/pqrs" replace />,
      },
      {
        path: "consulta",
        Component: ConsultaRadicado,
      },
      {
        path: "solicitud-certificados",
        Component: SolicitudCertificados,
      },
      {
        path: "consulta-certificado",
        Component: ConsultaCertificado,
      },
      {
        path: "quiz",
        Component: QuizCentral,
      },
      {
        path: "convocatorias",
        Component: ConvocatoriasCentral,
      },
      {
        path: "dashboard",
        element: <DashboardGuard />,
      },
      {
        path: "docente",
        element: <DocenteGuard />,
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin-certificados",
        element: (
          <ProtectedRoute adminOnly>
            <AdminCertificados />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin-diplomas",
        element: (
          <DiplomaRoute>
            <AdminDiplomas />
          </DiplomaRoute>
        ),
      },
      {
        path: "gestion-areas",
        element: (
          <ProtectedRoute adminOnly>
            <GestionAreas />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-roles",
        element: (
          <ProtectedRoute adminOnly>
            <GestionRoles />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-elecciones",
        element: (
          <ProtectedRoute adminOnly>
            <GestionElecciones />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-sla",
        element: (
          <ProtectedRoute adminOnly>
            <GestionSLA />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-contactos",
        element: (
          <ProtectedRoute adminOnly>
            <GestionContactos />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-chatbot",
        element: (
          <ProtectedRoute adminOnly>
            <GestionChatbot />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-correo-tickets",
        element: (
          <ProtectedRoute adminOnly>
            <GestionCorreoTickets />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-correo-saliente",
        element: (
          <ProtectedRoute adminOnly>
            <GestionCorreoSaliente />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-whatsapp-masivo",
        element: <WhatsAppBulkGuard />,
      },
      {
        path: "gestion-hero",
        element: (
          <ProtectedRoute adminOnly>
            <GestionHeroImages />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-manual",
        element: (
          <ProtectedRoute adminOnly>
            <GestionManual />
          </ProtectedRoute>
        ),
      },
      {
        path: "contactos",
        Component: Contactos,
      },
      {
        path: "perfil",
        element: (
          <ProtectedRoute>
            <Perfil />
          </ProtectedRoute>
        ),
      },
      {
        path: "seleccionar-rol",
        element: (
          <ProtectedRoute>
            <SeleccionRol />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion-solicitudes-rol",
        element: (
          <ProtectedRoute adminOnly>
            <GestionSolicitudesRol />
          </ProtectedRoute>
        ),
      },
      {
        path: "archivo-central",
        element: (
          <ArchivoCentralRoute>
            <ArchivoCentralArea />
          </ArchivoCentralRoute>
        ),
      },
      {
        path: "area",
        element: (
          <ProtectedRoute areaOnly>
            <AreaDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "area/radicar-presencial",
        element: (
          <ProtectedRoute areaOnly>
            <RadicarPresencial />
          </ProtectedRoute>
        ),
      },
      {
        path: "area/consulta-estudiantes",
        element: <CampusLookupGuard />,
      },
      {
        path: "inventario/activo/:id",
        Component: InventarioActivoPublico,
      },
      // ── Inventario TI (solo TI_STAFF / Admin) ─────────────────────────────
      {
        path: "inventario/ti",
        element: <TIRoute><TIDashboard /></TIRoute>,
      },
      {
        path: "elecciones",
        element: <EleccionesRoute><EleccionesPanel /></EleccionesRoute>,
      },
      {
        path: "inventario/ti/equipos",
        element: <TIRoute><EquiposComputoList /></TIRoute>,
      },
      {
        path: "inventario/ti/av",
        element: <TIRoute><EquiposAVList /></TIRoute>,
      },
      {
        path: "inventario/ti/servidores",
        element: <TIRoute><ServidoresList /></TIRoute>,
      },
      {
        path: "inventario/ti/rack",
        element: <TIRoute><RackList /></TIRoute>,
      },
      {
        path: "inventario/ti/pbx",
        element: <TIRoute><ExtencionesPBXList /></TIRoute>,
      },
      {
        path: "inventario/ti/telefonos",
        element: <TIRoute><TelefonosList /></TIRoute>,
      },
      {
        path: "inventario/ti/software",
        element: <TIRoute><SoftwareMatrizPage /></TIRoute>,
      },
      // { path: "inventario/areas", element: <TIRoute><TIInventarioAreas /></TIRoute> },
      {
        path: "*",
        Component: NotFound,
      },
    ],
  },
]);