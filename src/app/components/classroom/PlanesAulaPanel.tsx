import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ApiError, formatApiError } from "../../lib/api";
import type { Usuario } from "../../context/AuthContext";
import { CreateCourseDialog } from "./CreateCourseDialog";
import {
  apiCreateEvaluation,
  apiCreateGeneralObjective,
  apiCreateSpecificObjective,
  apiCreateTopic,
  apiCreatePlan,
  apiCreateReference,
  apiUpdateCourseComponent,
  apiDuplicateCourse,
  apiAcquirePlanLock,
  apiReleasePlanLock,
  apiDeleteEvaluation,
  apiDeleteGeneralObjective,
  apiDeletePlan,
  apiDeleteSpecificObjective,
  apiDeleteTopic,
  apiDeleteReference,
  apiListCourses,
  apiExportBulkPdf,
  apiExportCsv,
  apiExportPlanExcel,
  apiExportPlanPdf,
  apiGetPlan,
  apiListEvaluations,
  apiListObjectives,
  apiListPlans,
  apiListReferences,
  apiSubmitPlanForReview,
  apiUpdatePlan,
  apiUpdatePlanStatus,
  apiUpdateEvaluation,
  apiUpdateGeneralObjective,
  apiUpdateSpecificObjective,
  apiUpdateTopic,
  apiUpdateReference,
  apiBulkImportExcel,
  apiGetComponentOptions,
  ensureClassroomSession,
  getClassroomSessionKey,
  SEMESTER_ROMAN_OPTIONS,
  MODALITY_OPTIONS,
  COMPONENT_OPTIONS,
  COMPONENT_CAMPO_LABELS,
  type BulkImportResult,
  type ClassroomCourse,
  type ClassroomPlan,
  type ClassroomUser,
  type ProgramComponentOption,
} from "../../lib/classroomApi";

function statusLabel(s: ClassroomPlan["status"]) {
  if (s === "planeacion") return "Planeación";
  if (s === "revision") return "Revisión";
  return "Aprobado";
}
function statusClass(s: ClassroomPlan["status"]) {
  if (s === "planeacion") return "bg-orange-100 text-orange-800 border-orange-200";
  if (s === "revision") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function normalizeOptionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const DISCIPLINARY_FIELD_OPTIONS: Array<{ value: "comun" | "basico_disciplinar"; label: string }> = [
  { value: "comun", label: "Común" },
  { value: "basico_disciplinar", label: "Básico disciplinar" },
];

type ClassType = "teorico" | "practico" | "teorico_practico";

const CLASS_TYPE_OPTIONS: Array<{ value: ClassType; label: string }> = [
  { value: "teorico", label: "Teórico" },
  { value: "practico", label: "Práctico" },
  { value: "teorico_practico", label: "Teórico-práctico" },
];

const EVALUATION_INSTRUMENTS: Record<ClassType, string[]> = {
  teorico: [
    "Ensayo",
    "Exposición",
    "Cuestionario",
    "Quiz",
    "Mapas conceptuales",
    "Autoevaluación y coevaluación",
    "Estructuración de propuestas",
    "Estructuración de proyectos",
    "Análisis de sentencias",
  ],
  practico: [
    "Parcial",
    "Prototipo funcional",
    "Práctica de Laboratorio",
    "Exposición",
    "Prácticas supervisadas",
    "Informe de sesión práctica",
    "Atención a usuarios",
    "Estructuración de proyectos",
    "Diseño de escenarios didácticos",
    "Autoevaluación y coevaluación",
    "Portafolios Digitales",
  ],
  teorico_practico: [
    "Práctica de Laboratorio",
    "Simulaciones",
    "Estructuración de proyectos",
    "Exposición",
    "Debate",
    "Mesa redonda",
    "Resolución de casos",
    "Prototipo funcional",
  ],
};

function evaluationInstrumentOptions(classType: ClassType | "", currentName?: string): string[] {
  const options = (classType && EVALUATION_INSTRUMENTS[classType]) || Object.values(EVALUATION_INSTRUMENTS).flat();
  return currentName && !options.includes(currentName) ? [currentName, ...options] : options;
}

/** Bloquea el plan antes de editar; si otro usuario ya lo tiene abierto, avisa y no deja continuar.
 *  Si el bloqueo falla por un error ajeno (backend caído, migración pendiente, etc.) no impide editar. */
async function tryAcquireLock(planId: string): Promise<boolean> {
  try {
    const result = await apiAcquirePlanLock(planId);
    if (result.locked) {
      toast.error(`${result.locked_by} está editando este plan ahora mismo`, {
        description: "Espera unos minutos e intenta de nuevo para no perder tus cambios.",
      });
      return false;
    }
    return true;
  } catch (e) {
    toast.warning("No se pudo verificar si alguien más está editando", { description: formatApiError(e) });
    return true;
  }
}

type TopicRow = { id?: string; title: string; content?: string; weeks?: number };
type SpecificObjRow = { id?: string; description: string; topics: TopicRow[] };
type ObjRow  = { id?: string; description: string; specificObjectives: SpecificObjRow[] };
type EvalRow = { id?: string; name: string; percentage: string; description: string };
type RefRow  = { id?: string; type: string; title: string; author: string; year: string; publisher: string; url: string };

const EMPTY_OBJ  = (): ObjRow  => ({ description: "", specificObjectives: [] });
const EMPTY_EVAL = (): EvalRow => ({ name: "", percentage: "", description: "" });
const EMPTY_REF  = (): RefRow  => ({ type: "libro", title: "", author: "", year: "", publisher: "", url: "" });

const REFERENCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "libro", label: "Libro" },
  { value: "articulo", label: "Artículo" },
  { value: "sitio_web", label: "Sitio web" },
  { value: "otro", label: "Otro" },
];

/** Vista previa de la cita en formato APA 7 a partir de los campos sueltos (misma lógica que el backend). */
function formatApaCitation(r: { title: string; author: string; year: string; publisher: string; url: string }): string {
  const year = r.year.trim() ? `(${r.year.trim()}).` : "(s.f.).";
  const title = r.title.trim() ? `${r.title.trim().replace(/\.$/, "")}.` : "";
  const parts: string[] = [];

  if (r.author.trim()) {
    parts.push(`${r.author.trim().replace(/\.$/, "")}.`, year);
    if (title) parts.push(title);
  } else {
    // Sin autor individual (común en sitios web institucionales): el título va primero.
    if (title) parts.push(title);
    parts.push(year);
  }

  if (r.publisher.trim()) parts.push(`${r.publisher.trim().replace(/\.$/, "")}.`);
  if (r.url.trim()) parts.push(r.url.trim());
  return parts.join(" ");
}

interface Props { user: Usuario; }

export function PlanesAulaPanel({ user }: Props) {
  const classroomSessionKey = getClassroomSessionKey(user);
  const [classroomUser, setClassroomUser] = useState<ClassroomUser | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [plans, setPlans] = useState<ClassroomPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ClassroomPlan | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [filterFacultyId, setFilterFacultyId] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [downloadingBulk, setDownloadingBulk] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openCreateCourse, setOpenCreateCourse] = useState(false);

  // ── Carga masiva desde Excel ──────────────────────────────────────────────
  const [openImport, setOpenImport]       = useState(false);
  const [importFile, setImportFile]       = useState<File | null>(null);
  const [importPeriod, setImportPeriod]   = useState("");
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState<BulkImportResult | null>(null);
  const [newPlan, setNewPlan] = useState({
    course_id: "",
    component: "",
    disciplinary_field: "" as "" | "comun" | "basico_disciplinar",
    class_type: "" as "" | ClassType,
    modality: "" as "" | "presencial" | "virtual" | "hibrida" | "dual" | "unica",
    semester: "",
    credits: "",
    competency: "",
  });
  const [courseQuery, setCourseQuery] = useState("");
  const newPlanCourse = useMemo(() => courses.find((c) => c.id === newPlan.course_id), [courses, newPlan.course_id]);
  useEffect(() => {
    setNewPlan((s) => ({ ...s, component: newPlanCourse?.component ?? "" }));
  }, [newPlanCourse]);
  // Catálogo real de Componentes (por programa) para el select de "Crear plan".
  const [newPlanComponentOptions, setNewPlanComponentOptions] = useState<ProgramComponentOption[]>([]);
  useEffect(() => {
    apiGetComponentOptions(newPlanCourse?.program?.id ?? null)
      .then((res) => setNewPlanComponentOptions(res.options))
      .catch(() => setNewPlanComponentOptions([]));
  }, [newPlanCourse?.program?.id]);
  const [createObjs,  setCreateObjs]  = useState<ObjRow[]>([]);
  const [createEvals, setCreateEvals] = useState<EvalRow[]>([]);
  const [createRefs,  setCreateRefs]  = useState<RefRow[]>([]);

  const [openEditGeneral, setOpenEditGeneral] = useState(false);
  const [editGeneral, setEditGeneral] = useState({
    disciplinary_field: "" as "" | "comun" | "basico_disciplinar",
    component: "",
    class_type: "" as "" | ClassType,
    modality: "" as "" | "presencial" | "virtual" | "hibrida" | "dual" | "unica",
    semester: "",
    credits: "",
    competency: "",
  });
  const [savingGeneral, setSavingGeneral] = useState(false);
  // Catálogo real de Componentes (por programa) para el select de "Editar datos generales".
  const [editGeneralComponentOptions, setEditGeneralComponentOptions] = useState<ProgramComponentOption[]>([]);
  useEffect(() => {
    if (!openEditGeneral) return;
    apiGetComponentOptions(selectedPlan?.course?.program?.id ?? null)
      .then((res) => setEditGeneralComponentOptions(res.options))
      .catch(() => setEditGeneralComponentOptions([]));
  }, [openEditGeneral, selectedPlan?.course?.program?.id]);

  const [openObjectives, setOpenObjectives] = useState(false);
  const [editObjs, setEditObjs] = useState<ObjRow[]>([]);
  const [savingObjectives, setSavingObjectives] = useState(false);

  const [openEvals, setOpenEvals] = useState(false);
  const [editEvals, setEditEvals] = useState<EvalRow[]>([]);
  const [savingEvals, setSavingEvals] = useState(false);

  const [openRefs, setOpenRefs] = useState(false);
  const [editRefs, setEditRefs] = useState<RefRow[]>([]);
  const [savingRefs, setSavingRefs] = useState(false);

  const [sendingReview, setSendingReview] = useState(false);
  const [duplicatingCourseId, setDuplicatingCourseId] = useState<string | null>(null);

  // Renueva el bloqueo mientras algún formulario esté abierto, para que ediciones
  // largas (>5 min, el TTL del lock) no expiren y permitan a otro usuario entrar.
  useEffect(() => {
    const anyOpen = openEditGeneral || openObjectives || openEvals || openRefs;
    if (!anyOpen || !selectedPlan) return;
    const planId = selectedPlan.id;
    const interval = setInterval(() => {
      apiAcquirePlanLock(planId).catch(() => {});
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [openEditGeneral, openObjectives, openEvals, openRefs, selectedPlan]);

  const canReview = useMemo(() => [1, 2, 3].includes(classroomUser?.role_id ?? 0), [classroomUser]);
  const isDocente = useMemo(() => classroomUser?.role_id === 4, [classroomUser]);
  // Estudiante puro: no tiene role_id asignado en CLASSROOM_PLAN_SERVICE (solo perfil_tipo en PQRS_SYS)
  const isStudentePuro = useMemo(() => !classroomUser?.role_id || classroomUser?.role_id === null, [classroomUser]);

  const resolveCourseId = useCallback(
    (rawQuery: string) => {
      const normalized = rawQuery.trim().toLowerCase();
      if (!normalized) return "";

      const exactCodeMatch = courses.find((c) => c.code.toLowerCase() === normalized);
      if (exactCodeMatch) return exactCodeMatch.id;

      const exactNameMatches = courses.filter((c) => c.name.toLowerCase() === normalized);
      if (exactNameMatches.length === 1) return exactNameMatches[0].id;

      const matches = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(normalized) ||
          c.name.toLowerCase().includes(normalized),
      );

      return matches.length === 1 ? matches[0].id : "";
    },
    [courses],
  );

  // `silent` refresca sin spinner ni toasts (usado por el refresco automático).
  const reloadPlans = useCallback(async (silent = false) => {
    if (!silent) setLoadingPlans(true);
    try {
      const res = await apiListPlans({ per_page: 500 });
      setPlans(res.data ?? []);
    } catch (e) {
      if (!silent) toast.error("No se pudieron cargar los planes", { description: formatApiError(e) });
    } finally {
      if (!silent) setLoadingPlans(false);
    }
  }, []);

  const loadPlanDetail = useCallback(async (planId: string, silent = false) => {
    try {
      const [plan, objectives, evaluations, references] = await Promise.all([
        apiGetPlan(planId),
        apiListObjectives(planId),
        apiListEvaluations(planId),
        apiListReferences(planId),
      ]);
      const fullPlan = { ...plan, generalObjectives: objectives, evaluationMethods: evaluations, bibliographicReferences: references };
      if (silent) {
        // No reabrir ni reemplazar el modal si el usuario cerró o cambió de plan mientras cargaba.
        setSelectedPlan((prev) => (prev?.id === planId ? fullPlan : prev));
      } else {
        setSelectedPlan(fullPlan);
      }
      // Mantiene la lista sincronizada con los datos recién guardados.
      setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, ...plan } : p)));
      return fullPlan;
    } catch (e) {
      if (!silent) toast.error("No se pudo cargar el detalle del plan", { description: formatApiError(e) });
      return null;
    }
  }, []);

  // Refresco automático: otros usuarios pueden modificar planes mientras este módulo está abierto.
  const autoRefreshBlocked = openCreate || openCreateCourse || openImport || openEditGeneral || openObjectives || openEvals || openRefs
    || savingGeneral || savingObjectives || savingEvals || savingRefs || creating;
  const selectedPlanId = selectedPlan?.id ?? null;
  useEffect(() => {
    if (loadingBootstrap || autoRefreshBlocked) return;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await Promise.all([reloadPlans(true), selectedPlanId ? loadPlanDetail(selectedPlanId, true) : Promise.resolve(null)]);
      } finally {
        running = false;
      }
    };
    const interval = setInterval(refresh, 20_000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadingBootstrap, autoRefreshBlocked, selectedPlanId, reloadPlans, loadPlanDetail]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoadingBootstrap(true);
      try {
        const me = await ensureClassroomSession(user);
        setClassroomUser(me);
        
        const catalogCourses = await apiListCourses({ active_only: true });

        setCourses(catalogCourses);
        await reloadPlans();
      } catch (e) {
        toast.error("No se pudo inicializar el módulo de Planes de Aula", { description: formatApiError(e) });
      } finally {
        setLoadingBootstrap(false);
      }
    };
    bootstrap();
  }, [classroomSessionKey, reloadPlans]);

  const onCreatePlan = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setCreating(true);
    try {
      const resolvedCourseId = newPlan.course_id || resolveCourseId(courseQuery);
      
      if (!resolvedCourseId) {
        toast.error("Selecciona un curso habilitado de la lista antes de guardar");
        setCreating(false);
        return;
      }

      if (newPlan.component !== (newPlanCourse?.component ?? "")) {
        await apiUpdateCourseComponent(resolvedCourseId, newPlan.component || null);
        setCourses((prev) => prev.map((c) => (c.id === resolvedCourseId ? { ...c, component: newPlan.component || null } : c)));
      }
      const createEvalTotal = evalTotal(createEvals);
      if (createEvalTotal > 100) {
        toast.error("El total de evaluación no puede superar 100%", {
          description: `Total actual: ${createEvalTotal.toFixed(1)}%`,
        });
        setCreating(false);
        return;
      }

      const created = await apiCreatePlan({
        course_id: resolvedCourseId,
        disciplinary_field: newPlan.disciplinary_field || undefined,
        class_type: newPlan.class_type || undefined,
        modality: newPlan.modality || undefined,
        semester: newPlan.semester.trim() || undefined,
        credits: newPlan.credits.trim() ? Number(newPlan.credits) : undefined,
        competency: newPlan.competency.trim() || undefined,
      });
      await Promise.all([
        ...createObjs.filter((o) => o.description.trim()).map((o, i) => apiCreateGeneralObjective(created.id, { description: o.description.trim(), order: i + 1 })),
        ...createEvals.filter((e) => e.name.trim() && e.percentage).map((e) => apiCreateEvaluation(created.id, { name: e.name.trim(), percentage: Number(e.percentage), description: e.description || undefined })),
        ...createRefs.filter((r) => r.title.trim()).map((r, i) => apiCreateReference(created.id, { type: r.type, title: r.title.trim(), author: r.author || undefined, year: r.year || undefined, publisher: r.publisher || undefined, url: r.url || undefined, order: i + 1 })),
      ]);
      toast.success("Plan creado correctamente");
      setOpenCreate(false);
      setNewPlan({ course_id: "", component: "", disciplinary_field: "", class_type: "", modality: "", semester: "", credits: "", competency: "" });
      setCourseQuery("");
      setCreateObjs([]); setCreateEvals([]); setCreateRefs([]);
      await reloadPlans();
      await loadPlanDetail(created.id);
    } catch (e) {
      toast.error("No se pudo crear el plan", { description: formatApiError(e) });
    } finally {
      setCreating(false);
    }
  };

  const onOpenEditGeneral = async () => {
    if (!selectedPlan) return;
    if (!(await tryAcquireLock(selectedPlan.id))) return;
    setEditGeneral({
      disciplinary_field: selectedPlan.disciplinary_field ?? "",
      component: selectedPlan.course?.component ?? "",
      class_type: selectedPlan.class_type ?? "",
      modality: selectedPlan.modality ?? "",
      semester: selectedPlan.semester ?? "",
      credits: selectedPlan.credits != null ? String(selectedPlan.credits) : "",
      competency: selectedPlan.competency ?? "",
    });
    setOpenEditGeneral(true);
  };
  const onSaveGeneral = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPlan) return;
    setSavingGeneral(true);
    try {
      if (selectedPlan.course?.id && editGeneral.component !== (selectedPlan.course?.component ?? "")) {
        await apiUpdateCourseComponent(selectedPlan.course.id, editGeneral.component || null);
        setCourses((prev) => prev.map((c) => (c.id === selectedPlan.course?.id ? { ...c, component: editGeneral.component || null } : c)));
      }
      await apiUpdatePlan(selectedPlan.id, {
        disciplinary_field: editGeneral.disciplinary_field || undefined,
        class_type: editGeneral.class_type || undefined,
        modality: editGeneral.modality || undefined,
        semester: editGeneral.semester.trim() || undefined,
        credits: editGeneral.credits.trim() ? Number(editGeneral.credits) : undefined,
        competency: editGeneral.competency.trim() || undefined,
      });
      toast.success("Datos generales actualizados");
      setOpenEditGeneral(false);
      await apiReleasePlanLock(selectedPlan.id).catch(() => {});
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudieron actualizar los datos", { description: formatApiError(e) });
    } finally { setSavingGeneral(false); }
  };

  const onOpenObjectives = async () => {
    if (!selectedPlan) return;
    if (!(await tryAcquireLock(selectedPlan.id))) return;
    // Recarga los datos justo antes de editar: si otro usuario borró/recreó un
    // objetivo o tema mientras el plan estaba abierto, evita construir el
    // formulario con IDs obsoletos que ya no existen en el backend (causa de 404).
    const freshPlan = await loadPlanDetail(selectedPlan.id);
    if (!freshPlan) { await apiReleasePlanLock(selectedPlan.id).catch(() => {}); return; }
    setEditObjs((freshPlan.generalObjectives ?? []).map((o) => ({
      id: o.id,
      description: o.description,
      specificObjectives: (o.specificObjectives ?? []).map((specific) => ({
        id: specific.id,
        description: specific.description,
        topics: (specific.topics ?? []).map((topic) => ({
          id: topic.id,
          title: topic.title,
          content: topic.content,
          weeks: topic.weeks,
        })),
      })),
    })));
    setOpenObjectives(true);
  };
  const onSaveObjectives = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPlan) return;
    setSavingObjectives(true);
    try {
      await Promise.all(editObjs.filter((o) => o.description.trim()).map(async (objective, objectiveIndex) => {
        let generalObjectiveId = objective.id;
        if (generalObjectiveId) {
          await apiUpdateGeneralObjective(selectedPlan.id, generalObjectiveId, {
            description: objective.description.trim(),
            order: objectiveIndex + 1,
          });
        } else {
          const created = await apiCreateGeneralObjective(selectedPlan.id, {
            description: objective.description.trim(),
            order: objectiveIndex + 1,
          });
          generalObjectiveId = created.id;
        }

        await Promise.all(objective.specificObjectives.filter((specific) => specific.description.trim()).map(async (specific, specificIndex) => {
          let specificObjectiveId = specific.id;
          if (specificObjectiveId) {
            await apiUpdateSpecificObjective(selectedPlan.id, generalObjectiveId, specificObjectiveId, {
                description: specific.description.trim(),
                order: specificIndex + 1,
              });
          } else {
            const created = await apiCreateSpecificObjective(selectedPlan.id, generalObjectiveId, {
                description: specific.description.trim(),
                order: specificIndex + 1,
              });
            specificObjectiveId = created.id;
          }

          await Promise.all(specific.topics.filter((topic) => topic.title.trim()).map((topic, topicIndex) =>
            topic.id
              ? apiUpdateTopic(selectedPlan.id, generalObjectiveId, specificObjectiveId, topic.id, {
                  title: topic.title.trim(),
                  content: topic.content?.trim() || undefined,
                  weeks: topic.weeks,
                  order: topicIndex + 1,
                })
              : apiCreateTopic(selectedPlan.id, generalObjectiveId, specificObjectiveId, {
                  title: topic.title.trim(),
                  content: topic.content?.trim() || undefined,
                  weeks: topic.weeks,
                  order: topicIndex + 1,
                }),
          ));
        }));
      }));
      toast.success("Objetivos guardados");
      setOpenObjectives(false);
      await apiReleasePlanLock(selectedPlan.id).catch(() => {});
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // El objetivo/tema referenciado ya no existe (editado o eliminado por otro usuario).
        toast.error("Los objetivos cambiaron mientras editabas", {
          description: "Alguien más modificó este plan. Se recargó la información más reciente, vuelve a intentarlo.",
        });
        await apiReleasePlanLock(selectedPlan.id).catch(() => {});
        await loadPlanDetail(selectedPlan.id);
        setOpenObjectives(false);
      } else {
        toast.error("No se pudieron guardar los objetivos", { description: formatApiError(e) });
      }
    } finally { setSavingObjectives(false); }
  };

  const onOpenEvals = async () => {
    if (!selectedPlan) return;
    if (!(await tryAcquireLock(selectedPlan.id))) return;
    setEditEvals((selectedPlan.evaluationMethods ?? []).map((e) => ({ id: e.id, name: e.name, percentage: String(e.percentage), description: e.description ?? "" })));
    setOpenEvals(true);
  };
  const onSaveEvals = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPlan) return;
    setSavingEvals(true);
    try {
      const payload = editEvals
        .filter((e) => e.name.trim() && e.percentage.trim())
        .map((e) => ({
          id: e.id,
          name: e.name.trim(),
          percentage: Number(e.percentage),
          description: e.description?.trim() || undefined,
        }));

      if (payload.some((e) => Number.isNaN(e.percentage) || e.percentage <= 0 || e.percentage > 100)) {
        toast.error("Cada evaluación debe tener un porcentaje válido entre 0.1 y 100");
        setSavingEvals(false);
        return;
      }

      const payloadTotal = payload.reduce((acc, e) => acc + e.percentage, 0);
      if (payloadTotal > 100) {
        toast.error("El total de evaluación no puede superar 100%", {
          description: `Total actual: ${payloadTotal.toFixed(1)}%`,
        });
        setSavingEvals(false);
        return;
      }

      await Promise.all(
        payload.map((e) => e.id
          ? apiUpdateEvaluation(selectedPlan.id, e.id, { name: e.name, percentage: e.percentage, description: e.description })
          : apiCreateEvaluation(selectedPlan.id, { name: e.name, percentage: e.percentage, description: e.description })),
      );
      toast.success("Evaluaciones guardadas");
      setOpenEvals(false);
      await apiReleasePlanLock(selectedPlan.id).catch(() => {});
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudieron guardar las evaluaciones", { description: formatApiError(e) });
    } finally { setSavingEvals(false); }
  };

  const onOpenRefs = async () => {
    if (!selectedPlan) return;
    if (!(await tryAcquireLock(selectedPlan.id))) return;
    setEditRefs((selectedPlan.bibliographicReferences ?? []).map((r) => ({ id: r.id, type: r.type ?? "libro", title: r.title, author: r.author ?? "", year: r.year ?? "", publisher: r.publisher ?? "", url: r.url ?? "" })));
    setOpenRefs(true);
  };
  const onSaveRefs = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPlan) return;
    setSavingRefs(true);
    try {
      await Promise.all(
        editRefs
          .filter((r) => r.title.trim())
          .map((r, i) => r.id
        ? apiUpdateReference(selectedPlan.id, r.id, { type: r.type, title: r.title.trim(), author: r.author.trim() || undefined, year: r.year.trim() || undefined, publisher: r.publisher.trim() || undefined, url: normalizeOptionalUrl(r.url), order: i + 1 })
        : apiCreateReference(selectedPlan.id, { type: r.type, title: r.title.trim(), author: r.author.trim() || undefined, year: r.year.trim() || undefined, publisher: r.publisher.trim() || undefined, url: normalizeOptionalUrl(r.url), order: i + 1 })),
      );
      toast.success("Referencias guardadas");
      setOpenRefs(false);
      await apiReleasePlanLock(selectedPlan.id).catch(() => {});
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudieron guardar las referencias", { description: formatApiError(e) });
    } finally { setSavingRefs(false); }
  };

  const onSubmitReview = async () => {
    if (!selectedPlan) return;
    setSendingReview(true);
    try {
      await apiSubmitPlanForReview(selectedPlan.id);
      toast.success("Plan enviado a revisión");
      await reloadPlans(); await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudo enviar a revisión", { description: formatApiError(e) });
    } finally { setSendingReview(false); }
  };

  const onApproveOrBack = async (next: ClassroomPlan["status"]) => {
    if (!selectedPlan) return;
    try {
      await apiUpdatePlanStatus(selectedPlan.id, next);
      toast.success(`Estado actualizado a ${statusLabel(next)}`);
      await reloadPlans(); await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudo cambiar el estado", { description: formatApiError(e) });
    }
  };

  const [deletingPlan, setDeletingPlan] = useState(false);
  const onDeletePlan = async () => {
    if (!selectedPlan) return;
    if (!window.confirm(`¿Eliminar el plan de "${selectedPlan.course?.name}" (${selectedPlan.academic_period})? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingPlan(true);
    try {
      await apiDeletePlan(selectedPlan.id);
      toast.success("Plan eliminado correctamente");
      setSelectedPlan(null);
      await reloadPlans();
    } catch (e) {
      toast.error("No se pudo eliminar el plan", { description: formatApiError(e) });
    } finally {
      setDeletingPlan(false);
    }
  };

  const onDuplicateCourse = async () => {
    const course = selectedPlan?.course;
    if (!course) return;
    const newCode = window.prompt(`Nuevo código para la copia de "${course.name}" (${course.code}):`, "");
    if (!newCode || !newCode.trim()) return;
    setDuplicatingCourseId(course.id);
    try {
      await apiDuplicateCourse(course.id, { code: newCode.trim() });
      toast.success("Curso duplicado correctamente", {
        description: "El plan de aula más reciente se copió como base editable e independiente.",
      });
      const catalogCourses = await apiListCourses({ active_only: true });
      setCourses(catalogCourses);
      await reloadPlans();
    } catch (e) {
      toast.error("No se pudo duplicar el curso", { description: formatApiError(e) });
    } finally {
      setDuplicatingCourseId(null);
    }
  };

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plans.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterFacultyId && p.course?.program?.faculty?.id !== filterFacultyId) return false;
      if (filterProgramId && p.course?.program?.id !== filterProgramId) return false;
      if (!q) return true;
      const haystack = [p.course?.name, p.course?.code, p.course?.program?.name, p.academic_period]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [plans, filterStatus, filterFacultyId, filterProgramId, searchQuery]);
  const faculties = useMemo(() => [...new Map(plans.map((p) => [p.course?.program?.faculty?.id, p.course?.program?.faculty])).values()].filter(Boolean), [plans]);
  const programs = useMemo(() => plans.filter((p) => !filterFacultyId || p.course?.program?.faculty?.id === filterFacultyId).map((p) => p.course?.program).filter((prog, idx, self) => prog && self.findIndex((q) => q?.id === prog.id) === idx), [plans, filterFacultyId]);

  const evalTotal = (rows: EvalRow[]) => rows.reduce((a, e) => a + (Number(e.percentage) || 0), 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterFacultyId, filterProgramId, searchQuery, plans.length]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPlans.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPlans]);

  if (loadingBootstrap) return (
    <div className="py-10 text-center text-gray-500">
      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#1e3a5f]" />
      Cargando módulo de planes de aula...
    </div>
  );

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <Card className="border-[#1e3a5f]/15 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-[#ffc107]" /> Planes de Aula
            </CardTitle>
            <div className="flex items-center gap-2">
              {canReview && !isStudentePuro && (
                <Button onClick={() => { setImportResult(null); setOpenImport(true); }} variant="outline" className="border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107]/10 font-semibold">
                  <UploadCloud className="mr-2 h-4 w-4" /> Carga masiva
                </Button>
              )}
              {(canReview || isDocente) && !isStudentePuro && (
                <Button onClick={() => setOpenCreateCourse(true)} variant="outline" className="border-white bg-white text-[#1e3a5f] hover:bg-gray-100 font-semibold">
                  <Plus className="mr-2 h-4 w-4" /> Crear curso
                </Button>
              )}
              {(canReview || isDocente) && !isStudentePuro && (
                <Button onClick={() => setOpenCreate(true)} className="bg-[#ffc107] text-[#1e3a5f] hover:bg-[#ffb300] font-semibold">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo plan
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="text-blue-100">
            Módulo académico para planeación docente · Rol: {classroomUser?.role_id ?? "—"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ label: "Total", value: plans.length, color: "text-[#1e3a5f]" }, { label: "En planeación", value: plans.filter((p) => p.status === "planeacion").length, color: "text-[#ff9800]" }, { label: "Aprobados", value: plans.filter((p) => p.status === "aprobado").length, color: "text-emerald-600" }].map(({ label, value, color }) => (
          <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">{label}</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${color}`}>{value}</div></CardContent></Card>
        ))}
      </div>

      {/* LISTA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <ClipboardList className="h-5 w-5 text-[#ff9800]" /> Todos los planes de aula
          </CardTitle>
          <CardDescription>Total: {plans.length} planes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por curso, código, programa o periodo académico..."
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Estado</Label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
                <option value="">Todos</option><option value="planeacion">Planeación</option><option value="revision">Revisión</option><option value="aprobado">Aprobado</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Facultad</Label>
              <select value={filterFacultyId} onChange={(e) => { setFilterFacultyId(e.target.value); setFilterProgramId(""); }} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
                <option value="">Todas</option>{faculties.map((f) => <option key={f!.id} value={f!.id}>{f!.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Programa</Label>
              <select value={filterProgramId} onChange={(e) => setFilterProgramId(e.target.value)} disabled={!filterFacultyId} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50">
                <option value="">Todos</option>{programs.map((p) => <option key={p?.id} value={p?.id ?? ""}>{p?.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" className="w-full" onClick={() => { setFilterStatus(""); setFilterFacultyId(""); setFilterProgramId(""); setSearchQuery(""); setSelectedPlanIds(new Set()); }}>Limpiar</Button>
            </div>
          </div>

          {filteredPlans.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button size="sm" variant="outline" onClick={() => apiExportCsv({ faculty_id: filterFacultyId, program_id: filterProgramId, status: filterStatus })} className="flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" /> Descargar CSV
              </Button>
              <Button size="sm" variant="outline" disabled={selectedPlanIds.size === 0 || downloadingBulk}
                onClick={async () => {
                  setDownloadingBulk(true);
                  try {
                    const ids = Array.from(selectedPlanIds);
                    if (ids.length === 1) { await apiExportPlanPdf(ids[0]); toast.success("PDF descargado"); }
                    else { await apiExportBulkPdf(ids); toast.success(`${ids.length} PDFs descargados en ZIP`); }
                    setSelectedPlanIds(new Set());
                  } catch (e) { toast.error("Error al descargar", { description: formatApiError(e) }); }
                  finally { setDownloadingBulk(false); }
                }} className="flex items-center gap-1">
                {downloadingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedPlanIds.size === 1 ? <Download className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {selectedPlanIds.size === 1 ? "Descargar PDF" : `Descargar ZIP (${selectedPlanIds.size})`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPlanIds(selectedPlanIds.size === filteredPlans.length ? new Set() : new Set(filteredPlans.map((p) => p.id)))}>
                {selectedPlanIds.size === filteredPlans.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <span>Página {currentPage} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
              </div>
            </div>
          )}

          {loadingPlans ? (
            <div className="py-8 text-center text-gray-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Cargando planes...</div>
          ) : filteredPlans.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No hay planes con los filtros seleccionados.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="hidden grid-cols-12 gap-2 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
                <span className="col-span-1">Sel</span>
                <span className="col-span-4">Curso</span>
                <span className="col-span-3">Programa</span>
                <span className="col-span-2">Periodo</span>
                <span className="col-span-2">Estado</span>
              </div>
              <div className="divide-y divide-gray-100">
              {paginatedPlans.map((plan) => (
                <div key={plan.id} className={`grid grid-cols-12 items-center gap-2 px-3 py-2 transition hover:bg-orange-50 ${selectedPlan?.id === plan.id ? "bg-orange-50" : "bg-white"}`}>
                  <input type="checkbox" checked={selectedPlanIds.has(plan.id)}
                    onChange={(e) => { const s = new Set(selectedPlanIds); e.target.checked ? s.add(plan.id) : s.delete(plan.id); setSelectedPlanIds(s); }}
                    className="col-span-1 h-4 w-4 rounded border-gray-300 accent-[#ff9800]" />
                  <div role="button" tabIndex={0} onClick={() => loadPlanDetail(plan.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadPlanDetail(plan.id); } }}
                    className="col-span-11 grid cursor-pointer grid-cols-11 items-center gap-2 text-left">
                    <div className="col-span-11 md:col-span-4 min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1e3a5f]">{plan.course?.name ?? "Curso"}</p>
                      <p className="truncate text-xs text-gray-500">{plan.course?.code ?? "—"}</p>
                    </div>
                    <div className="hidden truncate text-sm text-gray-600 md:col-span-3 md:block">{plan.course?.program?.name ?? "—"}</div>
                    <div className="hidden text-sm text-gray-600 md:col-span-2 md:block">{plan.academic_period}</div>
                    <div className="hidden md:col-span-2 md:block"><Badge className={statusClass(plan.status)}>{statusLabel(plan.status)}</Badge></div>
                    <p className="col-span-11 truncate text-xs text-gray-500 md:hidden">{plan.course?.program?.name ?? "—"} · {plan.academic_period} · {statusLabel(plan.status)}</p>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Detalle de plan */}
      <Dialog open={Boolean(selectedPlan)} onOpenChange={(open) => { if (!open) setSelectedPlan(null); }}>
        <DialogContent className="max-h-[90vh] !w-[96vw] !max-w-[1200px] overflow-y-auto rounded-lg p-4 md:p-6">
          {selectedPlan && (
            <div className="space-y-3">
          <Card className="border-[#1e3a5f]/20">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-base">
                <span className="text-[#1e3a5f]">{selectedPlan.course?.name}<span className="ml-2 text-xs font-normal text-gray-500">{selectedPlan.academic_period}</span></span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => apiExportPlanPdf(selectedPlan.id)}><Download className="mr-1 h-4 w-4" /> PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => apiExportPlanExcel(selectedPlan.id)}><FileSpreadsheet className="mr-1 h-4 w-4" /> Excel</Button>
                  {(canReview || isDocente) && (
                    <Button size="sm" variant="outline" disabled={duplicatingCourseId === selectedPlan.course?.id} onClick={onDuplicateCourse}>
                      {duplicatingCourseId === selectedPlan.course?.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Copy className="mr-1 h-4 w-4" />} Duplicar curso
                    </Button>
                  )}
                  {selectedPlan.status === "planeacion" && (canReview || isDocente) && (
                    <Button size="sm" variant="outline" onClick={onOpenEditGeneral}><Pencil className="mr-1 h-4 w-4" /> Editar</Button>
                  )}
                  {selectedPlan.status === "planeacion" && isDocente && (
                    <Button size="sm" onClick={onSubmitReview} disabled={sendingReview} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                      {sendingReview ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enviar a revisión
                    </Button>
                  )}
                  {canReview && selectedPlan.status === "revision" && (
                    <>
                      <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onApproveOrBack("aprobado")}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onApproveOrBack("planeacion")}>Rechazar (Volver a planeación)</Button>
                    </>
                  )}
                  {selectedPlan.status === "planeacion" && (canReview || (isDocente && selectedPlan.author_id === classroomUser?.id)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deletingPlan}
                      onClick={onDeletePlan}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {deletingPlan ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Eliminar
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              <div className="grid gap-1.5 text-xs md:grid-cols-2">
                <div><span className="font-medium text-gray-600">Programa:</span> {selectedPlan.course?.program?.name ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Curso:</span> {selectedPlan.course?.name ?? "—"} ({selectedPlan.course?.code ?? "—"})</div>
                <div><span className="font-medium text-gray-600">Campo:</span> {DISCIPLINARY_FIELD_OPTIONS.find((o) => o.value === selectedPlan.disciplinary_field)?.label ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Componente:</span> {COMPONENT_OPTIONS.find((o) => o.value === selectedPlan.course?.component)?.label ?? selectedPlan.course?.component ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Tipo de curso:</span> {MODALITY_OPTIONS.find((o) => o.value === selectedPlan.modality)?.label ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Tipo de clase:</span> {CLASS_TYPE_OPTIONS.find((o) => o.value === selectedPlan.class_type)?.label ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Semestre:</span> {selectedPlan.semester_roman ?? selectedPlan.semester ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Créditos:</span> {selectedPlan.credits ?? "—"}</div>
                <div><span className="font-medium text-gray-600">Estado:</span> <Badge className={`${statusClass(selectedPlan.status)} text-xs`}>{statusLabel(selectedPlan.status)}</Badge></div>
              </div>
              <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs"><p className="mb-0.5 font-medium text-gray-700">Competencia</p><p className="text-gray-600">{selectedPlan.competency || "Sin competencia registrada."}</p></div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-1.5 pt-3 px-3">
                <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-semibold leading-tight text-[#1e3a5f]">Propósito</CardTitle>
                  {selectedPlan.status === "planeacion" && (canReview || isDocente) && <Button size="sm" variant="outline" onClick={onOpenObjectives} className="shrink-0 whitespace-nowrap"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                {(selectedPlan.generalObjectives ?? []).length === 0 ? <p className="text-xs text-gray-400 italic">Sin objetivos registrados.</p> :
                  (selectedPlan.generalObjectives ?? []).map((o, i) => (
                    <div key={o.id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs">
                      <p><span className="font-semibold text-[#1e3a5f]">{i + 1}. </span>{o.description}</p>
                      {(o.specificObjectives ?? []).length > 0 && (
                        <div className="mt-1.5 space-y-1 border-l-2 border-[#ffc107] pl-2 text-gray-600">
                          {(o.specificObjectives ?? []).map((specific, specificIndex) => (
                            <p key={specific.id}><span className="font-medium">{i + 1}.{specificIndex + 1}.</span> {specific.description}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1.5 pt-3 px-3">
                <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-semibold leading-tight text-[#1e3a5f]">Evaluación</CardTitle>
                  {selectedPlan.status === "planeacion" && (canReview || isDocente) && <Button size="sm" variant="outline" onClick={onOpenEvals} className="shrink-0 whitespace-nowrap"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                {(selectedPlan.evaluationMethods ?? []).length === 0 ? <p className="text-xs text-gray-400 italic">Sin métodos de evaluación.</p> : (<>
                  {(selectedPlan.evaluationMethods ?? []).map((e) => (
                    <div key={e.id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs">
                      <div className="flex justify-between"><span>{e.name}</span><span className="font-semibold text-[#1e3a5f]">{e.percentage}%</span></div>
                      {e.description && <p className="mt-0.5 text-gray-500">{e.description}</p>}
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 text-xs font-bold">
                    <span>Total</span>
                    <span className={(selectedPlan.evaluationMethods ?? []).reduce((a, e) => a + e.percentage, 0) > 100 ? "text-red-600" : (selectedPlan.evaluationMethods ?? []).reduce((a, e) => a + e.percentage, 0) === 100 ? "text-emerald-600" : "text-orange-500"}>
                      {(selectedPlan.evaluationMethods ?? []).reduce((a, e) => a + e.percentage, 0).toFixed(1)}%
                    </span>
                  </div>
                </>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1.5 pt-3 px-3">
                <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-semibold leading-tight text-[#1e3a5f]">Referencias</CardTitle>
                  {selectedPlan.status === "planeacion" && (canReview || isDocente) && <Button size="sm" variant="outline" onClick={onOpenRefs} className="shrink-0 whitespace-nowrap"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                {(selectedPlan.bibliographicReferences ?? []).length === 0 ? <p className="text-xs text-gray-400 italic">Sin referencias registradas.</p> :
                  (selectedPlan.bibliographicReferences ?? []).map((r, i) => (
                    <div key={r.id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs" style={{ paddingLeft: "1.25rem", textIndent: "-1rem" }}>
                      {i + 1}. {r.apa_citation ?? formatApaCitation({ title: r.title, author: r.author ?? "", year: r.year ?? "", publisher: r.publisher ?? "", url: r.url ?? "" })}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="px-3 pb-1.5 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1e3a5f]">
                <History className="h-4 w-4" /> Bitácora de edición
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-3 pb-3">
              {(selectedPlan.activities ?? []).filter((activity) => activity.activity_type === "EDITED").length === 0 ? (
                <p className="text-xs italic text-gray-400">Aún no hay ediciones registradas.</p>
              ) : (
                (selectedPlan.activities ?? [])
                  .filter((activity) => activity.activity_type === "EDITED")
                  .slice(0, 10)
                  .map((activity) => (
                    <div key={activity.id} className="flex flex-col gap-0.5 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <strong className="text-gray-700">{activity.user?.name ?? "Usuario"}</strong>
                        {activity.notes ? ` · ${activity.notes}` : " · Plan actualizado."}
                      </span>
                      <span className="shrink-0 text-gray-500">
                        {new Date(activity.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Crear plan */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[90vh] w-[97vw] max-w-[1120px] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><Plus className="h-5 w-5 text-[#ff9800]" /> Crear nuevo plan de aula</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreatePlan} className="space-y-5 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Programa</Label>
                <Input readOnly disabled value={newPlanCourse?.program?.name ?? "Campo Común"} className="mt-1 bg-gray-50" />
              </div>
              <div>
                <Label>Curso <span className="text-red-500">*</span></Label>
                <CourseSearch
                  courses={courses}
                  value={newPlan.course_id}
                  query={courseQuery}
                  onQueryChange={setCourseQuery}
                  onChange={(id) => setNewPlan((s) => ({ ...s, course_id: id }))}
                />
              </div>
              <div>
                <Label>Campo</Label>
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  value={newPlan.disciplinary_field}
                  onChange={(e) => setNewPlan((s) => ({ ...s, disciplinary_field: e.target.value as typeof s.disciplinary_field }))}>
                  <option value="">Selecciona…</option>
                  {DISCIPLINARY_FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Componente</Label>
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  value={newPlan.component}
                  onChange={(e) => setNewPlan((s) => ({ ...s, component: e.target.value }))}>
                  <option value="">Selecciona…</option>
                  {newPlan.component && !newPlanComponentOptions.some((o) => o.componente === newPlan.component) && (
                    <option value={newPlan.component}>{COMPONENT_OPTIONS.find((o) => o.value === newPlan.component)?.label ?? newPlan.component}</option>
                  )}
                  {(Object.keys(COMPONENT_CAMPO_LABELS) as Array<keyof typeof COMPONENT_CAMPO_LABELS>).map((campo) => {
                    const opts = newPlanComponentOptions.filter((o) => o.campo === campo);
                    if (opts.length === 0) return null;
                    return (
                      <optgroup key={campo} label={COMPONENT_CAMPO_LABELS[campo]}>
                        {opts.map((o) => <option key={o.componente} value={o.componente}>{o.componente}</option>)}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <Label>Tipo de curso</Label>
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  value={newPlan.modality}
                  onChange={(e) => setNewPlan((s) => ({ ...s, modality: e.target.value as typeof s.modality }))}>
                  <option value="">Selecciona…</option>
                  {MODALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Tipo de clase</Label>
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  value={newPlan.class_type}
                  onChange={(e) => setNewPlan((s) => ({ ...s, class_type: e.target.value as "" | ClassType }))}>
                  <option value="">Selecciona…</option>
                  {CLASS_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Semestre</Label>
                <select value={newPlan.semester} onChange={(e) => setNewPlan((s) => ({ ...s, semester: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
                  <option value="">Selecciona…</option>
                  {SEMESTER_ROMAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Label>Créditos</Label>
                <Input type="number" min={0} max={20} placeholder="Ej: 3" value={newPlan.credits} onChange={(e) => setNewPlan((s) => ({ ...s, credits: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Competencia <span className="text-red-500">*</span></Label>
                <Textarea rows={2} placeholder="Competencia que desarrolla el curso..." value={newPlan.competency} onChange={(e) => setNewPlan((s) => ({ ...s, competency: e.target.value }))} />
              </div>
            </div>


            <ModalSection title="Propósito" onAdd={() => setCreateObjs((s) => [...s, EMPTY_OBJ()])} addLabel="Agregar propósito" empty={createObjs.length === 0}>
              {createObjs.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-bold text-gray-400">{i + 1}.</span>
                  <Input value={o.description} placeholder={`Propósito ${i + 1}`} onChange={(e) => setCreateObjs((s) => s.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <button type="button" onClick={() => setCreateObjs((s) => s.filter((_, j) => j !== i))} className="shrink-0 text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </ModalSection>

            <ModalSection title="Instrumentos de evaluación" onAdd={() => setCreateEvals((s) => [...s, EMPTY_EVAL()])} addLabel="Agregar instrumento" empty={createEvals.length === 0}
              extra={createEvals.length > 0 && <span className={`text-xs font-semibold ${evalTotal(createEvals) > 100 ? "text-red-600" : evalTotal(createEvals).toFixed(1) === "100.0" ? "text-emerald-600" : "text-orange-500"}`}>Total: {evalTotal(createEvals).toFixed(1)}%</span>}>
              {createEvals.length > 0 && <div className="grid grid-cols-12 gap-1 px-1 text-xs font-semibold text-gray-500"><span className="col-span-5">Instrumento</span><span className="col-span-2">%</span><span className="col-span-4">Descripción</span><span className="col-span-1" /></div>}
              {createEvals.map((e, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select className="col-span-5 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm" value={e.name} onChange={(ev) => setCreateEvals((s) => s.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))}>
                    <option value="">Selecciona un instrumento…</option>
                    {evaluationInstrumentOptions(newPlan.class_type, e.name).map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}
                  </select>
                  <Input className="col-span-2" type="number" min={0.1} max={100} step={0.1} placeholder="%" value={e.percentage} onChange={(ev) => setCreateEvals((s) => s.map((x, j) => j === i ? { ...x, percentage: ev.target.value } : x))} />
                  <Input className="col-span-4" placeholder="Descripción" value={e.description} onChange={(ev) => setCreateEvals((s) => s.map((x, j) => j === i ? { ...x, description: ev.target.value } : x))} />
                  <button type="button" className="col-span-1 text-gray-400 hover:text-red-500" onClick={() => setCreateEvals((s) => s.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>
              ))}
            </ModalSection>

            <ModalSection title="Referencias bibliográficas (Normas APA)" onAdd={() => setCreateRefs((s) => [...s, EMPTY_REF()])} addLabel="Agregar referencia" empty={createRefs.length === 0}>
              {createRefs.map((r, i) => (
                <div key={i} className="space-y-1 rounded-md border border-gray-100 p-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select className="col-span-3 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm" value={r.type} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}>
                      {REFERENCE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input className="col-span-6" placeholder="Autor (Apellido, N.) — opcional en sitios web" value={r.author} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, author: e.target.value } : x))} />
                    <Input className="col-span-2" placeholder="Año" value={r.year} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, year: e.target.value } : x))} />
                    <button type="button" className="col-span-1 text-gray-400 hover:text-red-500" onClick={() => setCreateRefs((s) => s.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-5" placeholder="Título" value={r.title} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                    <Input className="col-span-4" placeholder={r.type === "sitio_web" ? "Nombre del sitio / organización" : "Editorial"} value={r.publisher} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, publisher: e.target.value } : x))} />
                    <Input className="col-span-3" placeholder="URL" value={r.url} onChange={(e) => setCreateRefs((s) => s.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                  </div>
                  {(r.title.trim() || r.author.trim()) && (
                    <p className="pl-1 text-xs italic text-gray-500">Vista previa APA: {formatApaCitation(r)}</p>
                  )}
                </div>
              ))}
            </ModalSection>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating || evalTotal(createEvals) > 100} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar plan completo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Carga masiva desde Excel */}
      <Dialog open={openImport} onOpenChange={(o) => { if (!o) { setImportFile(null); setImportResult(null); } setOpenImport(o); }}>
        <DialogContent className="max-h-[88vh] w-[95vw] max-w-[560px] overflow-y-auto rounded-lg p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <UploadCloud className="h-5 w-5 text-[#ff9800]" /> Carga masiva desde Excel
            </DialogTitle>
            <DialogDescription>
              Selecciona el archivo micro-curricular y el periodo académico que se importará.
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-gray-500">
                Sube el archivo Excel de actualización micro-curricular. Se importarán automáticamente
                facultad, programa, cursos y planes de aula de cada hoja <strong>CURSO</strong>.
              </p>

              <div className="space-y-1">
                <Label>Archivo Excel <span className="text-red-500">*</span></Label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="block w-full rounded-md border border-gray-300 text-sm file:mr-3 file:rounded-l-md file:border-0 file:bg-[#1e3a5f] file:px-3 file:py-2 file:text-xs file:text-white file:font-medium hover:file:bg-[#2a4a6f]"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                {importFile && <p className="text-xs text-emerald-600">✓ {importFile.name}</p>}
              </div>

              <div className="space-y-1">
                <Label>Periodo académico <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Ej: 2025-1"
                  value={importPeriod}
                  onChange={(e) => setImportPeriod(e.target.value)}
                />
              </div>

              {/* Barra de progreso animada durante la importación */}
              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-[#ff9800]" />
                      Procesando hojas CURSO…
                    </span>
                    <span className="text-[#ff9800] font-medium">Por favor espera</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #ff9800 0%, #ffc107 40%, #ff9800 60%, #ffc107 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'progress-indeterminate 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <p className="text-center text-xs text-gray-400">
                    Leyendo facultad, programa, cursos, objetivos, evaluaciones y referencias…
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenImport(false)} disabled={importing}>Cancelar</Button>
                <Button
                  disabled={!importFile || !importPeriod.trim() || importing}
                  className="bg-[#ff9800] text-white hover:bg-[#f57c00]"
                  onClick={async () => {
                    if (!importFile || !importPeriod.trim()) return;
                    setImporting(true);
                    try {
                      const result = await apiBulkImportExcel(importFile, importPeriod.trim());
                      setImportResult(result);
                      reloadPlans();
                    } catch (e) {
                      toast.error("Error en la importación", { description: formatApiError(e) });
                    } finally {
                      setImporting(false);
                    }
                  }}
                >
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  {importing ? "Importando…" : "Iniciar importación"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Resultados */}
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                  <p className="text-xs text-emerald-700">Planes creados</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                  <p className="text-xs text-amber-700">Omitidos</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                  <p className="text-xs text-red-700">Errores</p>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <p className="text-2xl font-bold text-orange-600">{importResult.warnings ?? 0}</p>
                  <p className="text-xs text-orange-700">Con datos faltantes</p>
                </div>
              </div>

              {importResult.detail.created.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-emerald-700">Creados:</p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                    {importResult.detail.created.map((r, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        <span className="block truncate">✓ {r.course}</span>
                        {!!r.missing_fields?.length && (
                          <span className="block text-orange-600">
                            Sin datos en Excel: {r.missing_fields.join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.detail.errors.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-red-700">Errores:</p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                    {importResult.detail.errors.map((r, i) => (
                      <li key={i} className="text-xs text-red-600">[{r.sheet}] {r.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportFile(null); setImportResult(null); }}>
                  Importar otro archivo
                </Button>
                <Button className="bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]" onClick={() => { setOpenImport(false); setImportFile(null); setImportResult(null); }}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar datos generales */}
      <Dialog open={openEditGeneral} onOpenChange={(open) => { setOpenEditGeneral(open); if (!open && selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><Pencil className="h-4 w-4 text-[#ff9800]" /> Editar datos generales</DialogTitle></DialogHeader>
          <form onSubmit={onSaveGeneral} className="space-y-4 pt-2">
            <div>
              <Label>Programa</Label>
              <Input readOnly disabled value={selectedPlan?.course?.program?.name ?? "Campo Común"} className="mt-1 bg-gray-50" />
            </div>
            <div>
              <Label>Curso</Label>
              <Input readOnly disabled value={selectedPlan?.course ? `${selectedPlan.course.name} (${selectedPlan.course.code})` : ""} className="mt-1 bg-gray-50" />
            </div>
            <div>
              <Label>Campo</Label>
              <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                value={editGeneral.disciplinary_field}
                onChange={(e) => setEditGeneral((s) => ({ ...s, disciplinary_field: e.target.value as typeof s.disciplinary_field }))}>
                <option value="">Selecciona…</option>
                {DISCIPLINARY_FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Componente</Label>
              <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                value={editGeneral.component}
                onChange={(e) => setEditGeneral((s) => ({ ...s, component: e.target.value }))}>
                <option value="">Selecciona…</option>
                {editGeneral.component && !editGeneralComponentOptions.some((o) => o.componente === editGeneral.component) && (
                  <option value={editGeneral.component}>{COMPONENT_OPTIONS.find((o) => o.value === editGeneral.component)?.label ?? editGeneral.component}</option>
                )}
                {(Object.keys(COMPONENT_CAMPO_LABELS) as Array<keyof typeof COMPONENT_CAMPO_LABELS>).map((campo) => {
                  const opts = editGeneralComponentOptions.filter((o) => o.campo === campo);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={campo} label={COMPONENT_CAMPO_LABELS[campo]}>
                      {opts.map((o) => <option key={o.componente} value={o.componente}>{o.componente}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <Label>Tipo de curso</Label>
              <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                value={editGeneral.modality}
                onChange={(e) => setEditGeneral((s) => ({ ...s, modality: e.target.value as typeof s.modality }))}>
                <option value="">Selecciona…</option>
                {MODALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Tipo de clase</Label>
              <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                value={editGeneral.class_type}
                onChange={(e) => setEditGeneral((s) => ({ ...s, class_type: e.target.value as "" | ClassType }))}>
                <option value="">Selecciona…</option>
                {CLASS_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Semestre</Label>
              <select value={editGeneral.semester} onChange={(e) => setEditGeneral((s) => ({ ...s, semester: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
                <option value="">Selecciona…</option>
                {SEMESTER_ROMAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><Label>Créditos</Label><Input type="number" min={0} max={20} value={editGeneral.credits} onChange={(e) => setEditGeneral((s) => ({ ...s, credits: e.target.value }))} /></div>
            <div><Label>Competencia <span className="text-red-500">*</span></Label><Textarea rows={2} value={editGeneral.competency} onChange={(e) => setEditGeneral((s) => ({ ...s, competency: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenEditGeneral(false); if (selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>Cancelar</Button>
              <Button type="submit" disabled={savingGeneral} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                {savingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar objetivos */}
      <Dialog open={openObjectives} onOpenChange={(open) => { setOpenObjectives(open); if (!open && selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>
        <DialogContent className="max-h-[92vh] !w-[96vw] !max-w-[1200px] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><Pencil className="h-4 w-4 text-[#ff9800]" /> Propósito y contenido</DialogTitle>
            <DialogDescription>Organiza el contenido específico dentro del propósito al que pertenece.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveObjectives} className="space-y-4 pt-2">
            {editObjs.map((o, i) => {
              return (
                <div key={o.id ?? `new-${i}`} className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-sm font-bold text-[#1e3a5f]">{i + 1}.</span>
                    <Textarea rows={2} value={o.description} placeholder={`Propósito ${i + 1}`}
                      onChange={(e) => setEditObjs((s) => s.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("¿Eliminar este propósito y su contenido?")) return;
                        // Se quita del estado local primero para que Guardar nunca intente
                        // actualizar un objetivo que ya se está eliminando (evita el 404 por carrera).
                        setEditObjs((s) => s.filter((_, j) => j !== i));
                        if (o.id && selectedPlan) {
                          try {
                            await apiDeleteGeneralObjective(selectedPlan.id, o.id);
                          } catch (e) {
                            toast.error("No se pudo eliminar el objetivo", { description: formatApiError(e) });
                          }
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    ><Trash2 className="h-3 w-3" /> Eliminar</button>
                  </div>

                  <div className="ml-0 space-y-2 border-l-2 border-[#ffc107] pl-3 sm:ml-8 sm:pl-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold text-gray-600">Contenido específico</Label>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                        ? { ...item, specificObjectives: [...item.specificObjectives, { description: "", topics: [] }] }
                        : item))}>
                        <Plus className="mr-1 h-3 w-3" /> Agregar contenido
                      </Button>
                    </div>
                    {o.specificObjectives.length === 0 && <p className="text-xs italic text-gray-400">Sin contenido específico.</p>}
                    {o.specificObjectives.map((specific, specificIndex) => (
                      <div key={specific.id ?? `new-specific-${specificIndex}`} className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-2 w-9 shrink-0 text-xs font-semibold text-gray-500">{i + 1}.{specificIndex + 1}.</span>
                          <Textarea rows={2} value={specific.description} placeholder={`Contenido ${specificIndex + 1}`}
                            onChange={(event) => setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                              ? { ...item, specificObjectives: item.specificObjectives.map((current, currentIndex) => currentIndex === specificIndex ? { ...current, description: event.target.value } : current) }
                              : item))} />
                          <button type="button" aria-label="Eliminar contenido"
                            onClick={async () => {
                              // Se quita del estado local primero para que Guardar nunca intente
                              // actualizar un contenido que ya se está eliminando (evita el 404 por carrera).
                              setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                                ? { ...item, specificObjectives: item.specificObjectives.filter((_, currentIndex) => currentIndex !== specificIndex) }
                                : item));
                              if (specific.id && o.id && selectedPlan) {
                                try {
                                  await apiDeleteSpecificObjective(selectedPlan.id, o.id, specific.id);
                                } catch (error) {
                                  toast.error("No se pudo eliminar el contenido", { description: formatApiError(error) });
                                }
                              }
                            }}
                            className="mt-1 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="ml-11 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold text-gray-500">Temas</Label>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                              ? { ...item, specificObjectives: item.specificObjectives.map((current, currentIndex) => currentIndex === specificIndex
                                  ? { ...current, topics: [...current.topics, { title: "" }] }
                                  : current) }
                              : item))}>
                              <Plus className="mr-1 h-3 w-3" /> Agregar tema
                            </Button>
                          </div>
                          {specific.topics.length === 0 && <p className="text-xs italic text-gray-400">Sin temas asociados.</p>}
                          {specific.topics.map((topic, topicIndex) => (
                            <div key={topic.id ?? `new-topic-${topicIndex}`} className="flex items-start gap-2">
                              <span className="mt-2 w-5 shrink-0 text-xs text-gray-400">{topicIndex + 1}.</span>
                              <Textarea rows={2} value={topic.title} placeholder={`Tema ${topicIndex + 1}`}
                                onChange={(event) => setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                                  ? { ...item, specificObjectives: item.specificObjectives.map((current, currentIndex) => currentIndex === specificIndex
                                      ? { ...current, topics: current.topics.map((currentTopic, currentTopicIndex) => currentTopicIndex === topicIndex ? { ...currentTopic, title: event.target.value } : currentTopic) }
                                      : current) }
                                  : item))} />
                              <button type="button" aria-label="Eliminar tema"
                                onClick={async () => {
                                  // Se quita del estado local primero para que Guardar nunca intente
                                  // actualizar un tema que ya se está eliminando (evita el 404 por carrera).
                                  setEditObjs((state) => state.map((item, itemIndex) => itemIndex === i
                                    ? { ...item, specificObjectives: item.specificObjectives.map((current, currentIndex) => currentIndex === specificIndex
                                        ? { ...current, topics: current.topics.filter((_, currentTopicIndex) => currentTopicIndex !== topicIndex) }
                                        : current) }
                                    : item));
                                  if (topic.id && specific.id && o.id && selectedPlan) {
                                    try {
                                      await apiDeleteTopic(selectedPlan.id, o.id, specific.id, topic.id);
                                    } catch (error) {
                                      toast.error("No se pudo eliminar el tema", { description: formatApiError(error) });
                                    }
                                  }
                                }}
                                className="mt-1 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Button type="button" size="sm" variant="outline" onClick={() => setEditObjs((s) => [...s, EMPTY_OBJ()])}>
              <Plus className="h-3 w-3 mr-1" /> Agregar propósito
            </Button>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenObjectives(false); if (selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>Cancelar</Button>
              <Button type="submit" disabled={savingObjectives} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                {savingObjectives ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar evaluaciones */}
      <Dialog open={openEvals} onOpenChange={(open) => { setOpenEvals(open); if (!open && selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>
        <DialogContent className="max-h-[92vh] !w-[99vw] !max-w-[99vw] overflow-y-auto px-3 sm:px-5">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><Pencil className="h-4 w-4 text-[#ff9800]" /> Instrumentos de evaluación</DialogTitle></DialogHeader>
          <form onSubmit={onSaveEvals} className="space-y-3 pt-2">
            {editEvals.length > 0 && (
              <div className="hidden md:grid md:grid-cols-12 gap-2 px-1 text-xs font-semibold text-gray-500">
                <span className="md:col-span-4">Instrumento</span>
                <span className="md:col-span-2">%</span>
                <span className="md:col-span-4">Descripción</span>
                <span className="md:col-span-2 text-right">Acción</span>
              </div>
            )}
            {editEvals.map((e, i) => {
              return (
                <div key={i} className="grid grid-cols-1 items-center gap-2 rounded-md border border-gray-100 p-2 md:grid-cols-12 md:border-0 md:p-0">
                  <select className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm md:col-span-4" value={e.name} onChange={(ev) => setEditEvals((s) => s.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))}>
                    <option value="">Selecciona un instrumento…</option>
                    {evaluationInstrumentOptions(selectedPlan?.class_type ?? "", e.name).map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}
                  </select>
                  <Input className="md:col-span-2" type="number" min={0.1} max={100} step={0.1} placeholder="%" value={e.percentage} onChange={(ev) => setEditEvals((s) => s.map((x, j) => j === i ? { ...x, percentage: ev.target.value } : x))} />
                  <Input className="md:col-span-4" placeholder="Descripción" value={e.description} onChange={(ev) => setEditEvals((s) => s.map((x, j) => j === i ? { ...x, description: ev.target.value } : x))} />
                  <button
                    type="button"
                    className="md:col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (!window.confirm("¿Eliminar esta evaluación?")) return;
                      // Se quita del estado local primero para que Guardar nunca intente
                      // actualizar una evaluación que ya se está eliminando (evita el 404 por carrera).
                      setEditEvals((s) => s.filter((_, j) => j !== i));
                      if (e.id && selectedPlan) {
                        try {
                          await apiDeleteEvaluation(selectedPlan.id, e.id);
                        } catch (err) {
                          toast.error("No se pudo eliminar la evaluación", { description: formatApiError(err) });
                        }
                      }
                    }}
                  ><Trash2 className="h-3 w-3" /> Eliminar</button>
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditEvals((s) => [...s, EMPTY_EVAL()])}>
                <Plus className="h-3 w-3 mr-1" /> Agregar instrumento
              </Button>
              {editEvals.length > 0 && <span className={`text-xs font-semibold ${evalTotal(editEvals) > 100 ? "text-red-600" : evalTotal(editEvals).toFixed(1) === "100.0" ? "text-emerald-600" : "text-orange-500"}`}>Total: {evalTotal(editEvals).toFixed(1)}%</span>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenEvals(false); if (selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>Cancelar</Button>
              <Button type="submit" disabled={savingEvals || evalTotal(editEvals) > 100} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                {savingEvals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar referencias */}
      <Dialog open={openRefs} onOpenChange={(open) => { setOpenRefs(open); if (!open && selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>
        <DialogContent className="max-h-[92vh] !w-[96vw] !max-w-[1200px] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><Pencil className="h-4 w-4 text-[#ff9800]" /> Referencias bibliográficas (Normas APA)</DialogTitle></DialogHeader>
          <form onSubmit={onSaveRefs} className="space-y-3 pt-2">
            {editRefs.map((r, i) => {
              return (
                <div key={r.id ?? i} className="space-y-1 rounded-md border border-gray-100 p-3 md:p-2">
                  <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
                    <select className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm md:col-span-3" value={r.type} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}>
                      {REFERENCE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input className="md:col-span-6" placeholder="Autor (Apellido, N.) — opcional en sitios web" value={r.author} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, author: e.target.value } : x))} />
                    <Input className="md:col-span-2" placeholder="Año" value={r.year} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, year: e.target.value } : x))} />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 md:col-span-1"
                      onClick={async () => {
                        if (!window.confirm("¿Eliminar esta referencia?")) return;
                        // Se quita del estado local primero para que Guardar nunca intente
                        // actualizar una referencia que ya se está eliminando (evita el 404 por carrera).
                        setEditRefs((s) => s.filter((_, j) => j !== i));
                        if (r.id && selectedPlan) {
                          try {
                            await apiDeleteReference(selectedPlan.id, r.id);
                          } catch (err) {
                            toast.error("No se pudo eliminar la referencia", { description: formatApiError(err) });
                          }
                        }
                      }}
                    ><Trash2 className="h-3 w-3" /> Eliminar</button>
                  </div>
                  <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
                    <Input className="md:col-span-5" placeholder="Título" value={r.title} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                    <Input className="md:col-span-4" placeholder={r.type === "sitio_web" ? "Nombre del sitio / organización" : "Editorial"} value={r.publisher} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, publisher: e.target.value } : x))} />
                    <Input className="md:col-span-3" placeholder="URL" value={r.url} onChange={(e) => setEditRefs((s) => s.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                  </div>
                  {(r.title.trim() || r.author.trim()) && (
                    <p className="pl-1 text-xs italic text-gray-500">Vista previa APA: {formatApaCitation(r)}</p>
                  )}
                </div>
              );
            })}
            <Button type="button" size="sm" variant="outline" onClick={() => setEditRefs((s) => [...s, EMPTY_REF()])}>
              <Plus className="h-3 w-3 mr-1" /> Agregar referencia
            </Button>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenRefs(false); if (selectedPlan) apiReleasePlanLock(selectedPlan.id).catch(() => {}); }}>Cancelar</Button>
              <Button type="submit" disabled={savingRefs} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                {savingRefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateCourseDialog
        open={openCreateCourse}
        onOpenChange={setOpenCreateCourse}
        onCreated={(course) => {
          setCourses((prev) => [...prev, course]);
          setNewPlan((s) => ({ ...s, course_id: course.id }));
          setCourseQuery(`${course.code} – ${course.name}${course.program?.name ? ` · ${course.program.name}` : " · Campo común"}`);
          setOpenCreate(true);
        }}
      />

    </div>
  );
}

function ModalSection({ title, onAdd, addLabel, empty, extra, children }: {
  title: string; onAdd: () => void; addLabel: string; empty: boolean; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[#1e3a5f] text-sm">{title}</h4>
        <div className="flex items-center gap-3">
          {extra}
          <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="h-3 w-3 mr-1" /> {addLabel}</Button>
        </div>
      </div>
      {empty && <p className="text-xs text-gray-400 italic">Haz clic en "{addLabel}" para agregar.</p>}
      {children}
    </div>
  );
}

function CourseSearch({
  courses,
  value,
  query,
  onQueryChange,
  onChange,
}: {
  courses: import("../../lib/classroomApi").ClassroomCourse[];
  value: string;
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = courses.find((c) => c.id === value);
  const courseLabel = (course: import("../../lib/classroomApi").ClassroomCourse) =>
    `${course.code} – ${course.name}${course.program?.name ? ` · ${course.program.name}` : " · Campo común"}`;

  const resolveCourseId = useCallback(
    (rawQuery: string) => {
      const normalized = rawQuery.trim().toLowerCase();
      if (!normalized) return null;

      const exactCodeMatch = courses.find((c) => c.code.toLowerCase() === normalized);

      if (exactCodeMatch) return exactCodeMatch.id;

      const exactNameMatches = courses.filter((c) => c.name.toLowerCase() === normalized);

      if (exactNameMatches.length === 1) return exactNameMatches[0].id;

      const matches = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(normalized) ||
          c.name.toLowerCase().includes(normalized),
      );

      return matches.length === 1 ? matches[0].id : null;
    },
    [courses],
  );

  const commitQuery = useCallback(() => {
    const resolved = resolveCourseId(query);
    if (resolved) {
      onChange(resolved);
      const picked = courses.find((c) => c.id === resolved);
      onQueryChange(picked ? courseLabel(picked) : query);
    }
    setOpen(false);
  }, [courses, onChange, onQueryChange, query, resolveCourseId, value]);

  const filtered = useMemo(
    () =>
      query.trim() === ""
        ? courses
        : courses.filter(
            (c) =>
              c.name.toLowerCase().includes(query.toLowerCase()) ||
              c.code.toLowerCase().includes(query.toLowerCase()) ||
              c.program?.name.toLowerCase().includes(query.toLowerCase()),
          ),
    [courses, query],
  );

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        commitQuery();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [commitQuery, open]);

  return (
    <div className="relative mt-1" ref={(el) => { ref.current = el; }}>
      {/* Input visible */}
      <input
        type="text"
        autoComplete="off"
        placeholder="Escribe el código o nombre del curso…"
        value={query || (selected ? courseLabel(selected) : "")}
        onFocus={() => { if (!query && selected) onQueryChange(courseLabel(selected)); setOpen(true); }}
        onBlur={() => { commitQuery(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitQuery();
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          onQueryChange(next);
          setOpen(true);

          const resolved = resolveCourseId(next);
          if (resolved) {
            onChange(resolved);
          }
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9800]"
      />
      {query.trim() !== "" && !selected && !resolveCourseId(query) && (
        <p className="mt-1 text-xs text-orange-600">
          Selecciona uno de los cursos habilitados en la lista.
        </p>
      )}
      {/* Campo oculto para validación required */}
      <input type="text" required readOnly value={value} className="sr-only" aria-hidden />

      {/* Lista desplegable */}
      {open && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.id);
                  setOpen(false);
                  onQueryChange(courseLabel(c));
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${value === c.id ? "bg-orange-100 font-semibold text-[#1e3a5f]" : "text-gray-700"}`}
              >
                <span className="font-mono text-xs text-gray-400 mr-2">{c.code}</span>
                <span>{c.name}</span>
                <span className="ml-2 text-xs text-gray-500">· {c.program?.name ?? "Campo común"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
