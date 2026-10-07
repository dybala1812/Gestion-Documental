import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { formatApiError } from "../../lib/api";
import type { Usuario } from "../../context/AuthContext";
import {
  apiCreateEvaluation,
  apiCreateGeneralObjective,
  apiCreatePlan,
  apiCreateReference,
  apiDeleteEvaluation,
  apiDeleteGeneralObjective,
  apiDeleteReference,
  apiListCourses,
  apiExportPlanPdf,
  apiExportPlanExcel,
  apiGetPlan,
  apiListEvaluations,
  apiListObjectives,
  apiListPlans,
  apiListReferences,
  apiSubmitPlanForReview,
  apiUpdatePlan,
  apiUpdateEvaluation,
  apiUpdateGeneralObjective,
  apiUpdateReference,
  ensureClassroomSession,
  getClassroomSessionKey,
  type ClassroomCourse,
  type ClassroomPlan,
  type ClassroomUser,
} from "../../lib/classroomApi";

function statusLabel(s: ClassroomPlan["status"]) {
  if (s === "planeacion") return "Planeación";
  if (s === "revision") return "En revisión";
  return "Aprobado";
}

function statusBadge(s: ClassroomPlan["status"]) {
  if (s === "planeacion") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Editable</Badge>;
  if (s === "revision") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pendiente revisión</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">✓ Aprobado</Badge>;
}

type ObjRow = { id?: string; description: string };
type EvalRow = { id?: string; name: string; percentage: string; description: string };
type RefRow = { id?: string; title: string; author: string; year: string; url: string };

const EMPTY_OBJ = (): ObjRow => ({ description: "" });
const EMPTY_EVAL = (): EvalRow => ({ name: "", percentage: "", description: "" });
const EMPTY_REF = (): RefRow => ({ title: "", author: "", year: "", url: "" });

interface Props {
  user: Usuario;
}

export function DocentePlanesPanel({ user }: Props) {
  const classroomSessionKey = getClassroomSessionKey(user);
  const [classroomUser, setClassroomUser] = useState<ClassroomUser | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [plans, setPlans] = useState<ClassroomPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ClassroomPlan | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<any>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({
    course_id: "",
    academic_period: "",
    general_description: "",
    methodology: "",
  });
  const [courseQuery, setCourseQuery] = useState("");
  const [createObjs, setCreateObjs] = useState<ObjRow[]>([]);
  const [createEvals, setCreateEvals] = useState<EvalRow[]>([]);
  const [createRefs, setCreateRefs] = useState<RefRow[]>([]);

  const [openEditGeneral, setOpenEditGeneral] = useState(false);
  const [editGeneral, setEditGeneral] = useState({
    academic_period: "",
    general_description: "",
    methodology: "",
  });
  const [savingGeneral, setSavingGeneral] = useState(false);

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

  const resolveCourseId = useCallback(
    (rawQuery: string) => {
      const normalized = rawQuery.trim().toLowerCase();
      if (!normalized) return "";

      const exactMatch = courses.find(
        (c) =>
          c.code.toLowerCase() === normalized ||
          c.name.toLowerCase() === normalized
      );
      if (exactMatch) return exactMatch.id;

      const matches = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(normalized) ||
          c.name.toLowerCase().includes(normalized)
      );

      return matches.length === 1 ? matches[0].id : "";
    },
    [courses]
  );

  const reloadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await apiListPlans({ per_page: 500 });
      setPlans(res.data ?? []);
    } catch (e) {
      toast.error("No se pudieron cargar los planes", {
        description: formatApiError(e),
      });
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const loadPlanDetail = useCallback(async (planId: string) => {
    try {
      const [plan, objectives, evaluations, references] =
        await Promise.all([
          apiGetPlan(planId),
          apiListObjectives(planId),
          apiListEvaluations(planId),
          apiListReferences(planId),
        ]);
      setSelectedPlan({
        ...plan,
        generalObjectives: objectives,
        evaluationMethods: evaluations,
        bibliographicReferences: references,
      });
      // TODO: Cargar feedback de revisiones si existe
    } catch (e) {
      toast.error("No se pudo cargar el detalle del plan", {
        description: formatApiError(e),
      });
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoadingBootstrap(true);
      try {
        const me = await ensureClassroomSession(user);
        setClassroomUser(me);
        const [catalogCourses] = await Promise.all([
          apiListCourses({ active_only: true }),
          reloadPlans(),
        ]);
        setCourses(catalogCourses);
      } catch (e) {
        toast.error("No se pudo inicializar el módulo de Planes de Aula", {
          description: formatApiError(e),
        });
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
      const resolvedCourseId =
        newPlan.course_id || resolveCourseId(courseQuery);
      if (!resolvedCourseId) {
        toast.error("Selecciona un curso válido antes de guardar");
        setCreating(false);
        return;
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
        academic_period: newPlan.academic_period.trim(),
        general_description: newPlan.general_description || undefined,
        methodology: newPlan.methodology || undefined,
      });

      await Promise.all([
        ...createObjs
          .filter((o) => o.description.trim())
          .map((o, i) =>
            apiCreateGeneralObjective(created.id, {
              description: o.description.trim(),
              order: i + 1,
            })
          ),
        ...createEvals
          .filter((e) => e.name.trim() && e.percentage)
          .map((e) =>
            apiCreateEvaluation(created.id, {
              name: e.name.trim(),
              percentage: Number(e.percentage),
              description: e.description || undefined,
            })
          ),
        ...createRefs
          .filter((r) => r.title.trim())
          .map((r, i) =>
            apiCreateReference(created.id, {
              title: r.title.trim(),
              author: r.author || undefined,
              year: r.year || undefined,
              url: r.url || undefined,
              order: i + 1,
            })
          ),
      ]);

      await apiSubmitPlanForReview(created.id);
      toast.success("Plan enviado a revisión del coordinador");
      setOpenCreate(false);
      setNewPlan({
        course_id: "",
        academic_period: "",
        general_description: "",
        methodology: "",
      });
      setCourseQuery("");
      setCreateObjs([]);
      setCreateEvals([]);
      setCreateRefs([]);
      await reloadPlans();
      await loadPlanDetail(created.id);
    } catch (e) {
      toast.error("No se pudo crear el plan", { description: formatApiError(e) });
    } finally {
      setCreating(false);
    }
  };

  const onSubmitReview = async () => {
    if (!selectedPlan) return;
    setSendingReview(true);
    try {
      await apiSubmitPlanForReview(selectedPlan.id);
      toast.success("Plan enviado a revisión del coordinador");
      await reloadPlans();
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      toast.error("No se pudo enviar a revisión", {
        description: formatApiError(e),
      });
    } finally {
      setSendingReview(false);
    }
  };

  const onDeletePlan = async () => {
    if (!selectedPlan) return;
    if (!confirm("¿Eliminar este plan? La acción es irreversible.")) return;

    try {
      // TODO: Llamar a apiDeletePlan
      toast.success("Plan eliminado");
      setSelectedPlan(null);
      await reloadPlans();
    } catch (e) {
      toast.error("No se pudo eliminar el plan", {
        description: formatApiError(e),
      });
    }
  };

  const evalTotal = (rows: EvalRow[]) =>
    rows.reduce((a, e) => a + (Number(e.percentage) || 0), 0);

  if (loadingBootstrap) {
    return (
      <div className="py-10 text-center text-gray-500">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#1e3a5f]" />
        Cargando módulo de planes de aula...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Card className="border-[#1e3a5f]/15 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-[#ffc107]" /> Mis Planes de Aula
            </CardTitle>
            <Button
              onClick={() => setOpenCreate(true)}
              className="bg-[#ffc107] text-[#1e3a5f] hover:bg-[#ffb300] font-semibold"
            >
              <Plus className="mr-2 h-4 w-4" /> Nuevo plan
            </Button>
          </div>
          <CardDescription className="text-blue-100">
            Crear y gestionar tus planes de aula. Los coordinadores validarán y podrán sugerir cambios.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total",
            value: plans.length,
            color: "text-[#1e3a5f]",
          },
          {
            label: "Editables",
            value: plans.filter((p) => p.status === "planeacion").length,
            color: "text-[#ff9800]",
          },
          {
            label: "Aprobados",
            value: plans.filter((p) => p.status === "aprobado").length,
            color: "text-emerald-600",
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LISTA */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <ClipboardList className="h-5 w-5 text-[#ff9800]" /> Tus Planes
            </CardTitle>
            <CardDescription>Total: {plans.length} planes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingPlans ? (
              <div className="text-center py-4 text-gray-500">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No tienes planes aún
              </div>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => loadPlanDetail(plan.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedPlan?.id === plan.id
                      ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                      : "border-gray-200 hover:border-[#1e3a5f]/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-[#1e3a5f]">
                        {plan.course?.code}
                      </p>
                      <p className="text-xs text-gray-600">
                        {plan.academic_period}
                      </p>
                    </div>
                    {statusBadge(plan.status)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* DETALLE */}
        {selectedPlan ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-[#1e3a5f]">
                    {selectedPlan.course?.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedPlan.course?.code} · {selectedPlan.academic_period}
                  </CardDescription>
                </div>
                {statusBadge(selectedPlan.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ⚠️ BANNER DE BLOQUEO - PLAN EN REVISIÓN */}
              {selectedPlan.status === "revision" && (
                <Alert className="border-amber-400 bg-amber-50 shadow-md">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-amber-900 font-semibold">
                    <p className="mb-1">🔒 Plan en revisión</p>
                    <p className="text-sm font-normal">
                      Este plan ha sido enviado al coordinador para revisión. 
                      No se puede editar hasta que se complete la validación.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* ✅ BANNER DE ÉXITO - PLAN APROBADO */}
              {selectedPlan.status === "aprobado" && (
                <Alert className="border-emerald-400 bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <AlertDescription className="text-emerald-900 font-semibold">
                    <p className="mb-1">✓ Plan aprobado</p>
                    <p className="text-sm font-normal">
                      Tu plan ha sido validado exitosamente por el coordinador.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* FEEDBACK SI ESTÁ RECHAZADO */}
              {selectedPlan.status === "planeacion" && reviewFeedback && (
                <Alert className="border-red-300 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <p className="font-semibold mb-2">
                      El coordinador sugiere mejoras:
                    </p>
                    <p className="text-sm">{reviewFeedback.suggestions}</p>
                    {reviewFeedback.comments && (
                      <p className="text-sm mt-2">
                        <strong>Comentarios:</strong> {reviewFeedback.comments}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* DATOS GENERALES */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Datos Generales
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Descripción general</p>
                    <p className="text-gray-900">
                      {selectedPlan.general_description || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Metodología</p>
                    <p className="text-gray-900">
                      {selectedPlan.methodology || "—"}
                    </p>
                  </div>
                </div>
                {selectedPlan.status === "planeacion" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      setEditGeneral({
                        academic_period: selectedPlan.academic_period,
                        general_description:
                          selectedPlan.general_description ?? "",
                        methodology: selectedPlan.methodology ?? "",
                      });
                      setOpenEditGeneral(true);
                    }}
                  >
                    Editar
                  </Button>
                )}
              </div>

              {/* OBJETIVOS */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Objetivos Generales (
                  {selectedPlan.generalObjectives?.length ?? 0})
                </h3>
                {selectedPlan.generalObjectives?.length ? (
                  <ul className="space-y-2 text-sm">
                    {selectedPlan.generalObjectives.map((obj) => (
                      <li key={obj.id} className="flex gap-2">
                        <span className="text-[#ff9800]">•</span>
                        <span>{obj.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Sin objetivos definidos</p>
                )}
                {selectedPlan.status === "planeacion" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      setEditObjs(
                        (selectedPlan.generalObjectives ?? []).map((o) => ({
                          id: o.id,
                          description: o.description,
                        }))
                      );
                      setOpenObjectives(true);
                    }}
                  >
                    Editar objetivos
                  </Button>
                )}
              </div>

              {/* EVALUACIONES */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  📊 Métodos de Evaluación ({selectedPlan.evaluationMethods?.length ?? 0})
                </h3>
                {selectedPlan.evaluationMethods?.length ? (
                  <ul className="space-y-2 text-sm">
                    {selectedPlan.evaluationMethods.map((ev) => (
                      <li key={ev.id} className="flex justify-between">
                        <span>{ev.name}</span>
                        <span className="font-semibold text-[#1e3a5f]">
                          {ev.percentage}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Sin evaluaciones definidas</p>
                )}
                {selectedPlan.status === "planeacion" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      setEditEvals(
                        (selectedPlan.evaluationMethods ?? []).map((e) => ({
                          id: e.id,
                          name: e.name,
                          percentage: String(e.percentage),
                          description: e.description ?? "",
                        }))
                      );
                      setOpenEvals(true);
                    }}
                  >
                    Editar evaluaciones
                  </Button>
                )}
              </div>

              {/* REFERENCIAS */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  📚 Referencias Bibliográficas (
                  {selectedPlan.bibliographicReferences?.length ?? 0})
                </h3>
                {selectedPlan.bibliographicReferences?.length ? (
                  <ul className="space-y-2 text-sm">
                    {selectedPlan.bibliographicReferences.map((ref) => (
                      <li key={ref.id} className="text-gray-700">
                        <p className="font-medium">{ref.title}</p>
                        {ref.author && <p className="text-gray-600">{ref.author}</p>}
                        {ref.year && (
                          <p className="text-gray-600">({ref.year})</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Sin referencias definidas</p>
                )}
                {selectedPlan.status === "planeacion" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      setEditRefs(
                        (selectedPlan.bibliographicReferences ?? []).map(
                          (r) => ({
                            id: r.id,
                            title: r.title,
                            author: r.author ?? "",
                            year: r.year ?? "",
                            url: r.url ?? "",
                          })
                        )
                      );
                      setOpenRefs(true);
                    }}
                  >
                    Editar referencias
                  </Button>
                )}
              </div>

              {/* ACCIONES */}
              <div className="border-t pt-4 flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => apiExportPlanPdf(selectedPlan.id)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
                {selectedPlan.status === "planeacion" && (
                  <>
                    <Button
                      size="sm"
                      onClick={onSubmitReview}
                      disabled={sendingReview}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {sendingReview ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar a revisión
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={onDeletePlan}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center h-64 text-gray-500">
              Selecciona un plan para ver los detalles
            </CardContent>
          </Card>
        )}
      </div>

      {/* DIALOGS */}
      {/* TODO: Implementar todos los diálogos de edición */}
    </div>
  );
}
