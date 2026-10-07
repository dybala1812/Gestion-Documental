/**
 * @file AreaDashboard.tsx
 * @description Panel de gestión de PQRS asignadas a una dependencia/área institucional.
 *              Permite al funcionario de área ver, filtrar y responder las PQRS que le
 *              han sido asignadas, así como actualizar su estado.
 * @author Sistema PQRS Institucional
 * @date 2026-03-04
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker copiado a /public/ por el Dockerfile → URL estable sin hash, sin problemas de caché
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Building2, FileText, Clock, CheckCircle2, AlertCircle, X, User, Calendar, CalendarDays, ArrowLeft, Loader2, LayoutDashboard, Search, FileDown, FileSpreadsheet, ChevronDown, BarChart2, Target, RefreshCw, PlusCircle, Inbox, Send, Paperclip, Upload, Download, MessageSquare, Flag, Reply, StickyNote, CheckSquare, AlertTriangle, Globe, Printer, Activity, FilePlus, ArrowUpCircle, ShieldAlert, Check, Lock, Eye, Bell, BookOpen as GraduationCap, Package, ChevronRight, Menu, Home, HardDrive, PanelLeft, PanelRight, Database, Trash2, Mail, Phone, Vote as VoteIcon } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { generateAreaReport } from "../../lib/generateAreaReport";
import {
  apiListPQRS, apiRespondPQRS, apiUpdateEstado, apiGetPQRS, apiGetResponses,
  apiListTickets, apiGetTicketInterno, apiCreateTicketInterno, apiUpdateTicketInternoEstado,
  apiGetTicketActivities, apiGetTicketActivityFeed, apiCommentTicket, TicketActivity,
  apiUploadTicketAttachment, apiGetTicketAttachments, TicketAttachment,
  apiListTicketTasks, apiCreateTicketTask, apiUpdateTicketTask, TicketTaskAPI, TicketTaskStatus,
  apiGetEligibleAssignees, EligibleAssigneeAPI,
  apiGetTicketAssignments, apiAssignTicket, TicketAssignmentAPI,
  apiGetActivities, PQRSActivity,
  apiListDependencies,
  apiExportCSVArea, apiExportExcelArea, ExportFilters,
  apiGetAttachments, apiUploadAttachment, apiDownloadAttachment, Attachment,
  PqrsAPI, Dependency, resolveDepId,
  TicketInternoAPI, TicketInternoStatus, TICKET_STATUS_LABEL,
  PqrsPriority,
  PQRS_STATUS_LABEL, PQRS_TYPE_LABEL, PQRS_PRIORITY_LABEL, PQRS_CANAL_LABEL,
  apiDeleteInternalTicket,
  apiListAllUsers, apiAssignPQRS, UsuarioAPI,
  formatApiError
} from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { formatDateTime } from "../../lib/utils";
import { useTicketChat } from "../../lib/useTicketChat";
import { AreaCertificates } from "../certificates/AreaCertificates";
import { InventarioArea } from "../inventario/InventarioArea";

/**
 * Estructura del formulario de respuesta a una PQRS.
 *
 * @property response_text  - Contenido textual de la respuesta o nota interna.
 * @property response_type  - Tipo de respuesta:
 *   - `CITIZEN`  → Respuesta dirigida al ciudadano.
 *   - `FINAL`    → Respuesta final/cierre del caso.
 *   - `INTERNAL` → Nota interna (no visible para el ciudadano).
 * @property new_status - Nuevo estado al que se desea mover la PQRS (vacío = sin cambio).
 */
interface RespondForm {
  response_text: string;
  response_type: "CITIZEN" | "FINAL" | "INTERNAL";
  new_status: string;
}

/**
 * Estructura del formulario para crear un ticket interno entre áreas.
 * Los tickets no tienen tipo P/Q/R/S/F; son solicitudes institucionales.
 */
interface TicketForm {
  subject: string;
  description: string;
  priority: "LOW" | "MED" | "HIGH";
  target_dependency: string;
}

/** Respuesta o nota interna añadida localmente (sin backend). */
interface LocalTicketReply {
  id: string;
  ticketId: string;
  content: string;
  type: "respuesta" | "nota_interna";
  author: string;
  created_at: string;
}

/** Tarea local asociada a un ticket (sin backend). */
interface LocalTicketTask {
  id: string;
  ticketId: string;
  title: string;
  done: boolean;
}

/**
 * Componente principal del Panel de Área.
 *
 * Muestra las PQRS asignadas a la dependencia del usuario autenticado,
 * ofrece filtrado por estado y un panel lateral para gestionar (responder /
 * cambiar estado) cada PQRS seleccionada.
 *
 * Estrategia de carga de datos:
 * 1. Se consultan las PQRS cuya `dependency` coincida con la del usuario.
 * 2. En paralelo, se obtiene la lista de asignaciones activas para capturar
 *    PQRS que pueden no aparecer en el endpoint principal.
 * 3. Las PQRS faltantes se recuperan individualmente y se fusionan,
 *    eliminando duplicados.
 *
 * @returns JSX del panel de área responsivo (lista + panel de detalle/respuesta).
 */

/** Componente auxiliar que renderiza un PDF página por página usando PDF.js (canvas). */
function PdfPreview({ data }: { data: Uint8Array }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const fileObj = useMemo(() => ({ data: new Uint8Array(data) }), [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-auto" style={{ height: 'calc(90vh - 64px)' }}>
      <Document
        file={fileObj}
        onLoadSuccess={({ numPages: n }) => { setPdfError(null); setNumPages(n); }}
        onLoadError={(err) => { console.error("react-pdf load error:", err); setPdfError(String(err?.message ?? err)); }}
        loading={
          <div className="flex flex-col items-center justify-center gap-3 text-gray-400 w-full py-16">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Cargando PDF...</p>
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400 w-full">
            <FileText className="w-12 h-12" />
            <p className="text-sm">No se pudo cargar el PDF</p>
            {pdfError && <p className="text-xs text-red-400 max-w-md text-center break-all">{pdfError}</p>}
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={containerWidth - 16} />
        ))}
      </Document>
    </div>
  );
}

export function AreaDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /** Lista completa de PQRS asignadas a la dependencia del usuario. */
  const [pqrsList, setPqrsList] = useState<PqrsAPI[]>([]);

  /** PQRS actualmente seleccionada para ver detalle / responder. */
  const [selected, setSelected] = useState<PqrsAPI | null>(null);

  /** Indica si la carga inicial (o recarga) de PQRS está en curso. */
  const [loading, setLoading] = useState(true);

  /** Indica si el envío del formulario de respuesta está en curso. */
  const [submitting, setSubmitting] = useState(false);

  /** Archivos seleccionados para adjuntar a la próxima respuesta. */
  const [respondFiles, setRespondFiles] = useState<File[]>([]);

  /** Valor del filtro de estado activo (`"todos"` muestra todas). */
  const [filtroEstado, setFiltroEstado] = useState("todos");

  /** Filtro SLA: '' = todos, 'vencida', 'por_vencer', 'en_tiempo', 'sin_sla' */
  const [filtroSla, setFiltroSla] = useState("");

  // ── Modo de vista: lista de PQRS o gráficas de analytics ─────────────────
  const [viewMode, setViewMode]     = useState<"list" | "analytics">("list");
  /** Días del período para filtrar las gráficas (0 = todo el histórico). */
  const [periodDays, setPeriodDays] = useState(30);
  /** Índice del sector activo en la dona de estado. */
  const [activeEstadoIndex, setActiveEstadoIndex] = useState<number | undefined>(undefined);

  // ── Exportación de reportes por área ─────────────────────────────────────
  /** Controla la visibilidad del panel de exportación. */
  const [showExport, setShowExport] = useState(false);
  /** Formato que se está descargando actualmente, o null si no hay descarga en curso. */
  const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);
  /** Filtros opcionales aplicados al exportar. */
  const [exportFilters, setExportFilters] = useState<ExportFilters>({});

  // ── Tickets internos ─────────────────────────────────────────────────────────────────────────────
  /** Pestaña activa en la lista: PQRS ciudadanas, tickets internos, certificados o inventario. */
  const [tab, setTab] = useState<"inicio" | "pqrs" | "tickets" | "certificates" | "inventario">("inicio");

  /**
   * Permisos derivados según el perfil del usuario:
   *  - canViewPQRS: el usuario puede ver/atender PQRS de su área.
   *    Aplica a admins, líderes de área, a quienes el admin marque como "Asignable a PQRS"
   *    y a cualquier usuario con una dependencia asignada (rol "area"), para mantener
   *    compatibilidad con encargados registrados solo en DependencyManager.
   *  - isAreaLeader: el usuario es Líder del área (puede reasignar tareas).
   */
  const canViewPQRS = !!(usuario?.is_staff || usuario?.is_area_leader || usuario?.can_handle_pqrs || !!usuario?.dependencyId);
  const isAreaLeader = !!usuario?.is_area_leader;

  // Si el usuario aterriza en la pesta\u00f1a PQRS sin permisos (caso edge: cambio de rol),
  // lo redirigimos autom\u00e1ticamente a "Inicio" para no mostrar contenido vac\u00edo confuso.
  useEffect(() => {
    if (tab === "pqrs" && !canViewPQRS) setTab("inicio");
  }, [tab, canViewPQRS]);

  /** Estado de visibilidad de la barra lateral de navegación. */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Sub-pestaña dentro de Tickets Internos. */
  const [ticketSubTab, setTicketSubTab] = useState<"recibidos" | "enviados">("recibidos");
  /** Tickets internos recibidos de otras áreas (dependency = esta área). */
  const [ticketsRecibidos, setTicketsRecibidos] = useState<TicketInternoAPI[]>([]);
  /** Tickets internos enviados por esta área a otras áreas. */
  const [ticketsEnviados, setTicketsEnviados] = useState<TicketInternoAPI[]>([]);
  /** Ticket interno seleccionado para ver su detalle. */
  const [selectedTicket, setSelectedTicket] = useState<TicketInternoAPI | null>(null);

  // ── Asignación de responsables dentro del área (solo Líder de Área) ──────
  /** Usuarios que pertenecen a la misma dependencia del líder, candidatos a responsable. */
  const [areaUsers, setAreaUsers] = useState<UsuarioAPI[]>([]);
  /** IDs de usuarios seleccionados como responsables del PQRS abierto. */
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]);
  /** Indica si el envío de la asignación de responsable está en curso. */
  const [assigningResponsible, setAssigningResponsible] = useState(false);

  // ── Adjuntos del PQRS seleccionado ───────────────────────────────────────
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  /** Indica si el detalle completo (descripción) del PQRS seleccionado se está cargando. */
  const [descLoading, setDescLoading] = useState(false);
  /** Indica si la carga de tickets internos está en curso. */
  const [loadingTickets, setLoadingTickets] = useState(false);
  /** Controla la visibilidad del modal de creación de ticket interno. */
  const [showNewTicket, setShowNewTicket] = useState(false);
  /** Indica si el envío del formulario de ticket está en curso. */
  const [submittingTicket, setSubmittingTicket] = useState(false);
  /** Lista de dependencias disponibles para el selector de área destino. */
  const [deps, setDeps] = useState<Dependency[]>([]);
  /** Filtro de estado activo en la lista de tickets ("" = todos). */
  const [ticketFiltroEstado, setTicketFiltroEstado] = useState<TicketInternoStatus | "">("" );
  /** Filtro de prioridad activo en la lista de tickets ("" = todas). */
  const [ticketFiltroPrioridad, setTicketFiltroPrioridad] = useState<PqrsPriority | "">("" );
  /** Filtro de área activo en la lista de tickets ("" = todas). */
  const [ticketFiltroArea, setTicketFiltroArea] = useState<string>("");
  /** Estado seleccionado en el selector "Cambiar estado" del ticket abierto. */
  const [ticketNewStatus, setTicketNewStatus] = useState<TicketInternoStatus>("ABR");
  /** Pestaña activa en el detalle del ticket. */
  const [ticketDetailTab, setTicketDetailTab] = useState<"hilo" | "tareas" | "calendario" | "adjuntos">("hilo");
  /** En móvil: controla si el panel lateral de metadatos del ticket está visible. */
  const [ticketMobileSidebarOpen, setTicketMobileSidebarOpen] = useState(false);
  /** Colapsar el panel izquierdo de metadatos del ticket (desktop). */
  const [ticketSidebarHidden, setTicketSidebarHidden] = useState(false);
  /** Colapsar el área de respuesta inferior del ticket (desktop). */
  const [ticketReplyHidden, setTicketReplyHidden] = useState(false);
  /** Mes/año mostrado en la pestaña de calendario (YYYY-MM). */
  const [calendarMonth, setCalendarMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  /** Día seleccionado en el calendario (YYYY-MM-DD) o null. */
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  /** Modo del campo de respuesta: respuesta pública o nota interna. */
  const [ticketReplyMode, setTicketReplyMode] = useState<"respuesta" | "nota_interna">("respuesta");
  /** Texto del campo de respuesta en el panel de ticket. */
  const [ticketReplyText, setTicketReplyText] = useState("");
  /** Indica si el envío de un comentario/respuesta al backend está en curso. */
  const [submittingReply, setSubmittingReply] = useState(false);
  /** Adjuntos ya subidos al ticket (cargados del backend). */
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  /** Adjunto que se está previsualizando en el modal (null = cerrado). */
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null);
  /** Blob URL generada autenticada para el archivo que se previsualiza. */
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  /** Raw bytes del PDF para react-pdf (evita problemas de blob URL). */
  const [previewPdfData, setPreviewPdfData] = useState<Uint8Array | null>(null);
  /** Indica si el blob del archivo está cargando. */
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Controla el modal de confirmación (con contraseña) para eliminar el ticket abierto. */
  const [showDeleteTicketDialog, setShowDeleteTicketDialog] = useState(false);
  /** Contraseña ingresada para autorizar la eliminación del ticket. */
  const [deleteTicketPassword, setDeleteTicketPassword] = useState("");
  /** Indica si la eliminación del ticket está en curso. */
  const [deletingTicket, setDeletingTicket] = useState(false);

  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;
    if (!deleteTicketPassword.trim()) {
      toast.error("Ingresa la contraseña de eliminación");
      return;
    }
    setDeletingTicket(true);
    try {
      await apiDeleteInternalTicket(selectedTicket.id, deleteTicketPassword.trim());
      toast.success(`Ticket ${selectedTicket.numero_ticket} eliminado`);
      setShowDeleteTicketDialog(false);
      setDeleteTicketPassword("");
      setSelectedTicket(null);
      cargarTickets();
    } catch (error) {
      toast.error("No se pudo eliminar el ticket", { description: formatApiError(error) });
    } finally {
      setDeletingTicket(false);
    }
  };

  // Cuando cambia el adjunto a previsualizar, descarga el blob con el token de auth
  // para evitar el bloqueo por X-Frame-Options / cookies cross-origin.
  useEffect(() => {
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
    setPreviewPdfData(null);
    if (!previewAttachment?.file) return;
    let cancelled = false;
    setPreviewLoading(true);
    const token = sessionStorage.getItem("access_token");
    fetch(previewAttachment.file, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (cancelled) return;
        const ext2 = previewAttachment?.filename?.split(".").pop()?.toLowerCase() ?? "";
        const isPdfFile = ext2 === "pdf";
        // Para PDFs guardamos los bytes crudos para react-pdf
        if (isPdfFile) {
          setPreviewPdfData(new Uint8Array(buf));
          return;
        }
        // Para imágenes y otros: crear blob URL con MIME-type forzado
        const blob = new Blob([buf]);
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        };
        const forcedType = mimeMap[ext2] || blob.type || "application/octet-stream";
        const typedBlob = forcedType !== blob.type ? new Blob([buf], { type: forcedType }) : blob;
        setPreviewBlobUrl(URL.createObjectURL(typedBlob));
      })
      .catch(() => { if (!cancelled) { setPreviewBlobUrl(null); setPreviewPdfData(null); } })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => {
      cancelled = true;
      setPreviewLoading(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewAttachment?.id]);

  // Limpiar blob URL al cerrar el modal.
  const handleClosePreview = () => {
    setPreviewAttachment(null);
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
    setPreviewPdfData(null);
  };
  /** Archivos pendientes a adjuntar junto con la próxima respuesta. */
  const [ticketReplyFiles, setTicketReplyFiles] = useState<File[]>([]);
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  /** Controla la visibilidad del mini-formulario de insertar link. */
  const [showLinkInput, setShowLinkInput] = useState(false);
  /** URL del link que se va a insertar. */
  const [replyLinkUrl, setReplyLinkUrl] = useState("");
  /** Texto/etiqueta opcional del link. */
  const [replyLinkLabel, setReplyLinkLabel] = useState("");
  /** Tareas del ticket actual cargadas desde el backend. */
  const [ticketTasks, setTicketTasks] = useState<TicketTaskAPI[]>([]);
  /** Indica si las tareas del ticket están cargando. */
  const [ticketTasksLoading, setTicketTasksLoading] = useState(false);
  /** Indica si se está creando/actualizando una tarea. */
  const [submittingTask, setSubmittingTask] = useState(false);
  /** Indica si se está guardando el cambio de estado del ticket (evita doble envío). */
  const [submittingTicketStatus, setSubmittingTicketStatus] = useState(false);
  /** Texto del campo para añadir nueva tarea. */
  const [newTaskText, setNewTaskText] = useState("");
  /** Descripción opcional de la nueva tarea. */
  const [newTaskDescription, setNewTaskDescription] = useState("");
  /** UUIDs de los asignados seleccionados al crear una tarea. */
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  /** Fecha límite seleccionada al crear una tarea (ISO date YYYY-MM-DD). */
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  /** Controla visibilidad del picker de asignados en el formulario nueva tarea. */
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  /** Usuarios elegibles para asignar a tareas del ticket seleccionado. */
  const [eligibleAssignees, setEligibleAssignees] = useState<EligibleAssigneeAPI[]>([]);
  /** Historial de asignaciones del ticket seleccionado. */
  const [ticketAssignments, setTicketAssignments] = useState<TicketAssignmentAPI[]>([]);
  /** Área seleccionada en el picker de asignación de ticket. */
  const [assignTicketDepId, setAssignTicketDepId] = useState("");
  /** Notas opcionales al asignar el ticket a un área. */
  const [assignTicketNotes, setAssignTicketNotes] = useState("");
  /** Controla si el formulario de reasignación está expandido. */
  const [showAssignForm, setShowAssignForm] = useState(false);
  /** Envío de asignación en curso. */
  const [submittingAssign, setSubmittingAssign] = useState(false);
  /** Filtro de estado activo en la lista de tareas. */
  const [taskFilterStatus, setTaskFilterStatus] = useState<TicketTaskStatus | "">(" ".trim() as "");
  /** Si true, muestra solo tareas asignadas al usuario autenticado. */
  const [taskFilterAssignedToMe, setTaskFilterAssignedToMe] = useState(false);
  /** Actividades (bitácora) del ticket seleccionado, cargadas desde el backend. */
  const [ticketActivities, setTicketActivities] = useState<TicketActivity[]>([]);
  /** Ref que sombrea ticketActivities para poder leerlo fuera de callbacks de setState. */
  const lastActivitiesRef = useRef<TicketActivity[]>([]);
  useEffect(() => { lastActivitiesRef.current = ticketActivities; }, [ticketActivities]);
  /** Marca temporal de arranque: sólo notificar actividades creadas después de este instante.
   *  Se persiste en localStorage para recuperar notificaciones perdidas al reentrar. */
  const globalPollStartTime = useRef((() => {
    const key = `pqrs_lastSeen_${usuario?.id ?? 'anon'}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const storedMs = new Date(stored).getTime();
      const maxLookback = Date.now() - 24 * 60 * 60 * 1000; // máximo 24 h atrás
      if (storedMs > maxLookback) return stored;
    }
    return new Date().toISOString();
  })());
  /** Snapshot de updated_at por ticketId para el global poll. */
  const snapshotTicketUpdatedAt = useRef<Map<string, string>>(new Map());
  /** IDs de actividades ya notificadas (dedup entre polling local y global). */
  const globalSeenActivities = useRef<Set<string>>(new Set());
  /** Sombrea selectedTicket?.id para leerlo dentro del global poll sin añadirlo a deps. */
  const selectedTicketIdRef = useRef<string | null>(null);
  useEffect(() => { selectedTicketIdRef.current = selectedTicket?.id ?? null; }, [selectedTicket?.id]);
  /** Espejo estable de la lista de tickets para el global poll (no causa reinicios del effect). */
  const allTicketsRef = useRef<TicketInternoAPI[]>([]);
  useEffect(() => { allTicketsRef.current = [...ticketsRecibidos, ...ticketsEnviados]; }, [ticketsRecibidos, ticketsEnviados]);
  /** Ref al centinela al final del hilo para auto-scroll. */
  const chatBottomRef = useRef<HTMLDivElement>(null);
  /** Indica si la bitácora del ticket está cargando. */
  const [ticketActivitiesLoading, setTicketActivitiesLoading] = useState(false);
  // Auto-scroll al último mensaje cuando llegan actividades nuevas o se abre el hilo
  useEffect(() => {
    if (ticketDetailTab === 'hilo') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticketActivities, ticketDetailTab]);

  // ── Notificaciones de campana ─────────────────────────────────────────────
  interface TicketNotif {
    id: string;
    ticketNumero: string;
    ticketSubject: string;
    ticketId: string;
    author: string;
    detail: string;
    created_at: string;
    read: boolean;
  }
  const [ticketNotifications, setTicketNotifications] = useState<TicketNotif[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const [showGlobalNotif, setShowGlobalNotif] = useState(false);
  const globalNotifRef = useRef<HTMLDivElement>(null);
  // Cerrar el panel al hacer click fuera
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);
  useEffect(() => {
    if (!showGlobalNotif) return;
    const handler = (e: MouseEvent) => {
      if (globalNotifRef.current && !globalNotifRef.current.contains(e.target as Node)) {
        setShowGlobalNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGlobalNotif]);
  const unreadCount = ticketNotifications.filter(n => !n.read).length;
  const addNotification = useCallback((notif: Omit<TicketNotif, 'read'>) => {
    setTicketNotifications(prev => {
      if (prev.some(n => n.id === notif.id)) return prev; // evitar duplicados
      return [{ ...notif, read: false }, ...prev].slice(0, 200); // máximo 200
    });
  }, []);
  // Limpiar notificaciones con más de 1 hora cada 5 minutos
  useEffect(() => {
    const cleanup = () => {
      const cutoff = Date.now() - 60 * 60 * 1000; // 1 hora en ms
      setTicketNotifications(prev =>
        prev.filter(n => new Date(n.created_at).getTime() > cutoff)
      );
    };
    const id = setInterval(cleanup, 5 * 60 * 1000); // cada 5 min
    return () => clearInterval(id);
  }, []);

  // ── WebSocket: chat en tiempo real del ticket seleccionado ─────────────────
  const { messages: wsMessages, status: wsStatus, typingUser, sendTyping } = useTicketChat(
    selectedTicket?.id ?? null,
    usuario?.id ?? null,
    !!selectedTicket && selectedTicket.status !== "CER",
  );
  // Ref para throttle del indicador de escritura (evita flood de mensajes WS)
  const sendTypingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para detectar transiciones de estado WS y recargar si se reconecta
  const prevWsStatusRef = useRef<string>("disconnected");
  useEffect(() => {
    if (wsStatus === "connected" && prevWsStatusRef.current !== "connected" && selectedTicket) {
      // WS acaba de (re)conectar — recargar actividades para recuperar mensajes perdidos.
      apiGetTicketActivities(selectedTicket.id)
        .then(acts => setTicketActivities(acts))
        .catch(() => {
          setTimeout(() => {
            if (selectedTicket) {
              apiGetTicketActivities(selectedTicket.id)
                .then(acts => setTicketActivities(acts))
                .catch(() => {});
            }
          }, 2_000);
        });
    }
    prevWsStatusRef.current = wsStatus;
  }, [wsStatus, selectedTicket]);

  // ── Polling fallback ─────────────────────────────────────────────────────
  // Cuando el WS no está conectado, hacer polling cada 2 s para recuperar
  // mensajes nuevos. Usa merge para no sobrescribir lo que ya hay en pantalla.
  // IMPORTANTE: toast y addNotification se ejecutan FUERA del callback de
  // setState para evitar el anti-patrón de side-effects dentro de updaters.
  useEffect(() => {
    if (!selectedTicket || wsStatus === "connected") return;
    const pollInterval = setInterval(async () => {
      try {
        const acts = await apiGetTicketActivities(selectedTicket.id);
        // Comparar con el ref (no con estado) para no meter side-effects en setState
        const existingIds = new Set(lastActivitiesRef.current.map(a => a.id));
        // Marcar solo actividades de ESTE ticket como ya vistas (no bloquear otros tickets en el global poll)
        acts.filter(a => a.ticket === selectedTicket?.id).forEach(a => globalSeenActivities.current.add(a.id));
        const newOnes = acts.filter(a => !existingIds.has(a.id));
        if (newOnes.length > 0) {
          // Actualizar estado (puro, sin side-effects)
          setTicketActivities(prev => {
            const ids = new Set(prev.map(a => a.id));
            const fresh = newOnes.filter(a => !ids.has(a.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
          // Disparar notificaciones FUERA de setState (sólo actividades post-apertura)
          newOnes
            .filter(a => a.created_at > globalPollStartTime.current
              && (a.activity_type === 'COMMENT' || a.activity_type === 'INTERNAL_NOTE')
              && a.performed_by_email !== usuario?.email)
            .forEach(a => {
              globalSeenActivities.current.add(a.id);
              const author = a.performed_by_nombre ?? a.performed_by_email ?? 'Alguien';
              const snippet = (a.detail ?? '').slice(0, 80);
              toast.message(`💬 ${author}`, {
                description: `${selectedTicket.numero_ticket}: ${snippet}`,
                duration: 5_000,
              });
              addNotification({
                id: a.id,
                ticketId: selectedTicket.id,
                ticketNumero: selectedTicket.numero_ticket,
                ticketSubject: selectedTicket.subject,
                author,
                detail: snippet,
                created_at: a.created_at,
              });
            });
        }
      } catch { /* apiFetch ya maneja el 401 internamente */ }
    }, 2_000);
    return () => clearInterval(pollInterval);
  }, [selectedTicket, wsStatus, usuario?.email, addNotification]);

  // Agregar mensajes WS nuevos al estado ticketActivities + campana
  // IMPORTANTE: toast y addNotification se ejecutan FUERA del callback de
  // setState para evitar el anti-patrón de side-effects dentro de updaters.
  useEffect(() => {
    if (!wsMessages.length) return;
    // Calcular entrantes usando el ref (fuera de setState)
    const existingIds = new Set(lastActivitiesRef.current.map(a => a.id));
    const incoming = wsMessages
      .filter(m => !existingIds.has(m.id) && m.ticket === selectedTicket?.id)
      .map(m => ({
        id:                   m.id,
        ticket:               m.ticket,
        activity_type:        m.activity_type,
        detail:               m.detail ?? "",
        created_at:           m.created_at,
        performed_by_nombre:  m.performed_by?.nombre ?? null,
        performed_by_email:   m.performed_by?.email ?? null,
      } satisfies TicketActivity));
    if (!incoming.length) return;
    // Actualizar estado (puro, sin side-effects)
    setTicketActivities(prev => {
      const ids = new Set(prev.map(a => a.id));
      const fresh = incoming.filter(a => !ids.has(a.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
    // Disparar notificaciones FUERA de setState (sólo actividades post-apertura)
    incoming
      .filter(m => m.created_at > globalPollStartTime.current
        && (m.activity_type === 'COMMENT' || m.activity_type === 'INTERNAL_NOTE')
        && m.performed_by_email !== usuario?.email)
      .forEach(m => {
        globalSeenActivities.current.add(m.id);
        const author = m.performed_by_nombre ?? m.performed_by_email ?? 'Alguien';
        const snippet = (m.detail ?? '').slice(0, 80);
        toast.message(`💬 ${author}`, {
          description: `${selectedTicket?.numero_ticket}: ${snippet}`,
          duration: 5_000,
        });
        addNotification({
          id: m.id,
          ticketId: selectedTicket?.id ?? '',
          ticketNumero: selectedTicket?.numero_ticket ?? '',
          ticketSubject: selectedTicket?.subject ?? '',
          author,
          detail: snippet,
          created_at: m.created_at,
        });
      });
  }, [wsMessages, selectedTicket?.id, selectedTicket?.numero_ticket, selectedTicket?.subject, usuario?.email, addNotification]);

  // ── Global background poll ────────────────────────────────────────────
  // Llama a /api/pqrs/tickets/activity-feed/?since=<carga> cada 10 s.
  // Una sola petición devuelve TODOS los comentarios nuevos de todos los
  // tickets visibles — sin mapa de deltas, sin estado complejo.
  useEffect(() => {
    if (!usuario?.email) return;
    let active = true;

    const poll = async () => {
      try {
        const acts = await apiGetTicketActivityFeed(globalPollStartTime.current);
        if (!active) return;

        // Avanzar la marca temporal al más reciente recibido y persistir
        if (acts.length > 0) {
          const latest = acts[acts.length - 1].created_at;
          globalPollStartTime.current = latest;
          try { localStorage.setItem(`pqrs_lastSeen_${usuario?.id ?? 'anon'}`, latest); } catch { /* quota */ }
        }

        acts
          .filter(a =>
            !globalSeenActivities.current.has(a.id) &&
            a.performed_by_email !== usuario?.email
          )
          .forEach(a => {
            globalSeenActivities.current.add(a.id);
            const author = a.performed_by_nombre ?? a.performed_by_email ?? 'Alguien';
            const snippet = (a.detail ?? '').slice(0, 80);
            // Buscar datos del ticket vía ref estable (no recrea el effect)
            const ticketNum  = allTicketsRef.current.find(t => t.id === a.ticket)?.numero_ticket ?? '';
            const ticketSubj = allTicketsRef.current.find(t => t.id === a.ticket)?.subject ?? '';
            toast.message(`💬 ${author}`, {
              description: ticketNum ? `${ticketNum}: ${snippet}` : snippet,
              duration: 5_000,
            });
            addNotification({
              id: a.id,
              ticketId: a.ticket,
              ticketNumero: ticketNum,
              ticketSubject: ticketSubj,
              author,
              detail: snippet,
              created_at: a.created_at,
            });
          });
      } catch { /* apiFetch maneja 401 internamente */ }
    };

    // Esperar 3 s antes del primer poll para dar tiempo a que cargue la lista
    const warmup = setTimeout(() => {
      if (active) poll();
    }, 3_000);
    const interval = setInterval(poll, 10_000);

    // Persistir marca temporal al salir de la página para poder retomar al volver
    const handleUnload = () => {
      try { localStorage.setItem(`pqrs_lastSeen_${usuario?.id ?? 'anon'}`, new Date().toISOString()); } catch { /* quota */ }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => { active = false; clearTimeout(warmup); clearInterval(interval); window.removeEventListener('beforeunload', handleUnload); handleUnload(); };
  // allTicketsRef y globalSeenActivities son refs → no causan reinicios del effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.email, addNotification]);

  /** Actividades (bitácora) de la PQRS seleccionada. */
  const [pqrsActivities, setPqrsActivities] = useState<PQRSActivity[]>([]);
  /** Indica si la bitácora de la PQRS está cargando. */
  const [pqrsActivitiesLoading, setPqrsActivitiesLoading] = useState(false);
  /** Controla la visibilidad del panel de bitácora de la PQRS. */
  const [showBitacora, setShowBitacora] = useState(false);

  /** Fuerza la descarga de un Blob como archivo. */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAttachment = async (pqrsId: string, attachment: Attachment) => {
    try {
      const result = await apiDownloadAttachment(pqrsId, attachment.id);
      triggerDownload(result.blob, result.filename || attachment.filename);
    } catch (error) {
      toast.error("No se pudo descargar el adjunto", { description: formatApiError(error) });
    }
  };

  /**
   * Dispara la exportación del reporte de área.
   * - CSV  → endpoint backend `/api/pqrs/exportar_csv_area/`.
   * - Excel → generado en el frontend con ExcelJS (multi-hoja elaborado).
   */
  const handleExport = async (format: "csv" | "excel") => {
    setExporting(format);
    try {
      if (format === "csv") {
        const result = await apiExportCSVArea(exportFilters);
        triggerDownload(result.blob, result.filename);
        toast.success("Reporte CSV descargado correctamente");
      } else {
        const areaLabel =
          usuario?.dependencyName
          ?? (typeof usuario?.dependencyId === "string" ? usuario.dependencyId : "Área");
        await generateAreaReport({
          areaName:          areaLabel,
          userName:          `${usuario?.nombre ?? ""} ${usuario?.apellido ?? ""}`.trim() || usuario?.email || "Usuario",
          pqrsList,
          ticketsRecibidos,
          ticketsEnviados,
          periodDays,
          exportFilters,
        });
        toast.success("Reporte Excel elaborado descargado correctamente");
      }
    } catch (e) {
      toast.error(`Error al exportar ${format.toUpperCase()}`, { description: formatApiError(e) });
    } finally {
      setExporting(null);
    }
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RespondForm>({
    defaultValues: { response_type: "CITIZEN", new_status: "" },
  });

  const { register: regTicket, handleSubmit: submitTicket, reset: resetTicket, formState: { errors: errTicket } } = useForm<TicketForm>({
    defaultValues: { priority: "MED", target_dependency: "", subject: "", description: "" },
  });

  /**
   * Carga (o recarga) todas las PQRS asignadas al área del usuario.
   *
   * Utiliza `Promise.allSettled` para ejecutar en paralelo dos consultas:
   *   - **Primaria**: PQRS filtradas por `dependency` del usuario.
   *   - **Secundaria**: Asignaciones activas (puede fallar silenciosamente).
   *
   * Las PQRS referenciadas en asignaciones pero ausentes de la consulta
   * primaria se recuperan de forma individual y se incorporan al listado.
   * El resultado final se desduplicha por `id` y se ordena de más reciente
   * a más antiguo.
   *
   * Memorizado con `useCallback` para evitar re-creaciones innecesarias;
   * solo cambia si `dependencyId` o `id` del usuario cambian.
   */
  const cargarPQRS = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/pqrs/lista/ sin filtros extra.
      // El backend auto-filtra por contexto del usuario autenticado:
      //   - Admin     → todas las PQRS
      //   - Encargado → _pqrs_qs_for_dep_manager: PQRS con PQRSAssignment.dependency__in = dep_ids del manager
      //   - Usuario   → solo las propias
      // El endpoint global /api/pqrs/assignments/ devuelve 404 para encargados
      // (solo existe para admin), por lo que se elimina la consulta de respaldo.
      const pqrsResult = await apiListPQRS({ page_size: 200, is_internal: false });
      const items: PqrsAPI[] = Array.isArray(pqrsResult)
        ? pqrsResult
        : (pqrsResult as any).results ?? [];

      // eslint-disable-next-line no-console
      console.debug("[AreaDashboard] lista cargada:", items.length, "PQRS");

      // El endpoint de lista puede usar un serializer ligero que omite `description`.
      // Para los ítems del listado base cuya descripción no viene incluida (null/undefined),
      // recuperamos el detalle completo en paralelo usando el mismo apiGetPQRS que usa el admin.
      const needsDesc = items.filter(p => p.description == null);
      if (needsDesc.length > 0) {
        // eslint-disable-next-line no-console
        console.debug("[AreaDashboard] Enriqueciendo descripción para", needsDesc.length, "PQRS desde el endpoint de detalle");
        const detailResults = await Promise.allSettled(needsDesc.map(p => apiGetPQRS(p.id)));
        detailResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const idx = items.findIndex(p => p.id === needsDesc[i].id);
            if (idx !== -1) {
              items[idx] = {
                ...items[idx],
                description: r.value.description,
                subject:     r.value.subject,
                due_date:    r.value.due_date,
                dependency:  r.value.dependency,
              };
            }
          } else {
            // eslint-disable-next-line no-console
            console.warn("[AreaDashboard] No se pudo obtener descripción del PQRS", needsDesc[i].id, r.reason);
          }
        });
      }

      // Ordena de más reciente a más antigua antes de guardar en el estado.
      setPqrsList(items.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (e) {
      toast.error("Error al cargar PQRS", { description: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  }, [usuario?.dependencyId, usuario?.id]);

  // Dispara la carga de PQRS al montar el componente y cada vez que cambie
  // la referencia estable de `cargarPQRS` (dependencias del usuario).
  useEffect(() => { cargarPQRS(); }, [cargarPQRS]);

  // Un Líder de Área necesita la lista de integrantes de su propia dependencia
  // para poder designarlos como responsables de una PQRS.
  useEffect(() => {
    if (!isAreaLeader || !usuario?.dependencyId) return;
    apiListAllUsers()
      .then(res => {
        const items = Array.isArray(res) ? res : (res as any).results ?? [];
        setAreaUsers(items);
      })
      .catch(() => {}); // No crítico: el backend ya filtra por su propia área.
  }, [isAreaLeader, usuario?.dependencyId]);

  /**
   * Carga (o recarga) los tickets internos del área usando el endpoint dedicado
   * `GET /api/pqrs/tickets/` que devuelve todos los tickets visibles para el usuario.
   * Separa recibidos (dependency = esta área) de enviados (el resto).
   */
  const cargarTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const depId  = usuario?.dependencyId;
      const sortDesc = (arr: TicketInternoAPI[]) =>
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const ticketsRes = await apiListTickets({ page_size: 200 });
      const todos: TicketInternoAPI[] = Array.isArray(ticketsRes)
        ? ticketsRes
        : (ticketsRes as any).results ?? [];

      const recibidos: TicketInternoAPI[] = [];
      const enviadosMap = new Map<string, TicketInternoAPI>();
      for (const t of todos) {
        if (t.target_dependency === depId) {
          recibidos.push(t);
        } else {
          enviadosMap.set(t.id, t);
        }
      }

      setTicketsRecibidos(sortDesc(recibidos));
      setTicketsEnviados(sortDesc([...enviadosMap.values()]));
    } catch (e) {
      toast.error("Error al cargar tickets internos", { description: formatApiError(e) });
    } finally {
      setLoadingTickets(false);
    }
  }, [usuario?.dependencyId]);

  /**
   * Crea un nuevo ticket interno y lo envía al área destino seleccionada.
   * Tras el éxito recarga la lista de tickets y cambia a la pestaña de tickets.
   */
  const onCrearTicket = async (data: TicketForm) => {
    setSubmittingTicket(true);
    try {
      const ticket = await apiCreateTicketInterno({
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        origin_dependency: usuario?.dependencyId ?? "",
        target_dependency: data.target_dependency || null,
      });
      // Los adjuntos se suben en llamadas separadas porque la creación del ticket es JSON puro.
      for (const file of newTicketFiles) {
        await apiUploadTicketAttachment(ticket.id, file);
      }
      toast.success("Ticket interno creado correctamente");
      resetTicket();
      setNewTicketFiles([]);
      setShowNewTicket(false);
      setSelectedTicket(null);
      await cargarTickets();
      setTab("tickets");
      setTicketSubTab("enviados");
    } catch (e) {
      toast.error("Error al crear ticket interno", { description: formatApiError(e) });
    } finally {
      setSubmittingTicket(false);
    }
  };

  /** Genera y abre un documento PDF/imprimible de la PQRS seleccionada (entrega física). */
  const handlePrintPQRS = async () => {
    if (!selected) return;

    const fmtDate = (s?: string | null) =>
      !s ? "—" : new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const fmtDateShort = (s?: string | null) =>
      !s ? "—" : new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

    // Fetch full detail (has anon_info.phone, registered_user) + citizen responses in parallel
    let rawDetail: any = selected;
    let citizenResponses: any[] = [];
    try {
      const [detail, respData] = await Promise.all([
        apiGetPQRS(selected.id),
        apiGetResponses(selected.id, 200),
      ]);
      rawDetail = detail as any;
      const allResponses: any[] = Array.isArray(respData)
        ? respData
        : ((respData as any)?.results ?? []);
      // El backend ya filtra según el rol: admin ve todas, área solo ve CITIZEN/FINAL
      citizenResponses = allResponses;
    } catch (e) {
      console.error("[PDF] Error al cargar datos de la PQRS:", e);
    }

    const anonInfo = rawDetail.anon_info ?? rawDetail.anonymous_submitter ?? null;
    const regUser  = rawDetail.registered_user_info ?? rawDetail.registered_user ?? rawDetail.user ?? selected.user ?? null;

    const respAutor = (r: any): string => {
      if (r.responded_by_nombre) return r.responded_by_nombre;
      const u = r.responded_by;
      if (!u) return "Sistema";
      if (typeof u === "string") return "Funcionario";
      return `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() || u.email || u.username || "Funcionario";
    };

    const responsesHtml = citizenResponses.length === 0
      ? `<p style="color:#6b7280;font-style:italic;">Sin respuestas registradas.</p>`
      : citizenResponses.map((r: any) => {
          const esFinal = r.is_final || r.response_type === "FINAL";
          return `
            <div style="border:1px solid ${esFinal ? "#bfdbfe" : "#bbf7d0"};border-radius:6px;margin-bottom:10px;overflow:hidden;page-break-inside:avoid;">
              <div style="background:${esFinal ? "#eff6ff" : "#f0fdf4"};padding:8px 12px;border-bottom:1px solid ${esFinal ? "#bfdbfe" : "#bbf7d0"};display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:11px;color:${esFinal ? "#1d4ed8" : "#15803d"};">${esFinal ? "✅ Respuesta oficial" : "💬 " + respAutor(r)}</strong>
                <span style="font-size:11px;color:#6b7280;">${fmtDate(r.created_at)}</span>
              </div>
              <div style="padding:10px 12px;font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.6;">${r.content ?? ""}</div>
            </div>`;
        }).join("");

    const tipoLabel   = PQRS_TYPE_LABEL[(selected.type ?? (selected as any).pqrs_type) as keyof typeof PQRS_TYPE_LABEL] ?? selected.type;
    const estadoLabel = PQRS_STATUS_LABEL[selected.status as keyof typeof PQRS_STATUS_LABEL] ?? selected.status;
    const prioLabel   = PQRS_PRIORITY_LABEL[selected.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? selected.priority;
    const canalLabel  = selected.canal_ingreso ? (PQRS_CANAL_LABEL[selected.canal_ingreso] ?? selected.canal_ingreso) : "En línea (web)";
    const ciudadano   = contactName(selected);
    const emailCiudadano  = regUser?.email ?? anonInfo?.email ?? (selected as any).submitter_email ?? "—";
    const telefonoCiudadano = regUser?.telefono ?? anonInfo?.phone ?? anonInfo?.telefono ?? "—";
    const areaLabel   = selected.dependency_names?.map(d => d.name).join(", ")
      || (typeof selected.dependency === "object" && selected.dependency?.name)
      || "Sin asignar";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>PQRSF ${selected.numero_radicado ?? (selected as any).radicado}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 24px 32px; font-size: 12px; }
    h2 { font-size: 11px; font-weight: 700; color: #374151; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid #e5e7eb; text-transform: uppercase; letter-spacing: .05em; }
    .header-bar { background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%); color: #fff; padding: 16px 22px; border-radius: 8px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; }
    .header-bar .left .radicado-label { font-size: 10px; font-family: monospace; opacity: .75; text-transform: uppercase; letter-spacing: .08em; }
    .header-bar .left .radicado { font-size: 22px; font-weight: 800; font-family: monospace; }
    .header-bar .left .tipo { font-size: 12px; opacity: .9; margin-top: 2px; }
    .header-bar .right { text-align:right; font-size:10px; opacity:.7; line-height:1.6; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 0; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 0; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
    .field { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px; padding: 7px 10px; }
    .field label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; display: block; margin-bottom: 2px; }
    .field span { font-size: 12px; font-weight: 600; color: #1f2937; }
    .badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:700; }
    .badge-RAD { background:#dbeafe; color:#1d4ed8; }
    .badge-PRO { background:#fef9c3; color:#b45309; }
    .badge-RES { background:#dcfce7; color:#15803d; }
    .badge-CER { background:#f3f4f6; color:#374151; }
    .badge-HIGH { background:#fee2e2; color:#b91c1c; }
    .badge-MED  { background:#fef9c3; color:#b45309; }
    .badge-LOW  { background:#dcfce7; color:#15803d; }
    .description-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:10px 12px; line-height:1.65; white-space:pre-wrap; font-size:12px; color:#374151; }
    .stamp { border: 2px solid #d1d5db; border-radius: 6px; padding: 10px 16px; text-align: center; margin-top: 16px; page-break-inside: avoid; break-inside: avoid; display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
    .stamp-col p { font-size: 10px; color: #6b7280; margin-bottom: 2px; }
    .stamp-line { border-top: 1px solid #d1d5db; margin-top: 22px; }
    .footer { margin-top:16px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; page-break-inside: avoid; break-inside: avoid; }
    @media print {
      body { padding: 12mm 14mm; }
      @page { margin: 0; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <div class="header-bar">
    <div class="left">
      <div class="radicado-label">Número de radicado</div>
      <div class="radicado">${selected.numero_radicado ?? (selected as any).radicado}</div>
      <div class="tipo">${tipoLabel} · Canal: ${canalLabel}</div>
    </div>
    <div class="right">
      Sistema PQRSF Institucional<br/>
      Radicado: ${fmtDate(selected.created_at)}<br/>
      Estado: <strong style="color:#fff;">${estadoLabel}</strong>
    </div>
  </div>

  <h2>Información general</h2>
  <div class="grid-4">
    <div class="field"><label>Tipo</label><span>${tipoLabel}</span></div>
    <div class="field"><label>Estado</label><span><span class="badge badge-${selected.status}">${estadoLabel}</span></span></div>
    <div class="field"><label>Prioridad</label><span><span class="badge badge-${selected.priority}">${prioLabel}</span></span></div>
    <div class="field"><label>Canal</label><span>${canalLabel}</span></div>
  </div>
  <div class="grid-2" style="margin-top:8px;">
    <div class="field"><label>Área responsable</label><span>${areaLabel}</span></div>
    <div class="field"><label>Fecha límite (SLA)</label><span>${fmtDateShort(selected.due_date)}</span></div>
  </div>
  ${selected.registrado_por_nombre ? `<div class="field" style="margin-top:8px;"><label>Registrado por (funcionario)</label><span>${selected.registrado_por_nombre}</span></div>` : ""}

  <h2>Datos del ciudadano</h2>
  <div class="grid-3">
    <div class="field"><label>Nombre</label><span>${ciudadano}</span></div>
    <div class="field"><label>Correo electrónico</label><span>${emailCiudadano}</span></div>
    <div class="field"><label>Teléfono</label><span>${telefonoCiudadano}</span></div>
  </div>

  <h2>Asunto</h2>
  <div class="description-box" style="font-weight:600;min-height:auto;">${selected.subject}</div>

  <h2>Descripción</h2>
  <div class="description-box">${rawDetail.description || selected.description || "<em style='color:#9ca3af'>Sin descripción registrada.</em>"}</div>

  <h2>Respuestas y seguimiento (${citizenResponses.length})</h2>
  ${responsesHtml}

  <div class="stamp">
    <div class="stamp-col">
      <p>Nombre y firma del ciudadano</p>
      <div class="stamp-line"></div>
    </div>
    <div class="stamp-col">
      <p>Nombre y firma del funcionario receptor</p>
      <div class="stamp-line"></div>
    </div>
    <div class="stamp-col">
      <p>Fecha de entrega física</p>
      <div class="stamp-line"></div>
    </div>
  </div>

  <div class="footer">
    <span>PQRSF ${selected.numero_radicado ?? (selected as any).radicado} — ${estadoLabel}</span>
    <span>Generado el ${fmtDate(new Date().toISOString())} · Sistema PQRSF Institucional</span>
  </div>

</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);
    const iframeWin = iframe.contentWindow;
    if (!iframeWin) { document.body.removeChild(iframe); return; }
    iframeWin.document.write(html);
    iframeWin.document.close();
    iframeWin.focus();
    iframeWin.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 2000);
  };

  /** Genera y abre un informe imprimible del ticket actual en una nueva ventana. */
  const handlePrintTicket = () => {
    if (!selectedTicket || !ticketComputed) return;

    const STATUS_LABEL: Record<string, string> = { ABR: "Abierto", PRO: "En proceso", RES: "Resuelto", CER: "Cerrado" };
    const TASK_STATUS_LABEL: Record<string, string> = { PENDING: "Pendiente", IN_PROGRESS: "En progreso", DONE: "Completada", CANCELLED: "Cancelada" };
    const ACT_LABEL: Record<string, string> = {
      CREATED: "Creado", STATUS_CHANGED: "Cambio de estado", ASSIGNED: "Asignación",
      ESCALATED: "Escalado", COMMENT: "Comentario", ATTACHMENT_ADDED: "Adjunto",
    };

    const fmtDate = (s?: string | null) => !s ? "—" : new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const fmtDateShort = (s?: string | null) => !s ? "—" : new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

    const comments = ticketActivities.filter(a => a.activity_type === "COMMENT");
    const activityLog = ticketActivities.filter(a => a.activity_type !== "COMMENT");

    const commentsHtml = comments.length === 0
      ? `<p style="color:#6b7280;font-style:italic;">Sin comentarios registrados.</p>`
      : comments.map(c => {
          const autor = c.performed_by_nombre ?? c.performed_by_email ?? "Sistema";
          return `
            <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;overflow:hidden;">
              <div style="background:#f0f4ff;padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:13px;color:#1e3a5f;">${autor}</strong>
                <span style="font-size:11px;color:#6b7280;">${fmtDate(c.created_at)}</span>
              </div>
              <div style="padding:12px 14px;font-size:13px;color:#374151;white-space:pre-wrap;line-height:1.6;">${c.detail ?? ""}</div>
            </div>`;
        }).join("");

    const tasksHtml = ticketTasks.length === 0
      ? `<p style="color:#6b7280;font-style:italic;">Sin tareas registradas.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151;">Tarea</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151;">Estado</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151;">Asignado a</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#374151;">Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            ${ticketTasks.map((t, i) => `
              <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">
                  <span style="font-weight:600;color:#1f2937;">${t.title}</span>
                  ${t.description ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;line-height:1.5;white-space:pre-wrap;">${t.description}</div>` : ""}
                </td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${TASK_STATUS_LABEL[t.status] ?? t.status}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${(t.assigned_to_nombres ?? []).join(", ") || "—"}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${fmtDateShort(t.due_date)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;

    const activityHtml = activityLog.length === 0
      ? `<p style="color:#6b7280;font-style:italic;">Sin actividad registrada.</p>`
      : activityLog.map(a => {
          const quien = a.performed_by_nombre ?? a.performed_by_email ?? "Sistema";
          return `<div style="display:flex;gap:10px;margin-bottom:8px;font-size:12px;color:#6b7280;">
            <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;margin-top:4px;flex-shrink:0;"></span>
            <span><strong style="color:#374151;">${ACT_LABEL[a.activity_type] ?? a.activity_type}</strong>${a.detail ? ` — ${a.detail}` : ""} · ${quien} · ${fmtDate(a.created_at)}</span>
          </div>`;
        }).join("");

    const doneTasks = ticketTasks.filter(t => t.status === "DONE").length;
    const pctTasks = ticketTasks.length > 0 ? Math.round((doneTasks / ticketTasks.length) * 100) : 0;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Ticket ${selectedTicket.numero_ticket}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 40px; font-size: 13px; }
    h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 700; color: #374151; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: .05em; }
    .header-bar { background: #3730a3; color: #fff; padding: 20px 28px; border-radius: 10px; margin-bottom: 28px; }
    .header-bar .numero { font-size: 12px; font-family: monospace; opacity: .8; margin-bottom: 6px; }
    .header-bar h1 { color: #fff; }
    .header-bar .meta { font-size: 12px; opacity: .75; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 4px; }
    .field { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
    .field label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; display: block; margin-bottom: 4px; }
    .field span { font-size: 13px; font-weight: 600; color: #1f2937; }
    .badge { display:inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
    .badge-ABR { background:#dbeafe; color:#1d4ed8; }
    .badge-PRO { background:#fef9c3; color:#b45309; }
    .badge-RES { background:#dcfce7; color:#15803d; }
    .badge-CER { background:#f3f4f6; color:#374151; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; margin-top: 6px; }
    .progress-fill { height: 100%; background: #6366f1; border-radius: 9999px; }
    .description-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; line-height: 1.7; white-space: pre-wrap; font-size: 13px; color: #374151; }
    .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="numero">${selectedTicket.numero_ticket}</div>
    <h1>${selectedTicket.subject}</h1>
    <div class="meta">Generado el ${fmtDate(new Date().toISOString())} &nbsp;|&nbsp; Sistema PQRS Institucional</div>
  </div>

  <h2>Información general</h2>
  <div class="grid-2">
    <div class="field"><label>Estado</label><span><span class="badge badge-${selectedTicket.status}">${STATUS_LABEL[selectedTicket.status] ?? selectedTicket.status}</span></span></div>
    <div class="field"><label>Prioridad</label><span>${PQRS_PRIORITY_LABEL[selectedTicket.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? selectedTicket.priority}</span></div>
    <div class="field"><label>Área origen</label><span>${selectedTicket.origin_dependency_info?.name ?? selectedTicket.origin_dependency_name ?? "—"}</span></div>
    <div class="field"><label>Área destino</label><span>${selectedTicket.target_dependency_info?.name ?? selectedTicket.target_dependency_name ?? "Sin área destino"}</span></div>
    <div class="field"><label>Creado</label><span>${fmtDate(selectedTicket.created_at)}</span></div>
    <div class="field"><label>Vencimiento</label><span>${fmtDateShort(selectedTicket.due_date ?? ticketComputed.dueDate.toISOString())}</span></div>
  </div>
  ${ticketTasks.length > 0 ? `
  <div class="field" style="margin-top:12px;">
    <label>Progreso de tareas</label>
    <span>${doneTasks} de ${ticketTasks.length} completadas (${pctTasks}%)</span>
    <div class="progress-bar"><div class="progress-fill" style="width:${pctTasks}%"></div></div>
  </div>` : ""}

  <h2>Descripción</h2>
  <div class="description-box">${selectedTicket.description ?? "<em style='color:#9ca3af'>Sin descripción registrada.</em>"}</div>

  <h2>Hilo de comentarios (${comments.length})</h2>
  ${commentsHtml}

  <h2>Tareas (${ticketTasks.length})</h2>
  ${tasksHtml}

  <h2>Bitácora de actividad</h2>
  ${activityHtml}

  <div class="footer">
    <span>Ticket ${selectedTicket.numero_ticket} — ${STATUS_LABEL[selectedTicket.status] ?? selectedTicket.status}</span>
    <span>Documento generado por el Sistema PQRS Institucional</span>
  </div>

</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);
    const iframeWin = iframe.contentWindow;
    if (!iframeWin) { document.body.removeChild(iframe); return; }
    iframeWin.document.write(html);
    iframeWin.document.close();
    iframeWin.focus();
    iframeWin.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 2000);
  };

  /** Añade una respuesta o nota interna local al ticket (sin backend aún). */
  const handleTicketAddReply = async () => {
    const hasText = ticketReplyText.trim().length > 0;
    const hasFiles = ticketReplyFiles.length > 0;
    if (!selectedTicket || (!hasText && !hasFiles) || submittingReply) return;
    setSubmittingReply(true);
    try {
      if (hasText) {
        await apiCommentTicket(selectedTicket.id, ticketReplyText.trim(), ticketReplyMode === "nota_interna");
        setTicketReplyText("");
        toast.success(ticketReplyMode === "nota_interna" ? "Nota interna guardada" : "Respuesta publicada");
      }
      if (hasFiles) {
        await Promise.all(
          ticketReplyFiles.map(f => apiUploadTicketAttachment(selectedTicket.id, f))
        );
        const names = ticketReplyFiles.map(f => f.name).join(", ");
        toast.success(`Archivo${ticketReplyFiles.length > 1 ? "s" : ""} adjuntado${ticketReplyFiles.length > 1 ? "s" : ""}: ${names}`);
        setTicketReplyFiles([]);
      }
      // Recargar la bitácora para que el nuevo COMMENT / ATTACHMENT_ADDED aparezca en el hilo.
      // Usamos merge (no replace) para no perder mensajes WS que ya se hayan añadido en paralelo.
      const [acts, atts] = await Promise.all([
        apiGetTicketActivities(selectedTicket.id),
        apiGetTicketAttachments(selectedTicket.id),
      ]);
      setTicketActivities(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newOnes = acts.filter(a => !existingIds.has(a.id));
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
      });
      setTicketAttachments(atts);
    } catch (e) {
      toast.error("Error al publicar", { description: (e instanceof Error ? e.message : "Intente de nuevo") });
    } finally {
      setSubmittingReply(false);
    }
  };

  /** Añade una tarea al ticket llamando al backend. */
  const handleTicketAddTask = async () => {
    if (!selectedTicket || !newTaskText.trim() || submittingTask) return;
    setSubmittingTask(true);
    try {
      const task = await apiCreateTicketTask(selectedTicket.id, {
        title: newTaskText.trim(),
        ...(newTaskDescription.trim() && { description: newTaskDescription.trim() }),
        ...(newTaskAssignees.length > 0 && { assigned_to: newTaskAssignees }),
        ...(newTaskDueDate && { due_date: newTaskDueDate }),
      });
      setTicketTasks(prev => [...prev, task]);
      setNewTaskText("");
      setNewTaskDescription("");
      setNewTaskAssignees([]);
      setNewTaskDueDate("");
      // Recargar actividades: crear tarea genera un evento en el hilo
      const acts = await apiGetTicketActivities(selectedTicket.id);
      setTicketActivities(acts);
    } catch (e) {
      toast.error("Error al crear tarea", { description: formatApiError(e) });
    } finally {
      setSubmittingTask(false);
    }
  };

  // Carga inicial de tickets internos y dependencias disponibles.
  useEffect(() => { cargarTickets(); }, [cargarTickets]);
  // Deep-link: abre directamente el ticket indicado en ?ticket=<id> (usado por los
  // enlaces de los correos de asignación/notificación) apenas termina la carga inicial.
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId || loadingTickets) return;
    const encontrado = [...ticketsRecibidos, ...ticketsEnviados].find(t => t.id === ticketId);
    setTab("tickets");
    setTicketSubTab(ticketsRecibidos.some(t => t.id === ticketId) ? "recibidos" : "enviados");
    if (encontrado) {
      setSelectedTicket(encontrado);
    } else {
      apiGetTicketInterno(ticketId)
        .then(setSelectedTicket)
        .catch(() => toast.error("No se pudo abrir el ticket enlazado en el correo"));
    }
    // Limpia el parámetro para no reabrir el ticket en refrescos posteriores.
    setSearchParams(prev => { prev.delete("ticket"); return prev; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTickets]);
  // Sincronizar selector de estado + resetear UI + cargar bitácora y tareas cuando cambia el ticket.
  useEffect(() => {
    if (selectedTicket) {
      setTicketNewStatus(selectedTicket.status);
      setTicketDetailTab("hilo");
      setCalendarMonth(new Date().toISOString().slice(0, 7));
      setCalendarSelectedDay(null);
      setTicketReplyText("");
      setTicketReplyMode("respuesta");
      setTicketReplyFiles([]);
      setShowLinkInput(false);
      setReplyLinkUrl("");
      setReplyLinkLabel("");
      setTicketActivities([]);
      setTicketAttachments([]);
      setTicketTasks([]);
      setTicketActivitiesLoading(true);
      setTicketTasksLoading(true);
      setNewTaskText("");
      setNewTaskDescription("");
      setNewTaskAssignees([]);
      setNewTaskDueDate("");
      setShowAssigneePicker(false);
      setTaskFilterStatus("");
      setTaskFilterAssignedToMe(false);
      setEligibleAssignees([]);
      setTicketAssignments([]);
      setAssignTicketDepId("");
      setAssignTicketNotes("");
      setShowAssignForm(false);
      setSubmittingTicketStatus(false);
      // Si el serializer de lista omitió `description` (y otros campos de detalle),
      // refrescamos con el endpoint de detalle en segundo plano.
      if (selectedTicket.description == null) {
        apiGetTicketInterno(selectedTicket.id)
          .then(full => setSelectedTicket(prev => prev?.id === full.id ? full : prev))
          .catch(() => {});
      }

      // Usar allSettled en lugar de all: si un endpoint secundario falla (p.ej.
      // eligible-assignees devuelve 403 para ciertos roles), los demás datos
      // (actividades, tareas, adjuntos) igualmente se cargan y muestran.
      Promise.allSettled([
        apiGetTicketActivities(selectedTicket.id),
        apiListTicketTasks(selectedTicket.id),
        apiGetEligibleAssignees(selectedTicket.id),
        apiGetTicketAssignments(selectedTicket.id),
        apiGetTicketAttachments(selectedTicket.id),
      ])
        .then(([actsR, tasksR, assigneesR, assignsR, attsR]) => {
          if (actsR.status === "fulfilled")      setTicketActivities(actsR.value);
          if (tasksR.status === "fulfilled")     setTicketTasks(tasksR.value);
          if (assigneesR.status === "fulfilled") setEligibleAssignees(assigneesR.value);
          if (assignsR.status === "fulfilled")   setTicketAssignments(assignsR.value);
          if (attsR.status === "fulfilled")      setTicketAttachments(attsR.value);
        })
        .finally(() => {
          setTicketActivitiesLoading(false);
          setTicketTasksLoading(false);
        });
    } else {
      setTicketActivities([]);
      setTicketTasks([]);
      setTicketAttachments([]);
    }
  }, [selectedTicket?.id]);
  // Carga la bitácora de la PQRS seleccionada cuando el usuario abre el panel.
  useEffect(() => {
    if (!selected || !showBitacora) return;
    setPqrsActivitiesLoading(true);
    apiGetActivities(selected.id)
      .then(res => {
        const acts = (Array.isArray(res) ? res : ((res as any).results ?? [])) as PQRSActivity[];
        setPqrsActivities(acts.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      })
      .catch(() => {})
      .finally(() => setPqrsActivitiesLoading(false));
  }, [selected?.id, showBitacora]);

  // Sincronizar tareas con localStorage cada vez que cambian.
  // ELIMINADO: las tareas ahora provienen del backend.

  useEffect(() => {
    apiListDependencies(true, true)
      .then(res => setDeps((res as any).results ?? []))
      .catch(() => {});
  }, []);

  /**
   * Bloquea el scroll del body en dispositivos móviles (<1024 px) cuando
   * hay una PQRS seleccionada y el panel de detalle ocupa toda la pantalla.
   * El cleanup restaura siempre el scroll al desmontar o al cerrar el panel.
   */
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile && selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  /**
   * Subconjunto de `pqrsList` que pasa el filtro de estado activo.
   * Cuando `filtroEstado` es `"todos"` no se aplica ningún filtro.
   */
  const pqrsFiltradas = pqrsList.filter(p => {
    // Filtro de estado
    const passEstado =
      filtroEstado === "todos" ? true :
      filtroEstado === "RES_CER" ? (p.status === "RES" || p.status === "CER") :
      p.status === filtroEstado;
    if (!passEstado) return false;

    // Filtro SLA
    if (filtroSla) {
      const hoy = new Date().toISOString().slice(0, 10);
      const en5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      if (filtroSla === "vencida") {
        if (!p.due_date || p.due_date >= hoy || p.status === "CER" || p.status === "RES") return false;
      } else if (filtroSla === "por_vencer") {
        if (!p.due_date || p.due_date < hoy || p.due_date > en5 || p.status === "CER" || p.status === "RES") return false;
      } else if (filtroSla === "en_tiempo") {
        if (!p.due_date || p.due_date <= en5 || p.status === "CER" || p.status === "RES") return false;
      } else if (filtroSla === "sin_sla") {
        if (p.due_date || p.status === "CER" || p.status === "RES") return false;
      }
    }
    return true;
  });

  /**
   * Manejador del formulario de respuesta.
   *
   * Pasos que realiza:
   * 1. Registra la respuesta/nota interna llamando a `apiRespondPQRS`.
   * 2. Si se indicó un nuevo estado diferente al actual, llama a `apiUpdateEstado`.
   * 3. Notifica éxito, limpia el formulario, recarga la lista y cierra el panel.
   *
   * En caso de error muestra una notificación `toast` con el detalle del fallo.
   *
   * @param data - Datos validados del formulario `RespondForm`.
   */
  const loadAttachments = async (pqrsId: string) => {
    setAttachLoading(true);
    try {
      const [fromDetail, fromEndpoint] = await Promise.allSettled([
        apiGetPQRS(pqrsId).then(p => p.attachments ?? []),
        apiGetAttachments(pqrsId),
      ]);
      const detailAtts = fromDetail.status === "fulfilled" ? fromDetail.value : [];
      const endpointAtts = fromEndpoint.status === "fulfilled" ? fromEndpoint.value : [];
      const seen = new Set(detailAtts.map((a: Attachment) => a.id));
      const merged = [
        ...detailAtts,
        ...endpointAtts.filter((a: Attachment) => !seen.has(a.id)),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAttachments(merged);
    } catch (e) {
      toast.error("Error al cargar adjuntos", { description: formatApiError(e) });
      setAttachments([]);
    } finally {
      setAttachLoading(false);
    }
  };

  const handleUploadFile = async (pqrsId: string, file: File) => {
    setUploading(true);
    try {
      const newAtt = await apiUploadAttachment(pqrsId, file);
      setAttachments(prev => [newAtt, ...prev]);
      toast.success(`Archivo "${file.name}" adjuntado`);
    } catch (e) {
      toast.error("Error al subir archivo", { description: formatApiError(e) });
    } finally {
      setUploading(false);
    }
  };

  /**
   * Abre el panel de detalle de una PQRS. Muestra inmediatamente los datos del
   * listado y luego carga el detalle completo en background para garantizar que
   * la descripción (excluida del endpoint de lista) esté disponible.
   */
  const openDetail = (p: PqrsAPI) => {
    setSelected(p);
    setSelectedTicket(null);
    reset({ response_type: "CITIZEN", new_status: "" });
    setAttachments([]);
    setRespondFiles([]);
    setShowAdjuntos(false);
    setPqrsActivities([]);
    setShowBitacora(false);
    setSelectedResponsibleIds([]);
    // Si el ítem ya trae descripción del listado (enriquecido en cargarPQRS), no
    // hay necesidad de una petición extra. Solo disparamos apiGetPQRS cuando falta.
    if (p.description == null) {
      setDescLoading(true);
      apiGetPQRS(p.id)
        .then(fresh => {
          setSelected(prev => prev && prev.id === fresh.id
            ? { ...prev, description: fresh.description, subject: fresh.subject, due_date: fresh.due_date, dependency: fresh.dependency }
            : prev);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[AreaDashboard] No se pudo cargar el detalle del PQRS:", p.id, e);
        })
        .finally(() => setDescLoading(false));
    }
  };

  const onResponder = async (data: RespondForm) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      // Paso 1: subir los archivos adjuntos y recopilar sus IDs.
      const attachmentIds: string[] = [];
      for (const file of respondFiles) {
        try {
          const att = await apiUploadAttachment(selected.id, file);
          attachmentIds.push(att.id);
        } catch (uploadErr) {
          toast.error(`Error al subir "${file.name}"`, { description: formatApiError(uploadErr) });
        }
      }

      // Paso 2: enviar la respuesta o nota interna.
      await apiRespondPQRS({
        pqrs: selected.id,
        content: data.response_text,
        response_type: data.response_type,
        ...(attachmentIds.length > 0 && { attachment_ids: attachmentIds }),
      });

      // Paso 3: cambiar estado solo si se seleccionó uno distinto al actual.
      if (data.new_status && data.new_status !== selected.status) {
        await apiUpdateEstado(selected.id, data.new_status as any);
      }

      toast.success("Respuesta registrada correctamente");
      reset({ response_type: "CITIZEN", new_status: "" });
      setRespondFiles([]);
      await cargarPQRS(); // Recarga el listado para reflejar cambios.
      setSelected(null);  // Cierra el panel de detalle.
    } catch (e) {
      toast.error("Error al guardar respuesta", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Designa a uno o varios integrantes de la propia área como responsables
   * de la PQRS abierta. Solo disponible para el Líder de Área.
   * El backend valida que la PQRS pertenezca al área del líder y que los
   * responsables elegidos sean miembros de la misma dependencia.
   */
  const onAsignarResponsable = async () => {
    if (!selected || selectedResponsibleIds.length === 0) return;
    setAssigningResponsible(true);
    try {
      await apiAssignPQRS({
        pqrs: selected.id,
        responsible_users: selectedResponsibleIds,
        ...(usuario?.dependencyId && { dependencies: [usuario.dependencyId] }),
      });
      toast.success("Responsable asignado correctamente");
      setSelectedResponsibleIds([]);
      await cargarPQRS();
    } catch (e) {
      toast.error("Error al asignar responsable", { description: formatApiError(e) });
    } finally {
      setAssigningResponsible(false);
    }
  };

  /**
   * Genera una etiqueta (badge) visual coloreada según el estado de la PQRS.
   *
   * Mapa de colores por código de estado:
   * - `RAD` (Radicado)  → Azul
   * - `PRO` (En Proceso) → Amarillo
   * - `RES` (Resuelto)  → Verde
   * - `CER` (Cerrado)   → Gris
   * - Cualquier otro    → Gris neutro (fallback)
   *
   * @param status - Código de estado interno (p.ej. `"RAD"`, `"PRO"`).
   * @returns Elemento `<span>` con estilos Tailwind y la etiqueta legible.
   */
  const getStatusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      RAD: "bg-blue-100 text-blue-800",
      PRO: "bg-yellow-100 text-yellow-800",
      RES: "bg-green-100 text-green-800",
      CER: "bg-gray-100 text-gray-800",
      ABR: "bg-blue-100 text-blue-800",
    };
    const allLabels: Record<string, string> = { ...PQRS_STATUS_LABEL, ...TICKET_STATUS_LABEL };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] ?? "bg-gray-100 text-gray-700"}`}>
        {allLabels[status] ?? status}
      </span>
    );
  };

  /**
   * Resuelve el nombre del remitente/ciudadano de una PQRS con la siguiente
   * jerarquía de fallback:
   * 1. Usuario registrado → `nombre + apellido`.
   * 2. Remitente anónimo con nombre → `anon_info.name`.
   * 3. Campo genérico `submitter` (cadena plana).
   * 4. Valor por defecto → `"Anónimo"`.
   *
   * @param p - Objeto PQRS obtenido de la API.
   * @returns Nombre legible del remitente.
   */
  const contactName = (p: PqrsAPI) => {
    if (p.user) return `${p.user.nombre} ${p.user.apellido}`.trim();
    if (p.anon_info?.name) return `${p.anon_info.name} ${p.anon_info.last_name ?? ""}`.trim();
    const sub = (p as any).submitter as string | undefined;
    return sub || "Anónimo";
  };

  const contactEmail = (p: PqrsAPI) =>
    p.registered_user_info?.email || p.user?.email || p.anon_info?.email || p.submitter_email || "—";

  const contactPhone = (p: PqrsAPI) =>
    p.registered_user_info?.telefono || p.user?.telefono || p.anon_info?.phone || p.submitter_phone || "—";

  // ── Contadores para las tarjetas de estadísticas ─────────────────────────
  const total = pqrsList.length;                                              // Total de PQRS asignadas al área.
  const rad   = pqrsList.filter(p => p.status === "RAD").length;             // En estado Radicado.
  const pro   = pqrsList.filter(p => p.status === "PRO").length;             // En estado En Proceso.
  const res   = pqrsList.filter(p => p.status === "RES" || p.status === "CER").length; // Resueltas o Cerradas.

  // ── Datos computados para las gráficas de analytics ──────────────────────
  const analyticsData = useMemo(() => {
    const cutoff = periodDays > 0
      ? new Date(Date.now() - periodDays * 86_400_000)
      : null;
    const filtered = cutoff
      ? pqrsList.filter(p => new Date(p.created_at) >= cutoff)
      : pqrsList;

    // Por estado
    const estadoMap: Record<string, number> = {};
    for (const p of filtered) estadoMap[p.status] = (estadoMap[p.status] ?? 0) + 1;
    const porEstado = Object.entries(estadoMap).map(([key, value]) => ({
      name: PQRS_STATUS_LABEL[key as keyof typeof PQRS_STATUS_LABEL] ?? key,
      value, key,
    }));

    // Por tipo
    const tipoMap: Record<string, number> = {};
    for (const p of filtered) {
      const t = p.type ?? p.pqrs_type ?? "?";
      tipoMap[t] = (tipoMap[t] ?? 0) + 1;
    }
    const porTipo = Object.entries(tipoMap).map(([key, value]) => ({
      name: PQRS_TYPE_LABEL[key as keyof typeof PQRS_TYPE_LABEL] ?? key,
      value,
    }));

    // Por prioridad
    const prioMap: Record<string, number> = {};
    for (const p of filtered) {
      const pr = p.priority ?? "?";
      prioMap[pr] = (prioMap[pr] ?? 0) + 1;
    }
    const porPrioridad = Object.entries(prioMap).map(([key, value]) => ({
      name: PQRS_PRIORITY_LABEL[key as keyof typeof PQRS_PRIORITY_LABEL] ?? key,
      value,
    }));

    // Tendencia diaria
    const days = periodDays > 0 ? periodDays : 90;
    const cutoffTend = new Date(Date.now() - days * 86_400_000);
    const tendenciaMap: Record<string, { fecha: string; total: number; resueltas: number }> = {};
    for (const p of pqrsList) {
      const d = new Date(p.created_at);
      if (d < cutoffTend) continue;
      const key = d.toISOString().slice(0, 10);
      if (!tendenciaMap[key]) tendenciaMap[key] = { fecha: key, total: 0, resueltas: 0 };
      tendenciaMap[key].total++;
      if (p.status === "RES" || p.status === "CER") tendenciaMap[key].resueltas++;
    }
    const tendencia = Object.values(tendenciaMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

    // KPIs
    const totalKPI     = filtered.length;
    const resueltas    = filtered.filter(p => p.status === "RES" || p.status === "CER").length;
    const enProceso    = filtered.filter(p => p.status === "PRO").length;
    const tasaResolucion = totalKPI > 0 ? Math.round((resueltas / totalKPI) * 100) : 0;

    return { porEstado, porTipo, porPrioridad, tendencia, totalKPI, resueltas, enProceso, tasaResolucion };
  }, [pqrsList, periodDays]);

  // ── Cards de área para filtrar tickets ───────────────────────────────────
  const ticketAreaStats = useMemo(() => {
    const listaBase = ticketSubTab === "recibidos" ? ticketsRecibidos : ticketsEnviados;
    const map = new Map<string, { name: string; count: number }>();
    for (const t of listaBase) {
      const areaId = ticketSubTab === "recibidos"
        ? (t.origin_dependency ?? "sin_origen")
        : (t.target_dependency ?? "sin_destino");
      const areaName = ticketSubTab === "recibidos"
        ? (t.origin_dependency_name ?? t.origin_dependency_info?.name ?? "Sin área origen")
        : (t.target_dependency_name ?? t.target_dependency_info?.name ?? "Sin área destino");
      const prev = map.get(areaId) ?? { name: areaName, count: 0 };
      map.set(areaId, { ...prev, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [ticketsRecibidos, ticketsEnviados, ticketSubTab]);

  // ── Datos computados para el panel de detalle del ticket ─────────────────────────────────────
  const ticketComputed = useMemo(() => {
    if (!selectedTicket) return null;
    const tasks   = ticketTasks;
    const dueDate = selectedTicket.due_date
      ? new Date(selectedTicket.due_date)
      : new Date(new Date(selectedTicket.created_at).getTime() + 3 * 86_400_000);
    const isOverdue = selectedTicket.is_overdue !== undefined
      ? selectedTicket.is_overdue
      : (dueDate < new Date() && selectedTicket.status !== "RES" && selectedTicket.status !== "CER");
    const authorObj =
      selectedTicket.created_by !== null && typeof selectedTicket.created_by === "object"
        ? (selectedTicket.created_by as { nombre?: string; apellido?: string })
        : null;
    const authorName = selectedTicket.external_requester_name?.trim()
      || selectedTicket.external_requester_email?.trim()
      || (authorObj?.nombre
        ? `${authorObj.nombre} ${authorObj.apellido ?? ""}`.trim()
        : selectedTicket.created_by_nombre?.trim() || "Sistema");
    const authorInitials = authorName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
    return { tasks, dueDate, isOverdue, authorName, authorInitials };
  }, [selectedTicket, ticketTasks]);

  const COLORS_ESTADO    = ["#3b82f6", "#f59e0b", "#22c55e", "#6b7280"];
  const COLORS_TIPO      = ["#6366f1", "#ec4899", "#f97316", "#14b8a6", "#a855f7"];
  const COLORS_PRIORIDAD = ["#22c55e", "#f59e0b", "#ef4444"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
            <span className="text-gray-600">{p.name}:</span>
            <span className="font-bold text-gray-900">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ====================================================
            CABECERA: identidad del área y navegación rápida
        ==================================================== */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Área</h1>
              <p className="text-sm text-gray-500">
                {usuario?.dependencyName ?? "Sin dependencia asignada"} — {usuario?.nombre}
                {(usuario?.roles ?? []).includes("REGISTRO_CONTROL") && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    Registro y Control Académico
                  </span>
                )}
              </p>
            </div>
            {/* ── Campana de notificaciones global ── */}
            <div className="ml-auto relative" ref={globalNotifRef}>
              <button
                title="Notificaciones de tickets"
                className="relative p-2 rounded-lg bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm"
                onClick={() => {
                  setShowGlobalNotif(v => !v);
                  if (!showGlobalNotif) {
                    setTicketNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }
                }}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showGlobalNotif && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
                    <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                    {ticketNotifications.length > 0 && (
                      <button
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => setTicketNotifications([])}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {ticketNotifications.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">Sin notificaciones</p>
                    ) : ticketNotifications.map(n => (
                      <button
                        key={n.id}
                        className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                          !n.read ? 'bg-indigo-50/60' : ''
                        }`}
                        onClick={() => {
                          setTicketNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                          setShowGlobalNotif(false);
                          // Abrir el ticket si no está ya abierto
                          const found = allTicketsRef.current.find(t => t.id === n.ticketId);
                          if (found) {
                            setSelectedTicket(found);
                            setTicketDetailTab('hilo');
                          }
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                          <div className={!n.read ? '' : 'ml-3.5'}>
                            <p className="text-xs font-semibold text-gray-800 truncate">{n.author} · {n.ticketNumero}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.detail}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {(usuario?.roles ?? []).includes("REGISTRO_CONTROL") && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <VoteIcon className="h-5 w-5 text-purple-600 shrink-0" />
                <p className="text-sm text-purple-800">
                  Tienes el rol de <strong>Registro y Control Académico</strong>: en{" "}
                  <strong>Elecciones</strong> puedes revisar postulaciones, avalar candidaturas y generar tarjetones.
                </p>
              </div>
              <Button variant="outline" size="sm"
                className="border-purple-400 text-purple-700 hover:bg-purple-100 shrink-0"
                onClick={() => navigate("/elecciones")}
              >
                Ir a Elecciones
              </Button>
            </div>
          )}
          {/* Accesos rápidos del panel de área */}
          {/* Accesos rápidos — compactos con expansión al hover */}
          <nav className="flex flex-nowrap items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">

            {/* helper reutilizable inline: etiqueta que se expande */}
            {/* Cada botón: ícono siempre visible · label slide-in al hover */}

            <button
              onClick={() => navigate("/area")}
              title="PQRS Asignadas"
              className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md hover:shadow-blue-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
            >
              <Building2 className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[9rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">PQRS Asignadas</span>
            </button>

            <button
              onClick={() => navigate("/consulta")}
              title="Consultar Radicado"
              className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-white text-gray-600 border-gray-200 hover:bg-slate-700 hover:text-white hover:border-slate-700 hover:shadow-md hover:shadow-slate-300/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
            >
              <Search className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[10rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Consultar Radicado</span>
            </button>

            {(usuario?.is_staff || usuario?.dependencyId) && (
              <button
                onClick={() => setShowNewTicket(true)}
                title="Nuevo Ticket"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <PlusCircle className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[8rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Nuevo Ticket</span>
              </button>
            )}

            {(usuario?.is_staff || usuario?.dependencyId) && (
              <button
                onClick={() => navigate("/area/radicar-presencial")}
                title="Radicar PQRS Presencial / Verbal"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <FilePlus className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[13rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Radicar PQRS Presencial</span>
              </button>
            )}

            {(usuario?.is_staff || (usuario?.roles ?? []).includes("ADMIN") || usuario?.can_consume_campus_api) && (
              <button
                onClick={() => navigate("/area/consulta-estudiantes")}
                title="Consulta Estudiantes Campus"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <Database className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[12rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Consulta Estudiantes</span>
              </button>
            )}

            {usuario?.is_staff && (
              <button
                onClick={() => navigate("/admin")}
                title="Panel Administración"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-600 hover:text-white hover:border-violet-600 hover:shadow-md hover:shadow-violet-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[9rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Panel Admin</span>
              </button>
            )}

              {(usuario?.is_staff || usuario?.perfil_tipo === "admin_area" || usuario?.is_area_leader || usuario?.can_handle_pqrs || usuario?.can_consume_campus_api) && (
              <button
                onClick={() => navigate("/gestion-whatsapp-masivo")}
                title="WhatsApp Masivo"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white hover:border-green-600 hover:shadow-md hover:shadow-green-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <MessageSquare className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[10rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">WhatsApp Masivo</span>
              </button>
            )}

            {(usuario?.is_staff || (usuario?.roles ?? []).includes("TI_STAFF")) && (
              <button
                onClick={() => navigate("/inventario/ti")}
                title="Inventario TI"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:shadow-md hover:shadow-cyan-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <HardDrive className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[8rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Inventario TI</span>
              </button>
            )}

            {(usuario?.is_staff || usuario?.dependencyId || (usuario?.roles ?? []).includes("REGISTRO_CONTROL") || ["docente", "admin_area"].includes(usuario?.perfil_tipo ?? "")) && (
              <button
                onClick={() => navigate("/elecciones")}
                title="Elecciones"
                className="group inline-flex items-center px-2.5 py-2 rounded-xl border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600 hover:shadow-md hover:shadow-purple-200/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out shrink-0"
              >
                <VoteIcon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[8rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Elecciones</span>
              </button>
            )}

            {/* ── separador ── */}
            <span className="w-px h-5 bg-gray-200 self-center mx-0.5 shrink-0" />

            {/* ── Vista Analytics ── */}
            <button
              onClick={() => setViewMode(v => v === "list" ? "analytics" : "list")}
              title={viewMode === "analytics" ? "Ver PQRS" : "Ver Gráficas"}
              className={`group inline-flex items-center px-2.5 py-2 rounded-xl border transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 shrink-0 ${
                viewMode === "analytics"
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200/70"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-slate-700 hover:text-white hover:border-slate-700 hover:shadow-md hover:shadow-slate-300/50"
              }`}
            >
              {viewMode === "analytics"
                ? <Building2 className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                : <BarChart2 className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              }
              <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[8rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">
                {viewMode === "analytics" ? "Ver PQRS" : "Ver Gráficas"}
              </span>
            </button>

            {/* ── Exportar ── */}
            <button
              onClick={() => setShowExport(v => !v)}
              title="Exportar"
              className={`group inline-flex items-center px-2.5 py-2 rounded-xl border transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 shrink-0 ${
                showExport
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200/70"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-200/60"
              }`}
            >
              <FileDown className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-[6rem] group-hover:pl-1.5 text-sm font-semibold transition-all duration-200 ease-out">Exportar</span>
              <ChevronDown className={`w-3 h-3 ml-0.5 shrink-0 transition-transform duration-300 ${showExport ? "rotate-180" : ""}`} />
            </button>

          </nav>

          {/* ── Panel de exportación de reportes del área ───────────────── */}
          {showExport && (
            <div className="animate-slide-down-fade mt-3 bg-white border border-emerald-200 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-800">Exportar Reporte del Área</span>
                <span className="ml-auto text-xs text-gray-400">Filtros opcionales</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                {/* Estado */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Estado</label>
                  <select
                    value={exportFilters.status ?? ""}
                    onChange={e => setExportFilters(f => ({ ...f, status: e.target.value || undefined }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Todos</option>
                    <option value="RAD">Radicado</option>
                    <option value="PRO">En Proceso</option>
                    <option value="RES">Resuelto</option>
                    <option value="CER">Cerrado</option>
                  </select>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                  <select
                    value={exportFilters.type ?? ""}
                    onChange={e => setExportFilters(f => ({ ...f, type: e.target.value || undefined }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Todos</option>
                    <option value="P">Petición</option>
                    <option value="Q">Queja</option>
                    <option value="R">Reclamo</option>
                    <option value="S">Sugerencia</option>
                    <option value="F">Felicitación</option>
                  </select>
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
                  <select
                    value={exportFilters.priority ?? ""}
                    onChange={e => setExportFilters(f => ({ ...f, priority: e.target.value || undefined }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Todas</option>
                    <option value="LOW">Baja</option>
                    <option value="MED">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>

                {/* Desde */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={exportFilters.date_from ?? ""}
                    onChange={e => setExportFilters(f => ({ ...f, date_from: e.target.value || undefined }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Hasta */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={exportFilters.date_to ?? ""}
                    onChange={e => setExportFilters(f => ({ ...f, date_to: e.target.value || undefined }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExport("csv")}
                  disabled={exporting !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {exporting === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Descargar CSV
                </button>

                <button
                  onClick={() => handleExport("excel")}
                  disabled={exporting !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {exporting === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Descargar Excel
                </button>

                <button
                  onClick={() => setExportFilters({})}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            TARJETAS DE ESTADÍSTICAS: resumen numérico del área
            Clicables: filtran la lista de PQRS por estado.
        ==================================================== */}
        {/* Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 ${tab === "inventario" || tab === "inicio" ? "hidden" : ""}`}>
          {[
            { icon: FileText,    label: "Total asignadas", value: total, color: "text-blue-600",  filterKey: "todos"   },
            { icon: AlertCircle, label: "Radicadas",       value: rad,   color: "text-blue-500",  filterKey: "RAD"     },
            { icon: Clock,       label: "En Proceso",      value: pro,   color: "text-yellow-600",filterKey: "PRO"     },
            { icon: CheckCircle2,label: "Cerradas",        value: res,   color: "text-green-600", filterKey: "RES_CER" },
          ].map(({ icon: Icon, label, value, color, filterKey }) => {
            const isActive = filtroEstado === filterKey ||
              (filterKey === "RES_CER" && (filtroEstado === "RES" || filtroEstado === "CER"));
            const handleClick = () => {
              if (viewMode === "analytics") { setViewMode("list"); }
              setFiltroEstado(isActive && filterKey !== "todos" ? "todos" : filterKey);
            };
            return (
              <button
                key={label}
                onClick={handleClick}
                className={`text-left w-full rounded-xl border shadow-sm transition-all ${
                  isActive
                    ? "border-blue-500 ring-2 ring-blue-300 bg-white"
                    : "border-transparent bg-white hover:shadow-md hover:border-gray-200"
                }`}
              >
                <div className="p-4 flex items-center gap-3">
                  <Icon className={`w-8 h-8 ${color}`} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className={`text-xs ${isActive ? "text-blue-600 font-semibold" : "text-gray-500"}`}>{label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ====================================================
            VISTA ANALYTICS: gráficas del área
        ==================================================== */}
        {viewMode === "analytics" && (
          <div className="animate-fade-slide-up mb-8 space-y-6">

            {/* Filtro de período */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Período:</span>
              {[
                { label: "7 días",  days: 7  },
                { label: "30 días", days: 30 },
                { label: "90 días", days: 90 },
                { label: "Todo",    days: 0  },
              ].map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setPeriodDays(opt.days)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    periodDays === opt.days
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={cargarPQRS}
                disabled={loading}
                className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total en período",     value: analyticsData.totalKPI,           icon: FileText,    color: "text-blue-600",   bg: "bg-blue-50"   },
                { label: "Resueltas / Cerradas",  value: analyticsData.resueltas,          icon: CheckCircle2,color: "text-green-600",  bg: "bg-green-50"  },
                { label: "En Proceso",            value: analyticsData.enProceso,          icon: Clock,       color: "text-yellow-600", bg: "bg-yellow-50" },
                { label: "Tasa de Resolución",    value: `${analyticsData.tasaResolucion}%`, icon: Target,    color: "text-purple-600", bg: "bg-purple-50" },
              ].map(({ label, value, icon: Icon, color, bg }, idx) => (
                <div
                  key={label}
                  className="animate-fade-slide-up bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3"
                  style={{ animationDelay: `${idx * 55}ms` }}
                >
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fila 1: Estado + Tipo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Dona interactiva: por estado */}
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">Distribución por Estado</p>
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                    {analyticsData.totalKPI} PQRS
                  </span>
                </div>

                {analyticsData.porEstado.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
                ) : (() => {
                  const totalEstado = analyticsData.porEstado.reduce((s, d) => s + d.value, 0);
                  const active = activeEstadoIndex !== undefined ? analyticsData.porEstado[activeEstadoIndex] : null;

                  const renderActiveShape = (props: any) => {
                    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                    return (
                      <g>
                        <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10}
                          startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={1}
                          style={{ filter: `drop-shadow(0 0 6px ${fill}99)` }}
                        />
                        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 14} outerRadius={outerRadius + 17}
                          startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.5}
                        />
                      </g>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-4">
                      <div className="relative">
                        <ResponsiveContainer width="100%" height={210}>
                          <PieChart>
                            <Pie
                              data={analyticsData.porEstado}
                              cx="50%" cy="50%"
                              innerRadius={60} outerRadius={88}
                              paddingAngle={3}
                              dataKey="value"
                              activeIndex={activeEstadoIndex}
                              activeShape={renderActiveShape}
                              onMouseEnter={(_, index) => setActiveEstadoIndex(index)}
                              onMouseLeave={() => setActiveEstadoIndex(undefined)}
                              animationBegin={0} animationDuration={700}
                            >
                              {analyticsData.porEstado.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={COLORS_ESTADO[i % COLORS_ESTADO.length]}
                                  opacity={activeEstadoIndex === undefined || activeEstadoIndex === i ? 1 : 0.4}
                                  style={{ cursor: "pointer", transition: "opacity .2s" }}
                                />
                              ))}
                            </Pie>
                            <RTooltip
                              content={({ active: a, payload }) => {
                                if (!a || !payload?.length) return null;
                                const d = payload[0];
                                const pct = totalEstado > 0 ? ((d.value as number) / totalEstado * 100).toFixed(1) : "0";
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color as string }} />
                                      <span className="font-semibold text-gray-800">{d.name}</span>
                                    </div>
                                    <div className="flex gap-3 pl-4 text-gray-600">
                                      <span><span className="font-bold text-gray-900">{d.value}</span> PQRS</span>
                                      <span className="text-gray-400">·</span>
                                      <span className="font-bold" style={{ color: d.color as string }}>{pct}%</span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          {active ? (
                            <>
                              <span className="text-2xl font-extrabold leading-none"
                                style={{ color: COLORS_ESTADO[activeEstadoIndex! % COLORS_ESTADO.length] }}>
                                {active.value}
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5 font-medium">{active.name}</span>
                              <span className="text-[11px] text-gray-400">
                                {totalEstado > 0 ? ((active.value / totalEstado) * 100).toFixed(1) : 0}%
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-2xl font-extrabold text-gray-800 leading-none">{totalEstado}</span>
                              <span className="text-xs text-gray-400 mt-0.5">Total PQRS</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-1">
                        {analyticsData.porEstado.map((d, i) => {
                          const color = COLORS_ESTADO[i % COLORS_ESTADO.length];
                          const pct = totalEstado > 0 ? (d.value / totalEstado) * 100 : 0;
                          const isHovered = activeEstadoIndex === i;
                          return (
                            <button
                              key={d.key ?? d.name}
                              onMouseEnter={() => setActiveEstadoIndex(i)}
                              onMouseLeave={() => setActiveEstadoIndex(undefined)}
                              className={`text-left rounded-lg px-2 py-1.5 transition-all ${
                                isHovered ? "bg-gray-50 scale-[1.02]" : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                  <span className={`text-xs font-medium ${isHovered ? "text-gray-900" : "text-gray-600"}`}>
                                    {d.name}
                                  </span>
                                </div>
                                <span className="text-xs font-bold" style={{ color }}>{d.value}</span>
                              </div>
                              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Barras: por tipo */}
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">Solicitudes por Tipo</p>
                {analyticsData.porTipo.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analyticsData.porTipo} barSize={32} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Cantidad" radius={[4, 4, 0, 0]}>
                        {analyticsData.porTipo.map((_, i) => (
                          <Cell key={i} fill={COLORS_TIPO[i % COLORS_TIPO.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Fila 2: Tendencia diaria */}
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Tendencia de Radicación
                <span className="font-normal text-gray-400 ml-2">
                  (últimos {periodDays > 0 ? periodDays : 90} días)
                </span>
              </p>
              {analyticsData.tendencia.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Sin datos en el período seleccionado</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analyticsData.tendencia} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaGradRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="total"     name="Radicadas" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGradTotal)" dot={false} />
                    <Area type="monotone" dataKey="resueltas" name="Resueltas"  stroke="#22c55e" strokeWidth={2} fill="url(#areaGradRes)"   dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Fila 3: Prioridad */}
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-4">Distribución por Prioridad</p>
              {analyticsData.porPrioridad.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={analyticsData.porPrioridad}
                      cx="50%" cy="50%"
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {analyticsData.porPrioridad.map((_, i) => (
                        <Cell key={i} fill={COLORS_PRIORIDAD[i % COLORS_PRIORIDAD.length]} />
                      ))}
                    </Pie>
                    <RTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>
        )}

        {/* ====================================================
            CUERPO PRINCIPAL: barra lateral + contenido
            Barra lateral desplegable con navegación por módulos.
        ==================================================== */}

        {/* ── BARRA INFERIOR MÓVIL (visible solo en sm y menor) ── */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1 shadow-lg">
          {([
            { key: "inicio" as const,        label: "Inicio",  icon: Home,         color: "text-slate-700",  badge: 0 },
            ...(canViewPQRS ? [{ key: "pqrs" as const, label: "PQRS", icon: FileText, color: "text-blue-600", badge: pqrsList.length }] : []),
            { key: "tickets" as const,       label: "Tickets", icon: Inbox,        color: "text-indigo-600", badge: ticketsRecibidos.length + ticketsEnviados.length },
            { key: "certificates" as const,  label: "Certs.",  icon: GraduationCap,color: "text-emerald-600",badge: 0 },
            { key: "inventario" as const,    label: "Inv.",    icon: Package,      color: "text-teal-600",  badge: 0 },
          ] as const).map(({ key, label, icon: Icon, color, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                tab === key ? color : "text-gray-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white">{badge > 99 ? "99+" : badge}</span>
              )}
            </button>
          ))}
          {tab === "tickets" && (
            <button
              onClick={() => setShowNewTicket(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-indigo-600"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">Nuevo</span>
            </button>
          )}
        </nav>

        <div className="flex gap-4 items-start pb-16 sm:pb-0">

          {/* ── BARRA LATERAL DE NAVEGACIÓN (desktop) ────────────── */}
          <aside
            className={`hidden sm:flex shrink-0 transition-all duration-200 bg-white border border-gray-200 rounded-xl shadow-sm flex-col overflow-visible ${
              sidebarOpen ? "w-52" : "w-12"
            }`}
          >
            {/* Botón toggle */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
              className="flex items-center justify-center h-10 w-full border-b border-gray-100 hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600"
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Ítems de navegación */}
            <nav className="flex flex-col py-2 gap-0.5 px-1">
              {([
                {
                  key: "inicio" as const,
                  label: "Inicio",
                  sublabel: "Resumen",
                  icon: Home,
                  color: "text-slate-700",
                  activeBg: "bg-slate-100",
                  activeBorder: "border-slate-500",
                  badge: 0,
                  badgeCls: "",
                },
                ...(canViewPQRS ? [{
                  key: "pqrs" as const,
                  label: "PQRS / F",
                  sublabel: "Ciudadanas",
                  icon: FileText,
                  color: "text-blue-600",
                  activeBg: "bg-blue-50",
                  activeBorder: "border-blue-500",
                  badge: pqrsList.length,
                  badgeCls: "bg-blue-100 text-blue-700",
                }] : []),
                {
                  key: "tickets" as const,
                  label: "Tickets",
                  sublabel: "Internos",
                  icon: Inbox,
                  color: "text-indigo-600",
                  activeBg: "bg-indigo-50",
                  activeBorder: "border-indigo-500",
                  badge: ticketsRecibidos.length + ticketsEnviados.length,
                  badgeCls: "bg-indigo-100 text-indigo-700",
                },
                {
                  key: "certificates" as const,
                  label: "Certificados",
                  sublabel: "",
                  icon: GraduationCap,
                  color: "text-emerald-600",
                  activeBg: "bg-emerald-50",
                  activeBorder: "border-emerald-500",
                  badge: 0,
                  badgeCls: "",
                },
                {
                  key: "inventario" as const,
                  label: "Inventario",
                  sublabel: "del Área",
                  icon: Package,
                  color: "text-teal-600",
                  activeBg: "bg-teal-50",
                  activeBorder: "border-teal-500",
                  badge: 0,
                  badgeCls: "",
                },
              ] as const).map(({ key, label, sublabel, icon: Icon, color, activeBg, activeBorder, badge, badgeCls }) => (
                <div key={key} className="relative group">
                  <button
                    onClick={() => setTab(key)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors border-l-2 ${
                      tab === key
                        ? `${activeBg} ${activeBorder} ${color}`
                        : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${tab === key ? color : "text-gray-400"}`} />
                    {sidebarOpen && (
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold leading-tight truncate">{label}</span>
                        {sublabel && <span className="block text-[10px] text-gray-400 leading-tight">{sublabel}</span>}
                      </span>
                    )}
                    {sidebarOpen && badge > 0 && (
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0 shrink-0 ${badgeCls}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                  {/* Tooltip — visible solo cuando el sidebar está colapsado */}
                  {!sidebarOpen && (
                    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                      <span className="font-semibold">{label}</span>
                      {sublabel && <span className="text-gray-300 ml-1">{sublabel}</span>}
                      {badge > 0 && <span className="ml-1.5 bg-white/20 rounded-full px-1.5">{badge}</span>}
                      {/* flecha */}
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Acción rápida: Nuevo Ticket */}
            {tab === "tickets" && (
              <div className="mt-auto px-2 py-3 border-t border-gray-100">
                {sidebarOpen ? (
                  <button
                    onClick={() => setShowNewTicket(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Nuevo Ticket
                  </button>
                ) : (
                  <div className="relative group">
                    <button
                      onClick={() => setShowNewTicket(true)}
                      className="w-full flex items-center justify-center py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4 text-indigo-600" />
                    </button>
                    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                      Nuevo Ticket
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ── CONTENIDO PRINCIPAL ─────────────────────────────── */}
          <div className="flex-1 min-w-0">

          {/* Módulo Inventario del Área */}
          {tab === "inventario" && (
            <div className="animate-fade-slide-up">
              <InventarioArea
                areaId={usuario?.dependencyId ?? "default"}
                areaNombre={usuario?.dependencyName ?? "Área"}
              />
            </div>
          )}

          {/* Módulo Inicio: landing con resumen y accesos rápidos */}
          {tab === "inicio" && (() => {
            const pqrsPendientes = canViewPQRS
              ? pqrsList.filter(p => p.status === "RAD" || p.status === "PRO")
              : [];
            const pqrsOrdenadas = [...pqrsPendientes].sort((a, b) => {
              const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
              const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
              return da - db;
            }).slice(0, 5);
            const ticketsPendientes = ticketsRecibidos.filter(t => t.status === "ABR" || t.status === "PRO");
            const ticketsOrdenados = [...ticketsPendientes].slice(0, 5);
            const totalPendientes = pqrsPendientes.length + ticketsPendientes.length;
            const nombre = (usuario as any)?.nombre?.split(" ")?.[0] ?? "";
            const horaActual = new Date().getHours();
            const saludo = horaActual < 12 ? "Buenos días" : horaActual < 19 ? "Buenas tardes" : "Buenas noches";

            const tarjetasBase = [
              ...(canViewPQRS ? [{
                key: "pqrs-pend",
                label: "PQRS pendientes",
                sublabel: "Radicadas + En Proceso",
                value: pqrsPendientes.length,
                icon: FileText,
                color: "text-blue-600",
                bg: "bg-blue-50",
                onClick: () => { setTab("pqrs"); setFiltroEstado("todos"); },
              }] : []),
              {
                key: "tickets-pend",
                label: "Tickets recibidos",
                sublabel: "Abiertos + En Proceso",
                value: ticketsPendientes.length,
                icon: Inbox,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
                onClick: () => { setTab("tickets"); setTicketSubTab("recibidos"); },
              },
              ...(canViewPQRS ? [{
                key: "pqrs-cerradas",
                label: "PQRS cerradas",
                sublabel: "Resueltas o cerradas",
                value: pqrsList.filter(p => p.status === "RES" || p.status === "CER").length,
                icon: CheckCircle2,
                color: "text-green-600",
                bg: "bg-green-50",
                onClick: () => { setTab("pqrs"); setFiltroEstado("todos"); },
              }] : []),
              {
                key: "tickets-enviados",
                label: "Tickets enviados",
                sublabel: "Solicitados a otras áreas",
                value: ticketsEnviados.length,
                icon: Send,
                color: "text-purple-600",
                bg: "bg-purple-50",
                onClick: () => { setTab("tickets"); setTicketSubTab("enviados"); },
              },
            ];
            const tarjetas = tarjetasBase;

            return (
              <div className="animate-fade-slide-up space-y-6">

                {/* Cabecera de bienvenida */}
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                        {saludo}{nombre ? `, ${nombre}` : ""} 👋
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Tienes <span className="font-bold text-blue-700">{totalPendientes}</span>{" "}
                        {totalPendientes === 1 ? "asunto pendiente" : "asuntos pendientes"} en tu área{" "}
                        <span className="font-semibold">{usuario?.dependencyName ?? ""}</span>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cargarPQRS()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refrescar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tarjetas de resumen clicables */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {tarjetas.map(({ key, label, sublabel, value, icon: Icon, color, bg, onClick }) => (
                    <button
                      key={key}
                      onClick={onClick}
                      className="group text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                      <div className="mt-3">
                        <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
                        <div className="text-[11px] text-gray-400">{sublabel}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Listas: PQRS y tickets pendientes */}
                <div className={`grid grid-cols-1 ${canViewPQRS ? "lg:grid-cols-2" : ""} gap-4`}>

                  {/* PQRS más urgentes (por fecha límite) — solo si tiene permiso */}
                  {canViewPQRS && (
                  <Card className="border border-gray-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" /> PQRS pendientes
                      </CardTitle>
                      <button
                        onClick={() => { setTab("pqrs"); setFiltroEstado("todos"); }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Ver todas →
                      </button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {pqrsOrdenadas.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
                          No hay PQRS pendientes
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {pqrsOrdenadas.map(p => {
                            const vencida = p.due_date ? new Date(p.due_date).getTime() < Date.now() : false;
                            return (
                              <li key={p.id}>
                                <button
                                  onClick={() => { setTab("pqrs"); setSelected(p); }}
                                  className="w-full text-left py-2.5 px-1 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-3"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-mono text-gray-500 truncate">{p.codigo_radicado || p.id}</div>
                                    <div className="text-sm font-medium text-gray-800 truncate">{p.subject || "(sin asunto)"}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                      <span>{PQRS_STATUS_LABEL[p.status as keyof typeof PQRS_STATUS_LABEL] ?? p.status}</span>
                                      {p.due_date && (
                                        <span className={vencida ? "text-red-600 font-semibold" : ""}>
                                          • Vence {formatDateTime(p.due_date)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-gray-300" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                  )}

                  {/* Tickets recibidos pendientes */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-indigo-600" /> Tickets recibidos pendientes
                      </CardTitle>
                      <button
                        onClick={() => { setTab("tickets"); setTicketSubTab("recibidos"); }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Ver todos →
                      </button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {ticketsOrdenados.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
                          No hay tickets pendientes
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {ticketsOrdenados.map(t => (
                            <li key={t.id}>
                              <button
                                onClick={() => { setTab("tickets"); setTicketSubTab("recibidos"); setSelectedTicket(t); }}
                                className="w-full text-left py-2.5 px-1 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-mono text-gray-500 truncate">{(t as any).codigo || t.id}</div>
                                  <div className="text-sm font-medium text-gray-800 truncate">{t.subject || "(sin asunto)"}</div>
                                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>{TICKET_STATUS_LABEL[t.status] ?? t.status}</span>
                                    {(t as any).from_dependency_name && (
                                      <span>• De {(t as any).from_dependency_name}</span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Accesos rápidos */}
                <Card className="border border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-800">Accesos rápidos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      <button
                        onClick={() => navigate("/consulta")}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-gray-700"
                      >
                        <Search className="w-4 h-4 text-gray-500" /> Consultar Radicado
                      </button>
                      <button
                        onClick={() => setShowNewTicket(true)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-indigo-700"
                      >
                        <PlusCircle className="w-4 h-4" /> Nuevo Ticket
                      </button>
                      <button
                        onClick={() => navigate("/area/radicar-presencial")}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors text-emerald-700"
                      >
                        <FilePlus className="w-4 h-4" /> Radicar Presencial
                      </button>
                      <button
                        onClick={() => setViewMode("analytics")}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-amber-50 hover:border-amber-300 transition-colors text-amber-700"
                      >
                        <BarChart2 className="w-4 h-4" /> Ver Gráficas
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

        <div key={viewMode === "list" ? "list" : "list-hidden"} className={`flex flex-col lg:flex-row gap-6 ${viewMode === "analytics" || tab === "inventario" || tab === "inicio" ? "hidden" : "animate-fade-slide-up"}`}>
          {/* ---- LISTA DE PQRS con filtro por estado ---- */}
          <div className={`flex-1 ${selected ? "hidden lg:block" : "block"}`}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 space-y-3">
                {/* Fila 1: acción principal para tickets */}
                <div className="flex flex-wrap items-center gap-2">
                  {tab === "tickets" && !sidebarOpen && (
                    <button
                      onClick={() => setShowNewTicket(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors ml-auto"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Nuevo Ticket
                    </button>
                  )}
                </div>

                {/* Fila 2 (PQRS): filtros de estado y SLA — en su propia fila para no desbordar en móvil */}
                {tab === "pqrs" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="flex-1 sm:flex-none border rounded-md px-2 py-1.5 text-sm bg-white"
                      value={filtroEstado}
                      onChange={e => setFiltroEstado(e.target.value)}
                    >
                      <option value="todos">Todos los estados</option>
                      <option value="RAD">Radicado</option>
                      <option value="PRO">En Proceso</option>
                      <option value="RES">Resuelto</option>
                      <option value="CER">Cerrado</option>
                    </select>
                    <select
                      className="flex-1 sm:flex-none border rounded-md px-2 py-1.5 text-sm bg-white"
                      value={filtroSla}
                      onChange={e => setFiltroSla(e.target.value)}
                    >
                      <option value="">SLA: Todos</option>
                      <option value="vencida">🔴 Vencidas</option>
                      <option value="por_vencer">🟡 Por vencer (5 días)</option>
                      <option value="en_tiempo">🟢 En tiempo</option>
                      <option value="sin_sla">⚪ Sin SLA</option>
                    </select>
                    {filtroSla && (
                      <button
                        onClick={() => setFiltroSla("")}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        title="Limpiar filtro SLA"
                      >✕</button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {/* ── Pestaña PQRS Ciudadanas ── */}
                {tab === "pqrs" && (
                  loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : pqrsFiltradas.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No hay PQRS asignadas a esta área</p>
                    </div>
                  ) : (
                    <div className="divide-y max-h-[60vh] overflow-y-auto overscroll-contain">
                      {pqrsFiltradas.map(p => (
                        <button
                          key={p.id}
                          onClick={() => openDetail(p)}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.id === p.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-blue-600 mb-0.5">{p.numero_radicado ?? p.radicado}</p>
                              <p className="text-sm font-medium text-gray-900 truncate">{p.subject}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{contactName(p)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {getStatusBadge(p.status)}
                              <span className="text-xs text-gray-400">
                                {PQRS_TYPE_LABEL[(p.type ?? p.pqrs_type) as keyof typeof PQRS_TYPE_LABEL]}
                              </span>
                              {/* Badge SLA */}
                              {p.due_date && p.status !== "CER" && p.status !== "RES" && (() => {
                                const hoy = new Date().toISOString().slice(0, 10);
                                const dias = Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000);
                                if (p.due_date < hoy) return (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                    Vencida
                                  </span>
                                );
                                if (dias <= 5) return (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    Vence en {dias}d
                                  </span>
                                );
                                return null;
                              })()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
                {/* ── Pestaña Tickets Internos ── */}
                {tab === "tickets" && (
                  <div>
                    {/* Sub-tabs: Recibidos / Enviados */}
                    <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b">
                      <button
                        onClick={() => { setTicketSubTab("recibidos"); setTicketFiltroArea(""); }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          ticketSubTab === "recibidos"
                            ? "bg-indigo-100 text-indigo-800"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <Inbox className="w-3 h-3" /> Recibidos
                        <span className="ml-1 text-[10px] font-bold">{ticketsRecibidos.length}</span>
                      </button>
                      <button
                        onClick={() => { setTicketSubTab("enviados"); setTicketFiltroArea(""); }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          ticketSubTab === "enviados"
                            ? "bg-indigo-100 text-indigo-800"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <Send className="w-3 h-3" /> Enviados
                        <span className="ml-1 text-[10px] font-bold">{ticketsEnviados.length}</span>
                      </button>
                    </div>

                    {/* Cards de área como filtro de tickets */}
                    {ticketAreaStats.length > 0 && (
                      <div className="px-3 py-2 border-b bg-indigo-50/50">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {ticketSubTab === "recibidos" ? "Filtrar por área de origen" : "Filtrar por área destino"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setTicketFiltroArea("")}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                              ticketFiltroArea === ""
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                            }`}
                          >
                            Todas
                          </button>
                          {ticketAreaStats.map(({ id, name, count }) => (
                            <button
                              key={id}
                              onClick={() => setTicketFiltroArea(ticketFiltroArea === id ? "" : id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                ticketFiltroArea === id
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                              }`}
                            >
                              <Building2 className="w-2.5 h-2.5" />
                              {name}
                              <span className={`rounded-full px-1 text-[10px] font-bold ${
                                ticketFiltroArea === id ? "text-indigo-200" : "text-gray-400"
                              }`}>{count}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filtros de estado y prioridad */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
                      <select
                        value={ticketFiltroEstado}
                        onChange={e => setTicketFiltroEstado(e.target.value as TicketInternoStatus | "")}
                        className="flex-1 border rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        aria-label="Filtrar por estado"
                      >
                        <option value="">Todos los estados</option>
                        <option value="ABR">Abierto</option>
                        <option value="PRO">En proceso</option>
                        <option value="RES">Resuelto</option>
                        <option value="CER">Cerrado</option>
                      </select>
                      <select
                        value={ticketFiltroPrioridad}
                        onChange={e => setTicketFiltroPrioridad(e.target.value as PqrsPriority | "")}
                        className="flex-1 border rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        aria-label="Filtrar por prioridad"
                      >
                        <option value="">Todas las prioridades</option>
                        <option value="HIGH">Alta</option>
                        <option value="MED">Media</option>
                        <option value="LOW">Baja</option>
                      </select>
                      {(ticketFiltroEstado || ticketFiltroPrioridad || ticketFiltroArea) && (
                        <button
                          onClick={() => { setTicketFiltroEstado(""); setTicketFiltroPrioridad(""); setTicketFiltroArea(""); }}
                          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                          title="Limpiar filtros"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {loadingTickets ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      </div>
                    ) : (() => {
                      const listaBase = ticketSubTab === "recibidos" ? ticketsRecibidos : ticketsEnviados;
                      const lista = listaBase.filter(t =>
                        (!ticketFiltroEstado || t.status === ticketFiltroEstado) &&
                        (!ticketFiltroPrioridad || t.priority === ticketFiltroPrioridad) &&
                        (!ticketFiltroArea || (
                          ticketSubTab === "recibidos"
                            ? (t.origin_dependency ?? "sin_origen") === ticketFiltroArea
                            : (t.target_dependency ?? "sin_destino") === ticketFiltroArea
                        ))
                      );
                      const emptyLabel = ticketSubTab === "recibidos"
                        ? "No hay tickets recibidos de otras áreas"
                        : "Aún no has enviado tickets a otras áreas";
                      if (lista.length === 0) return (
                        <div className="text-center py-10 text-gray-400 space-y-2">
                          <Inbox className="w-9 h-9 mx-auto opacity-40" />
                          <p className="text-sm">{emptyLabel}</p>
                          {ticketSubTab === "enviados" && (
                            <button
                              onClick={() => setShowNewTicket(true)}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> Crear primer ticket
                            </button>
                          )}
                        </div>
                      );
                      return (
                        <div className="divide-y max-h-[55vh] overflow-y-auto overscroll-contain">
                          {lista.map(t => (
                            <button
                              key={t.id}
                              onClick={() => { setSelectedTicket(t); setSelected(null); }}
                              className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${selected?.id === t.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold uppercase ${
                                      ticketSubTab === "recibidos"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-indigo-100 text-indigo-700"
                                    }`}>
                                      {ticketSubTab === "recibidos" ? "Recibido" : "Enviado"}
                                    </span>
                                  <p className="text-xs font-mono text-indigo-600">{t.numero_ticket}</p>
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {ticketSubTab === "recibidos"
                                      ? `De: ${t.origin_dependency_info?.name ?? t.origin_dependency_name ?? (t.created_by && typeof t.created_by === "object" ? `${(t.created_by as any).nombre ?? ""} ${(t.created_by as any).apellido ?? ""}`.trim() : "Otra área")}`
                                      : `Para: ${t.target_dependency_info?.name ?? t.target_dependency_name ?? (t.target_dependency === null ? "Sin área destino" : "Otra área")}`
                                    }
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {getStatusBadge(t.status)}
                                  <span className="text-xs text-gray-400">{formatDateTime(t.created_at)}</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* ── Pestaña Certificados ── */}
                <AreaCertificates visible={tab === "certificates"} />
              </CardContent>
            </Card>
          </div>

          {/* ---- PANEL DE DETALLE Y RESPUESTA ----
               Solo se muestra cuando hay una PQRS seleccionada.
               En móvil ocupa toda la pantalla; en escritorio
               se ubica como columna derecha fija de 440 px.
          */}
          {selected && (
            <div className="w-full lg:w-[440px] shrink-0">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <button
                      className="lg:hidden flex items-center gap-1 text-sm text-blue-600"
                      onClick={() => setSelected(null)}
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <CardTitle className="text-base">Gestionar PQRS</CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        title="Exportar / Imprimir PQRSF física"
                        onClick={handlePrintPQRS}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => setSelected(null)} className="hidden lg:block text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto overscroll-contain">
                  {/* Info summary */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Radicado</span>
                      <span className="font-mono text-blue-600 font-medium">{selected.numero_radicado ?? selected.radicado}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo</span>
                      <span>{PQRS_TYPE_LABEL[(selected.type ?? selected.pqrs_type) as keyof typeof PQRS_TYPE_LABEL]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prioridad</span>
                      <span>{PQRS_PRIORITY_LABEL[selected.priority as keyof typeof PQRS_PRIORITY_LABEL]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Estado</span>
                      {getStatusBadge(selected.status)}
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500">Área</span>
                      {selected.dependency?.name ? (
                        <span className="text-blue-700 font-medium text-right">{selected.dependency.name}</span>
                      ) : (
                        <span className="text-gray-400 italic">Sin asignar</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ciudadano</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{contactName(selected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Correo electrónico</span>
                      <span className="flex items-center gap-1 text-right"><Mail className="w-3 h-3" />{contactEmail(selected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teléfono</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contactPhone(selected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fecha</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(selected.created_at)}</span>
                    </div>
                    {selected.due_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vence</span>
                        <span className="text-orange-600 font-medium">{formatDateTime(selected.due_date)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-700">{selected.subject}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Descripción</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100 min-h-[3rem]">
                      {descLoading
                        ? <span className="flex items-center gap-2 text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando descripción...</span>
                        : selected.description || <span className="italic text-gray-400">Sin descripción</span>}
                    </p>
                  </div>

                  {/* ── Adjuntos ── */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showAdjuntos;
                        setShowAdjuntos(next);
                        if (next && attachments.length === 0) {
                          if (selected.attachments?.length) setAttachments(selected.attachments);
                          loadAttachments(selected.id);
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                    >
                      <span className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        Adjuntos
                        {attachments.length > 0 && (
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full px-1.5">{attachments.length}</span>
                        )}
                      </span>
                      <span className="text-gray-400">{showAdjuntos ? "▲" : "▼"}</span>
                    </button>

                    {showAdjuntos && (
                      <div className="p-3 space-y-2">
                        {/* Upload */}
                        <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-lg py-3 cursor-pointer transition-colors ${uploading ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-blue-300 hover:border-blue-500 hover:bg-blue-50"}`}>
                          {uploading
                            ? <><Loader2 className="w-4 h-4 animate-spin text-blue-400" /><span className="text-sm text-gray-500">Subiendo...</span></>
                            : <><Upload className="w-4 h-4 text-blue-500" /><span className="text-sm text-blue-600 font-medium">Adjuntar archivo</span><span className="text-xs text-gray-400">(máx. 10 MB)</span></>}
                          <input
                            type="file"
                            className="sr-only"
                            disabled={uploading}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file && selected) handleUploadFile(selected.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {attachLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
                            <span className="text-xs text-gray-500">Cargando adjuntos...</span>
                          </div>
                        ) : attachments.length === 0 ? (
                          <div className="text-center py-4 text-gray-400">
                            <Paperclip className="w-6 h-6 mx-auto mb-1 opacity-40" />
                            <p className="text-xs">Sin archivos adjuntos</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {attachments.map(att => (
                              <div key={att.id} className="flex items-center justify-between border rounded px-3 py-2 bg-white text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="truncate text-gray-700 text-xs">{att.filename}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selected && handleDownloadAttachment(selected.id, att)}
                                  className="ml-2 shrink-0 text-blue-600 hover:text-blue-800"
                                  title="Descargar"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mx-auto"
                          onClick={() => selected && loadAttachments(selected.id)}
                        >
                          <RefreshCw className="w-3 h-3" /> Actualizar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Bitácora de actividades ── */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowBitacora(prev => !prev)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                    >
                      <span className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                        Bitácora
                        {pqrsActivities.length > 0 && (
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-100 rounded-full px-1.5">{pqrsActivities.length}</span>
                        )}
                      </span>
                      <span className="text-gray-400">{showBitacora ? "▲" : "▼"}</span>
                    </button>

                    {showBitacora && (
                      <div className="p-3 space-y-1">
                        {pqrsActivitiesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500 mr-2" />
                            <span className="text-xs text-gray-500">Cargando bitácora...</span>
                          </div>
                        ) : pqrsActivities.length === 0 ? (
                          <div className="text-center py-4 text-gray-400">
                            <Activity className="w-6 h-6 mx-auto mb-1 opacity-40" />
                            <p className="text-xs">Sin actividades registradas</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {pqrsActivities.map(a => {
                              const texto = a.detail ?? a.description ?? "";
                              const autor = a.performed_by ?? a.created_by ?? null;
                              const autorNombre = autor
                                ? typeof autor === "object"
                                  ? `${(autor as any).nombre ?? ""} ${(autor as any).apellido ?? ""}`.trim() || (autor as any).email || (autor as any).username || null
                                  : null
                                : null;
                              const label = a.activity_type_display ?? ({
                                CREATED:          "Radicación",
                                STATUS_CHANGED:   "Cambio de estado",
                                ASSIGNED:         "Asignación",
                                ESCALATED:        "Escalación",
                                RESPONSE_ADDED:   "Respuesta agregada",
                                ATTACHMENT_ADDED: "Adjunto agregado",
                                COMMENT:          "Comentario interno",
                                SLA_BREACH:       "Incumplimiento SLA",
                              } as Record<string, string>)[a.activity_type] ?? a.activity_type;
                              const cfg: Record<string, { icon: React.ReactNode; dot: string; badge: string }> = {
                                CREATED:          { icon: <FilePlus      className="w-3 h-3" />, dot: "bg-blue-500",   badge: "bg-blue-50   text-blue-700   border-blue-200"   },
                                STATUS_CHANGED:   { icon: <RefreshCw     className="w-3 h-3" />, dot: "bg-amber-500",  badge: "bg-amber-50  text-amber-700  border-amber-200"  },
                                ASSIGNED:         { icon: <Building2     className="w-3 h-3" />, dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                                ESCALATED:        { icon: <ArrowUpCircle className="w-3 h-3" />, dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
                                RESPONSE_ADDED:   { icon: <MessageSquare className="w-3 h-3" />, dot: "bg-green-500",  badge: "bg-green-50  text-green-700  border-green-200"  },
                                ATTACHMENT_ADDED: { icon: <Paperclip     className="w-3 h-3" />, dot: "bg-gray-400",   badge: "bg-gray-50   text-gray-600   border-gray-200"   },
                                COMMENT:          { icon: <StickyNote    className="w-3 h-3" />, dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border-purple-200" },
                                SLA_BREACH:       { icon: <ShieldAlert   className="w-3 h-3" />, dot: "bg-red-500",    badge: "bg-red-50    text-red-700    border-red-200"    },
                              };
                              const style = cfg[a.activity_type] ?? { icon: <Activity className="w-3 h-3" />, dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600 border-gray-200" };
                              return (
                                <div key={a.id} className="flex gap-2.5 py-2.5">
                                  <div className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${style.badge}`}>
                                      {style.icon}{label}
                                    </span>
                                    {texto && <p className="text-xs text-gray-700 leading-relaxed mt-0.5">{texto}</p>}
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {formatDateTime(a.created_at)}
                                      {autorNombre && ` · ${autorNombre}`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1 mx-auto pt-1"
                          onClick={() => {
                            setPqrsActivities([]);
                            setPqrsActivitiesLoading(true);
                            apiGetActivities(selected!.id)
                              .then(res => {
                                const acts = (Array.isArray(res) ? res : ((res as any).results ?? [])) as PQRSActivity[];
                                setPqrsActivities(acts.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
                              })
                              .catch(() => {})
                              .finally(() => setPqrsActivitiesLoading(false));
                          }}
                        >
                          <RefreshCw className="w-3 h-3" /> Actualizar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Asignar responsable dentro del área (solo Líder de Área) ── */}
                  {isAreaLeader && (
                    <div className="border rounded-lg p-3 space-y-2 bg-indigo-50/40 border-indigo-100">
                      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500" /> Asignar responsable del área
                      </p>
                      {areaUsers.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No hay integrantes registrados en tu área.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-0.5 bg-white">
                          {areaUsers.map(u => (
                            <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 text-sm select-none">
                              <input
                                type="checkbox"
                                className="rounded accent-indigo-600"
                                checked={selectedResponsibleIds.includes(u.id)}
                                onChange={e => setSelectedResponsibleIds(cur =>
                                  e.target.checked ? [...cur, u.id] : cur.filter(v => v !== u.id)
                                )}
                              />
                              <span className="truncate">{u.nombre} {u.apellido} <span className="text-gray-400 text-xs">· {u.email}</span></span>
                            </label>
                          ))}
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        disabled={assigningResponsible || selectedResponsibleIds.length === 0}
                        onClick={onAsignarResponsable}
                      >
                        {assigningResponsible ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Asignando...</> : "Asignar responsable"}
                      </Button>
                    </div>
                  )}

                  {/* Response form */}
                  <form onSubmit={handleSubmit(onResponder)} className="space-y-3">
                    <div>
                      <Label className="text-sm">Tipo de respuesta</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                        {...register("response_type")}
                      >
                        <option value="CITIZEN">Respuesta al ciudadano</option>
                        <option value="FINAL">Respuesta final</option>
                        <option value="INTERNAL">Nota interna</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-sm">Cambiar estado (opcional)</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                        {...register("new_status")}
                      >
                        <option value="">— Sin cambiar —</option>
                        <option value="PRO">En Proceso</option>
                        <option value="RES">Resuelto</option>
                        <option value="CER">Cerrado</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-sm">Respuesta / Nota *</Label>
                      <Textarea
                        className="mt-1 text-sm"
                        rows={4}
                        placeholder="Escriba su respuesta o nota interna..."
                        {...register("response_text", { required: "La respuesta es obligatoria" })}
                      />
                      {errors.response_text && (
                        <p className="text-red-500 text-xs mt-1">{errors.response_text.message}</p>
                      )}
                    </div>
                    {/* ── Archivos adjuntos a la respuesta ── */}
                    <div>
                      <Label className="text-sm">Archivos adjuntos (opcional)</Label>
                      <label className="mt-1 flex items-center gap-2 w-full border-2 border-dashed rounded-lg py-3 px-3 cursor-pointer transition-colors border-blue-300 hover:border-blue-500 hover:bg-blue-50">
                        <Paperclip className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-sm text-blue-600">Agregar archivos</span>
                        <span className="text-xs text-gray-400 ml-auto">máx. 10 MB c/u</span>
                        <input
                          type="file"
                          multiple
                          className="sr-only"
                          style={{ position: "fixed", top: 0, left: 0 }}
                          onChange={e => {
                            const nuevos = Array.from(e.target.files ?? []);
                            setRespondFiles(prev => [...prev, ...nuevos]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {respondFiles.length > 0 && (
                        <ul className="mt-1 space-y-1">
                          {respondFiles.map((f, i) => (
                            <li key={i} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-2 py-1">
                              <span className="truncate max-w-[200px]">{f.name}</span>
                              <button
                                type="button"
                                className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                                onClick={() => setRespondFiles(prev => prev.filter((_, idx) => idx !== i))}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : "Guardar Respuesta"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Ticket Interno Detail Modal ── */}
          <Dialog open={!!selectedTicket && !!ticketComputed} onOpenChange={open => { if (!open) { setSelectedTicket(null); setTicketMobileSidebarOpen(false); setTicketSidebarHidden(false); setTicketReplyHidden(false); } }}>
            <DialogContent className="p-0 overflow-hidden flex flex-col [&>button]:hidden max-sm:!rounded-none max-sm:!h-[100dvh] max-sm:!max-h-[100dvh]" style={{ maxHeight: "95vh", height: "95vh", width: "min(1300px, 97vw)", maxWidth: "min(1300px, 97vw)" }}>
              <DialogTitle className="sr-only">Detalle del Ticket</DialogTitle>
              {selectedTicket && ticketComputed && (
                <>
                  {/* ── Header ── */}
                  <div className="bg-indigo-700 text-white px-6 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-200 text-base font-mono font-semibold">{selectedTicket.numero_ticket}</span>
                        {getStatusBadge(selectedTicket.status)}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* ── Campana de notificaciones ── */}
                        <div className="relative" ref={notifPanelRef}>
                          <button
                            title="Notificaciones"
                            className="p-2 rounded hover:bg-white/15 transition-colors text-indigo-200 hover:text-white relative"
                            onClick={() => {
                              setShowNotifPanel(v => !v);
                              // Marcar todas como leídas al abrir
                              if (!showNotifPanel) {
                                setTicketNotifications(prev => prev.map(n => ({ ...n, read: true })));
                              }
                            }}
                          >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </button>
                          {showNotifPanel && (
                            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
                                <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                                {ticketNotifications.length > 0 && (
                                  <button
                                    className="text-xs text-indigo-600 hover:underline"
                                    onClick={() => setTicketNotifications([])}
                                  >
                                    Limpiar
                                  </button>
                                )}
                              </div>
                              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                                {ticketNotifications.length === 0 ? (
                                  <p className="text-center text-gray-400 text-sm py-6">Sin notificaciones</p>
                                ) : ticketNotifications.map(n => (
                                  <button
                                    key={n.id}
                                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${!n.read ? 'bg-indigo-50/60' : ''}`}
                                    onClick={() => {
                                      setTicketNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                      setShowNotifPanel(false);
                                      setTicketDetailTab('hilo');
                                    }}
                                  >
                                    <div className="flex items-start gap-2">
                                      {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                      <div className={!n.read ? '' : 'ml-3.5'}>
                                        <p className="text-xs font-semibold text-gray-800 truncate">{n.author} · {n.ticketNumero}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.detail}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          title="Marcar"
                          className="p-2 rounded hover:bg-white/15 transition-colors text-indigo-200 hover:text-white"
                          onClick={() => toast("Función disponible próximamente")}
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                        <button
                          title="Imprimir / Exportar informe"
                          className="p-2 rounded hover:bg-white/15 transition-colors text-indigo-200 hover:text-white"
                          onClick={handlePrintTicket}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {(usuario?.is_staff || isAreaLeader) && (
                          <button
                            title="Eliminar ticket"
                            className="p-2 rounded hover:bg-red-500/20 transition-colors text-indigo-200 hover:text-red-200"
                            onClick={() => setShowDeleteTicketDialog(true)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {/* [Móvil] Botón para mostrar/ocultar detalles */}
                        <button
                          className="md:hidden p-2 rounded hover:bg-white/15 transition-colors text-indigo-200 hover:text-white"
                          onClick={() => setTicketMobileSidebarOpen(v => !v)}
                          title="Detalles del ticket"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${ticketMobileSidebarOpen ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          onClick={() => setSelectedTicket(null)}
                          className="p-2 rounded hover:bg-white/15 transition-colors text-indigo-200 hover:text-white ml-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-white leading-snug">{selectedTicket.subject}</p>
                  </div>

                  {/* ── Body: columnas en escritorio, apilado en móvil ── */}
                  <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

                    {/* ── LEFT: Metadata sidebar ── */}
                    <div className={`md:shrink-0 md:border-b-0 border-b bg-gray-50 overflow-y-auto overscroll-contain flex-col max-h-[45vh] md:max-h-none transition-[width] duration-200 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none] ${ticketMobileSidebarOpen ? "flex" : "hidden md:flex"} ${ticketSidebarHidden ? "md:w-0 md:overflow-hidden md:border-r-0" : "md:w-72 md:border-r"}`}>
                      <div className="px-5 py-4 space-y-4 flex-1">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detalles del ticket</p>
                        <div className="space-y-3.5">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Estado</p>
                            {getStatusBadge(selectedTicket.status)}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Prioridad</p>
                            <p className="text-sm font-semibold text-gray-800">{PQRS_PRIORITY_LABEL[selectedTicket.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? selectedTicket.priority}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Área origen</p>
                            <p className="text-sm font-medium text-gray-800">{selectedTicket.origin_dependency_info?.name ?? selectedTicket.origin_dependency_name ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Área destino</p>
                            <p className="text-sm font-medium text-gray-800">{selectedTicket.target_dependency_info?.name ?? selectedTicket.target_dependency_name ?? (selectedTicket.target_dependency === null ? "Sin área destino" : "—")}</p>
                          </div>
                          {/* Asignación de ticket a área */}
                          {(() => {
                            // La asignación explícita (vía InternalTicketAssignment) tiene prioridad.
                            // Si no existe, el área responsable es target_dependency (asignación implícita
                            // generada automáticamente cuando se crea el ticket).
                            const activeAssign = ticketAssignments.find(a => a.is_active);
                            const implicitName =
                              selectedTicket.target_dependency_info?.name ??
                              selectedTicket.target_dependency_name ??
                              null;
                            const displayName = activeAssign?.dependency_name ?? implicitName;
                            const isReassignment = !!displayName; // siempre hay al menos target_dep
                            return (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs text-gray-500">Responsable</p>
                                  <button
                                    className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                                    onClick={() => setShowAssignForm(p => !p)}
                                  >
                                    {showAssignForm ? "Cancelar" : isReassignment ? "Reasignar" : "Asignar"}
                                  </button>
                                </div>
                                {!showAssignForm && (
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{displayName ?? "Sin área destino"}</p>
                                    {activeAssign && implicitName && activeAssign.dependency_name !== implicitName && (
                                      <p className="text-[10px] text-gray-400 mt-0.5">Origen: {implicitName}</p>
                                    )}
                                  </div>
                                )}
                                {showAssignForm && (
                                  <div className="space-y-1.5 mt-1">
                                    <select
                                      value={assignTicketDepId}
                                      onChange={e => setAssignTicketDepId(e.target.value)}
                                      className="w-full border rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700"
                                    >
                                      <option value="">Seleccionar área…</option>
                                      {deps.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Notas (opcional)"
                                      value={assignTicketNotes}
                                      onChange={e => setAssignTicketNotes(e.target.value)}
                                      className="w-full border rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 placeholder:text-gray-400"
                                    />
                                    <button
                                      disabled={!assignTicketDepId || submittingAssign}
                                      onClick={async () => {
                                        if (!assignTicketDepId) return;
                                        setSubmittingAssign(true);
                                        try {
                                          await apiAssignTicket(selectedTicket.id, assignTicketDepId, assignTicketNotes);
                                          const [assigns, acts] = await Promise.all([
                                            apiGetTicketAssignments(selectedTicket.id),
                                            apiGetTicketActivities(selectedTicket.id),
                                          ]);
                                          setTicketAssignments(assigns);
                                          setTicketActivities(acts);
                                          setShowAssignForm(false);
                                          setAssignTicketDepId("");
                                          setAssignTicketNotes("");
                                          toast.success("Ticket reasignado correctamente");
                                        } catch (e) {
                                          toast.error("Error al reasignar", { description: formatApiError(e) });
                                        } finally {
                                          setSubmittingAssign(false);
                                        }
                                      }}
                                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      {submittingAssign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                      Confirmar reasignación
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fuente</p>
                            <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-gray-400" />Sistema Interno</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Creado</p>
                            <p className="text-sm font-medium text-gray-800">{formatDateTime(selectedTicket.created_at)}</p>
                          </div>
                          <div>
                            <p className={`text-xs mb-1 ${ticketComputed.isOverdue ? "text-amber-600 font-medium" : "text-gray-500"}`}>Vencimiento</p>
                            <p className={`text-sm font-semibold ${ticketComputed.isOverdue ? "text-amber-700" : "text-gray-800"}`}>
                              {ticketComputed.dueDate.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                          </div>
                          {ticketActivities.filter(a => a.activity_type === "COMMENT").length > 0 && (() => {
                            const comments = ticketActivities.filter(a => a.activity_type === "COMMENT");
                            const last = comments[comments.length - 1];
                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Último comentario</p>
                                <p className="text-sm font-medium text-gray-800">{formatDateTime(last.created_at)}</p>
                              </div>
                            );
                          })()}
                          {/* Progreso de tareas */}
                          {ticketTasks.length > 0 && (() => {
                            const done = ticketTasks.filter(t => t.status === "DONE").length;
                            const pct = Math.round((done / ticketTasks.length) * 100);
                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-1.5">Tareas completadas</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-700">{done}/{ticketTasks.length}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Overdue banner */}
                      {ticketComputed.isOverdue && (
                        <div className="flex items-start gap-3 px-5 py-3 bg-amber-50 border-t border-amber-200 text-amber-700 shrink-0">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold">¡Marca de retraso!</p>
                            <p className="text-xs text-amber-600">
                              Venció el {ticketComputed.dueDate.toLocaleDateString("es-CO", { day: "2-digit", month: "long" })}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Status changer */}
                      <div className="border-t px-5 py-4 bg-white shrink-0">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Cambiar estado</p>
                        <div className="flex gap-2">
                          <select
                            className="flex-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                            value={ticketNewStatus}
                            onChange={e => setTicketNewStatus(e.target.value as TicketInternoStatus)}
                          >
                            <option value="ABR">Abierto</option>
                            <option value="PRO">En proceso</option>
                            <option value="RES">Resuelto</option>
                            <option value="CER">Cerrado</option>
                          </select>
                          <Button
                            size="sm"
                            disabled={submittingTicketStatus || ticketNewStatus === selectedTicket.status}
                            className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                            onClick={async () => {
                              if (!ticketNewStatus || ticketNewStatus === selectedTicket.status || submittingTicketStatus) return;
                              setSubmittingTicketStatus(true);
                              try {
                                await apiUpdateTicketInternoEstado(selectedTicket.id, { status: ticketNewStatus });
                                // Obtener el detalle completo para no perder campos expandidos (áreas, autor, etc.)
                                const full = await apiGetTicketInterno(selectedTicket.id);
                                setSelectedTicket(full);
                                setTicketNewStatus(full.status);
                                // Recargar actividades para mostrar el evento STATUS_CHANGE
                                const acts = await apiGetTicketActivities(selectedTicket.id);
                                setTicketActivities(acts);
                                await cargarTickets();
                                toast.success("Estado actualizado");
                              } catch (e) {
                                toast.error("Error al actualizar estado", { description: formatApiError(e) });
                              } finally {
                                setSubmittingTicketStatus(false);
                              }
                            }}
                          >
                            {submittingTicketStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* ── RIGHT: Thread + reply ── */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                      {/* Flecha para colapsar/expandir el panel de detalles (sólo desktop) */}
                      <button
                        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-5 h-12 bg-indigo-700 border-0 shadow-md rounded-r-lg hover:bg-indigo-600 transition-colors"
                        onClick={() => setTicketSidebarHidden(v => !v)}
                        title={ticketSidebarHidden ? "Mostrar detalles" : "Ocultar detalles"}
                      >
                        <ChevronRight className={`w-3 h-3 text-white transition-transform duration-200 ${ticketSidebarHidden ? "" : "rotate-180"}`} />
                      </button>

                      {/* [Móvil] Toggle para mostrar/ocultar el panel de metadatos */}
                      <button
                        className="md:hidden shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors w-full"
                        onClick={() => setTicketMobileSidebarOpen(v => !v)}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${ticketMobileSidebarOpen ? "rotate-180" : ""}`} />
                        {ticketMobileSidebarOpen ? "Ocultar detalles" : "Ver detalles del ticket"}
                      </button>

                      {/* Tabs — overflow-x-auto para scroll horizontal en móvil */}
                      <div className="flex overflow-x-auto border-b bg-white shrink-0 [&>button]:shrink-0">
                        <button
                          onClick={() => setTicketDetailTab("hilo")}
                          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                            ticketDetailTab === "hilo"
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Hilo ({ticketActivities.filter(a => a.activity_type === "COMMENT" || a.activity_type === "INTERNAL_NOTE").length + 1})
                          {/* Indicador de conexión WebSocket */}
                          <span title={wsStatus === "connected" ? "En tiempo real" : wsStatus === "connecting" ? "Conectando..." : "Sin conexión en vivo"}
                            className={`w-2 h-2 rounded-full ${
                              wsStatus === "connected"   ? "bg-emerald-500" :
                              wsStatus === "connecting" ? "bg-yellow-400 animate-pulse" :
                              "bg-gray-300"
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => setTicketDetailTab("tareas")}
                          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                            ticketDetailTab === "tareas"
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <CheckSquare className="w-4 h-4" />
                          Tareas ({ticketTasksLoading ? "..." : ticketComputed.tasks.length})
                        </button>
                        <button
                          onClick={() => setTicketDetailTab("calendario")}
                          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                            ticketDetailTab === "calendario"
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <CalendarDays className="w-4 h-4" />
                          Calendario
                        </button>
                        <button
                          onClick={() => setTicketDetailTab("adjuntos")}
                          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                            ticketDetailTab === "adjuntos"
                              ? "border-blue-600 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <Paperclip className="w-4 h-4" />
                          Adjuntos ({ticketAttachments.length})
                        </button>
                      </div>

                      {/* Scrollable body */}
                      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">

                        {/* Hilo tab */}
                        {ticketDetailTab === "hilo" && (
                          <div className="px-6 py-5 space-y-4">
                            {/* Mensaje original */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-3 border-b">
                                <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                  {ticketComputed.authorInitials}
                                </div>
                                <span className="text-base font-semibold text-gray-700 truncate">{ticketComputed.authorName}</span>
                                <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">publicado {formatDateTime(selectedTicket.created_at)}</span>
                              </div>
                              <div className="px-5 py-4 text-base text-gray-700 whitespace-pre-wrap leading-relaxed bg-white">
                                {selectedTicket.description}
                              </div>
                            </div>

                            {/* Hilo unificado: comentarios + eventos de actividad intercalados en orden cronológico */}
                            {ticketActivitiesLoading && ticketActivities.length === 0 && (
                              <div className="flex justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              </div>
                            )}
                            {[...ticketActivities]
                              .sort((a, b) => a.created_at.localeCompare(b.created_at))
                              .map(item => {
                                // ── Evento de actividad (pílldora intercalada) ──────────────
                                if (item.activity_type !== "COMMENT" && item.activity_type !== "INTERNAL_NOTE" && item.activity_type !== "ATTACHMENT_ADDED") {
                                  const who = item.performed_by ?? item.created_by;
                                  const whoName: string =
                                    item.performed_by_nombre
                                      ? item.performed_by_nombre
                                      : who && typeof who === "object"
                                        ? (`${(who as { nombre?: string }).nombre ?? ""} ${(who as { apellido?: string }).apellido ?? ""}`).trim() || item.performed_by_email || "Sistema"
                                        : typeof who === "string" ? who : item.performed_by_email || "Sistema";
                                  const pillColor =
                                    item.activity_type === "SLA_BREACH"     ? "bg-amber-50 border-amber-200 text-amber-700" :
                                    item.activity_type === "ESCALATED"      ? "bg-red-50 border-red-200 text-red-700" :
                                    item.activity_type === "STATUS_CHANGE"  ? "bg-indigo-50 border-indigo-200 text-indigo-700" :
                                    item.activity_type === "ASSIGNED"       ? "bg-green-50 border-green-200 text-green-700" :
                                    item.activity_type === "CREATED"        ? "bg-gray-50 border-gray-200 text-gray-500" :
                                                                              "bg-gray-50 border-gray-200 text-gray-500";
                                  return (
                                    <div key={item.id} className="flex items-center gap-2 my-1 min-w-0 w-full">
                                      <div className="flex-1 min-w-0 h-px bg-gray-200" />
                                      <span className={`flex flex-wrap justify-center min-w-0 max-w-full px-3 py-1 rounded-full border text-xs font-medium text-center whitespace-normal break-words [overflow-wrap:anywhere] ${pillColor}`}>
                                        {item.activity_type_display ?? item.activity_type}
                                        {item.detail ? ` — ${item.detail}` : ""}
                                        {" · "}{whoName}
                                        {" · "}{formatDateTime(item.created_at)}
                                      </span>
                                      <div className="flex-1 min-w-0 h-px bg-gray-200" />
                                    </div>
                                  );
                                }

                                // ── Adjunto ──────────────────────────────────────────────────
                                if (item.activity_type === "ATTACHMENT_ADDED") {
                                  const rawFilename = (item.detail ?? "").replace(/^Adjunto agregado:\s*/i, "").trim();
                                  const matched = ticketAttachments.find(
                                    a => a.filename === rawFilename || a.file?.split("/").pop() === rawFilename
                                  );
                                  const authorName: string =
                                    item.performed_by_nombre ? item.performed_by_nombre : item.performed_by_email || usuario?.nombre || "Usuario";
                                  return (
                                    <div key={item.id} className="rounded-lg overflow-hidden border border-blue-200">
                                      <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                                          <Paperclip className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 truncate">{authorName}</span>
                                        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{formatDateTime(item.created_at)}</span>
                                      </div>
                                      <div className="px-4 py-3 bg-white flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-700 truncate">{rawFilename || item.detail}</p>
                                          <p className="text-xs text-gray-400 mt-0.5">Archivo adjunto</p>
                                        </div>
                                        {matched?.file ? (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button type="button" onClick={() => setPreviewAttachment(matched)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors">
                                              <Eye className="w-3.5 h-3.5" /> Previsualizar
                                            </button>
                                            <a href={matched.file} download={rawFilename}
                                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                                              <Download className="w-3.5 h-3.5" /> Descargar
                                            </a>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic shrink-0">Vista no disponible</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                // ── Comentario / Nota interna ────────────────────────────────
                                const isInternal = item.activity_type === "INTERNAL_NOTE";
                                const authorName: string =
                                  item.performed_by_nombre
                                    ? item.performed_by_nombre
                                    : typeof item.performed_by === "object" && item.performed_by !== null
                                      ? (`${(item.performed_by as { nombre?: string }).nombre ?? ""} ${(item.performed_by as { apellido?: string }).apellido ?? ""}`).trim() || item.performed_by_email || usuario?.nombre || "Usuario"
                                      : typeof item.performed_by === "string"
                                        ? item.performed_by
                                        : item.performed_by_email || usuario?.nombre || "Usuario";
                                const initials = (authorName || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                                return (
                                  <div key={item.id} className={`rounded-lg overflow-hidden border ${isInternal ? "border-amber-300" : "border-gray-200"}`}>
                                    <div className={`flex items-center gap-3 px-4 py-3 border-b ${isInternal ? "bg-amber-50 border-amber-200" : "bg-gray-50"}`}>
                                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isInternal ? "bg-amber-500" : "bg-indigo-500"}`}>
                                        {initials}
                                      </div>
                                      <span className="text-base font-semibold text-gray-700 truncate">{authorName || "Usuario"}</span>
                                      {isInternal && (
                                        <span className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200 shrink-0">
                                          <Lock className="w-3 h-3" /> Solo visible para el equipo
                                        </span>
                                      )}
                                      <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">{formatDateTime(item.created_at)}</span>
                                    </div>
                                    <div className={`px-5 py-4 text-base text-gray-700 whitespace-pre-wrap leading-relaxed ${isInternal ? "bg-amber-50/40" : "bg-white"}`}>
                                      {(() => {
                                        const text = item.detail ?? item.description ?? "";
                                        const parts: React.ReactNode[] = [];
                                        const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
                                        let lastIdx = 0; let m: RegExpExecArray | null;
                                        while ((m = pattern.exec(text)) !== null) {
                                          if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
                                          if (m[1] && m[2]) {
                                            parts.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" className={`underline ${isInternal ? "text-amber-700 hover:text-amber-900" : "text-indigo-600 hover:text-indigo-800"}`}>{m[1]}</a>);
                                          } else {
                                            parts.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className={`underline break-all ${isInternal ? "text-amber-700 hover:text-amber-900" : "text-indigo-600 hover:text-indigo-800"}`}>{m[3]}</a>);
                                          }
                                          lastIdx = m.index + m[0].length;
                                        }
                                        if (lastIdx < text.length) parts.push(text.slice(lastIdx));
                                        return parts.length > 0 ? parts : text;
                                      })()}
                                    </div>
                                  </div>
                                );
                              })
                            }
                            {/* Centinela para auto-scroll al mensaje más reciente */}
                            <div ref={chatBottomRef} />
                          </div>
                        )}

                        {/* Tareas tab */}
                        {ticketDetailTab === "tareas" && (
                          <div className="px-5 py-4 space-y-3">

                            {/* ── Filtros por estado (pills) ── */}
                            <div className="space-y-2 pb-3 border-b">
                              <div className="flex flex-wrap gap-1.5">
                                {([
                                  { value: "" as const,            label: "Todas" },
                                  { value: "PENDING" as const,     label: "Pendiente" },
                                  { value: "IN_PROGRESS" as const, label: "En progreso" },
                                  { value: "DONE" as const,        label: "Completada" },
                                  { value: "CANCELLED" as const,   label: "Cancelada" },
                                ] as const).map(opt => {
                                  const count = opt.value === "" ? ticketTasks.length : ticketTasks.filter(t => t.status === opt.value).length;
                                  const isActive = taskFilterStatus === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => setTaskFilterStatus(opt.value as TicketTaskStatus | "")}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                        isActive
                                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                                      }`}
                                    >
                                      {opt.label}
                                      <span className={`text-[10px] font-bold rounded-full px-1 ${
                                        isActive ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"
                                      }`}>{count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Toggle "solo mis tareas" */}
                              <button
                                type="button"
                                onClick={() => setTaskFilterAssignedToMe(p => !p)}
                                className="flex items-center gap-2 group"
                              >
                                <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                                  taskFilterAssignedToMe ? "bg-indigo-600" : "bg-gray-200"
                                }`}>
                                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                    taskFilterAssignedToMe ? "translate-x-4" : "translate-x-0"
                                  }`} />
                                </span>
                                <span className="text-xs text-gray-600 group-hover:text-gray-800">Solo mis tareas</span>
                              </button>
                            </div>

                            {ticketTasksLoading && (
                              <div className="flex justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                              </div>
                            )}
                            {!ticketTasksLoading && ticketTasks.length === 0 && (
                              <p className="text-sm text-gray-400 text-center py-8">No hay tareas para este ticket</p>
                            )}
                            {(() => {
                              const TASK_CFG = {
                                PENDING:     { label: "Pendiente",   pill: "bg-yellow-50 border-yellow-200 text-yellow-700", card: "border-yellow-100 bg-yellow-50/30" },
                                IN_PROGRESS: { label: "En progreso", pill: "bg-blue-50 border-blue-200 text-blue-700",     card: "border-blue-100 bg-blue-50/30" },
                                DONE:        { label: "Completada",  pill: "bg-green-50 border-green-200 text-green-700",   card: "border-green-100 bg-green-50/30" },
                                CANCELLED:   { label: "Cancelada",   pill: "bg-gray-50 border-gray-200 text-gray-400",     card: "border-gray-100 bg-gray-50" },
                              } as const;
                              const myId = usuario?.id;
                              const filtered = ticketTasks.filter(task => {
                                if (taskFilterStatus && task.status !== taskFilterStatus) return false;
                                if (taskFilterAssignedToMe && myId && !(task.assigned_to ?? []).includes(myId)) return false;
                                return true;
                              });
                              if (!ticketTasksLoading && ticketTasks.length > 0 && filtered.length === 0) {
                                return (
                                  <div className="text-center py-6 space-y-1">
                                    <p className="text-sm text-gray-400">Sin tareas con los filtros aplicados.</p>
                                    <button type="button" onClick={() => { setTaskFilterStatus(""); setTaskFilterAssignedToMe(false); }} className="text-xs text-indigo-600 hover:underline">Limpiar filtros</button>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-1.5">
                                  {filtered.map(task => {
                                    const cfg = TASK_CFG[task.status] ?? TASK_CFG.PENDING;
                                    const isCancelled = task.status === "CANCELLED";
                                    const isDone      = task.status === "DONE";
                                    return (
                                      <div key={task.id} className={`rounded-lg border px-4 py-3 transition-all ${
                                        isCancelled ? "opacity-50" : ""
                                      } ${cfg.card}`}>
                                        {/* Fila principal: estado + título */}
                                        <div className="flex items-center gap-3">
                                          {/* Selector de estado inline */}
                                          <select
                                            disabled={submittingTask}
                                            value={task.status}
                                            onChange={async e => {
                                              const ns = e.target.value as TicketTaskStatus;
                                              try {
                                                const updated = await apiUpdateTicketTask(selectedTicket.id, task.id, { status: ns });
                                                setTicketTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                                                const acts = await apiGetTicketActivities(selectedTicket.id);
                                                setTicketActivities(acts);
                                              } catch { toast.error("Error al cambiar estado"); }
                                            }}
                                            className={`shrink-0 text-xs font-semibold border rounded-full px-3 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors appearance-none ${cfg.pill}`}
                                          >
                                            <option value="PENDING">Pendiente</option>
                                            <option value="IN_PROGRESS">En progreso</option>
                                            <option value="DONE">Completada</option>
                                            <option value="CANCELLED">Cancelada</option>
                                          </select>
                                          {/* Título */}
                                          <span className={`flex-1 text-[15px] font-medium leading-snug ${
                                            isCancelled ? "line-through text-gray-400" :
                                            isDone      ? "line-through text-gray-500" : "text-gray-800"
                                          }`}>{task.title}</span>
                                        </div>
                                        {/* Descripción */}
                                        {task.description && (
                                          <p className={`mt-2 text-sm leading-relaxed pl-1 border-l-2 border-indigo-100 ${
                                            isCancelled || isDone ? "text-gray-400" : "text-gray-600"
                                          }`}>{task.description}</p>
                                        )}
                                        {/* Área responsable */}
                                        {task.dependency_name && (
                                          <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                                            <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                                            <span className="text-xs text-gray-500">{task.dependency_name}</span>
                                          </div>
                                        )}
                                        {/* Fila secundaria: asignados + fecha + creador */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pl-1">
                                          {(task.assigned_to_nombres?.length ?? 0) > 0 && (
                                            <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                                              <User className="w-3.5 h-3.5 shrink-0" />
                                              {task.assigned_to_nombres!.join(", ")}
                                            </span>
                                          )}
                                          {task.due_date && (
                                            <span className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                                              task.is_overdue ? "text-amber-600" : "text-gray-500"
                                            }`}>
                                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                              {new Date(task.due_date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                                              {task.is_overdue && <span className="ml-1 text-amber-600 font-semibold">· Vencida</span>}
                                            </span>
                                          )}
                                          {task.created_by_nombre && (
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400 ml-auto">
                                              <FilePlus className="w-3 h-3 shrink-0" />
                                              {task.created_by_nombre}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* ── Formulario nueva tarea ── */}
                            <div className="pt-3 border-t space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newTaskText}
                                  onChange={e => setNewTaskText(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleTicketAddTask(); } }}
                                  placeholder="Título de la tarea..."
                                  className="flex-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 placeholder:text-gray-400"
                                />
                                <Button size="sm" onClick={handleTicketAddTask} disabled={!newTaskText.trim() || submittingTask} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
                                  {submittingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                                </Button>
                              </div>

                              <textarea
                                value={newTaskDescription}
                                onChange={e => setNewTaskDescription(e.target.value)}
                                placeholder="Descripción (opcional)..."
                                rows={2}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 placeholder:text-gray-400 resize-none"
                              />

                              <div className="flex flex-wrap gap-2 items-start">
                                {/* Picker de asignados con checkboxes */}
                                <div className="flex-1 min-w-[180px] relative">
                                  <button
                                    type="button"
                                    onClick={() => setShowAssigneePicker(p => !p)}
                                    className={`w-full flex items-center justify-between gap-1.5 border rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                                      showAssigneePicker ? "border-indigo-400 ring-1 ring-indigo-400" : "border-gray-200 hover:border-indigo-300"
                                    } bg-white text-gray-600`}
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      <User className="w-3 h-3 shrink-0 text-gray-400" />
                                      {newTaskAssignees.length === 0
                                        ? <span className="text-gray-400">Asignar a…</span>
                                        : <span className="text-indigo-600 font-medium">{newTaskAssignees.length} asignado{newTaskAssignees.length > 1 ? "s" : ""}</span>
                                      }
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform text-gray-400 ${showAssigneePicker ? "rotate-180" : ""}`} />
                                  </button>
                                  {showAssigneePicker && (
                                    <div className="absolute z-20 top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-[160px] overflow-y-auto">
                                      {eligibleAssignees.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-3 py-2">Sin miembros disponibles</p>
                                      ) : eligibleAssignees.map(a => {
                                        const isSel = newTaskAssignees.includes(a.id);
                                        return (
                                          <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => setNewTaskAssignees(prev =>
                                              isSel ? prev.filter(id => id !== a.id) : [...prev, a.id]
                                            )}
                                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors ${
                                              isSel ? "bg-indigo-50" : ""
                                            }`}
                                          >
                                            <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${
                                              isSel ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                            }`}>
                                              {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                                            </span>
                                            <span className="flex flex-col min-w-0">
                                              <span className="text-xs font-medium text-gray-700 truncate">{a.nombre_completo}</span>
                                              <span className="text-[10px] text-gray-400 truncate">{a.dependency_name}</span>
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Fecha límite */}
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <label className="text-[10px] text-gray-500 font-medium">Fecha límite</label>
                                  <input
                                    type="date"
                                    value={newTaskDueDate}
                                    min={new Date().toISOString().split("T")[0]}
                                    onChange={e => setNewTaskDueDate(e.target.value)}
                                    className="border rounded-md px-2 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                              </div>

                              {/* Tags de asignados seleccionados */}
                              {newTaskAssignees.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {eligibleAssignees.filter(a => newTaskAssignees.includes(a.id)).map(a => (
                                    <span key={a.id} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] font-medium rounded-full px-2.5 py-0.5 border border-indigo-100">
                                      {a.nombre_completo}
                                      <button type="button" onClick={() => setNewTaskAssignees(prev => prev.filter(id => id !== a.id))} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Calendario tab ── */}
                        {ticketDetailTab === "calendario" && (() => {
                          const [year, month] = calendarMonth.split("-").map(Number);
                          const firstDay = new Date(year, month - 1, 1);
                          const daysInMonth = new Date(year, month, 0).getDate();
                          const startOffset = (firstDay.getDay() + 6) % 7;

                          type CalEvent = {
                            type: "activity" | "task_due" | "task_created";
                            label: string;
                            color: string;
                            dot: string;
                            detail?: string;
                            time?: string;
                          };
                          const eventMap = new Map<string, CalEvent[]>();
                          const addEvent = (dateStr: string, ev: CalEvent) => {
                            if (!dateStr) return;
                            const key = dateStr.slice(0, 10);
                            eventMap.set(key, [...(eventMap.get(key) ?? []), ev]);
                          };

                          const ACT_COLORS: Record<string, { bg: string; dot: string }> = {
                            CREATED:         { bg: "bg-indigo-500",  dot: "bg-indigo-500" },
                            STATUS_CHANGED:  { bg: "bg-amber-500",   dot: "bg-amber-500" },
                            ASSIGNED:        { bg: "bg-blue-500",    dot: "bg-blue-500" },
                            ESCALATED:       { bg: "bg-purple-500",  dot: "bg-purple-500" },
                            COMMENT:         { bg: "bg-teal-500",    dot: "bg-teal-500" },
                            ATTACHMENT_ADDED:{ bg: "bg-pink-500",    dot: "bg-pink-500" },
                          };
                          const ACT_LABEL: Record<string, string> = {
                            CREATED: "Ticket creado", STATUS_CHANGED: "Cambio de estado",
                            ASSIGNED: "Asignación", ESCALATED: "Escalado",
                            COMMENT: "Comentario", ATTACHMENT_ADDED: "Adjunto",
                          };

                          ticketActivities.forEach(a => {
                            const cfg = ACT_COLORS[a.activity_type] ?? { bg: "bg-gray-400", dot: "bg-gray-400" };
                            addEvent(a.created_at, {
                              type: "activity",
                              label: ACT_LABEL[a.activity_type] ?? a.activity_type,
                              color: cfg.bg, dot: cfg.dot,
                              detail: a.detail ?? undefined,
                              time: a.created_at
                                ? new Date(a.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                                : undefined,
                            });
                          });
                          ticketTasks.forEach(t => {
                            if (t.due_date) addEvent(t.due_date, {
                              type: "task_due",
                              label: `Vence tarea`,
                              color: t.is_overdue ? "bg-red-500" : "bg-emerald-500",
                              dot:   t.is_overdue ? "bg-red-500" : "bg-emerald-500",
                              detail: t.title,
                            });
                            addEvent(t.created_at, {
                              type: "task_created",
                              label: "Tarea creada",
                              color: "bg-violet-500", dot: "bg-violet-500",
                              detail: t.title,
                              time: t.created_at
                                ? new Date(t.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                                : undefined,
                            });
                          });
                          addEvent(selectedTicket.created_at, {
                            type: "activity", label: "Ticket creado",
                            color: "bg-indigo-600", dot: "bg-indigo-600",
                            detail: `Asunto: ${selectedTicket.subject}`,
                            time: new Date(selectedTicket.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
                          });
                          const tdStr = selectedTicket.due_date ?? null;
                          if (tdStr) addEvent(tdStr, {
                            type: "task_due", label: "Vencimiento del ticket",
                            color: ticketComputed.isOverdue ? "bg-red-600" : "bg-amber-500",
                            dot:   ticketComputed.isOverdue ? "bg-red-600" : "bg-amber-500",
                            detail: selectedTicket.subject,
                          });

                          const prevMonth = () => {
                            const d = new Date(year, month - 2, 1);
                            setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                            setCalendarSelectedDay(null);
                          };
                          const nextMonth = () => {
                            const d = new Date(year, month, 1);
                            setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                            setCalendarSelectedDay(null);
                          };

                          const today = new Date().toISOString().slice(0, 10);
                          const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
                          const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

                          const cells: (number | null)[] = [
                            ...Array(startOffset).fill(null),
                            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                          ];
                          while (cells.length % 7 !== 0) cells.push(null);

                          const selEvents = calendarSelectedDay ? (eventMap.get(calendarSelectedDay) ?? []) : [];
                          const selDateLabel = calendarSelectedDay
                            ? new Date(calendarSelectedDay + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                            : null;

                          return (
                            <div className="flex gap-0 h-full">
                              {/* ── Grilla del calendario ── */}
                              <div className="flex-1 min-w-0 px-6 py-5">
                                {/* Navegación mes */}
                                <div className="flex items-center justify-between mb-4">
                                  <button type="button" onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                                    <ChevronDown className="w-4 h-4 rotate-90" />
                                  </button>
                                  <h3 className="text-base font-semibold text-gray-800">{MONTHS_ES[month - 1]} {year}</h3>
                                  <button type="button" onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                                    <ChevronDown className="w-4 h-4 -rotate-90" />
                                  </button>
                                </div>

                                {/* Cabecera días */}
                                <div className="grid grid-cols-7 mb-1">
                                  {DAYS.map(d => (
                                    <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase py-1">{d}</div>
                                  ))}
                                </div>

                                {/* Celdas */}
                                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                                  {cells.map((day, i) => {
                                    if (!day) return <div key={`e-${i}`} className="bg-gray-50 min-h-[68px]" />;
                                    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                    const events = eventMap.get(key) ?? [];
                                    const isToday   = key === today;
                                    const isSelected = key === calendarSelectedDay;
                                    const hasEvents  = events.length > 0;
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => setCalendarSelectedDay(isSelected ? null : key)}
                                        className={`min-h-[68px] p-1.5 flex flex-col text-left transition-colors ${
                                          isSelected
                                            ? "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
                                            : isToday
                                              ? "bg-white ring-2 ring-inset ring-indigo-300"
                                              : hasEvents
                                                ? "bg-white hover:bg-indigo-50/60 cursor-pointer"
                                                : "bg-white hover:bg-gray-50 cursor-default"
                                        }`}
                                      >
                                        <span className={`text-xs font-semibold mb-1 self-start w-5 h-5 flex items-center justify-center rounded-full ${
                                          isSelected ? "bg-indigo-600 text-white" :
                                          isToday    ? "bg-indigo-200 text-indigo-800" : "text-gray-600"
                                        }`}>{day}</span>
                                        <div className="space-y-0.5 overflow-hidden w-full">
                                          {events.slice(0, 2).map((ev, ei) => (
                                            <div key={ei} className={`${ev.color} text-white text-[9px] font-medium rounded px-1 py-0.5 truncate leading-tight`}>
                                              {ev.label}
                                            </div>
                                          ))}
                                          {events.length > 2 && (
                                            <div className="text-[9px] text-indigo-500 font-semibold pl-0.5">+{events.length - 2} más</div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Leyenda */}
                                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                                  {[
                                    { color: "bg-indigo-600", label: "Creación ticket" },
                                    { color: "bg-amber-500",  label: "Estado / vencimiento" },
                                    { color: "bg-teal-500",   label: "Comentario" },
                                    { color: "bg-blue-500",   label: "Asignación" },
                                    { color: "bg-violet-500", label: "Tarea creada" },
                                    { color: "bg-emerald-500",label: "Vence tarea" },
                                    { color: "bg-red-500",    label: "Vencida" },
                                  ].map(l => (
                                    <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                                      <span className={`w-2.5 h-2.5 rounded-sm ${l.color} shrink-0`} />
                                      {l.label}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* ── Panel lateral de detalle del día ── */}
                              <div className={`shrink-0 border-l bg-gray-50 flex flex-col transition-all duration-200 overflow-hidden ${
                                calendarSelectedDay ? "w-72" : "w-0 border-l-0"
                              }`}>
                                {calendarSelectedDay && (
                                  <>
                                    {/* Header del panel */}
                                    <div className="flex items-start justify-between gap-2 px-4 py-3 border-b bg-white shrink-0">
                                      <div>
                                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Eventos del día</p>
                                        <p className="text-sm font-semibold text-gray-800 mt-0.5 capitalize">{selDateLabel}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setCalendarSelectedDay(null)}
                                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {/* Lista de eventos */}
                                    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2">
                                      {selEvents.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                                          <CalendarDays className="w-8 h-8 text-gray-300" />
                                          <p className="text-sm text-gray-400">Sin eventos este día</p>
                                        </div>
                                      ) : selEvents.map((ev, idx) => (
                                        <div key={idx} className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ev.dot}`} />
                                            <span className="text-xs font-semibold text-gray-700">{ev.label}</span>
                                            {ev.time && (
                                              <span className="ml-auto text-[11px] text-gray-400 shrink-0">{ev.time}</span>
                                            )}
                                          </div>
                                          {ev.detail && (
                                            <p className="text-xs text-gray-500 leading-snug pl-[18px]">{ev.detail}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Footer con total */}
                                    {selEvents.length > 0 && (
                                      <div className="px-4 py-2.5 border-t bg-white shrink-0">
                                        <p className="text-xs text-gray-400">
                                          <span className="font-semibold text-gray-600">{selEvents.length}</span> evento{selEvents.length !== 1 ? "s" : ""} registrado{selEvents.length !== 1 ? "s" : ""}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Adjuntos tab */}
                        {ticketDetailTab === "adjuntos" && (
                          <div className="px-6 py-5">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-semibold text-gray-700">
                                Archivos adjuntos ({ticketAttachments.length})
                              </h3>
                            </div>

                            {ticketAttachments.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                                <Paperclip className="w-10 h-10 text-gray-300" />
                                <p className="text-sm font-medium text-gray-400">Sin archivos adjuntos</p>
                                <p className="text-xs text-gray-400">Adjunta archivos desde el área de respuesta del hilo</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {ticketAttachments.map(att => {
                                  const ext = att.filename?.split(".").pop()?.toLowerCase() ?? "";
                                  const isImg = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
                                  const isPdf = ext === "pdf";
                                  const uploaderName: string =
                                    att.uploaded_by && typeof att.uploaded_by === "object"
                                      ? (`${(att.uploaded_by as { nombre?: string }).nombre ?? ""} ${(att.uploaded_by as { apellido?: string }).apellido ?? ""}`).trim() || (att.uploaded_by as { email?: string }).email || "Usuario"
                                      : typeof att.uploaded_by === "string"
                                        ? att.uploaded_by
                                        : "Usuario";
                                  return (
                                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors group">
                                      {/* Icono de tipo de archivo */}
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                                        isImg ? "bg-emerald-500" : isPdf ? "bg-red-500" : "bg-blue-500"
                                      }`}>
                                        {isImg ? <FileText className="w-5 h-5" /> : isPdf ? <FileText className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                                      </div>

                                      {/* Nombre + meta */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{att.filename}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          {uploaderName} · {formatDateTime(att.created_at)}
                                        </p>
                                      </div>

                                      {/* Acciones */}
                                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(isImg || isPdf) && (
                                          <button
                                            type="button"
                                            onClick={() => setPreviewAttachment(att)}
                                            className="p-1.5 rounded-md hover:bg-indigo-100 text-gray-500 hover:text-indigo-600 transition-colors"
                                            title="Previsualizar"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => selected && handleDownloadAttachment(selected.id, att)}
                                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
                                          title="Descargar"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                      {/* Ext badge siempre visible */}
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                                        isImg ? "bg-emerald-100 text-emerald-700" : isPdf ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                                      }`}>
                                        {ext || "—"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reply area — solo visible en el hilo */}
                      {ticketDetailTab === "hilo" && (
                      <div className="shrink-0 bg-white">
                        {/* Handle strip en el borde superior — siempre visible */}
                        <div className="border-t flex justify-center py-1.5">
                          <button
                            className="flex items-center justify-center w-12 h-5 bg-indigo-700 rounded-full shadow-md hover:bg-indigo-600 transition-colors"
                            onClick={() => setTicketReplyHidden(v => !v)}
                            title={ticketReplyHidden ? "Mostrar respuesta" : "Ocultar respuesta"}
                          >
                            <ChevronDown className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${ticketReplyHidden ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {!ticketReplyHidden && (
                        <div className="px-5 pt-2 pb-4 overflow-y-auto max-h-72 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                        {/* Tabs: Publicar Respuesta / Nota Interna */}
                        <div className="flex border-b mb-3">
                          <button
                            onClick={() => setTicketReplyMode("respuesta")}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                              ticketReplyMode === "respuesta"
                                ? "border-indigo-600 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <Reply className="w-3.5 h-3.5" /> Publicar Respuesta
                          </button>
                          <button
                            onClick={() => setTicketReplyMode("nota_interna")}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                              ticketReplyMode === "nota_interna"
                                ? "border-amber-500 text-amber-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <StickyNote className="w-3.5 h-3.5" /> Nota interna
                          </button>
                        </div>

                        {/* Barra de herramientas: adjuntar archivo / insertar link */}
                        <div className="flex items-center gap-2 mb-2">
                          {/* Botón adjuntar archivo */}
                          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors select-none ${
                            ticketReplyMode === "nota_interna"
                              ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}>
                            <Paperclip className="w-3.5 h-3.5" />
                            Adjuntar archivo
                            <input
                              type="file"
                              multiple
                              className="sr-only"
                              disabled={submittingReply}
                              onChange={e => {
                                const files = Array.from(e.target.files ?? []);
                                if (files.length > 0) {
                                  setTicketReplyFiles(prev => [...prev, ...files]);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>

                          {/* Botón insertar link */}
                          <button
                            type="button"
                            onClick={() => { setShowLinkInput(v => !v); setReplyLinkUrl(""); setReplyLinkLabel(""); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                              showLinkInput
                                ? ticketReplyMode === "nota_interna"
                                  ? "border-amber-400 bg-amber-50 text-amber-700"
                                  : "border-indigo-400 bg-indigo-50 text-indigo-700"
                                : ticketReplyMode === "nota_interna"
                                  ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                            Insertar link
                          </button>
                        </div>

                        {/* Mini-formulario de insertar link */}
                        {showLinkInput && (
                          <div className={`flex items-center gap-2 mb-2 p-2.5 rounded-lg border ${
                            ticketReplyMode === "nota_interna" ? "border-amber-200 bg-amber-50/40" : "border-indigo-100 bg-indigo-50/30"
                          }`}>
                            <Input
                              type="url"
                              placeholder="https://..."
                              value={replyLinkUrl}
                              onChange={e => setReplyLinkUrl(e.target.value)}
                              className="h-7 text-xs flex-1 min-w-0"
                            />
                            <Input
                              type="text"
                              placeholder="Texto del link (opcional)"
                              value={replyLinkLabel}
                              onChange={e => setReplyLinkLabel(e.target.value)}
                              className="h-7 text-xs w-44"
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              disabled={!replyLinkUrl.trim()}
                              onClick={() => {
                                const url = replyLinkUrl.trim();
                                const label = replyLinkLabel.trim();
                                const insertion = label ? `[${label}](${url})` : url;
                                setTicketReplyText(prev => (prev ? `${prev}\n${insertion}` : insertion));
                                setShowLinkInput(false);
                                setReplyLinkUrl("");
                                setReplyLinkLabel("");
                              }}
                            >
                              Insertar
                            </Button>
                            <button
                              type="button"
                              onClick={() => { setShowLinkInput(false); setReplyLinkUrl(""); setReplyLinkLabel(""); }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Chips de archivos pendientes */}
                        {ticketReplyFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {ticketReplyFiles.map((f, idx) => (
                              <span
                                key={idx}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                  ticketReplyMode === "nota_interna"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-indigo-50 border-indigo-200 text-indigo-700"
                                }`}
                              >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span className="max-w-[180px] truncate">{f.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setTicketReplyFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="ml-0.5 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <Textarea
                          value={ticketReplyText}
                          onChange={e => {
                            setTicketReplyText(e.target.value);
                            // Enviar indicador de escritura al canal WS (throttled a 2 s)
                            if (!sendTypingThrottleRef.current) {
                              sendTyping();
                              sendTypingThrottleRef.current = setTimeout(() => {
                                sendTypingThrottleRef.current = null;
                              }, 2_000);
                            }
                          }}
                          placeholder={
                            ticketReplyMode === "nota_interna"
                              ? "Nota interna (solo visible para el equipo)..."
                              : "Escribe tu respuesta al ticket..."
                          }
                          rows={3}
                          className={`text-sm mb-3 resize-none ${ticketReplyMode === "nota_interna" ? "border-amber-200 focus:ring-amber-400 bg-amber-50/30" : ""}`}
                        />
                        {/* Indicador de escritura en tiempo real */}
                        {typingUser && (
                          <p className="text-xs text-gray-400 italic mb-2 flex items-center gap-1.5">
                            <span className="inline-flex gap-0.5">
                              {[0,1,2].map(i => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                              ))}
                            </span>
                            {typingUser} está escribiendo…
                          </p>
                        )}
                        <div className="flex justify-end">
                          <Button
                            disabled={(!ticketReplyText.trim() && ticketReplyFiles.length === 0) || submittingReply}
                            onClick={handleTicketAddReply}
                            className={ticketReplyMode === "nota_interna" ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-indigo-600 hover:bg-indigo-700"}
                          >
                            {submittingReply
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publicando...</>
                              : ticketReplyMode === "nota_interna"
                                ? <><StickyNote className="w-4 h-4 mr-2" />Guardar nota</>
                                : <><Send className="w-4 h-4 mr-2" />Publicar respuesta</>}
                          </Button>
                        </div>
                        </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ====================================================
          MODAL: Confirmar eliminación de ticket (con contraseña)
      ==================================================== */}
      <Dialog open={showDeleteTicketDialog} onOpenChange={(open) => { setShowDeleteTicketDialog(open); if (!open) setDeleteTicketPassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Eliminar ticket
            </DialogTitle>
            <DialogDescription>
              Esta acción es permanente y borrará el ticket {selectedTicket?.numero_ticket} junto con su
              historial, adjuntos y tareas. Ingresa la contraseña de eliminación configurada por el administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete_ticket_password">Contraseña</Label>
            <Input
              id="delete_ticket_password"
              type="password"
              value={deleteTicketPassword}
              onChange={(e) => setDeleteTicketPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteTicket(); }}
              autoFocus
            />
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setShowDeleteTicketDialog(false)} disabled={deletingTicket}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTicket} disabled={deletingTicket}>
              {deletingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================================================
          MODAL: Previsualización de adjunto
      ==================================================== */}
      <Dialog open={!!previewAttachment} onOpenChange={open => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden" style={{ maxHeight: '90vh' }}>
          <DialogHeader className="flex flex-row items-center gap-3 pl-5 pr-16 py-3 border-b bg-white shrink-0">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shrink-0">
              {(() => {
                const ext = previewAttachment?.filename?.split(".").pop()?.toLowerCase() ?? "";
                const isImg = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
                return isImg ? <FileText className="w-4 h-4" /> : <FileText className="w-4 h-4" />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold truncate leading-tight">
                {previewAttachment?.filename}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400 leading-tight">
                Previsualización del archivo
              </DialogDescription>
            </div>
            <a
              href={previewAttachment?.file ?? ""}
              download={previewAttachment?.filename}
              className="relative z-10 mr-8 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </a>
          </DialogHeader>
          <div className="bg-gray-100 flex overflow-auto" style={{ height: 'calc(90vh - 64px)' }}>
            {(() => {
              if (!previewAttachment) return null;
              const ext = previewAttachment.filename?.split(".").pop()?.toLowerCase() ?? "";
              const isImg = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
              const isPdf = ext === "pdf";
              if (previewLoading) {
                return (
                  <div className="flex flex-col items-center justify-center gap-3 text-gray-400 w-full">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Cargando archivo...</p>
                  </div>
                );
              }
              if (!previewBlobUrl && !previewPdfData) {
                return (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400 w-full">
                    <FileText className="w-12 h-12" />
                    <p className="text-sm">No se pudo cargar la previsualización</p>
                  </div>
                );
              }
              if (isImg) {
                return (
                  <div className="flex items-center justify-center w-full">
                    <img
                      src={previewBlobUrl!}
                      alt={previewAttachment.filename}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  </div>
                );
              }
              if (isPdf && previewPdfData) {
                return (
                  <PdfPreview data={previewPdfData} />
                );
              }
              return (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400 w-full">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm">Previsualización no disponible para este tipo de archivo</p>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

          </div>{/* end flex-1 min-w-0 (content wrapper) */}
        </div>{/* end flex gap-4 items-start (sidebar + content) */}

      {/* ====================================================
          MODAL: Crear Ticket Interno entre áreas
      ==================================================== */}
      <Dialog open={showNewTicket} onOpenChange={open => { setShowNewTicket(open); if (!open) { resetTicket(); setNewTicketFiles([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              Crear Ticket Interno
            </DialogTitle>
            <DialogDescription>
              Envía una solicitud interna a otra área de la institución. Solo visible para el personal autorizado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTicket(onCrearTicket)} className="space-y-4 pt-2">
            {/* Área destino */}
            <div>
              <Label className="text-sm font-medium">Área destino *</Label>
              <select
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                {...regTicket("target_dependency", { required: "Seleccione un área destino" })}
              >
                <option value="">— Seleccionar área —</option>
                {deps.map(d => (
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
                placeholder="Describa brevemente el asunto"
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
              <Textarea
                className="mt-1 text-sm"
                rows={4}
                placeholder="Detalle el contenido del ticket interno..."
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
                    if (files.length) setNewTicketFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </label>
              {newTicketFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {newTicketFiles.map((file, idx) => (
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
                        onClick={() => setNewTicketFiles((prev) => prev.filter((_, i) => i !== idx))}
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

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowNewTicket(false); resetTicket(); setNewTicketFiles([]); }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submittingTicket}>
                {submittingTicket
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</>
                  : <><Send className="w-4 h-4 mr-2" /> Crear Ticket</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}