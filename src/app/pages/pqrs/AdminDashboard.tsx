/**
 * @file AdminDashboard.tsx
 * @description Panel de administración del sistema PQRS.
 *   Centraliza la gestión completa del ciclo de vida de cada PQRS:
 *   - Listado, búsqueda y filtrado avanzado de solicitudes.
 *   - Asignación de responsables y dependencias.
 *   - Respuesta, cambio de estado y escalado.
 *   - Visualización de actividad, historial, adjuntos y estadísticas mediante gráficas.
 *   - Exportación de datos en formato CSV y Excel.
 *
 * @requires role ADMIN — La ruta que renderiza este componente debe estar protegida
 *   por el guard de roles correspondiente en `routes.tsx`.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import {
  LayoutDashboard, FileText, Clock, CheckCircle2,
  AlertCircle, X, Building2, Search, Filter, ArrowLeft,
  User, Calendar, Loader2,
  ArrowUpCircle, Activity, MessageSquare,
  BarChart2, Paperclip, Upload, Download, RefreshCw,
  TrendingUp, ShieldAlert, Target, FileSpreadsheet, FileDown,
  ChevronDown, FilePlus, StickyNote, Tag, Printer,
  BookOpen as GraduationCap, Mail, Phone, Archive, ArchiveRestore,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import {
  apiListPQRS, apiListDependencies, apiListAllUsers,
  apiAssignPQRS, apiRespondPQRS, apiUpdateEstado, apiEscalatePQRS,
  apiGetActivities, apiGetResponses, apiGetEscalations, apiGetAssignments, apiGetPQRS,
  apiGetDashboard, apiGetAttachments, apiUploadAttachment, apiDownloadAttachment,
  apiExportCSV, apiExportExcel, apiListTickets, apiArchivePQRS, ExportFilters,
  PqrsAPI, Dependency, UsuarioAPI, PqrsResponseAPI, PQRSActivity, PQRSEscalation, AssignmentAPI,
  PqrsStatus, PqrsType, TicketInternoAPI,
  DashboardAPI, Attachment,
  PQRS_STATUS_LABEL, PQRS_TYPE_LABEL, PQRS_PRIORITY_LABEL, PQRS_CANAL_LABEL,
  formatApiError, resolveDepId,
} from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { generateAdminReport } from "../../lib/generateAdminReport";
import { FormattingToolbar } from "../../components/ui/FormattingToolbar";
import { parseRichText } from "../../lib/richText";

/**
 * Formulario de respuesta a una PQRS.
 * @property content       - Texto de la respuesta (mínimo 10 caracteres).
 * @property response_type - Tipo de respuesta:
 *   - `CITIZEN`  → visible para el ciudadano.
 *   - `FINAL`    → respuesta final/cierre del caso.
 *   - `INTERNAL` → nota interna, no visible para el ciudadano.
 * @property new_status    - Estado destino de la PQRS (vacío = sin cambio de estado).
 */
interface RespondForm {
  content: string;
  response_type: "CITIZEN" | "FINAL" | "INTERNAL";
  new_status: string;
}

/**
 * Formulario de asignación de una PQRS a múltiples responsables y/o dependencias.
 * @property responsible_users - IDs de los usuarios responsables asignados.
 * @property dependencies      - IDs de las dependencias destino.
 * @property notes             - Notas adicionales para la asignación.
 */
interface AssignForm {
  responsible_users: string[];
  dependencies: string[];
  notes: string;
}

/**
 * Formulario de escalado de una PQRS a otra dependencia o usuario.
 * @property to_dependency - ID de la dependencia destino del escalado.
 * @property to_user       - ID del usuario al que se escala.
 * @property reason        - Código del motivo (choices del backend):
 *   - `SLA`        → incumplimiento de plazo.
 *   - `COMPLEXITY` → complejidad técnica.
 *   - `COMPETENCE` → no es competencia del área actual.
 *   - `OTHER`      → otro motivo.
 * @property notes         - Texto libre complementario al motivo.
 */
interface EscalateForm {
  to_dependency: string;
  to_user: string;
  /** Código de motivo (choices del backend). */
  reason: "SLA" | "COMPLEXITY" | "COMPETENCE" | "OTHER";
  /** Texto libre complementario. */
  notes: string;
}

/**
 * Pestañas disponibles en el panel lateral de detalle de una PQRS:
 * - `respond`  → formulario de respuesta / cambio de estado.
 * - `assign`   → asignación de responsable y dependencia.
 * - `escalate` → escalado a otra dependencia o usuario.
 * - `history`  → historial de actividades, respuestas y escalados.
 * - `adjuntos` → archivos adjuntos vinculados a la PQRS.
 */
type DetailTab = "respond" | "assign" | "escalate" | "history" | "adjuntos";

/**
 * Mapa de clases CSS de Tailwind por estado de PQRS.
 * Se usa en el componente `StatusBadge` para colorear visualmente cada estado.
 * - `RAD` = Radicado   → azul
 * - `PRO` = En Proceso → amarillo
 * - `RES` = Resuelto   → verde
 * - `CER` = Cerrado    → gris
 */
const BADGE_CFG: Record<string, string> = {
  RAD: "bg-blue-100 text-blue-800",
  PRO: "bg-yellow-100 text-yellow-800",
  RES: "bg-green-100 text-green-800",
  CER: "bg-gray-100 text-gray-800",
};

/**
 * Componente auxiliar que renderiza una pastilla (badge) coloreada según el estado de la PQRS.
 * @param status - Código de estado devuelto por el backend (RAD, PRO, RES, CER).
 */
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      BADGE_CFG[status] ?? "bg-gray-100 text-gray-700"
    }`}>
      {PQRS_STATUS_LABEL[status as keyof typeof PQRS_STATUS_LABEL] ?? status}
    </span>
  );
}

/** Componente principal del Panel de Administración. */
export function AdminDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  // ── Datos maestros ────────────────────────────────────────────────────────
  /** Lista completa de PQRS cargadas del backend */
  const [pqrsList, setPqrsList] = useState<PqrsAPI[]>([]);
  /** IDs de PQRS que aún no tienen ninguna asignación activa */
  const [sinAsignarIds, setSinAsignarIds] = useState<Set<string>>(new Set());
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [allUsers, setAllUsers] = useState<UsuarioAPI[]>([]);

  // UI state
  const [selected, setSelected] = useState<PqrsAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroArea, setFiltroArea] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("respond");

  // archivado masivo
  /** IDs marcados con el checkbox de la lista (solo se actúa sobre los que siguen visibles). */
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  /** `true` = la lista muestra las PQRS archivadas en lugar de las activas. */
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [archivadasList, setArchivadasList] = useState<PqrsAPI[]>([]);
  const [archivadasLoading, setArchivadasLoading] = useState(false);
  const [showConfirmArchivar, setShowConfirmArchivar] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // assign-tab: driven by the form's own dependency field
  // workload: userId -> active assignment count
  const [userWorkloadMap, setUserWorkloadMap] = useState<Map<string, number>>(new Map());
  const [assignAreaSearch, setAssignAreaSearch] = useState("");
  const [assignUserSearch, setAssignUserSearch] = useState("");

  // history (lazy loaded per-PQRS)
  const [historyLoading, setHistoryLoading] = useState(false);
  const [responses, setResponses] = useState<PqrsResponseAPI[]>([]);
  const [activities, setActivities] = useState<PQRSActivity[]>([]);
  const [escalations, setEscalations] = useState<PQRSEscalation[]>([]);
  // active assignment for the selected PQRS
  const [activeAssignment, setActiveAssignment] = useState<AssignmentAPI | null>(null);
  const [allAssignments, setAllAssignments] = useState<AssignmentAPI[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState(false);

  // analytics
  const [viewMode, setViewMode] = useState<"list" | "analytics">("list");
  const [dashData, setDashData] = useState<DashboardAPI | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  // filtro de período para analíticas: días hacia atrás (0 = todos)
  const [periodDays, setPeriodDays] = useState(30);
  // índice activo (hover) en la dona de estados
  const [activeEstadoIndex, setActiveEstadoIndex] = useState<number | undefined>(undefined);
  // comparativa temporal
  const [compMode,    setCompMode]    = useState<"monthly" | "year-vs-year" | "month-vs-month">("monthly");
  const [compMetric,  setCompMetric]  = useState<"total" | "resueltas" | "enProceso">("total");
  const [compYearA,   setCompYearA]   = useState("");
  const [compYearB,   setCompYearB]   = useState("");
  const [compMonthA,  setCompMonthA]  = useState("");
  const [compMonthB,  setCompMonthB]  = useState("");

  // attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // files selected to attach to the next response
  const [respondFiles, setRespondFiles] = useState<File[]>([]);

  // export report panel
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);
  const [exportFilters, setExportFilters] = useState<ExportFilters>({});
  const [exportTickets, setExportTickets] = useState<TicketInternoAPI[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const respondForm  = useForm<RespondForm>({ defaultValues: { response_type: "CITIZEN", new_status: "", content: "" } });
  const assignForm   = useForm<AssignForm>({ defaultValues: { responsible_users: [], dependencies: [], notes: "" } });
  const escalateForm = useForm<EscalateForm>({ defaultValues: { to_dependency: "", to_user: "", reason: "OTHER", notes: "" } });
  const respondContentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { ref: respondContentRefCb, ...respondContentReg } = respondForm.register("content", { required: "Campo obligatorio" });

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    // Use allSettled so a single failing endpoint doesn't blank out everything else.
    const [pqrsResult, sinAsignarResult, depsResult, usersResult] = await Promise.allSettled([
      apiListPQRS({ page_size: 200 }),
      apiListPQRS({ sin_asignar: true, page_size: 200 }),
      apiListDependencies(true),
      apiListAllUsers(),
    ]);

    if (pqrsResult.status === "fulfilled") {
      const items = Array.isArray(pqrsResult.value) ? pqrsResult.value : (pqrsResult.value as any).results ?? [];
      setPqrsList(items.sort((a: PqrsAPI, b: PqrsAPI) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } else {
      toast.error("Error al cargar PQRS", { description: formatApiError(pqrsResult.reason) });
    }

    if (sinAsignarResult.status === "fulfilled") {
      const sinAsignarItems: PqrsAPI[] = Array.isArray(sinAsignarResult.value)
        ? sinAsignarResult.value
        : (sinAsignarResult.value as any).results ?? [];
      setSinAsignarIds(new Set(sinAsignarItems.map((p: PqrsAPI) => p.id)));
    }
    // sinAsignar failing is non-critical — leave existing set as fallback.

    if (depsResult.status === "fulfilled") {
      setDependencies(Array.isArray(depsResult.value) ? depsResult.value : (depsResult.value as any).results ?? []);
    } else {
      toast.error("Error al cargar dependencias", { description: formatApiError(depsResult.reason) });
    }

    if (usersResult.status === "fulfilled") {
      setAllUsers(Array.isArray(usersResult.value) ? usersResult.value : (usersResult.value as any).results ?? []);
    } else {
      toast.error("Error al cargar usuarios", { description: formatApiError(usersResult.reason) });
    }

    setLoading(false);
  }, []);

  const loadHistory = useCallback(async (pqrsId: string) => {
    setHistoryLoading(true);
    try {
      const [resRes, actRes, escRes, assRes] = await Promise.all([
        apiGetResponses(pqrsId),
        apiGetActivities(pqrsId),
        apiGetEscalations(pqrsId),
        apiGetAssignments(pqrsId),
      ]);
      setResponses(((resRes as any).results ?? []).slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setActivities(((actRes as any).results ?? []).slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setEscalations(((escRes as any).results ?? []).slice().sort((a: any, b: any) => new Date(b.escalated_at ?? b.created_at).getTime() - new Date(a.escalated_at ?? a.created_at).getTime()));
      const list: AssignmentAPI[] = (Array.isArray(assRes) ? assRes : (assRes as any).results ?? [])
        .slice().sort((a: AssignmentAPI, b: AssignmentAPI) => new Date(b.assigned_at ?? b.created_at ?? "").getTime() - new Date(a.assigned_at ?? a.created_at ?? "").getTime());
      setAllAssignments(list);
      const active = list.find(a => a.is_active) ?? list[0] ?? null;
      setActiveAssignment(active);
    } catch (e) {
      toast.error("Error al cargar historial", { description: formatApiError(e) });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadDashboard = async () => {
    if (dashLoading) return;
    setDashLoading(true);
    try {
      const data = await apiGetDashboard();
      setDashData(data);
    } catch (e) {
      toast.error("Error al cargar analytics", { description: formatApiError(e) });
    } finally {
      setDashLoading(false);
    }
  };

  /** Dispara descarga del archivo recibido como Blob. */
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

  const handleExport = async (format: "csv" | "excel") => {
    setExporting(format);
    try {
      if (format === "csv") {
        const result = await apiExportCSV(exportFilters);
        triggerDownload(result.blob, result.filename);
        toast.success("Reporte CSV descargado correctamente");
      } else {
        // Cargar tickets si aún no se han cargado
        let tickets = exportTickets;
        if (tickets.length === 0 && !loadingTickets) {
          setLoadingTickets(true);
          try {
            const res = await apiListTickets({ page_size: 500 });
            const items: TicketInternoAPI[] = Array.isArray(res) ? res : (res as any).results ?? [];
            setExportTickets(items);
            tickets = items;
          } catch { /* si falla, se genera sin tickets */ }
          setLoadingTickets(false);
        }
        await generateAdminReport({
          userName: `${usuario?.nombre ?? ""} ${usuario?.apellido ?? ""}`.trim() || usuario?.email || "Administrador",
          pqrsList,
          tickets,
          dependencies,
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

  const loadAttachments = async (pqrsId: string) => {
    setAttachLoading(true);
    try {
      // Busca en ambas fuentes en paralelo:
      // 1. Detalle de la PQRS: incluye adjuntos subidos durante la creación.
      // 2. Endpoint /attachments/: incluye adjuntos añadidos después.
      const [fromDetail, fromEndpoint] = await Promise.allSettled([
        apiGetPQRS(pqrsId).then(p => p.attachments ?? []),
        apiGetAttachments(pqrsId),
      ]);
      const detailAtts = fromDetail.status === "fulfilled" ? fromDetail.value : [];
      const endpointAtts = fromEndpoint.status === "fulfilled" ? fromEndpoint.value : [];
      // Mergear deduplicando por id, y ordenar del más reciente al más antiguo.
      const seen = new Set(detailAtts.map((a: import("../../lib/api").Attachment) => a.id));
      const merged = [
        ...detailAtts,
        ...endpointAtts.filter((a: import("../../lib/api").Attachment) => !seen.has(a.id)),
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

  const loadAssignment = (p: PqrsAPI) => {
    setActiveAssignment(null);
    setAssignmentError(false);
    setAssignmentLoading(true);
    apiGetAssignments(p.id)
      .then(res => {
        const list: AssignmentAPI[] = (Array.isArray(res) ? res : (res as any).results ?? [])
          .slice().sort((a: AssignmentAPI, b: AssignmentAPI) => new Date(b.assigned_at ?? b.created_at ?? "").getTime() - new Date(a.assigned_at ?? a.created_at ?? "").getTime());
        // eslint-disable-next-line no-console
        console.debug("[AdminDashboard] assignments raw:", list);
        const activeList = list.filter(a => a.is_active);
        const active = activeList[0] ?? list[0] ?? null;
        setAllAssignments(list);
        setActiveAssignment(active);

        // Pre-populate the assign form with the current active assignment's areas and users.
        // Prefer new M2M arrays (dependencies / responsible_users); fall back to legacy FK.
        if (activeList.length > 0) {
          const depIds = [...new Set(
            activeList.flatMap(a => {
              const m2m = a.dependencies ?? [];
              if (m2m.length > 0) return m2m;
              const fk = typeof a.dependency === "string" ? a.dependency : (a.dependency as any)?.id ?? null;
              return fk ? [fk] : [];
            })
          )];
          const userIds = [...new Set(
            activeList.flatMap(a => {
              const m2m = a.responsible_users ?? [];
              if (m2m.length > 0) return m2m;
              const fk = typeof a.responsible_user === "string" ? a.responsible_user : (a.responsible_user as any)?.id ?? null;
              return fk ? [fk] : [];
            })
          )];
          if (depIds.length > 0) assignForm.setValue("dependencies", depIds);
          if (userIds.length > 0) assignForm.setValue("responsible_users", userIds);
        }

        // If assignments endpoint returned nothing but PQRS object has dependency, refresh via detail
        if (!active && !p.dependency) {
          apiGetPQRS(p.id)
            .then(fresh => {
              if (fresh.dependency) {
                setSelected(prev => prev && prev.id === fresh.id ? { ...prev, dependency: fresh.dependency } : prev);
              }
            })
            .catch(() => { /* best-effort */ });
        }
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error("[AdminDashboard] error loading assignment:", err);
        setAssignmentError(true);
        // Still try from PQRS detail as fallback
        apiGetPQRS(p.id)
          .then(fresh => {
            if (fresh.dependency) {
              setSelected(prev => prev && prev.id === fresh.id ? { ...prev, dependency: fresh.dependency } : prev);
            }
          })
          .catch(() => { /* best-effort */ });
      })
      .finally(() => setAssignmentLoading(false));
  };

  const openDetail = (p: PqrsAPI) => {
    setSelected(p);
    setActiveTab("respond");
    respondForm.reset({ response_type: "CITIZEN", new_status: "" });
    assignForm.reset();
    escalateForm.reset();
    setAssignAreaSearch("");
    setAssignUserSearch("");
    setResponses([]);
    setActivities([]);
    setEscalations([]);
    setActiveAssignment(null);
    setRespondFiles([]);
    setAllAssignments([]);
    loadAssignment(p);
    // Fetch full detail to ensure description and other list-excluded fields are populated
    apiGetPQRS(p.id)
      .then(fresh => {
        setSelected(prev => prev && prev.id === fresh.id
          ? {
              ...prev,
              description: fresh.description,
              subject: fresh.subject,
              due_date: fresh.due_date,
              registered_user_info: (fresh as any).registered_user_info ?? prev.registered_user_info,
              anon_info: (fresh as any).anon_info ?? prev.anon_info,
            }
          : prev);
      })
      .catch(() => { /* best-effort */ });
  };

  const switchTab = (tab: DetailTab) => {
    setActiveTab(tab);
    if (tab === "history" && selected && responses.length === 0 && activities.length === 0) {
      loadHistory(selected.id);
    }
    if (tab === "adjuntos" && selected) {
      // Pre-seed instantly from embedded attachments (avoids empty flash)
      if (selected.attachments?.length) setAttachments(selected.attachments);
      loadAttachments(selected.id);
    }
  };

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cargarArchivadas = useCallback(async () => {
    setArchivadasLoading(true);
    try {
      const res = await apiListPQRS({ archived: true, page_size: 200 });
      const items: PqrsAPI[] = Array.isArray(res) ? res : (res as any).results ?? [];
      setArchivadasList(items.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (e) {
      toast.error("Error al cargar PQRS archivadas", { description: formatApiError(e) });
    } finally {
      setArchivadasLoading(false);
    }
  }, []);

  useEffect(() => { if (verArchivadas) cargarArchivadas(); }, [verArchivadas, cargarArchivadas]);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile && selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  const pqrsFuente = verArchivadas ? archivadasList : pqrsList;
  const cargandoLista = verArchivadas ? archivadasLoading : loading;

  const pqrsFiltradas = pqrsFuente.filter(p => {
    const matchEstado =
      filtroEstado === "todos"       ? true :
      // sin_asignar usa IDs obtenidos del servidor (óptimo: nunca depende de p.dependency)
      filtroEstado === "SIN_ASIGNAR" ? sinAsignarIds.has(p.id) :
      filtroEstado === "RES_CER"     ? (p.status === "RES" || p.status === "CER") :
      p.status === filtroEstado;
    const matchTipo = filtroTipo === "todos" || (p.type ?? p.pqrs_type) === filtroTipo;
    const matchArea =
      filtroArea === "todos" ? true :
      filtroArea === "sin_area" ? !p.dependency :
      resolveDepId(p.dependency) === filtroArea;
    const q = busqueda.toLowerCase();
    const matchBusqueda = q === "" ||
      (p.numero_radicado ?? p.radicado ?? "").toLowerCase().includes(q) ||
      (p.subject ?? "").toLowerCase().includes(q) ||
      (p.user?.nombre ?? p.anon_info?.name ?? "").toLowerCase().includes(q);
    return matchEstado && matchTipo && matchBusqueda && matchArea;
  });

  // Solo se actúa sobre las seleccionadas que siguen visibles tras aplicar filtros/búsqueda.
  const idsSeleccionados = pqrsFiltradas.filter(p => seleccionadas.has(p.id)).map(p => p.id);
  const todasSeleccionadas = pqrsFiltradas.length > 0 && idsSeleccionados.length === pqrsFiltradas.length;

  const toggleSeleccion = (id: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSeleccionTodas = () => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (todasSeleccionadas) pqrsFiltradas.forEach(p => next.delete(p.id));
      else pqrsFiltradas.forEach(p => next.add(p.id));
      return next;
    });
  };

  const alternarVistaArchivadas = () => {
    setVerArchivadas(v => !v);
    setSeleccionadas(new Set());
    setSelected(null);
  };

  const confirmarArchivado = async () => {
    if (idsSeleccionados.length === 0 || archiving) return;
    const archivar = !verArchivadas;
    const ids = idsSeleccionados;
    setArchiving(true);
    try {
      const { actualizadas } = await apiArchivePQRS(ids, archivar);
      const idSet = new Set(ids);
      if (archivar) {
        setPqrsList(prev => prev.filter(p => !idSet.has(p.id)));
        setSinAsignarIds(prev => {
          const next = new Set(prev);
          idSet.forEach(id => next.delete(id));
          return next;
        });
        // Fuerza recarga del archivo y de las analíticas la próxima vez que se consulten.
        setArchivadasList([]);
      } else {
        setArchivadasList(prev => prev.filter(p => !idSet.has(p.id)));
        cargarDatos();
      }
      setDashData(null);
      if (selected && idSet.has(selected.id)) setSelected(null);
      setSeleccionadas(new Set());
      setShowConfirmArchivar(false);
      toast.success(
        archivar
          ? `${actualizadas} PQRS archivada${actualizadas === 1 ? "" : "s"}`
          : `${actualizadas} PQRS restaurada${actualizadas === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast.error(archivar ? "No se pudo archivar" : "No se pudo restaurar", { description: formatApiError(e) });
    } finally {
      setArchiving(false);
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
        content: data.content,
        response_type: data.response_type,
        is_final: data.response_type === "FINAL",
        ...(attachmentIds.length > 0 && { attachment_ids: attachmentIds }),
      });
      if (data.new_status && data.new_status !== selected.status) {
        await apiUpdateEstado(selected.id, data.new_status as any);
      }
      toast.success("Respuesta registrada correctamente");
      respondForm.reset({ response_type: "CITIZEN", new_status: "", content: "" });
      setRespondFiles([]);
      await cargarDatos();
      setSelected(null);
    } catch (e) {
      toast.error("Error al guardar respuesta", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const onAsignar = async (data: AssignForm) => {
    if (!selected) return;
    const userIds = (data.responsible_users ?? []).filter(Boolean);
    let depIds    = (data.dependencies ?? []).filter(Boolean);
    if (userIds.length === 0) {
      toast.error("Seleccione al menos un responsable");
      return;
    }

    // El backend (POST /api/pqrs/assign/) crea un PQRSAssignment con dependency=X.
    // _pqrs_qs_for_dep_manager filtra PQRS donde PQRSAssignment.dependency__in = dep_ids
    // del encargado. Sin dependency en el assignment, el área NUNCA verá la PQRS y
    // los encargados NO recibirán notificación por correo.
    // Regla: siempre debe enviarse al menos un área en el payload de asignación.
    if (depIds.length === 0) {
      // Intentar derivar las áreas de los perfiles de los usuarios seleccionados.
      const autoDeps = userIds
        .map(uid => allUsers.find(u => u.id === uid))
        .filter(Boolean)
        .map(u => resolveDepId(u!.dependency))
        .filter((id): id is string => !!id);
      depIds = [...new Set(autoDeps)];
    }

    // Si aún no hay áreas (usuarios sin departamento asignado en su perfil),
    // bloquear la asignación: sin un área en el assignment, el encargado no verá
    // la PQRS en su dashboard ni recibirá el correo de notificación.
    if (depIds.length === 0) {
      toast.error(
        "Selecciona al menos un Área responsable",
        { description: "Los usuarios seleccionados no tienen área asignada en su perfil. Elige un área manualmente en el formulario para que los encargados reciban la notificación y puedan ver la PQRS." }
      );
      return;
    }
    setSubmitting(true);
    const pqrsId = selected.id;
    let newStatus = selected.status;
    try {
      const assignPayload: Parameters<typeof apiAssignPQRS>[0] = {
        pqrs: pqrsId,
        responsible_users: userIds,
        ...(depIds.length > 0 && { dependencies: depIds }),
      };
      if (data.notes.trim()) assignPayload.notes = data.notes.trim();

      // POST /api/pqrs/assign/ → crea asignaciones (multi-usuario / multi-área).
      // El backend establece dependency en el PQRSAssignment internamente;
      // NO llamar apiPatchPQRS (PATCH /api/pqrs/<id>/) porque ese endpoint
      // devuelve 405 Method Not Allowed en este backend.
      const result = await apiAssignPQRS(assignPayload);
      const createdAssignments: AssignmentAPI[] = Array.isArray(result) ? result : [result];

      const primaryDepId = depIds[0] ?? undefined;

      // Cambiar estado a "En Proceso" si estaba en "Radicado"
      if (selected.status === "RAD") {
        try {
          const updated = await apiUpdateEstado(pqrsId, "PRO");
          newStatus = updated.status;
        } catch (stateErr) {
          toast.warning("PQRS asignada, pero no se pudo actualizar el estado", {
            description: formatApiError(stateErr),
          });
        }
      }

      const primaryDepObj = primaryDepId ? (dependencies.find(d => d.id === primaryDepId) ?? null) : null;
      const patched: PqrsAPI = {
        ...selected,
        dependency: primaryDepObj ?? selected.dependency,
        status: newStatus as PqrsAPI["status"],
      };
      setSelected(patched);
      setPqrsList(prev => prev.map(p => p.id === pqrsId ? patched : p));

      // Usar asignaciones devueltas por el backend; si el backend devolvió lista vacía
      // (edge-case), construir registros locales por cada usuario seleccionado.
      const now = new Date().toISOString();
      const newAssignments: AssignmentAPI[] = createdAssignments.length > 0 && createdAssignments[0]?.id
        ? createdAssignments
        : [{
            id: `${Date.now()}-0`,
            pqrs: pqrsId,
            // Legacy FK (primer usuario / primer área)
            responsible_user: allUsers.find(u => u.id === userIds[0]) ?? userIds[0] ?? null,
            dependency: depIds[0] ? (dependencies.find(d => d.id === depIds[0]) ?? depIds[0]) : null,
            // M2M arrays
            responsible_users: userIds,
            responsible_users_emails: userIds.map(id => allUsers.find(u => u.id === id)?.email ?? "").filter(Boolean),
            dependencies: depIds,
            dependencies_nombres: depIds.map(id => dependencies.find(d => d.id === id)?.name ?? "").filter(Boolean),
            assigned_by_user: "",
            is_active: true,
            assigned_at: now,
            created_at: now,
            notes: data.notes ?? "",
          }];

      setActiveAssignment(newAssignments[0] ?? null);
      setAllAssignments(prev => [
        ...newAssignments,
        ...prev.map(a => ({ ...a, is_active: false })),
      ]);
      setAssignmentError(false);

      const depNames = depIds
        .map(id => dependencies.find(d => d.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const userNames = userIds
        .map(id => allUsers.find(u => u.id === id))
        .filter(Boolean)
        .map(u => `${u!.nombre} ${u!.apellido}`)
        .join(", ");

      toast.success(`PQRS asignada correctamente${depNames ? ` a ${depNames}` : ""}${userNames ? ` → ${userNames}` : ""}`);
      assignForm.reset();

      // Refrescar en segundo plano para actualizar contadores sin_asignar
      cargarDatos();
    } catch (e) {
      toast.error("Error al asignar PQRS", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const onEscalar = async (data: EscalateForm) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const payload: any = { pqrs: selected.id, reason: data.reason };
      if (data.notes.trim()) payload.notes = data.notes.trim();
      if (data.to_dependency) payload.to_dependency = data.to_dependency;
      if (data.to_user) payload.to_user = data.to_user;
      await apiEscalatePQRS(payload);
      toast.success("PQRS escalada. Se notificó al área/usuario destino.");
      escalateForm.reset();
      await cargarDatos();
      setSelected(null);
    } catch (e) {
      toast.error("Error al escalar PQRS", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const total         = pqrsList.length;
  const rad           = pqrsList.filter(p => p.status === "RAD").length;
  const pro           = pqrsList.filter(p => p.status === "PRO").length;
  const res           = pqrsList.filter(p => p.status === "RES" || p.status === "CER").length;
  // sinAsignar viene del servidor (filtro server-side), no de p.dependency
  const sinAsignar    = sinAsignarIds.size;
  const nonStaffUsers = allUsers.filter(u => !u.is_staff);

  const selectedEscalateDepId = escalateForm.watch("to_dependency");
  const filteredEscalateUsers = nonStaffUsers.filter(u => {
    if (!selectedEscalateDepId) return true;
    const uid = typeof u.dependency === "string" ? u.dependency : u.dependency?.id ?? "";
    return uid === selectedEscalateDepId;
  });

  /** Resolves dependency name using the loaded `dependencies` list as ground truth. */
  const depNameFor = (dep: Dependency | string | null | undefined): string | null => {
    if (!dep) return null;
    if (typeof dep !== "string") return dep.name;
    return dependencies.find(d => d.id === dep)?.name ?? null;
  };

  const selectedDepIds  = assignForm.watch("dependencies")       ?? [];
  const selectedUserIds = assignForm.watch("responsible_users")  ?? [];
  const filteredAssignUsers = allUsers.filter(u => {
    if (selectedDepIds.length === 0) return true;
    const uid = typeof u.dependency === "string" ? u.dependency : u.dependency?.id ?? "";
    return selectedDepIds.includes(uid);
  });

  // ── Datos computados para gráficas (filtrados por período) ────────────────
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
      value,
      key,
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

    // Tendencia diaria (últimos periodDays días o todos)
    const tendenciaMap: Record<string, { fecha: string; total: number; resueltas: number }> = {};
    const days = periodDays > 0 ? periodDays : 90; // máx 90 días en gráfica
    const tendenciaCutoff = new Date(Date.now() - days * 86_400_000);
    for (const p of pqrsList) {
      const d = new Date(p.created_at);
      if (d < tendenciaCutoff) continue;
      const key = d.toISOString().slice(0, 10);
      if (!tendenciaMap[key]) tendenciaMap[key] = { fecha: key, total: 0, resueltas: 0 };
      tendenciaMap[key].total++;
      if (p.status === "RES" || p.status === "CER") tendenciaMap[key].resueltas++;
    }
    const tendencia = Object.values(tendenciaMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Por área
    const areaMap: Record<string, number> = {};
    for (const p of filtered) {
      const areaName = typeof p.dependency === "object" && p.dependency
        ? p.dependency.name
        : sinAsignarIds.has(p.id) ? "Sin Asignar" : "Sin Asignar";
      if (p.dependency) {
        const n = typeof p.dependency === "object" ? p.dependency.name : "Área";
        areaMap[n] = (areaMap[n] ?? 0) + 1;
      } else {
        areaMap["Sin Asignar"] = (areaMap["Sin Asignar"] ?? 0) + 1;
      }
    }
    const porArea = Object.entries(areaMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // KPIs
    const total = filtered.length;
    const resueltas = filtered.filter(p => p.status === "RES" || p.status === "CER").length;
    const enProceso = filtered.filter(p => p.status === "PRO").length;
    const anonimas  = filtered.filter(p => !p.user).length;
    const tasaResolucion = total > 0 ? Math.round((resueltas / total) * 100) : 0;

    return { porEstado, porTipo, porPrioridad, tendencia, porArea, total, resueltas, enProceso, anonimas, tasaResolucion };
  }, [pqrsList, periodDays, sinAsignarIds]);

  // ── Cards de área para filtrar PQRS ─────────────────────────────────────────
  const areaStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const p of pqrsList) {
      const depId = resolveDepId(p.dependency) ?? "sin_area";
      const depName = typeof p.dependency === "object" && p.dependency?.name
        ? p.dependency.name
        : dependencies.find(d => d.id === depId)?.name ?? "Sin Área";
      const prev = map.get(depId) ?? { name: depName, count: 0 };
      map.set(depId, { ...prev, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [pqrsList, dependencies]);

  // ── Datos comparativos (independientes del período) ───────────────────────────
  const comparativaData = useMemo(() => {
    const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

    // acumular por año-mes
    const bk: Record<string, { total:number; resueltas:number; enProceso:number; radicadas:number }> = {};
    for (const p of pqrsList) {
      const d  = new Date(p.created_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!bk[ym]) bk[ym] = { total:0, resueltas:0, enProceso:0, radicadas:0 };
      bk[ym].total++;
      if (p.status==="RES"||p.status==="CER") bk[ym].resueltas++;
      if (p.status==="PRO") bk[ym].enProceso++;
      if (p.status==="RAD") bk[ym].radicadas++;
    }

    const years  = [...new Set(Object.keys(bk).map(k=>k.slice(0,4)))].sort();
    const months = Object.keys(bk).sort();

    // vista mensual agregada (todos los meses en orden)
    const monthly = months.map(ym => ({
      periodo: ym,
      label: `${MN[parseInt(ym.slice(5))-1]} ${ym.slice(2,4)}`,
      ...bk[ym],
    }));

    // serie mensual para un año dado (12 puntos fijos)
    const yearSeries = (yr: string) =>
      Array.from({length:12},(_,i)=>{
        const ym = `${yr}-${String(i+1).padStart(2,"0")}`;
        return { mes: MN[i], ...(bk[ym]??{total:0,resueltas:0,enProceso:0,radicadas:0}) };
      });

    // serie diaria para un mes dado (ym = "YYYY-MM")
    const daySeries = (ym: string) => {
      const db: Record<number,{total:number;resueltas:number;enProceso:number}> = {};
      for (const p of pqrsList) {
        const d = new Date(p.created_at);
        if (`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` !== ym) continue;
        const day = d.getDate();
        if (!db[day]) db[day]={total:0,resueltas:0,enProceso:0};
        db[day].total++;
        if (p.status==="RES"||p.status==="CER") db[day].resueltas++;
        if (p.status==="PRO") db[day].enProceso++;
      }
      const maxDay = Object.keys(db).length>0 ? Math.max(...Object.keys(db).map(Number)) : 0;
      return Array.from({length:maxDay},(_,i)=>({ dia:i+1, ...(db[i+1]??{total:0,resueltas:0,enProceso:0}) }));
    };

    return { monthly, years, months, yearSeries, daySeries, MN };
  }, [pqrsList]);

  // Colores para las gráficas
  const COLORS_ESTADO   = ["#3b82f6", "#f59e0b", "#22c55e", "#6b7280"];
  const COLORS_TIPO     = ["#6366f1", "#ec4899", "#f97316", "#14b8a6", "#a855f7"];
  const COLORS_PRIORIDAD= ["#22c55e", "#f59e0b", "#ef4444"];
  const COLORS_AREA     = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#14b8a6", "#6b7280"];

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

  // El endpoint de lista devuelve `submitter` (string); el detalle devuelve user/anon_info
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

  /** Genera y abre un documento PDF/imprimible de la PQRS seleccionada (entrega física). */
  const handlePrintPQRS = async () => {
    if (!selected) return;

    const fmtDate = (s?: string | null) =>
      !s ? "—" : new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const fmtDateShort = (s?: string | null) =>
      !s ? "—" : new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

    // Use already-loaded responses state as base; fetch fresh if empty
    let rawDetail: any = selected;
    // Siempre hacer fetch fresco para el PDF (sin depender del estado cargado)
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
      // El backend filtra según rol: admin ve todas, área solo CITIZEN/FINAL
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
          return `<div style="border:1px solid ${esFinal ? "#bfdbfe" : "#bbf7d0"};border-radius:6px;margin-bottom:10px;overflow:hidden;page-break-inside:avoid;">
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
    const emailCiudadano    = regUser?.email ?? anonInfo?.email ?? (selected as any).submitter_email ?? "—";
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
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
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
    @media print { body { padding: 12mm 14mm; } @page { margin: 0; size: A4 portrait; } }
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
  <div class="description-box" style="font-weight:600;">${selected.subject}</div>
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

  const TABS: { id: DetailTab; label: string }[] = [
    { id: "respond",  label: "Responder"    },
    { id: "assign",   label: "Asignar Área" },
    { id: "escalate", label: "Escalar"      },
    { id: "history",  label: "Historial"    },
    { id: "adjuntos", label: "Adjuntos"     },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header + admin quick-nav */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="text-sm text-gray-500">Bienvenido, {usuario?.nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/admin-diplomas")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white shadow hover:bg-amber-700 transition-colors"
              >
                <GraduationCap className="w-4 h-4" />
                Diplomas
              </button>
              <button
                onClick={() => navigate("/gestion-whatsapp-masivo")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white shadow hover:bg-green-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp Masivo
              </button>

              {/* Export button */}
              <button
                onClick={() => {
                  const next = !showExport;
                  setShowExport(next);
                  if (next) {
                    const validStatuses = Object.keys(PQRS_STATUS_LABEL) as PqrsStatus[];
                    const validTypes    = Object.keys(PQRS_TYPE_LABEL)    as PqrsType[];
                    setExportFilters({
                      status:        validStatuses.includes(filtroEstado as PqrsStatus) ? filtroEstado as PqrsStatus : undefined,
                      type:          validTypes.includes(filtroTipo as PqrsType)         ? filtroTipo as PqrsType     : undefined,
                      dependency_id: filtroArea !== "todos" && filtroArea !== "sin_area"  ? filtroArea               : undefined,
                    });
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showExport
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FileDown className="w-4 h-4" />
                Exportar
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExport ? "rotate-180" : ""}`} />
              </button>

              {/* Analytics toggle */}
              <button
                onClick={() => {
                  const next = viewMode === "list" ? "analytics" : "list";
                  setViewMode(next);
                  if (next === "analytics" && !dashData && !dashLoading) loadDashboard();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === "analytics"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {viewMode === "analytics"
                  ? <><LayoutDashboard className="w-4 h-4" /> Gestionar PQRS</>
                  : <><BarChart2 className="w-4 h-4" /> Ver Analytics</>
                }
              </button>
            </div>
          </div>

          {/* ── Export panel ────────────────────────────────────── */}
          {showExport && (
            <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-md overflow-hidden mb-2">
              {/* Decorative stripe */}
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-2xl" />

              <div className="pl-5 pr-4 pt-4 pb-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
                      <FileSpreadsheet className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 leading-tight">Exportar Reportes PQRS</p>
                      <p className="text-[11px] text-gray-500 leading-tight">Aplica filtros opcionales antes de descargar</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowExport(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-white/70"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Filters grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <Clock className="w-3 h-3" /> Estado
                    </label>
                    <select
                      value={exportFilters.status ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, status: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    >
                      <option value="">Todos</option>
                      <option value="RAD">Radicado</option>
                      <option value="PRO">En Proceso</option>
                      <option value="RES">Resuelto</option>
                      <option value="CER">Cerrado</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <FileText className="w-3 h-3" /> Tipo
                    </label>
                    <select
                      value={exportFilters.type ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, type: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    >
                      <option value="">Todos</option>
                      <option value="P">Petición</option>
                      <option value="Q">Queja</option>
                      <option value="R">Reclamo</option>
                      <option value="S">Sugerencia</option>
                      <option value="F">Felicitación</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <AlertCircle className="w-3 h-3" /> Prioridad
                    </label>
                    <select
                      value={exportFilters.priority ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, priority: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    >
                      <option value="">Todas</option>
                      <option value="LOW">Baja</option>
                      <option value="MED">Media</option>
                      <option value="HIGH">Alta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <Calendar className="w-3 h-3" /> Desde
                    </label>
                    <input
                      type="date"
                      value={exportFilters.date_from ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, date_from: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <Calendar className="w-3 h-3" /> Hasta
                    </label>
                    <input
                      type="date"
                      value={exportFilters.date_to ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, date_to: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      <Building2 className="w-3 h-3" /> Dependencia
                    </label>
                    <select
                      value={exportFilters.dependency_id ?? ""}
                      onChange={e => setExportFilters(f => ({ ...f, dependency_id: e.target.value || undefined }))}
                      className="w-full text-xs border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white shadow-sm"
                    >
                      <option value="">Todas</option>
                      {dependencies.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active filter chips */}
                {Object.values(exportFilters).some(Boolean) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mr-1">Activos:</span>
                    {exportFilters.status && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {PQRS_STATUS_LABEL[exportFilters.status as keyof typeof PQRS_STATUS_LABEL]}
                        <button onClick={() => setExportFilters(f => ({ ...f, status: undefined }))} className="hover:text-blue-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {exportFilters.type && (
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {PQRS_TYPE_LABEL[exportFilters.type as keyof typeof PQRS_TYPE_LABEL]}
                        <button onClick={() => setExportFilters(f => ({ ...f, type: undefined }))} className="hover:text-purple-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {exportFilters.priority && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {PQRS_PRIORITY_LABEL[exportFilters.priority as keyof typeof PQRS_PRIORITY_LABEL]}
                        <button onClick={() => setExportFilters(f => ({ ...f, priority: undefined }))} className="hover:text-amber-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {exportFilters.date_from && (
                      <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        Desde {exportFilters.date_from}
                        <button onClick={() => setExportFilters(f => ({ ...f, date_from: undefined }))} className="hover:text-teal-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {exportFilters.date_to && (
                      <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        Hasta {exportFilters.date_to}
                        <button onClick={() => setExportFilters(f => ({ ...f, date_to: undefined }))} className="hover:text-teal-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {exportFilters.dependency_id && (
                      <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {dependencies.find(d => d.id === exportFilters.dependency_id)?.name ?? "Dependencia"}
                        <button onClick={() => setExportFilters(f => ({ ...f, dependency_id: undefined }))} className="hover:text-indigo-900"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    <button
                      onClick={() => setExportFilters({})}
                      className="text-[11px] text-gray-400 hover:text-red-500 underline ml-1 transition-colors"
                    >
                      Limpiar todo
                    </button>
                  </div>
                )}

                {/* Download buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-emerald-100">
                  <button
                    onClick={() => handleExport("csv")}
                    disabled={exporting !== null}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md active:scale-95"
                  >
                    {exporting === "csv"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileDown className="w-4 h-4" />}
                    Descargar CSV
                  </button>

                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting !== null}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md active:scale-95"
                  >
                    {exporting === "excel"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileSpreadsheet className="w-4 h-4" />}
                    Descargar Excel Elaborado
                  </button>

                  <span className="ml-auto text-[11px] text-gray-400 italic hidden sm:inline">
                    {Object.values(exportFilters).some(Boolean) ? "Con filtros aplicados" : "Sin filtros — exporta todo el registro"}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Stats – clickable filters */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon: FileText,    label: "Total",       value: total,      color: "text-blue-600",  filterKey: "todos"        },
            { icon: AlertCircle, label: "Radicadas",   value: rad,        color: "text-blue-500",  filterKey: "RAD"          },
            { icon: Clock,       label: "En Proceso",  value: pro,        color: "text-yellow-600",filterKey: "PRO"          },
            { icon: CheckCircle2,label: "Resueltas",   value: res,        color: "text-green-600", filterKey: "RES_CER"      },
            { icon: Building2,   label: "Sin Asignar", value: sinAsignar, color: "text-red-500",   filterKey: "SIN_ASIGNAR" },
          ].map(({ icon: Icon, label, value, color, filterKey }) => {
            const isActive = filtroEstado === filterKey;
            return (
              <button
                key={label}
                onClick={() => setFiltroEstado(isActive ? "todos" : filterKey)}
                className={`text-left w-full rounded-xl border shadow-sm transition-all
                  ${ isActive
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

        {/* ── Filtro por Área ─────────────────────────────────────────────── */}
        {areaStats.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Filtrar por Área
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltroArea("todos")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  filtroArea === "todos"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                Todas las áreas
              </button>
              {areaStats.map(({ id, name, count }) => (
                <button
                  key={id}
                  onClick={() => setFiltroArea(filtroArea === id ? "todos" : id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    filtroArea === id
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  {name}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                    filtroArea === id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Analytics view ─────────────────────────────────────────────── */}
        {viewMode === "analytics" && (
          <div className="mb-8 space-y-6">

            {/* ── Filtro de período ── */}
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
                onClick={() => { if (!dashLoading) loadDashboard(); }}
                disabled={dashLoading}
                className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dashLoading ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total en período",  value: analyticsData.total,          icon: FileText,    color: "text-blue-600",  bg: "bg-blue-50"  },
                { label: "Resueltas / Cerradas", value: analyticsData.resueltas,   icon: CheckCircle2,color: "text-green-600", bg: "bg-green-50" },
                { label: "En Proceso",        value: analyticsData.enProceso,      icon: Clock,       color: "text-yellow-600",bg: "bg-yellow-50"},
                { label: "Tasa de Resolución",value: `${analyticsData.tasaResolucion}%`, icon: Target,color: "text-purple-600",bg: "bg-purple-50"},
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3">
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

            {/* ── Fila 1: Estado + Tipo ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Dona: por estado — interactiva */}
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">Distribución por Estado</p>
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                    {analyticsData.total} PQRS
                  </span>
                </div>

                {analyticsData.porEstado.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
                ) : (() => {
                  const totalEstado = analyticsData.porEstado.reduce((s, d) => s + d.value, 0);
                  const active = activeEstadoIndex !== undefined ? analyticsData.porEstado[activeEstadoIndex] : null;

                  // Custom active sector: expands + glows
                  const renderActiveShape = (props: any) => {
                    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                    return (
                      <g>
                        <Sector
                          cx={cx} cy={cy}
                          innerRadius={innerRadius - 4}
                          outerRadius={outerRadius + 10}
                          startAngle={startAngle}
                          endAngle={endAngle}
                          fill={fill}
                          opacity={1}
                          style={{ filter: `drop-shadow(0 0 6px ${fill}99)` }}
                        />
                        <Sector
                          cx={cx} cy={cy}
                          innerRadius={outerRadius + 14}
                          outerRadius={outerRadius + 17}
                          startAngle={startAngle}
                          endAngle={endAngle}
                          fill={fill}
                          opacity={0.5}
                        />
                      </g>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-4">
                      {/* Chart + centre text */}
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
                              animationBegin={0}
                              animationDuration={700}
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
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color as string }} />
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

                        {/* Centro: texto dinámico según hover */}
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                          style={{ paddingBottom: 0 }}
                        >
                          {active ? (
                            <>
                              <span
                                className="text-2xl font-extrabold leading-none"
                                style={{ color: COLORS_ESTADO[activeEstadoIndex! % COLORS_ESTADO.length] }}
                              >
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

                      {/* Leyenda personalizada con barras de proporción */}
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
                                  <span className={`text-xs font-medium ${ isHovered ? "text-gray-900" : "text-gray-600" }`}>
                                    {d.name}
                                  </span>
                                </div>
                                <span className="text-xs font-bold" style={{ color }}>{d.value}</span>
                              </div>
                              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: color }}
                                />
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

            {/* ── Fila 2: Tendencia diaria ── */}
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
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="gradRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }}
                      tickFormatter={v => v.slice(5)} // MM-DD
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="total"     name="Radicadas" stroke="#3b82f6" strokeWidth={2} fill="url(#gradTotal)" dot={false} />
                    <Area type="monotone" dataKey="resueltas" name="Resueltas"  stroke="#22c55e" strokeWidth={2} fill="url(#gradRes)"   dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Fila 3: Prioridad + Áreas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Dona: por prioridad */}
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

              {/* Barras horizontales: por área */}
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">PQRS por Área</p>
                {analyticsData.porArea.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={analyticsData.porArea.slice(0, 8)}
                      layout="vertical"
                      barSize={18}
                      margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="PQRS" radius={[0, 4, 4, 0]}>
                        {analyticsData.porArea.map((_, i) => (
                          <Cell key={i} fill={COLORS_AREA[i % COLORS_AREA.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Fila 4 (nueva): Comparativa Temporal ──────────────────── */}
            {(() => {
              const { monthly, years, months, yearSeries, daySeries } = comparativaData;

              // defaults dinámicos cuando no hay selección aún
              const yA = compYearA  || years[years.length-1]  || "";
              const yB = compYearB  || years[years.length-2]  || years[years.length-1] || "";
              const mA = compMonthA || months[months.length-1] || "";
              const mB = compMonthB || months[months.length-2] || months[months.length-1] || "";

              const metricLabel: Record<string,string> = {
                total: "Total radicadas", resueltas: "Resueltas", enProceso: "En Proceso",
              };
              const metricColor: Record<string,string> = {
                total: "#3b82f6", resueltas: "#22c55e", enProceso: "#f59e0b",
              };
              const metricColorB = "#8b5cf6";

              // datos según modo
              let chartData: any[] = [];
              let xKey = "";
              let serieA = "";
              let serieB = "";
              let serieALabel = "";
              let serieBLabel = "";
              let showComparison = false;

              if (compMode === "monthly") {
                chartData = monthly;
                xKey = "label";
                showComparison = false;
              } else if (compMode === "year-vs-year") {
                // merge dos series por mes en un solo array
                const sA = yearSeries(yA);
                const sB = yearSeries(yB);
                chartData = sA.map((row,i)=>({
                  mes: row.mes,
                  [`${yA}`]: row[compMetric as keyof typeof row],
                  [`${yB}_b`]: sB[i]?.[compMetric as keyof typeof sB[0]] ?? 0,
                }));
                xKey = "mes";
                serieA = yA;
                serieB = `${yB}_b`;
                serieALabel = yA;
                serieBLabel = yB;
                showComparison = true;
              } else {
                const sA = daySeries(mA);
                const sB = daySeries(mB);
                const maxDays = Math.max(sA.length, sB.length);
                chartData = Array.from({length: maxDays}, (_, i) => ({
                  dia: i+1,
                  [`${mA}`]: sA[i]?.[compMetric as keyof typeof sA[0]] ?? 0,
                  [`${mB}_b`]: sB[i]?.[compMetric as keyof typeof sB[0]] ?? 0,
                }));
                xKey = "dia";
                serieA = mA;
                serieB = `${mB}_b`;
                serieALabel = mA;
                serieBLabel = mB;
                showComparison = true;
              }

              const compTooltip = ({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700 mb-1.5">{label ?? payload[0]?.payload?.[xKey]}</p>
                    {payload.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-gray-600">{s.name}:</span>
                        <span className="font-bold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                );
              };

              // Selector de mes: available months as "YYYY-MM"
              const MonthSelect = ({ value, onChange, label }: { value:string; onChange:(v:string)=>void; label:string }) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
                  <select
                    value={value}
                    onChange={e=>onChange(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[110px]"
                  >
                    {months.map(m=>(
                      <option key={m} value={m}>
                        {comparativaData.MN[parseInt(m.slice(5))-1]} {m.slice(0,4)}
                      </option>
                    ))}
                  </select>
                </div>
              );

              const YearSelect = ({ value, onChange, label }: { value:string; onChange:(v:string)=>void; label:string }) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
                  <select
                    value={value}
                    onChange={e=>onChange(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[80px]"
                  >
                    {years.map(y=>(
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              );

              return (
                <div className="bg-white rounded-xl border shadow-sm p-5">
                  {/* cabecera */}
                  <div className="flex flex-wrap items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Comparativa Temporal</p>
                      <p className="text-xs text-gray-400 mt-0.5">Analiza la evolución y compara períodos</p>
                    </div>

                    {/* modo */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium gap-0.5">
                      {([
                        { key:"monthly",       label:"Mensual" },
                        { key:"year-vs-year",  label:"Año vs Año" },
                        { key:"month-vs-month",label:"Mes vs Mes" },
                      ] as const).map(opt=>(
                        <button
                          key={opt.key}
                          onClick={()=>setCompMode(opt.key)}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            compMode===opt.key
                              ? "bg-white shadow text-blue-700 font-semibold"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* métrica */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(["total","resueltas","enProceso"] as const).map(m=>(
                        <button
                          key={m}
                          onClick={()=>setCompMetric(m)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            compMetric===m
                              ? "border-transparent text-white shadow-sm"
                              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                          style={compMetric===m ? { background: metricColor[m] } : {}}
                        >
                          {metricLabel[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* selectores de período */}
                  {showComparison && (
                    <div className="flex flex-wrap items-end gap-4 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: metricColor[compMetric] }} />
                        <span className="text-xs text-gray-500 font-medium">Periodo A</span>
                      </div>
                      {compMode==="year-vs-year"
                        ? <YearSelect  value={yA} onChange={setCompYearA}  label="Año A"  />
                        : <MonthSelect value={mA} onChange={setCompMonthA} label="Mes A" />}
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: metricColorB }} />
                        <span className="text-xs text-gray-500 font-medium">Periodo B</span>
                      </div>
                      {compMode==="year-vs-year"
                        ? <YearSelect  value={yB} onChange={setCompYearB}  label="Año B"  />
                        : <MonthSelect value={mB} onChange={setCompMonthB} label="Mes B" />}

                      {/* resumen delta */}
                      {(() => {
                        const totA = chartData.reduce((s:number,r:any)=>s+(r[serieA]??0),0);
                        const totB = chartData.reduce((s:number,r:any)=>s+(r[serieB]??0),0);
                        const delta = totA - totB;
                        const pct   = totB>0 ? Math.abs(Math.round((delta/totB)*100)) : null;
                        return (
                          <div className="ml-auto flex items-center gap-2 text-xs">
                            <span className="text-gray-400">{serieALabel} — {serieBLabel}:</span>
                            <span className={`font-bold ${ delta>0?"text-blue-600":delta<0?"text-red-500":"text-gray-500" }`}>
                              {delta>0?"+":""}{delta}
                            </span>
                            {pct!==null && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                delta>0?"bg-blue-50 text-blue-700":delta<0?"bg-red-50 text-red-600":"bg-gray-100 text-gray-500"
                              }`}>
                                {delta>0?"+":delta<0?"-":""}{pct}%
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* gráfica */}
                  {chartData.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-10">Sin datos disponibles para este período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      {compMode==="monthly" ? (
                        <BarChart data={chartData} barSize={18} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                          <defs>
                            <linearGradient id="cgTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={1}   />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.7} />
                            </linearGradient>
                            <linearGradient id="cgRes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#22c55e" stopOpacity={1}   />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.7} />
                            </linearGradient>
                            <linearGradient id="cgPro" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={1}   />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.7} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize:10 }} />
                          <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                          <RTooltip content={compTooltip} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                          {compMetric==="total"     && <Bar dataKey="total"     name="Total"       fill="url(#cgTotal)" radius={[3,3,0,0]} />}
                          {compMetric==="resueltas" && <Bar dataKey="resueltas" name="Resueltas"    fill="url(#cgRes)"   radius={[3,3,0,0]} />}
                          {compMetric==="enProceso" && <Bar dataKey="enProceso" name="En Proceso"   fill="url(#cgPro)"   radius={[3,3,0,0]} />}
                        </BarChart>
                      ) : (
                        <LineChart data={chartData} margin={{ top:4, right:16, left:-16, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey={xKey}
                            tick={{ fontSize:10 }}
                            tickLine={false}
                          />
                          <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                          <RTooltip content={compTooltip} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                          <Line
                            type="monotone"
                            dataKey={serieA}
                            name={`${metricLabel[compMetric]} ${serieALabel}`}
                            stroke={metricColor[compMetric]}
                            strokeWidth={2.5}
                            dot={{ r:3, fill: metricColor[compMetric] }}
                            activeDot={{ r:5 }}
                            animationDuration={600}
                          />
                          <Line
                            type="monotone"
                            dataKey={serieB}
                            name={`${metricLabel[compMetric]} ${serieBLabel}`}
                            stroke={metricColorB}
                            strokeWidth={2.5}
                            strokeDasharray="5 3"
                            dot={{ r:3, fill: metricColorB }}
                            activeDot={{ r:5 }}
                            animationDuration={600}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })()}

            {/* ── Fila 5 (ant. 4): SLA + métricas del backend ──────────────── */}
            {dashLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-gray-500">Cargando métricas del servidor...</span>
              </div>
            )}
            {dashData && (() => {
              const sla = dashData.sla as Record<string, unknown> | undefined;
              if (!sla) return null;
              const slaScalars = Object.entries(sla).filter(([, v]) => typeof v === "number" || typeof v === "string");
              if (!slaScalars.length) return null;

              const SLA_LABELS: Record<string, string> = {
                vencidas:              "Vencidas",
                por_vencer_hoy:        "Por Vencer Hoy",
                por_vencer_7_dias:     "Por Vencer (7 días)",
                sin_sla_asignado:      "Sin SLA Asignado",
                cumplimiento_porcentaje: "Cumplimiento %",
              };

              return (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-semibold text-gray-700">SLA — Niveles de Servicio</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {slaScalars.map(([k, v]) => {
                      const isBad = (k === "vencidas" || k === "por_vencer_hoy") && Number(v) > 0;
                      return (
                        <div key={k} className={`rounded-xl border p-4 ${isBad ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                          <p className={`text-2xl font-bold ${isBad ? "text-red-600" : "text-gray-900"}`}>{String(v)}{k.includes("porcentaje") ? "%" : ""}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{SLA_LABELS[k] ?? k.replace(/_/g," ")}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Resumen anónimas vs autenticadas (del backend) ── */}
            {dashData?.resumen && (() => {
              const res = dashData.resumen as Record<string, unknown>;
              const anonimas      = res["anonimas"]   as number | undefined;
              const autenticadas  = res["autenticadas"] as number | undefined;
              const pctAnonimas   = res["pct_anonimas"] as number | undefined;
              if (anonimas === undefined && autenticadas === undefined) return null;
              const pieData = [
                { name: "Anónimas",      value: anonimas    ?? 0 },
                { name: "Autenticadas",  value: autenticadas ?? 0 },
              ].filter(d => d.value > 0);
              return (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-semibold text-gray-700">Perfil de Solicitantes</p>
                    {pctAnonimas !== undefined && (
                      <span className="ml-auto text-xs text-gray-400">{pctAnonimas}% anónimas</span>
                    )}
                  </div>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#a855f7" />
                        </Pie>
                        <RTooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* ── Confirmación de archivado / restauración masiva ── */}
        <Dialog open={showConfirmArchivar} onOpenChange={open => { if (!archiving) setShowConfirmArchivar(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {verArchivadas ? "Restaurar PQRS" : "Archivar PQRS"}
              </DialogTitle>
              <DialogDescription>
                {verArchivadas
                  ? `Se restaurarán ${idsSeleccionados.length} PQRS y volverán a aparecer en la lista principal, las estadísticas y las exportaciones.`
                  : `Se archivarán ${idsSeleccionados.length} PQRS. Dejarán de aparecer en la lista principal, las estadísticas, las exportaciones y las alertas de SLA. No se eliminan: puedes restaurarlas desde la vista de archivadas.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmArchivar(false)} disabled={archiving}>
                Cancelar
              </Button>
              <Button onClick={confirmarArchivado} disabled={archiving || idsSeleccionados.length === 0}>
                {archiving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {verArchivadas ? "Restaurar" : "Archivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className={`flex flex-col lg:flex-row gap-6${viewMode === "analytics" ? " hidden" : ""}`}>
          {/* List panel */}
          <div className={`flex-1 ${selected ? "hidden lg:block" : "block"}`}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {verArchivadas ? "PQRS Archivadas" : "PQRS Registradas"}
                </CardTitle>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por radicado, asunto o nombre..."
                      className="pl-8 h-9 text-sm"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowFiltros(!showFiltros)}>
                    <Filter className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={verArchivadas ? "default" : "outline"}
                    size="sm"
                    onClick={alternarVistaArchivadas}
                    title={verArchivadas ? "Volver a las PQRS activas" : "Ver PQRS archivadas"}
                    aria-pressed={verArchivadas}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
                {showFiltros && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm bg-white"
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
                      className="border rounded-md px-2 py-1.5 text-sm bg-white"
                      value={filtroTipo}
                      onChange={e => setFiltroTipo(e.target.value)}
                    >
                      <option value="todos">Todos los tipos</option>
                      <option value="PE">Petición</option>
                      <option value="Q">Queja</option>
                      <option value="R">Reclamo</option>
                      <option value="S">Sugerencia</option>
                      <option value="F">Felicitación</option>
                    </select>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {cargandoLista ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : pqrsFiltradas.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    {verArchivadas
                      ? <Archive className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      : <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />}
                    <p className="text-sm">
                      {verArchivadas ? "No hay PQRS archivadas" : "No se encontraron PQRS"}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Barra de selección múltiple */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50 text-xs text-gray-600">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-blue-600"
                          checked={todasSeleccionadas}
                          onChange={toggleSeleccionTodas}
                        />
                        {idsSeleccionados.length > 0
                          ? `${idsSeleccionados.length} seleccionada${idsSeleccionados.length === 1 ? "" : "s"}`
                          : "Seleccionar todas"}
                      </label>
                      {idsSeleccionados.length > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto h-7 text-xs gap-1.5"
                            onClick={() => setShowConfirmArchivar(true)}
                          >
                            {verArchivadas
                              ? <ArchiveRestore className="w-3.5 h-3.5" />
                              : <Archive className="w-3.5 h-3.5" />}
                            {verArchivadas ? "Restaurar" : "Archivar"} ({idsSeleccionados.length})
                          </Button>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => setSeleccionadas(new Set())}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                    <div className="divide-y max-h-[60vh] overflow-y-auto">
                      {pqrsFiltradas.map(p => (
                        <div
                          key={p.id}
                          className={`flex items-stretch hover:bg-blue-50 transition-colors ${selected?.id === p.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                        >
                          <label className="flex items-center pl-4 pr-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-blue-600"
                              checked={seleccionadas.has(p.id)}
                              onChange={() => toggleSeleccion(p.id)}
                              aria-label={`Seleccionar ${p.numero_radicado ?? p.radicado}`}
                            />
                          </label>
                          <button
                            onClick={() => openDetail(p)}
                            className="flex-1 min-w-0 text-left px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-mono text-blue-600 mb-0.5">{p.numero_radicado ?? p.radicado}</p>
                                <p className="text-sm font-medium text-gray-900 truncate">{p.subject}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{contactName(p)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <StatusBadge status={p.status} />
                                <span className="text-xs text-gray-400">{PQRS_TYPE_LABEL[(p.type ?? p.pqrs_type) as keyof typeof PQRS_TYPE_LABEL]}</span>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-full lg:w-[500px] shrink-0">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <button
                      className="lg:hidden flex items-center gap-1 text-sm text-blue-600"
                      onClick={() => setSelected(null)}
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <CardTitle className="text-base">Detalle PQRS</CardTitle>
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
                <CardContent className="space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Info */}
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
                      <StatusBadge status={selected.status} />
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500">Área</span>
                      {assignmentLoading ? (
                        <span className="text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Cargando...</span>
                      ) : assignmentError && !selected.dependency ? (
                        <button
                          className="text-xs text-red-400 underline"
                          onClick={() => selected && loadAssignment(selected)}
                        >Error al cargar — reintentar</button>
                      ) : (() => {
                        // Prefer M2M arrays; fall back to legacy FK and then pqrs.dependency
                        const depNames: string[] =
                          (activeAssignment?.dependencies_nombres ?? []).length > 0
                            ? activeAssignment!.dependencies_nombres
                            : (activeAssignment?.dependencies ?? []).length > 0
                              ? activeAssignment!.dependencies.map(id => dependencies.find(d => d.id === id)?.name ?? id)
                              : activeAssignment?.dependency
                                ? [typeof activeAssignment.dependency === "object"
                                    ? (activeAssignment.dependency as Dependency).name
                                    : (dependencies.find(d => d.id === activeAssignment.dependency)?.name ?? String(activeAssignment.dependency))]
                                : selected.dependency?.name
                                  ? [selected.dependency.name]
                                  : [];
                        const ruNames: string[] =
                          (activeAssignment?.responsible_users ?? []).length > 0
                            ? activeAssignment!.responsible_users.map(id => {
                                const u = allUsers.find(x => x.id === id);
                                return u ? `${u.nombre} ${u.apellido}`.trim() : id;
                              })
                            : activeAssignment?.responsible_user
                              ? [typeof activeAssignment.responsible_user === "object"
                                  ? `${(activeAssignment.responsible_user as UsuarioAPI).nombre} ${(activeAssignment.responsible_user as UsuarioAPI).apellido}`.trim()
                                  : (allUsers.find(u => u.id === activeAssignment.responsible_user)?.nombre ?? String(activeAssignment.responsible_user))]
                              : [];
                        return depNames.length > 0 || ruNames.length > 0 ? (
                          <span className="text-right">
                            {depNames.length > 0 && (
                              <span className="text-blue-700 font-medium">{depNames.join(", ")}</span>
                            )}
                            {ruNames.length > 0 && (
                              <span className="block text-xs text-gray-500">({ruNames.join(", ")})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Sin asignar</span>
                        );
                      })()}
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
                    <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
                      {selected.description || <span className="italic text-gray-400">Sin descripción</span>}
                    </p>
                  </div>

                  {/* Tabs – 5 sections */}
                  <div className="grid grid-cols-5 border rounded-lg overflow-hidden text-xs">
                    {TABS.map(t => (
                      <button
                        key={t.id}
                        className={`py-2 font-medium transition-colors ${
                          activeTab === t.id ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        onClick={() => switchTab(t.id)}
                      >{t.label}</button>
                    ))}
                  </div>

                  {/* ── Tab: Responder ── */}
                  {activeTab === "respond" && (
                    <form onSubmit={respondForm.handleSubmit(onResponder)} className="space-y-3">
                      <div>
                        <Label className="text-sm">Tipo de respuesta</Label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white" {...respondForm.register("response_type")}>
                          <option value="CITIZEN">Respuesta al ciudadano</option>
                          <option value="FINAL">Respuesta final (cierra)</option>
                          <option value="INTERNAL">Nota interna</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-sm">Cambiar estado (opcional)</Label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white" {...respondForm.register("new_status")}>
                          <option value="">— Sin cambiar —</option>
                          <option value="RAD">Radicado</option>
                          <option value="PRO">En Proceso</option>
                          <option value="RES">Resuelto</option>
                          <option value="CER">Cerrado</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-sm">Respuesta *</Label>
                        <FormattingToolbar
                          textareaRef={respondContentTextareaRef}
                          value={respondForm.watch("content")}
                          onChange={(v) => respondForm.setValue("content", v, { shouldValidate: true, shouldDirty: true })}
                          className="mt-1 mb-1"
                        />
                        <Textarea
                          className="mt-1 text-sm" rows={4} placeholder="Escriba la respuesta o nota..."
                          {...respondContentReg}
                          ref={(el) => { respondContentRefCb(el); respondContentTextareaRef.current = el; }}
                        />
                        {respondForm.formState.errors.content && <p className="text-red-500 text-xs mt-1">{respondForm.formState.errors.content.message}</p>}
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
                  )}

                  {/* ── Tab: Asignar Área ── */}
                  {activeTab === "assign" && (
                    <form onSubmit={assignForm.handleSubmit(onAsignar)} className="space-y-3">
                      {/* Banner informativo cuando hay asignación activa pre-cargada */}
                      {activeAssignment && (
                        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                          Áreas y responsables pre-seleccionados de la asignación activa. Modifica la selección para reasignar.
                        </p>
                      )}
                      {/* Áreas (multi-select con checkboxes + búsqueda) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-sm">Áreas responsables <span className="text-red-500">*</span></Label>
                          {selectedDepIds.length > 0 && (
                            <button
                              type="button"
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              onClick={() => {
                                assignForm.setValue("dependencies", []);
                                assignForm.setValue("responsible_users", []);
                              }}
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={assignAreaSearch}
                          onChange={e => setAssignAreaSearch(e.target.value)}
                          placeholder="Buscar área..."
                          className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 mb-1"
                        />
                        <div className="max-h-36 overflow-y-auto border rounded-md p-2 space-y-0.5 bg-white">
                          {dependencies.length === 0 && (
                            <p className="text-xs text-gray-400 italic p-1">Sin dependencias disponibles.</p>
                          )}
                          {dependencies.filter(d =>
                            !assignAreaSearch.trim() ||
                            d.name.toLowerCase().includes(assignAreaSearch.toLowerCase()) ||
                            d.code.toLowerCase().includes(assignAreaSearch.toLowerCase())
                          ).map(d => (
                            <label
                              key={d.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 text-sm select-none"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDepIds.includes(d.id)}
                                onChange={e => {
                                  const cur = assignForm.getValues("dependencies") ?? [];
                                  assignForm.setValue(
                                    "dependencies",
                                    e.target.checked ? [...cur, d.id] : cur.filter(v => v !== d.id),
                                    { shouldDirty: true }
                                  );
                                }}
                                className="rounded accent-blue-600"
                              />
                              <span>{d.name}</span>
                              <span className="text-gray-400 text-xs">({d.code})</span>
                            </label>
                          ))}
                          {assignAreaSearch.trim() && dependencies.filter(d =>
                            d.name.toLowerCase().includes(assignAreaSearch.toLowerCase()) ||
                            d.code.toLowerCase().includes(assignAreaSearch.toLowerCase())
                          ).length === 0 && (
                            <p className="text-xs text-gray-400 italic p-1">Sin resultados.</p>
                          )}
                        </div>
                        {userWorkloadMap.size > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {selectedDepIds.length > 0
                              ? `${filteredAssignUsers.length} usuario${filteredAssignUsers.length !== 1 ? "s" : ""} en ${selectedDepIds.length === 1 ? "esta área" : "estas áreas"} — ordenados por carga`
                              : "Responsables ordenados por carga de asignaciones activas"}
                          </p>
                        )}
                      </div>

                      {/* Responsables (multi-select con checkboxes + búsqueda, filtrado por áreas) */}
                      <div>
                        <Label className="text-sm">Responsables *</Label>
                        <input
                          type="text"
                          value={assignUserSearch}
                          onChange={e => setAssignUserSearch(e.target.value)}
                          placeholder="Buscar por nombre o correo..."
                          className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1 mb-1"
                        />
                        <div className="max-h-44 overflow-y-auto border rounded-md p-2 space-y-0.5 bg-white">
                          {(() => {
                            const q = assignUserSearch.trim().toLowerCase();
                            const visible = [...filteredAssignUsers]
                              .sort((a, b) => (userWorkloadMap.get(a.id) ?? 0) - (userWorkloadMap.get(b.id) ?? 0))
                              .filter(u =>
                                !q ||
                                `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
                                u.email.toLowerCase().includes(q)
                              );
                            if (visible.length === 0 && filteredAssignUsers.length === 0 && selectedDepIds.length > 0)
                              return <p className="text-amber-600 text-xs p-1">No hay usuarios en las áreas seleccionadas.</p>;
                            if (visible.length === 0)
                              return <p className="text-gray-400 text-xs p-1 italic">{q ? "Sin resultados." : "No hay usuarios disponibles."}</p>;
                            return visible.map(u => {
                              const load = userWorkloadMap.get(u.id) ?? 0;
                              const loadLabel = userWorkloadMap.size > 0
                                ? (load === 0 ? " · sin asignaciones" : ` · ${load} asig${load !== 1 ? "." : ""}`)
                                : "";
                              const areaLabel = selectedDepIds.length === 0
                                ? ` [${depNameFor(u.dependency) ?? "Sin área"}]`
                                : "";
                              return (
                                <label
                                  key={u.id}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 text-sm select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedUserIds.includes(u.id)}
                                    onChange={e => {
                                      const cur = assignForm.getValues("responsible_users") ?? [];
                                      assignForm.setValue(
                                        "responsible_users",
                                        e.target.checked ? [...cur, u.id] : cur.filter(v => v !== u.id),
                                        { shouldDirty: true }
                                      );
                                    }}
                                    className="rounded accent-blue-600"
                                  />
                                  <span className="truncate">
                                    {u.nombre} {u.apellido}
                                    <span className="text-gray-400 text-xs"> · {u.email}{areaLabel}{loadLabel}</span>
                                  </span>
                                </label>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Notas de asignación (opcional)</Label>
                        <Textarea className="mt-1 text-sm" rows={3} placeholder="Instrucciones o contexto para el área..." {...assignForm.register("notes")} />
                      </div>
                      <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Asignando...</> : "Asignar a Área"}
                      </Button>
                    </form>
                  )}

                  {/* ── Tab: Escalar ── */}
                  {activeTab === "escalate" && (
                    <form onSubmit={escalateForm.handleSubmit(onEscalar)} className="space-y-3">
                      <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded p-2">
                        Escala esta PQRS a otra área o usuario. El destino recibirá una notificación automática.
                      </p>
                      <div>
                        <Label className="text-sm">Área destino (opcional)</Label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                          {...escalateForm.register("to_dependency", {
                            onChange: () => escalateForm.setValue("to_user", "")
                          })}
                        >
                          <option value="">— Sin cambio de área —</option>
                          {dependencies.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-sm">Usuario destino (opcional)</Label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white" {...escalateForm.register("to_user")}>
                          <option value="">— Sin usuario específico —</option>
                          {filteredEscalateUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.nombre} {u.apellido} — {u.email}</option>
                          ))}
                        </select>
                        {selectedEscalateDepId && filteredEscalateUsers.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">No hay usuarios asignados a esta área.</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm">Motivo *</Label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white" {...escalateForm.register("reason", { required: "El motivo es obligatorio" })}>
                          <option value="SLA">Vencimiento SLA</option>
                          <option value="COMPLEXITY">Complejidad del caso</option>
                          <option value="COMPETENCE">Competencia de otra área</option>
                          <option value="OTHER">Otro</option>
                        </select>
                        {escalateForm.formState.errors.reason && <p className="text-red-500 text-xs mt-1">{escalateForm.formState.errors.reason.message}</p>}
                      </div>
                      <div>
                        <Label className="text-sm">Notas adicionales (opcional)</Label>
                        <Textarea className="mt-1 text-sm" rows={3} placeholder="Información adicional sobre la escalación..." {...escalateForm.register("notes")} />
                      </div>
                      <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={submitting}>
                        {submitting
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Escalando...</>
                          : <><ArrowUpCircle className="w-4 h-4 mr-2" />Escalar PQRS</>}
                      </Button>
                    </form>
                  )}

                  {/* ── Tab: Historial ── */}
                  {activeTab === "history" && (
                    <div className="space-y-4">
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                          <span className="text-sm text-gray-500">Cargando historial...</span>
                        </div>
                      ) : (
                        <>
                          {/* Assignments */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                              <Building2 className="w-3 h-3" /> Asignaciones ({allAssignments.length})
                            </h4>
                            {allAssignments.length === 0
                              ? <p className="text-xs text-gray-400 italic">Sin asignaciones registradas.</p>
                              : allAssignments.map(a => {
                                  // Resolve area names: prefer M2M → FK legacy
                                  const aDepNames: string[] =
                                    (a.dependencies_nombres ?? []).length > 0
                                      ? a.dependencies_nombres
                                      : (a.dependencies ?? []).length > 0
                                        ? a.dependencies.map(id => dependencies.find(d => d.id === id)?.name ?? id)
                                        : a.dependency
                                          ? [typeof a.dependency === "object"
                                              ? (a.dependency as Dependency).name
                                              : (dependencies.find(d => d.id === a.dependency)?.name ?? String(a.dependency))]
                                          : [];
                                  // Resolve user names: prefer M2M → FK legacy
                                  const aUserNames: string[] =
                                    (a.responsible_users ?? []).length > 0
                                      ? a.responsible_users.map(id => {
                                          const u = allUsers.find(x => x.id === id);
                                          return u ? `${u.nombre} ${u.apellido}`.trim() : id;
                                        })
                                      : a.responsible_user
                                        ? [typeof a.responsible_user === "object"
                                            ? `${(a.responsible_user as UsuarioAPI).nombre} ${(a.responsible_user as UsuarioAPI).apellido}`.trim()
                                            : (allUsers.find(u => u.id === a.responsible_user)?.nombre ?? String(a.responsible_user))]
                                        : [];
                                  const assignedByField = a.assigned_by_user;
                                  const assignedByObj = assignedByField && typeof assignedByField === "object"
                                    ? assignedByField as UsuarioAPI
                                    : allUsers.find(u => u.id === assignedByField) ?? null;
                                  return (
                                    <div key={a.id} className={`border rounded-lg p-3 mb-2 text-xs ${
                                      a.is_active ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200 opacity-70"
                                    }`}>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className={`font-medium px-1.5 py-0.5 rounded ${
                                          a.is_active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                                        }`}>{a.is_active ? "Activa" : "Histórica"}</span>
                                        <span className="text-gray-400">{formatDateTime(a.assigned_at ?? a.created_at ?? "")}</span>
                                      </div>
                                      {aDepNames.length > 0 && (
                                        <p className="text-gray-700">Área{aDepNames.length > 1 ? "s" : ""}: <span className="font-medium">{aDepNames.join(", ")}</span></p>
                                      )}
                                      {aUserNames.length > 0 && (
                                        <p className="text-gray-700">Responsable{aUserNames.length > 1 ? "s" : ""}: <span className="font-medium">{aUserNames.join(", ")}</span></p>
                                      )}
                                      {assignedByObj && <p className="text-gray-400 mt-0.5">Asignado por: {assignedByObj.nombre} {assignedByObj.apellido}</p>}
                                      {a.notes && <p className="text-gray-600 italic mt-1">"{a.notes}"</p>}
                                    </div>
                                  );
                                })
                            }
                          </div>

                          {/* Responses */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                              <MessageSquare className="w-3 h-3" /> Respuestas ({responses.length})
                            </h4>
                            {responses.length === 0
                              ? <p className="text-xs text-gray-400 italic">Sin respuestas registradas.</p>
                              : responses.map(r => (
                                  <div key={r.id} className="border rounded-lg p-3 mb-2 text-sm bg-white">
                                    <div className="flex justify-between mb-1">
                                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                        r.response_type === "FINAL"    ? "bg-green-100 text-green-700" :
                                        r.response_type === "INTERNAL" ? "bg-gray-100 text-gray-600"  :
                                                                          "bg-blue-100 text-blue-700"
                                      }`}>
                                        {r.response_type === "FINAL" ? "Respuesta Final" : r.response_type === "INTERNAL" ? "Nota Interna" : "Respuesta Ciudadano"}
                                      </span>
                                      <span className="text-xs text-gray-400">{formatDateTime(r.created_at)}</span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap text-xs">{parseRichText(r.content)}</p>
                                    <p className="text-xs text-gray-400 mt-1">Por: {(() => {
                                      const raw = r.responded_by ?? r.user ?? r.created_by;
                                      if (!raw) return "—";
                                      if (typeof raw === "object") return `${(raw as UsuarioAPI).nombre ?? ""} ${(raw as UsuarioAPI).apellido ?? ""}`.trim() || (raw as UsuarioAPI).email || (raw as UsuarioAPI).username || "—";
                                      const found = allUsers.find(u => u.id === raw);
                                      return found ? `${found.nombre} ${found.apellido}`.trim() : raw;
                                    })()}</p>
                                  </div>
                                ))
                            }
                          </div>

                          {/* Escalations */}
                          {escalations.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                <ArrowUpCircle className="w-3 h-3" /> Escalaciones ({escalations.length})
                              </h4>
                              {escalations.map(e => (
                                <div key={e.id} className="border border-orange-100 rounded-lg p-3 mb-2 text-sm bg-orange-50">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-xs font-medium text-orange-700">{e.reason_display ?? e.reason}</span>
                                    <span className="text-xs text-gray-400">{formatDateTime(e.escalated_at)}</span>
                                  </div>
                                  {e.to_dependency && (() => {
                                    const depId = typeof e.to_dependency === "string" ? e.to_dependency : (e.to_dependency as any).id;
                                    const dep = dependencies.find(d => d.id === depId);
                                    return <p className="text-xs text-gray-600">→ Área: {dep ? `${dep.name} (${dep.code})` : depId}</p>;
                                  })()}
                                  {e.to_user && (() => {
                                    const userId = typeof e.to_user === "string" ? e.to_user : (e.to_user as any).id;
                                    const u = allUsers.find(u => u.id === userId);
                                    return <p className="text-xs text-gray-600">→ Usuario: {u ? `${u.nombre} ${u.apellido}` : userId}</p>;
                                  })()}
                                  {e.notes && <p className="text-gray-700 text-xs mt-1 italic">{e.notes}</p>}
                                  <p className="text-xs text-gray-400 mt-1">Por: {e.from_user?.nombre} {e.from_user?.apellido}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Activities */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                              <Activity className="w-3 h-3" /> Bitácora ({activities.length})
                            </h4>
                            {activities.length === 0
                              ? <p className="text-xs text-gray-400 italic">Sin actividades registradas.</p>
                              : activities.map(a => {
                                  // ── Resolve campos con doble nombre (backend real vs alias) ──
                                  const texto = a.detail ?? a.description ?? "";
                                  const autor = a.performed_by ?? a.created_by ?? null;
                                  const autorNombre = autor
                                    ? typeof autor === "object"
                                      ? `${(autor as UsuarioAPI).nombre ?? ""} ${(autor as UsuarioAPI).apellido ?? ""}`.trim()
                                      : allUsers.find(u => u.id === autor)
                                        ? `${allUsers.find(u => u.id === autor)!.nombre} ${allUsers.find(u => u.id === autor)!.apellido}`.trim()
                                        : null
                                    : null;
                                  const label = a.activity_type_display ?? {
                                    CREATED:         "Radicación",
                                    STATUS_CHANGED:  "Cambio de estado",
                                    ASSIGNED:        "Asignación",
                                    ESCALATED:       "Escalación",
                                    RESPONSE_ADDED:  "Respuesta agregada",
                                    ATTACHMENT_ADDED:"Adjunto agregado",
                                    COMMENT:         "Comentario interno",
                                    SLA_BREACH:      "Incumplimiento SLA",
                                  }[a.activity_type] ?? a.activity_type;
                                  const cfg: Record<string, { icon: React.ReactNode; dot: string; badge: string }> = {
                                    CREATED:         { icon: <FilePlus   className="w-3 h-3" />, dot: "bg-blue-500",   badge: "bg-blue-50   text-blue-700   border-blue-200"   },
                                    STATUS_CHANGED:  { icon: <RefreshCw  className="w-3 h-3" />, dot: "bg-amber-500",  badge: "bg-amber-50  text-amber-700  border-amber-200"  },
                                    ASSIGNED:        { icon: <Building2  className="w-3 h-3" />, dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                                    ESCALATED:       { icon: <ArrowUpCircle className="w-3 h-3" />, dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
                                    RESPONSE_ADDED:  { icon: <MessageSquare className="w-3 h-3" />, dot: "bg-green-500",  badge: "bg-green-50  text-green-700  border-green-200"  },
                                    ATTACHMENT_ADDED:{ icon: <Paperclip  className="w-3 h-3" />, dot: "bg-gray-400",   badge: "bg-gray-50   text-gray-600   border-gray-200"   },
                                    COMMENT:         { icon: <StickyNote className="w-3 h-3" />, dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border-purple-200" },
                                    SLA_BREACH:      { icon: <ShieldAlert className="w-3 h-3" />, dot: "bg-red-500",    badge: "bg-red-50    text-red-700    border-red-200"    },
                                  };
                                  const style = cfg[a.activity_type] ?? { icon: <Activity className="w-3 h-3" />, dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600 border-gray-200" };
                                  return (
                                    <div key={a.id} className="flex gap-2.5 py-2.5 border-b last:border-0">
                                      <div className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${style.badge}`}>
                                            {style.icon}{label}
                                          </span>
                                        </div>
                                        {texto && <p className="text-xs text-gray-700 leading-relaxed">{texto}</p>}
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                          {formatDateTime(a.created_at)}
                                          {autorNombre && ` · ${autorNombre}`}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                            }
                          </div>

                          <Button variant="outline" size="sm" className="w-full" onClick={() => loadHistory(selected!.id)}>
                            <Activity className="w-4 h-4 mr-1" /> Actualizar historial
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {/* ── Tab: Adjuntos ── */}
                  {activeTab === "adjuntos" && (
                    <div className="space-y-3">
                      {/* Upload button */}
                      <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-lg py-4 cursor-pointer transition-colors ${
                        uploading ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                      }`}>
                        {uploading
                          ? <><Loader2 className="w-4 h-4 animate-spin text-blue-400" /><span className="text-sm text-gray-500">Subiendo...</span></>
                          : <><Upload className="w-4 h-4 text-blue-500" /><span className="text-sm text-blue-600 font-medium">Adjuntar archivo</span><span className="text-xs text-gray-400">(máx. 10&nbsp;MB)</span></>}
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

                      {/* List */}
                      {attachLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                          <span className="text-sm text-gray-500">Cargando adjuntos...</span>
                        </div>
                      ) : attachments.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Sin archivos adjuntos</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {attachments.map(att => (
                            <div key={att.id} className="flex items-center justify-between border rounded-lg px-3 py-2 bg-white text-sm">
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
                        className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mx-auto"
                        onClick={() => selected && loadAttachments(selected.id)}
                      >
                        <RefreshCw className="w-3 h-3" /> Actualizar
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
