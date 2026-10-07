/**
 * @file UserDashboard.tsx
 * @description Panel personal del ciudadano registrado en el sistema PQRS.
 *
 * Muestra:
 *   - Saludo personalizado con el nombre del usuario autenticado.
 *   - Tarjetas de estadísticas: total, radicadas, en proceso y resueltas/cerradas.
 *   - Tabla con el historial completo de sus PQRS, ordenadas de más reciente a más antigua.
 *   - Acceso directo para radicar una nueva PQRS.
 *   - Para estudiantes: pestaña de tickets internos con formulario de creación.
 *
 * La carga de PQRS se realiza una sola vez al montar el componente (`useEffect`),
 * solicitando hasta 200 registros para evitar paginación adicional.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { User, FileText, Clock, CheckCircle2, AlertCircle, Plus, Ticket, Send, Loader2, ChevronDown, ChevronUp, UserCog, BookOpen as GraduationCap, Presentation, ExternalLink, BookOpen, Paperclip, Download, MessageSquare, Calendar, Upload, X, Vote as VoteIcon } from "lucide-react";
import {
  apiListPQRS,
  apiGetPQRS,
  apiGetResponses,
  apiDownloadAttachment,
  apiListTickets,
  apiCreateTicketInterno,
  apiUploadTicketAttachment,
  apiGetTicketActivities,
  apiGetTicketAttachments,
  apiCommentTicket,
  apiListDependencies,
  apiListCertificateRequests,
  apiGetCertificateRequest,
  apiQuizSSO,
  formatApiError,
  API_BASE,
  PQRS_STATUS_LABEL,
  PQRS_TYPE_LABEL,
  type PqrsAPI,
  type PqrsResponseAPI,
  type TicketInternoAPI,
  type TicketActivity,
  type TicketAttachment,
  type Dependency,
  type CertificateRequestListAPI,
  type CertificateRequestDetailAPI,
  type CertificateStatus,
} from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { PlanesAulaPanel } from "../../components/classroom/PlanesAulaPanel";
import { CoordinadorReviewPanel } from "../../components/classroom/CoordinadorReviewPanel";
import { CoordinadorAssignTeachersPanel } from "../../components/classroom/CoordinadorAssignTeachersPanel";
import { EleccionesPanel } from "../../components/elecciones/EleccionesPanel";

const TICKET_STATUS_LABEL: Record<string, string> = {
  ABR: "Abierto",
  PRO: "En proceso",
  RES: "Resuelto",
  CER: "Cerrado",
};

const CERT_STATUS_LABEL: Record<CertificateStatus, string> = {
  PEN: "Pendiente",
  REV: "En revisión",
  APR: "Aprobada",
  REC: "Rechazada",
  ENT: "Entregada",
};

const CERT_TYPE_LABEL: Record<string, string> = {
  CONSTANCIA: "Constancia de estudio",
  NOTAS: "Certificado de notas",
  CONTENIDOS: "Contenidos programáticos",
  OTRO: "Otro",
};

/** Construye la URL absoluta de un adjunto devuelto por el backend. */
function resolveAttachmentUrl(file: string): string {
  return file.startsWith("http") ? file : `${API_BASE}${file}`;
}

interface NuevoTicketForm {
  target_dependency: string;
  priority: "LOW" | "MED" | "HIGH";
  subject: string;
  description: string;
}

function normalizeRoleCodes(roles?: string[]): string[] {
  return (roles ?? []).map((r) => String(r).trim().toUpperCase());
}

/** Componente principal del panel de usuario (ciudadano). */
export function UserDashboard() {
  const { usuario, refreshPerfil } = useAuth();
  /** Lista de PQRS del usuario, ordenada de más reciente a más antigua */
  const [misPQRS, setMisPQRS] = useState<PqrsAPI[]>([]);
  /** true mientras se cargan las PQRS del backend */
  const [isLoading, setIsLoading] = useState(true);
  /** Lista de certificados del usuario */
  const [misCertificados, setMisCertificados] = useState<CertificateRequestListAPI[]>([]);
  /** true mientras se cargan los certificados del backend */
  const [isLoadingCerts, setIsLoadingCerts] = useState(true);
  /** Pestaña activa: "pqrs" | "tickets" | "planes" | "quiz" | "elecciones" */
  const [tab, setTab] = useState<"pqrs" | "tickets" | "planes" | "quiz" | "elecciones">("pqrs");
  /** Sub-pestaña para planes de aula: "mis-planes" | "revisar" | "asignar" */
  const [planesSubTab, setPlanesSubTab] = useState<"mis-planes" | "revisar" | "asignar">("mis-planes");

  // ── Detalle de PQRS seleccionada ────────────────────────────────────────
  const [pqrsDetalle, setPqrsDetalle] = useState<PqrsAPI | null>(null);
  const [pqrsRespuestas, setPqrsRespuestas] = useState<PqrsResponseAPI[]>([]);
  const [loadingPqrsDetalle, setLoadingPqrsDetalle] = useState(false);
  const [descargandoAdjunto, setDescargandoAdjunto] = useState<string | null>(null);

  // ── Detalle de certificado seleccionado ─────────────────────────────────
  const [certDetalle, setCertDetalle] = useState<CertificateRequestDetailAPI | null>(null);
  const [loadingCertDetalle, setLoadingCertDetalle] = useState(false);

  // ── SSO Quiz ──────────────────────────────────────────────────────────────
  /** URL final del iframe de Quiz con SSO preautenticado. null = cargando, "" = error */
  const [quizIframeSrc, setQuizIframeSrc] = useState<string | null>(null);
  const [quizSsoError, setQuizSsoError] = useState(false);

  // ── Estado exclusivo para estudiantes ──────────────────────────────
  const [misTickets, setMisTickets] = useState<TicketInternoAPI[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [showNuevoTicket, setShowNuevoTicket] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);

  // ── Detalle/hilo del ticket seleccionado ───────────────────────────
  const [ticketDetalle, setTicketDetalle] = useState<TicketInternoAPI | null>(null);
  const [ticketDetalleActivities, setTicketDetalleActivities] = useState<TicketActivity[]>([]);
  const [ticketDetalleAttachments, setTicketDetalleAttachments] = useState<TicketAttachment[]>([]);
  const [loadingTicketDetalle, setLoadingTicketDetalle] = useState(false);
  const [ticketReplyText, setTicketReplyText] = useState("");
  const [submittingTicketReply, setSubmittingTicketReply] = useState(false);

  useEffect(() => {
    const refreshOnFocus = () => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement && activeElement.type === "file") return;
      refreshPerfil();
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refreshPerfil]);

  const roleCodes = normalizeRoleCodes(usuario?.roles);
  const esDocente = roleCodes.some((code) =>
    code === "DOCENTE" ||
    code === "TEACHER" ||
    code === "FACULTY" ||
    code.startsWith("DOCENTE_")
  );
  const esCoordinador = roleCodes.some((code) =>
    code === "COORDINATOR" ||
    code.includes("COORDINADOR") ||
    code === "COORDINADOR_PQRS" ||
    code === "COORDINACION"
  );
  const esEstudiante = usuario?.perfil_tipo === "estudiante" && !esDocente && !esCoordinador;
  const esAdminArea   = usuario?.perfil_tipo === "admin_area" && !esCoordinador;
  const esRegistroControl = roleCodes.includes("REGISTRO_CONTROL");
  const tieneCorreoInstitucional = !!usuario?.email?.toLowerCase().endsWith("@uniautonoma.edu.co");
  /** True para roles que pueden crear tickets internos (estudiante, administrativo o docente) */
  const puedeCrearTickets = !esCoordinador && (esEstudiante || esAdminArea || esDocente);
  const puedeUsarPlanesAula = esDocente || esAdminArea || esCoordinador;
  const puedeUsarQuiz = false;
  /** Estudiantes, docentes y administrativos (postular/votar) y Registro y Control (avalar candidaturas); requiere correo institucional. */
  const puedeUsarElecciones = tieneCorreoInstitucional && (esEstudiante || esAdminArea || esDocente || esRegistroControl);
  const puedeVerPQRS = !esDocente && !esCoordinador;

  const { register: regTicket, handleSubmit: submitTicket, reset: resetTicket, formState: { errors: errTicket } } =
    useForm<NuevoTicketForm>({ defaultValues: { priority: "MED" } });

  // Cargar dependencias para el formulario de tickets
  useEffect(() => {
    if (!puedeCrearTickets) return;
    apiListDependencies(false, true)
      .then((res) => {
        const lista = Array.isArray(res) ? res : (res as any).results ?? [];
        setDeps(lista);
      })
      .catch(() => {});
  }, [puedeCrearTickets]);

  // Cargar tickets del usuario institucional
  const cargarTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await apiListTickets({ page_size: 200 });
      const items: TicketInternoAPI[] = Array.isArray(res) ? res : (res as any).results ?? [];
      setMisTickets(items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch {
      toast.error("Error al cargar los tickets");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    if (puedeCrearTickets && tab === "tickets") cargarTickets();
  }, [puedeCrearTickets, tab, cargarTickets]);

  const onCrearTicket = async (data: NuevoTicketForm) => {
    setSubmittingTicket(true);
    try {
      const ticket = await apiCreateTicketInterno({
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        origin_dependency: null,
        target_dependency: data.target_dependency || null,
      });
      // Los adjuntos se suben en llamadas separadas porque la creación del ticket es JSON puro.
      for (const file of ticketFiles) {
        await apiUploadTicketAttachment(ticket.id, file);
      }
      toast.success("Ticket enviado correctamente");
      resetTicket();
      setTicketFiles([]);
      setShowNuevoTicket(false);
      await cargarTickets();
    } catch (e) {
      toast.error("Error al crear el ticket", { description: formatApiError(e) });
    } finally {
      setSubmittingTicket(false);
    }
  };

  /** Abre el modal de detalle de un ticket: carga su hilo (bitácora) y adjuntos. */
  const abrirDetalleTicket = useCallback(async (ticket: TicketInternoAPI) => {
    setTicketDetalle(ticket);
    setTicketReplyText("");
    setLoadingTicketDetalle(true);
    try {
      const [activities, attachments] = await Promise.all([
        apiGetTicketActivities(ticket.id).catch(() => []),
        apiGetTicketAttachments(ticket.id).catch(() => []),
      ]);
      setTicketDetalleActivities(
        [...activities].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      );
      setTicketDetalleAttachments(attachments);
    } catch (e) {
      toast.error("No se pudo cargar el hilo del ticket", { description: formatApiError(e) });
    } finally {
      setLoadingTicketDetalle(false);
    }
  }, []);

  /** Cierra el modal de detalle del ticket y limpia su estado. */
  const cerrarDetalleTicket = () => {
    setTicketDetalle(null);
    setTicketDetalleActivities([]);
    setTicketDetalleAttachments([]);
    setTicketReplyText("");
  };

  /** Envía una respuesta/comentario al ticket abierto y recarga el hilo. */
  const enviarRespuestaTicket = async () => {
    if (!ticketDetalle || !ticketReplyText.trim()) return;
    setSubmittingTicketReply(true);
    try {
      await apiCommentTicket(ticketDetalle.id, ticketReplyText.trim());
      setTicketReplyText("");
      const activities = await apiGetTicketActivities(ticketDetalle.id);
      setTicketDetalleActivities(
        [...activities].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      );
    } catch (e) {
      toast.error("No se pudo enviar la respuesta", { description: formatApiError(e) });
    } finally {
      setSubmittingTicketReply(false);
    }
  };

  /**
   * Carga inicial de las PQRS del usuario.
   * Se solicitan hasta 200 registros (página única) y se ordenan
   * descendentemente por fecha de creación.
   * Los errores se silencian para no interrumpir la navegación.
   */
  useEffect(() => {
    if (!puedeVerPQRS) {
      setMisPQRS([]);
      setIsLoading(false);
      return;
    }

    apiListPQRS({ page_size: 200 })
      .then((res) => {
        const items: PqrsAPI[] = Array.isArray(res)
          ? (res as unknown as PqrsAPI[])
          : (res as any).results ?? [];
        setMisPQRS(
          [...items].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ),
        );
      })
      .catch(() => {}) // Error silenciado: no muestra toast para no interrumpir la navegación
      .finally(() => setIsLoading(false));
  }, [puedeVerPQRS]);

  useEffect(() => {
    if (!puedeVerPQRS && tab === "pqrs") {
      if (puedeUsarQuiz) {
        setTab("quiz");
        return;
      }
      setTab(puedeUsarPlanesAula ? "planes" : "tickets");
    }
  }, [puedeVerPQRS, puedeUsarPlanesAula, puedeUsarQuiz, tab]);

  // Obtener token SSO cuando el usuario abre la pestaña Quiz por primera vez
  useEffect(() => {
    if (tab !== "quiz" || !puedeUsarQuiz) return;
    if (quizIframeSrc !== null) return; // ya cargado o en progreso
    setQuizSsoError(false);
    apiQuizSSO()
      .then(({ token, rol }) => {
        const dest = rol === "docente" ? "/quiz-app/teacher/" : "/quiz-app/student/";
        setQuizIframeSrc(`/quiz-app/api/auth/sso?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(dest)}`);
      })
      .catch(() => {
        setQuizSsoError(true);
        setQuizIframeSrc("");
      });
  }, [tab, puedeUsarQuiz, quizIframeSrc]);

  // Carga inicial de los certificados del usuario
  useEffect(() => {
    apiListCertificateRequests({ page_size: 200 })
      .then((res) => {
        const items = res.results ?? [];
        setMisCertificados(
          [...items].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ),
        );
      })
      .catch(() => {})
      .finally(() => setIsLoadingCerts(false));
  }, []);

  /** Abre el detalle de una PQRS: carga la solicitud completa y su hilo de respuestas. */
  const abrirDetallePQRS = useCallback(async (id: string) => {
    setLoadingPqrsDetalle(true);
    setPqrsDetalle(null);
    setPqrsRespuestas([]);
    try {
      const [detalle, respuestasRes] = await Promise.all([
        apiGetPQRS(id),
        apiGetResponses(id).catch(() => ({ results: [] as PqrsResponseAPI[] })),
      ]);
      setPqrsDetalle(detalle);
      setPqrsRespuestas(respuestasRes.results ?? []);
    } catch (e) {
      toast.error("No se pudo cargar el detalle de la PQRS", { description: formatApiError(e) });
    } finally {
      setLoadingPqrsDetalle(false);
    }
  }, []);

  /** Descarga un adjunto de la PQRS abierta actualmente. */
  const descargarAdjuntoPQRS = async (attachmentId: string) => {
    if (!pqrsDetalle?.id) return;
    setDescargandoAdjunto(attachmentId);
    try {
      const { blob, filename } = await apiDownloadAttachment(pqrsDetalle.id, attachmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No fue posible descargar el adjunto", { description: formatApiError(e) });
    } finally {
      setDescargandoAdjunto(null);
    }
  };

  /** Abre el detalle de una solicitud de certificado: adjuntos + hilo de respuestas incluidos. */
  const abrirDetalleCertificado = useCallback(async (id: string) => {
    setLoadingCertDetalle(true);
    setCertDetalle(null);
    try {
      const detalle = await apiGetCertificateRequest(id);
      setCertDetalle(detalle);
    } catch (e) {
      toast.error("No se pudo cargar el detalle del certificado", { description: formatApiError(e) });
    } finally {
      setLoadingCertDetalle(false);
    }
  }, []);

  /**
   * Devuelve el componente `<Badge>` correspondiente al estado de una PQRS.
   * El mapa cubre los cuatro estados posibles del sistema:
   *   RAD = Radicado, PRO = En Proceso, RES = Resuelto, CER = Cerrado.
   */
  const getEstadoBadge = (status: string) => {
    const map: Record<string, React.ReactNode> = {
      RAD: <Badge variant="warning">Radicado</Badge>,
      PRO: <Badge>En Proceso</Badge>,
      RES: <Badge variant="success">Resuelto</Badge>,
      CER: <Badge variant="secondary">Cerrado</Badge>,
    };
    return map[status] || <Badge>{status}</Badge>;
  };

  /**
   * Agrega las PQRS en cuatro contadores para las tarjetas de estadísticas:
   * - `total`      : cantidad total de PQRS del usuario.
   * - `radicadas`  : PQRS con estado RAD (recén radicadas, sin gestionar).
   * - `enProceso`  : PQRS con estado PRO (asignadas y en gestión).
   * - `resueltas`  : PQRS con estado RES o CER (finalizadas).
   */
  const estadisticas = {
    total: misPQRS.length,
    radicadas: misPQRS.filter((p) => p.status === "RAD").length,
    enProceso: misPQRS.filter((p) => p.status === "PRO").length,
    resueltas: misPQRS.filter((p) => p.status === "RES" || p.status === "CER").length,
  };

  const certEstadisticas = {
    total: misCertificados.length,
    pendientes: misCertificados.filter((c) => c.status === "PEN").length,
    enRevision: misCertificados.filter((c) => c.status === "REV").length,
    entregados: misCertificados.filter((c) => c.status === "ENT" || c.status === "APR").length,
  };

  const getCertEstadoBadge = (status: CertificateStatus) => {
    const map: Record<CertificateStatus, React.ReactNode> = {
      PEN: <Badge variant="warning">Pendiente</Badge>,
      REV: <Badge>En Revisión</Badge>,
      APR: <Badge variant="success">Aprobada</Badge>,
      REC: <Badge variant="destructive">Rechazada</Badge>,
      ENT: <Badge variant="secondary">Entregada</Badge>,
    };
    return map[status] ?? <Badge>{status}</Badge>;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-2">{esCoordinador ? "Panel de Coordinación" : "Panel de Usuario"}</h1>
          <p className="text-gray-600">
            Bienvenido, {usuario?.nombre} {usuario?.apellido}
            {esEstudiante && (
              <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Estudiante
              </span>
            )}
            {esAdminArea && (
              <span className="ml-2 inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                Administrativo
              </span>
            )}
            {esDocente && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[#1e3a5f]/10 px-2 py-0.5 text-xs font-medium text-[#1e3a5f]">
                Docente
              </span>
            )}
            {esCoordinador && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[#1e3a5f]/10 px-2 py-0.5 text-xs font-medium text-[#1e3a5f]">
                Coordinador
              </span>
            )}
            {esRegistroControl && (
              <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Registro y Control Académico
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {puedeVerPQRS && (
            <Link to="/pqrs">
              <Button className="bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold">
                <Plus className="h-4 w-4 mr-1" />
                Nueva PQRS
              </Button>
            </Link>
          )}
        </div>
      </div>



      {/* Solicitud de perfil solo para externos que aún no tienen rol docente. */}
      {usuario?.perfil_tipo === "externo" && !esDocente && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <UserCog className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              {usuario?.email?.toLowerCase().endsWith("@uniautonoma.edu.co")
                ? <>Tienes un correo institucional. Puedes solicitar el perfil de <strong>Estudiante</strong> o <strong>Administrativo de Área</strong>.</>
                : <>¿Perteneces a la institución? Solicita el cambio de perfil a <strong>Estudiante</strong> o <strong>Administrativo de Área</strong>.</>
              }
            </p>
          </div>
          <Link to="/seleccionar-rol" className="shrink-0">
            <Button variant="outline" size="sm" className="border-amber-400 text-amber-700 hover:bg-amber-100">
              Cambiar perfil
            </Button>
          </Link>
        </div>
      )}



      {/* Aviso para el rol Registro y Control: dirige directo a la sección de Elecciones. */}
      {esRegistroControl && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <VoteIcon className="h-5 w-5 text-purple-600 shrink-0" />
            <p className="text-sm text-purple-800">
              Tienes el rol de <strong>Registro y Control Académico</strong>: en la pestaña{" "}
              <strong>Elecciones</strong> puedes revisar postulaciones, avalar candidaturas y generar tarjetones.
            </p>
          </div>
          <Button variant="outline" size="sm"
            className="border-purple-400 text-purple-700 hover:bg-purple-100 shrink-0"
            onClick={() => setTab("elecciones")}
          >
            Ir a Elecciones
          </Button>
        </div>
      )}

      {/* Pestañas de panel */}
      {(puedeCrearTickets || puedeUsarPlanesAula || puedeUsarQuiz || puedeUsarElecciones) && (
        <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
          {puedeVerPQRS && (
            <button
              onClick={() => setTab("pqrs")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "pqrs"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <FileText className="h-4 w-4" />
              Mis PQRS
            </button>
          )}
          {puedeCrearTickets && (
            <button
              onClick={() => setTab("tickets")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "tickets"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Ticket className="h-4 w-4" />
              Mis Tickets
            </button>
          )}
          {puedeUsarPlanesAula && (
            <button
              onClick={() => setTab("planes")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "planes"
                  ? "bg-white shadow text-[#1e3a5f]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Planes de Aula
            </button>
          )}
          {puedeUsarQuiz && (
            <button
              onClick={() => setTab("quiz")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "quiz"
                  ? "bg-white shadow text-indigo-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Presentation className="h-4 w-4" />
              Quiz
            </button>
          )}
          {puedeUsarElecciones && (
            <button
              onClick={() => setTab("elecciones")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "elecciones"
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <VoteIcon className="h-4 w-4" />
              Elecciones
            </button>
          )}
        </div>
      )}

      {/* Secciones PQRS y Certificados a lado y lado */}
      {tab === "pqrs" && puedeVerPQRS && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Columna PQRS ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#ff9800]" />
                Mis PQRS
              </CardTitle>
              <CardDescription>Historial de todas las PQRS radicadas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 text-center text-gray-500">Cargando solicitudes…</div>
              ) : misPQRS.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">No hay solicitudes registradas</h3>
                  <p className="text-sm text-gray-600 mb-6">Comience radicando su primera PQRS</p>
                  <Link to="/pqrs">
                    <Button>
                      <Plus className="h-4 w-4 mr-1" />
                      Radicar PQRS
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                  {misPQRS.map((pqrs) => (
                    <div
                      key={pqrs.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirDetallePQRS(pqrs.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") abrirDetallePQRS(pqrs.id); }}
                      className="rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-medium text-sm truncate">{pqrs.subject}</h3>
                            {getEstadoBadge(pqrs.status)}
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{pqrs.numero_radicado ?? pqrs.radicado}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0 ml-2">
                          {pqrs.pqrs_type ? (PQRS_TYPE_LABEL[pqrs.pqrs_type] ?? pqrs.pqrs_type) : 'N/A'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-700 mb-2 line-clamp-2">{pqrs.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        <span>Radicado: {formatDateTime(pqrs.created_at)}</span>
                        {pqrs.dependency && (
                          <span className="text-blue-600">Área: {pqrs.dependency.name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Columna Certificados ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                Mis Certificados
              </CardTitle>
              <CardDescription>Solicitudes de certificados académicos</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCerts ? (
                <div className="py-12 text-center text-gray-500">Cargando certificados…</div>
              ) : misCertificados.length === 0 ? (
                <div className="py-12 text-center">
                  <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">No hay certificados solicitados</h3>
                  <p className="text-sm text-gray-600 mb-6">Este módulo está deshabilitado temporalmente</p>
                  <Button variant="outline" disabled className="border-gray-300 text-gray-400 cursor-not-allowed">
                    <GraduationCap className="h-4 w-4 mr-1" />
                    Próximamente
                  </Button>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                  {misCertificados.map((cert) => (
                    <div
                      key={cert.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirDetalleCertificado(cert.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") abrirDetalleCertificado(cert.id); }}
                      className="rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">
                              {CERT_TYPE_LABEL[cert.certificate_type] ?? cert.certificate_type_display}
                            </span>
                            {getCertEstadoBadge(cert.status)}
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{cert.numero_solicitud}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{cert.programa_academico}</p>
                      <div className="text-xs text-gray-400">
                        Solicitado: {formatDateTime(cert.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sección de Tickets — para estudiantes y administrativos de área */}
      {tab === "tickets" && puedeCrearTickets && (
        <div className="space-y-4">
          {/* Botón abrir/cerrar formulario */}
          <div className="flex justify-end">
            <Button
              variant={showNuevoTicket ? "outline" : "default"}
              onClick={() => { setShowNuevoTicket(v => !v); resetTicket(); }}
              className="gap-2"
            >
              {showNuevoTicket ? (
                <><ChevronUp className="h-4 w-4" /> Cancelar</>
              ) : (
                <><Plus className="h-4 w-4" /> Nuevo Ticket</>
              )}
            </Button>
          </div>

          {/* Formulario nuevo ticket */}
          {showNuevoTicket && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4 text-indigo-600" />
                  Enviar ticket a un área
                </CardTitle>
                <CardDescription>
                  Dirije tu solicitud directamente a un área de la institución.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitTicket(onCrearTicket)} className="space-y-4">
                  {/* Área destino */}
                  <div>
                    <Label className="text-sm font-medium">Área destino *</Label>
                    <select
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      {...regTicket("target_dependency", { required: "Selecciona un área destino" })}
                    >
                      <option value="">— Seleccionar área —</option>
                      {deps.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {errTicket.target_dependency && (
                      <p className="text-red-500 text-xs mt-1">{errTicket.target_dependency.message}</p>
                    )}
                  </div>

                  {/* Prioridad */}
                  <div>
                    <Label className="text-sm font-medium">Prioridad</Label>
                    <select
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      {...regTicket("priority")}
                    >
                      <option value="LOW">Baja</option>
                      <option value="MED">Media</option>
                      <option value="HIGH">Alta</option>
                    </select>
                  </div>

                  {/* Asunto */}
                  <div>
                    <Label className="text-sm font-medium">Asunto *</Label>
                    <Input
                      className="mt-1"
                      placeholder="Describe brevemente el asunto"
                      {...regTicket("subject", {
                        required: "El asunto es obligatorio",
                        minLength: { value: 5, message: "Mínimo 5 caracteres" },
                        maxLength: { value: 200, message: "Máximo 200 caracteres" },
                      })}
                    />
                    {errTicket.subject && (
                      <p className="text-red-500 text-xs mt-1">{errTicket.subject.message}</p>
                    )}
                  </div>

                  {/* Descripción */}
                  <div>
                    <Label className="text-sm font-medium">Descripción *</Label>
                    <textarea
                      rows={4}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      placeholder="Explica con detalle tu solicitud"
                      {...regTicket("description", {
                        required: "La descripción es obligatoria",
                        minLength: { value: 10, message: "Mínimo 10 caracteres" },
                      })}
                    />
                    {errTicket.description && (
                      <p className="text-red-500 text-xs mt-1">{errTicket.description.message}</p>
                    )}
                  </div>

                  {/* Adjuntos */}
                  <div>
                    <Label className="text-sm font-medium">Adjuntos (imágenes o PDF)</Label>
                    <label className="mt-1 flex items-center justify-center gap-2 w-full border-2 border-dashed border-indigo-300 rounded-lg py-3 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                      <Upload className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm text-indigo-600 font-medium">Adjuntar archivo</span>
                      <span className="text-xs text-gray-400">(máx. 10 MB c/u)</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          const files = e.target.files ? Array.from(e.target.files) : [];
                          if (files.length) setTicketFiles((prev) => [...prev, ...files]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {ticketFiles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ticketFiles.map((file, idx) => (
                          <li
                            key={`${file.name}-${idx}`}
                            className="flex items-center justify-between gap-2 border rounded px-3 py-1.5 bg-white text-xs"
                          >
                            <span className="flex items-center gap-1.5 min-w-0 truncate text-gray-700">
                              <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTicketFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-gray-400 hover:text-red-500 shrink-0"
                              title="Quitar archivo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => { setShowNuevoTicket(false); resetTicket(); setTicketFiles([]); }}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submittingTicket} className="gap-2">
                      {submittingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar ticket
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista de tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Mis Tickets</CardTitle>
              <CardDescription>Solicitudes enviadas directamente a áreas de la institución</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTickets ? (
                <div className="py-10 text-center text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando tickets…
                </div>
              ) : misTickets.length === 0 ? (
                <div className="py-10 text-center">
                  <Ticket className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">Aún no has enviado ningún ticket</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {misTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => abrirDetalleTicket(t)}
                      className="rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{t.subject}</span>
                            <Badge
                              variant={
                                t.status === "RES" || t.status === "CER"
                                  ? "success"
                                  : t.status === "PRO"
                                  ? "default"
                                  : "warning"
                              }
                              className="text-xs"
                            >
                              {TICKET_STATUS_LABEL[t.status] ?? t.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{t.numero_ticket}</p>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2">
                          {t.priority === "HIGH" ? "Alta" : t.priority === "MED" ? "Media" : "Baja"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        <span>Enviado: {formatDateTime(t.created_at)}</span>
                        {t.target_dependency_name && (
                          <span className="text-indigo-600">Área: {t.target_dependency_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sección Planes de Aula — docentes y administrativos */}
      {tab === "planes" && puedeUsarPlanesAula && usuario && (
        <div className="space-y-4">
          {/* Sub-tabs para coordinadores y docentes */}
          {esCoordinador && (
            <div className="flex gap-2 border-b border-gray-200 pb-3">
              <button
                onClick={() => setPlanesSubTab("mis-planes")}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-all ${
                  planesSubTab === "mis-planes"
                    ? "bg-[#1e3a5f] text-white border-b-2 border-[#1e3a5f]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Mis Planes
              </button>
              <button
                onClick={() => setPlanesSubTab("asignar")}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-all ${
                  planesSubTab === "asignar"
                    ? "bg-[#1e3a5f] text-white border-b-2 border-[#1e3a5f]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Asignar Docentes
              </button>
              <button
                onClick={() => setPlanesSubTab("revisar")}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-all ${
                  planesSubTab === "revisar"
                    ? "bg-[#1e3a5f] text-white border-b-2 border-[#1e3a5f]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Revisar Planes
              </button>
            </div>
          )}

          {/* Mostrar componente según sub-tab */}
          {planesSubTab === "mis-planes" && <PlanesAulaPanel user={usuario} />}
          {planesSubTab === "asignar" && <CoordinadorAssignTeachersPanel user={usuario} />}
          {planesSubTab === "revisar" && <CoordinadorReviewPanel user={usuario} />}
        </div>
      )}

      {/* Sección Quiz — docentes */}
      {tab === "quiz" && puedeUsarQuiz && (
        <div className="space-y-4">

          <Card className="border-indigo-200">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Presentation className="h-5 w-5 text-indigo-600" />
                  ElectroQuiz Docentes
                </CardTitle>
                <CardDescription>
                  Gestiona tus quizzes y sesiones en vivo desde la vista docente integrada.
                </CardDescription>
              </div>
              <a
                href="/quiz-app/teacher/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Abrir en pestaña
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {quizSsoError ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-500">
                    <Presentation className="h-10 w-10 text-indigo-300" />
                    <p className="text-sm">No se pudo conectar con ElectroQuiz.</p>
                    <button
                      className="text-xs underline text-indigo-600 hover:text-indigo-800"
                      onClick={() => { setQuizIframeSrc(null); setQuizSsoError(false); }}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : quizIframeSrc === null ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Iniciando sesión en ElectroQuiz…</span>
                  </div>
                ) : (
                  <iframe
                    key={quizIframeSrc}
                    src={quizIframeSrc}
                    title="ElectroQuiz Docentes"
                    className="h-[calc(100vh-280px)] min-h-[680px] w-full"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "elecciones" && puedeUsarElecciones && (
        <EleccionesPanel />
      )}

      {/* ── Modal: detalle de PQRS ── */}
      <Dialog open={!!pqrsDetalle || loadingPqrsDetalle} onOpenChange={(open) => { if (!open) { setPqrsDetalle(null); setPqrsRespuestas([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {loadingPqrsDetalle && !pqrsDetalle ? (
            <div className="py-12 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando solicitud…
            </div>
          ) : pqrsDetalle ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#ff9800]" />
                  {pqrsDetalle.subject}
                </DialogTitle>
                <DialogDescription className="font-mono">
                  {pqrsDetalle.numero_radicado ?? pqrsDetalle.radicado}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  {getEstadoBadge(pqrsDetalle.status)}
                  <Badge variant="outline" className="text-xs">
                    {pqrsDetalle.type_display ?? (PQRS_TYPE_LABEL[pqrsDetalle.type ?? pqrsDetalle.pqrs_type!] ?? pqrsDetalle.type)}
                  </Badge>
                  {pqrsDetalle.dependency && (
                    <span className="text-xs text-blue-600">Área: {pqrsDetalle.dependency.name}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Descripción</p>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm whitespace-pre-wrap">{pqrsDetalle.description}</p>
                  </div>
                </div>

                {pqrsDetalle.attachments && pqrsDetalle.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-gray-900">
                        Sus adjuntos ({pqrsDetalle.attachments.length})
                      </p>
                    </div>
                    <div className="divide-y rounded-lg border border-gray-200">
                      {pqrsDetalle.attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between gap-3 p-3">
                          <p className="truncate text-sm font-medium text-gray-800">{att.filename}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={descargandoAdjunto === att.id}
                            onClick={() => descargarAdjuntoPQRS(att.id)}
                          >
                            <Download className="mr-1.5 h-4 w-4" />
                            {descargandoAdjunto === att.id ? "Descargando…" : "Descargar"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">
                      Respuesta de la institución {pqrsRespuestas.length > 0 && `(${pqrsRespuestas.length})`}
                    </p>
                  </div>
                  {pqrsRespuestas.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aún no se ha registrado una respuesta.</p>
                  ) : (
                    <div className="space-y-2">
                      {pqrsRespuestas.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-lg border p-3 ${r.response_type === "FINAL" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
                        >
                          <p className="text-xs text-gray-500 mb-1">{formatDateTime(r.created_at)}</p>
                          <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Radicado: {formatDateTime(pqrsDetalle.created_at)}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Modal: detalle/hilo de un ticket interno ── */}
      <Dialog open={!!ticketDetalle} onOpenChange={(open) => { if (!open) cerrarDetalleTicket(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {loadingTicketDetalle && !ticketDetalleActivities.length ? (
            <div className="py-12 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando ticket…
            </div>
          ) : ticketDetalle ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-indigo-600" />
                  {ticketDetalle.subject}
                </DialogTitle>
                <DialogDescription className="font-mono">
                  {ticketDetalle.numero_ticket}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={
                      ticketDetalle.status === "RES" || ticketDetalle.status === "CER"
                        ? "success"
                        : ticketDetalle.status === "PRO"
                        ? "default"
                        : "warning"
                    }
                    className="text-xs"
                  >
                    {TICKET_STATUS_LABEL[ticketDetalle.status] ?? ticketDetalle.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {ticketDetalle.priority === "HIGH" ? "Alta" : ticketDetalle.priority === "MED" ? "Media" : "Baja"}
                  </Badge>
                  {ticketDetalle.target_dependency_name && (
                    <span className="text-xs text-indigo-600">Área: {ticketDetalle.target_dependency_name}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Descripción</p>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm whitespace-pre-wrap">{ticketDetalle.description}</p>
                  </div>
                </div>

                {ticketDetalleAttachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-medium text-gray-900">
                        Adjuntos ({ticketDetalleAttachments.length})
                      </p>
                    </div>
                    <div className="divide-y rounded-lg border border-gray-200">
                      {ticketDetalleAttachments.map((att) => (
                        <a
                          key={att.id}
                          href={resolveAttachmentUrl(att.file)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50"
                        >
                          <p className="truncate text-sm font-medium text-gray-800">{att.filename}</p>
                          <Download className="h-4 w-4 text-gray-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-medium text-gray-900">
                      Hilo del ticket {ticketDetalleActivities.length > 0 && `(${ticketDetalleActivities.length})`}
                    </p>
                  </div>
                  {ticketDetalleActivities.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aún no hay actividad registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {ticketDetalleActivities.map((a) => (
                        <div key={a.id} className="rounded-lg border p-3 bg-indigo-50/40 border-indigo-100">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-medium text-gray-700">
                              {a.performed_by_nombre ?? a.performed_by_email ?? "Sistema"}
                            </p>
                            <p className="text-xs text-gray-400">{formatDateTime(a.created_at)}</p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{a.detail ?? a.description ?? a.activity_type_display ?? a.activity_type}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm font-medium">Responder</Label>
                  <textarea
                    rows={3}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    placeholder="Escribe una respuesta o comentario..."
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={!ticketReplyText.trim() || submittingTicketReply}
                      onClick={enviarRespuestaTicket}
                      className="gap-2"
                    >
                      {submittingTicketReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Modal: detalle de solicitud de certificado ── */}
      <Dialog open={!!certDetalle || loadingCertDetalle} onOpenChange={(open) => { if (!open) setCertDetalle(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {loadingCertDetalle && !certDetalle ? (
            <div className="py-12 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando solicitud…
            </div>
          ) : certDetalle ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  {CERT_TYPE_LABEL[certDetalle.certificate_type] ?? certDetalle.certificate_type_display}
                </DialogTitle>
                <DialogDescription className="font-mono">{certDetalle.numero_solicitud}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  {getCertEstadoBadge(certDetalle.status)}
                  <span className="text-xs text-gray-500">{certDetalle.programa_academico}</span>
                </div>

                {certDetalle.observaciones && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Observaciones</p>
                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-sm whitespace-pre-wrap">{certDetalle.observaciones}</p>
                    </div>
                  </div>
                )}

                {certDetalle.respuesta && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Respuesta</p>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <p className="text-sm whitespace-pre-wrap">{certDetalle.respuesta}</p>
                    </div>
                  </div>
                )}

                {certDetalle.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-gray-900">
                        Sus adjuntos ({certDetalle.attachments.length})
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {certDetalle.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={resolveAttachmentUrl(att.file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-100 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          <Download className="h-3.5 w-3.5" /> {att.filename}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">
                      Respuestas de la institución {certDetalle.responses.length > 0 && `(${certDetalle.responses.length})`}
                    </p>
                  </div>
                  {certDetalle.responses.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aún no se ha registrado una respuesta.</p>
                  ) : (
                    <div className="space-y-2">
                      {certDetalle.responses.map((r) => (
                        <div key={r.id} className="rounded-lg border bg-green-50 border-green-200 p-3">
                          <p className="text-xs text-gray-500 mb-1">
                            {r.author_name} — {formatDateTime(r.created_at)}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                          {r.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {r.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={resolveAttachmentUrl(att.file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-[11px] text-blue-600 hover:bg-blue-50"
                                >
                                  <Paperclip className="h-3 w-3" /> {att.filename}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Solicitado: {formatDateTime(certDetalle.created_at)}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
