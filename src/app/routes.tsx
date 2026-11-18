import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Loader2 } from "lucide-react";
import { Layout } from "./components/layout/Layout";
import { Home } from "./pages/Home";
import { NovaLanding } from "./pages/NovaLanding";
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

// ── Guardias de rutas (modo pruebas: siempre pasan) ───────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode; adminOnly?: boolean; areaOnly?: boolean }) {
  return <>{children}</>;
}

function DiplomaRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TIRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function EleccionesRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ArchivoCentralRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DashboardGuard() {
  return <AreaDashboard />;
}

function DocenteGuard() {
  return <AreaDashboard />;
}

function WhatsAppBulkGuard() {
  return <GestionWhatsAppMasivo />;
}

function CampusLookupGuard() {
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