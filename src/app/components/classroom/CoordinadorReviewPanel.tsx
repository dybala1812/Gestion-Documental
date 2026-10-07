import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  Filter,
  History,
  Loader2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  X,
  AlertCircle,
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
  apiGetPlan,
  apiExportPlanPdf,
  apiBulkApprovePlanning,
  apiListEvaluations,
  apiListObjectives,
  apiListPlans,
  apiListReferences,
  ensureClassroomSession,
  getClassroomSessionKey,
  apiCreatePlanReview,
  apiListReviews,
  type ClassroomPlan,
  type ClassroomUser,
} from "../../lib/classroomApi";

interface Props {
  user: Usuario;
}

interface ReviewData {
  status: "approved" | "rejected";
  comments?: string;
  suggestions?: string;
}

function reviewSubmitter(plan: ClassroomPlan): ClassroomUser | undefined {
  return plan.activities?.find(
    (activity) => activity.activity_type === "SUBMITTED_REVIEW"
  )?.user ?? plan.author;
}

export function CoordinadorReviewPanel({ user }: Props) {
  const classroomSessionKey = getClassroomSessionKey(user);
  const [classroomUser, setClassroomUser] = useState<ClassroomUser | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [plans, setPlans] = useState<ClassroomPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ClassroomPlan | null>(null);

  const [filterStatus, setFilterStatus] = useState("revision");
  const [filterFacultyId, setFilterFacultyId] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterAuthorId, setFilterAuthorId] = useState("");

  const [openReview, setOpenReview] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData>({
    status: "approved",
    comments: "",
    suggestions: "",
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [approvingPlanning, setApprovingPlanning] = useState(false);

  const reloadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await apiListPlans({
        per_page: 500,
        faculty_id: filterFacultyId || undefined,
        program_id: filterProgramId || undefined,
        author_id: filterAuthorId || undefined,
      });
      setPlans(res.data ?? []);
    } catch (e) {
      toast.error("No se pudieron cargar los planes", {
        description: formatApiError(e),
      });
    } finally {
      setLoadingPlans(false);
    }
  }, [filterFacultyId, filterProgramId, filterAuthorId]);

  const loadPlanDetail = useCallback(async (planId: string) => {
    try {
      const [plan, objectives, evaluations, references] = await Promise.all([
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
        await reloadPlans();
      } catch (e) {
        toast.error("No se pudo inicializar el módulo de revisión", {
          description: formatApiError(e),
        });
      } finally {
        setLoadingBootstrap(false);
      }
    };
    bootstrap();
  }, [classroomSessionKey, reloadPlans]);

  const onSubmitReview = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPlan) return;

    setSubmittingReview(true);
    try {
      await apiCreatePlanReview({
        plan_id: selectedPlan.id,
        status: reviewData.status,
        comments: reviewData.comments || "",
        suggestions: reviewData.suggestions || "",
      });

      toast.success(
        reviewData.status === "approved"
          ? "Plan aprobado exitosamente"
          : "Plan rechazado con sugerencias enviadas"
      );

      setOpenReview(false);
      setReviewData({ status: "approved", comments: "", suggestions: "" });
      setSelectedPlan(null);
      await reloadPlans();
    } catch (e) {
      toast.error("No se pudo procesar la revisión", {
        description: formatApiError(e),
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const planningPlans = useMemo(
    () => plans.filter((plan) => plan.status === "planeacion"),
    [plans]
  );

  const onBulkApprovePlanning = async () => {
    if (planningPlans.length === 0) return;
    if (!window.confirm(`¿Avalar ${planningPlans.length} planes en planeación? Los docentes ya no podrán editarlos.`)) return;

    setApprovingPlanning(true);
    try {
      const result = await apiBulkApprovePlanning(planningPlans.map((plan) => plan.id));
      toast.success(`${result.approved} planes avalados`, {
        description: result.skipped > 0
          ? `${result.skipped} se omitieron por estado, permisos o propuestas duplicadas.`
          : undefined,
      });
      setSelectedPlan(null);
      await reloadPlans();
    } catch (e) {
      toast.error("No se pudieron avalar los planes", {
        description: formatApiError(e),
      });
    } finally {
      setApprovingPlanning(false);
    }
  };

  const faculties = useMemo(
    () =>
      [
        ...new Map(
          plans.map((p) => [
            p.course?.program?.faculty?.id,
            p.course?.program?.faculty,
          ])
        ).values(),
      ].filter(Boolean),
    [plans]
  );

  const programs = useMemo(
    () =>
      plans
        .filter(
          (p) => !filterFacultyId || p.course?.program?.faculty?.id === filterFacultyId
        )
        .map((p) => p.course?.program)
        .filter(
          (prog, idx, self) =>
            prog && self.findIndex((q) => q?.id === prog.id) === idx
        ),
    [plans, filterFacultyId]
  );

  const filteredPlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          (!filterStatus || p.status === filterStatus) &&
          (!filterFacultyId ||
            p.course?.program?.faculty?.id === filterFacultyId) &&
          (!filterProgramId || p.course?.program?.id === filterProgramId) &&
          (!filterAuthorId || p.author?.id === filterAuthorId)
      ),
    [plans, filterStatus, filterFacultyId, filterProgramId, filterAuthorId]
  );

  const stats = {
    pendingReview: plans.filter((p) => p.status === "revision").length,
    approved: plans.filter((p) => p.status === "aprobado").length,
    total: plans.length,
  };

  if (loadingBootstrap) {
    return (
      <div className="py-10 text-center text-gray-500">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#1e3a5f]" />
        Cargando módulo de revisión de planes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Card className="border-[#1e3a5f]/15 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-[#ffc107]" /> Revisión de
              Planes de Aula
            </CardTitle>
            <CardDescription className="text-blue-100">
              Validar planes de docentes, sugerir mejoras y aprobar o rechazar.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={onBulkApprovePlanning}
            disabled={planningPlans.length === 0 || approvingPlanning}
            className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-white/20"
          >
            {approvingPlanning
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Avalar planeación ({planningPlans.length})
          </Button>
        </CardHeader>
      </Card>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Pendientes",
            value: stats.pendingReview,
            color: "text-[#ff9800]",
          },
          {
            label: "Aprobados",
            value: stats.approved,
            color: "text-emerald-600",
          },
          {
            label: "Total",
            value: stats.total,
            color: "text-[#1e3a5f]",
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
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <Filter className="h-4 w-4" /> Planes
            </CardTitle>
            <CardDescription>
              {filteredPlans.length} / {plans.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* FILTROS */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Estado</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">Todos</option>
                <option value="revision">Pendientes revisión</option>
                <option value="planeacion">En planeación</option>
                <option value="aprobado">Aprobados</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Facultad</Label>
              <select
                value={filterFacultyId}
                onChange={(e) => {
                  setFilterFacultyId(e.target.value);
                  setFilterProgramId("");
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">Todas</option>
                {faculties.map((f) => (
                  <option key={f!.id} value={f!.id}>
                    {f!.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Programa</Label>
              <select
                value={filterProgramId}
                onChange={(e) => setFilterProgramId(e.target.value)}
                disabled={!filterFacultyId}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value="">Todos</option>
                {programs.map((p) => (
                  <option key={p?.id} value={p?.id ?? ""}>
                    {p?.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setFilterStatus("revision");
                setFilterFacultyId("");
                setFilterProgramId("");
                setFilterAuthorId("");
              }}
            >
              Limpiar filtros
            </Button>

            {/* LISTA */}
            <div className="space-y-2 border-t pt-3 max-h-96 overflow-y-auto">
              {loadingPlans ? (
                <div className="text-center py-4 text-gray-500">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              ) : filteredPlans.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No hay planes que mostrar
                </div>
              ) : (
                filteredPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => loadPlanDetail(plan.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedPlan?.id === plan.id
                        ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                        : "border-gray-200 hover:border-[#1e3a5f]/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-[#1e3a5f]">
                        {plan.course?.code}
                      </p>
                      <p className="text-xs text-gray-600">
                        Enviado por: {reviewSubmitter(plan)?.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {plan.academic_period}
                      </p>
                      {plan.status === "revision" && (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          Pendiente revisión
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* DETALLE */}
        {selectedPlan ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-[#1e3a5f]">
                    {selectedPlan.course?.name}
                  </CardTitle>
                  <CardDescription>
                    Enviado por: <strong>{reviewSubmitter(selectedPlan)?.name}</strong> · Periodo:{" "}
                    {selectedPlan.academic_period}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => apiExportPlanPdf(selectedPlan.id)}>
                    <Download className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  <Badge
                    className={
                      selectedPlan.status === "revision"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }
                  >
                    {selectedPlan.status === "revision"
                      ? "Pendiente"
                      : "Aprobado"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* DATOS GENERALES */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3">
                  Datos Generales
                </h3>
                <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p><span className="font-medium text-gray-600">Código:</span> {selectedPlan.course?.code || "—"}</p>
                    <p><span className="font-medium text-gray-600">Programa:</span> {selectedPlan.course?.program?.name || "—"}</p>
                    <p><span className="font-medium text-gray-600">Facultad:</span> {selectedPlan.course?.program?.faculty?.name || "—"}</p>
                    <p><span className="font-medium text-gray-600">Periodo:</span> {selectedPlan.academic_period}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Descripción</p>
                    <p className="text-gray-900">
                      {selectedPlan.general_description || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Metodología</p>
                    <p className="text-gray-900">
                      {selectedPlan.methodology || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* OBJETIVOS */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Objetivos Generales (
                  {selectedPlan.generalObjectives?.length ?? 0})
                </h3>
                {selectedPlan.generalObjectives?.length ? (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                    {selectedPlan.generalObjectives.map((obj, objectiveIndex) => (
                      <div key={obj.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                        <p className="font-medium text-[#1e3a5f]">
                          {objectiveIndex + 1}. {obj.description}
                        </p>
                        {(obj.specificObjectives ?? []).length > 0 ? (
                          <div className="mt-2 space-y-2 border-l-2 border-[#ffc107] pl-3">
                            {(obj.specificObjectives ?? []).map((specific, specificIndex) => (
                              <div key={specific.id}>
                                <p className="text-gray-700">
                                  <span className="font-medium">{objectiveIndex + 1}.{specificIndex + 1}.</span> {specific.description}
                                </p>
                                {(specific.topics ?? []).length > 0 && (
                                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-500">
                                    {(specific.topics ?? []).map((topic) => (
                                      <li key={topic.id}>
                                        {topic.title}{topic.weeks ? ` (${topic.weeks} semana${topic.weeks === 1 ? "" : "s"})` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs italic text-gray-400">Sin objetivos específicos.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    Sin objetivos definidos
                  </p>
                )}
              </div>

              {/* EVALUACIONES */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Métodos de Evaluación
                </h3>
                {selectedPlan.evaluationMethods?.length ? (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="space-y-1 text-sm">
                      {selectedPlan.evaluationMethods.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-start justify-between gap-3 border-b border-gray-200 py-1.5 last:border-0"
                        >
                          <span>
                            <span className="block font-medium">{ev.name}</span>
                            {ev.description && <span className="block text-xs text-gray-500">{ev.description}</span>}
                          </span>
                          <span className="font-semibold text-[#1e3a5f]">
                            {ev.percentage}%
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-1 mt-1 flex justify-between items-center font-semibold">
                        <span>Total</span>
                        <span>
                          {selectedPlan.evaluationMethods.reduce(
                            (sum, ev) => sum + ev.percentage,
                            0
                          )}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    Sin métodos de evaluación
                  </p>
                )}
              </div>

              {/* REFERENCIAS */}
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Referencias Bibliográficas (
                  {selectedPlan.bibliographicReferences?.length ?? 0})
                </h3>
                {selectedPlan.bibliographicReferences?.length ? (
                  <div className="space-y-2 text-sm max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                    {selectedPlan.bibliographicReferences.map((ref) => (
                      <div key={ref.id} className="border-b pb-2 last:border-b-0">
                        <p className="font-medium text-gray-900">
                          {ref.title}
                        </p>
                        {ref.author && (
                          <p className="text-gray-600">{ref.author}</p>
                        )}
                        {ref.year && (
                          <p className="text-gray-600">({ref.year})</p>
                        )}
                        {ref.publisher && <p className="text-gray-600">Editorial: {ref.publisher}</p>}
                        {ref.isbn_issn && <p className="text-gray-600">ISBN/ISSN: {ref.isbn_issn}</p>}
                        {ref.url && (
                          <a href={ref.url} target="_blank" rel="noreferrer" className="break-all text-[#1e3a5f] underline hover:text-[#ff9800]">
                            {ref.url}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    Sin referencias bibliográficas
                  </p>
                )}
              </div>

              {/* BITÁCORA */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#1e3a5f]">
                  <History className="h-4 w-4" /> Bitácora de edición
                </h3>
                {(selectedPlan.activities ?? []).filter((activity) => activity.activity_type === "EDITED").length > 0 ? (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
                    {(selectedPlan.activities ?? [])
                      .filter((activity) => activity.activity_type === "EDITED")
                      .map((activity) => (
                        <div key={activity.id} className="flex flex-col justify-between gap-1 border-b border-gray-200 pb-2 text-xs last:border-0 sm:flex-row">
                          <span>
                            <strong>{activity.user?.name ?? "Usuario"}</strong>
                            {activity.notes ? ` · ${activity.notes}` : " · Plan actualizado."}
                          </span>
                          <span className="shrink-0 text-gray-500">
                            {new Date(activity.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm italic text-gray-500">Sin ediciones registradas.</p>
                )}
              </div>

              {/* ACCIONES */}
              {selectedPlan.status === "revision" && (
                <div className="border-t pt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setReviewData({
                        status: "approved",
                        comments: "",
                        suggestions: "",
                      });
                      setOpenReview(true);
                    }}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setReviewData({
                        status: "rejected",
                        comments: "",
                        suggestions: "",
                      });
                      setOpenReview(true);
                    }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" /> Rechazar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center h-96 text-gray-500">
              Selecciona un plan para revisar
            </CardContent>
          </Card>
        )}
      </div>

      {/* DIALOG REVIEW */}
      <Dialog open={openReview} onOpenChange={setOpenReview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewData.status === "approved" ? "Aprobar Plan" : "Rechazar Plan"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmitReview} className="space-y-4">
            {reviewData.status === "rejected" && (
              <Alert className="border-red-300 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  El docente recibirá una notificación con tus sugerencias para
                  mejorar.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label className="text-sm font-semibold">Comentarios</Label>
              <Textarea
                placeholder="Comentarios adicionales sobre la revisión..."
                value={reviewData.comments}
                onChange={(e) =>
                  setReviewData({ ...reviewData, comments: e.target.value })
                }
                className="mt-1 min-h-20"
              />
            </div>

            {reviewData.status === "rejected" && (
              <div>
                <Label className="text-sm font-semibold">
                  Sugerencias de mejora
                </Label>
                <Textarea
                  placeholder="Describe qué aspectos deben mejorar..."
                  value={reviewData.suggestions}
                  onChange={(e) =>
                    setReviewData({
                      ...reviewData,
                      suggestions: e.target.value,
                    })
                  }
                  className="mt-1 min-h-24"
                  required
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenReview(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingReview}
                className={
                  reviewData.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }
              >
                {submittingReview ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : reviewData.status === "approved" ? (
                  <ThumbsUp className="h-4 w-4 mr-2" />
                ) : (
                  <ThumbsDown className="h-4 w-4 mr-2" />
                )}
                {reviewData.status === "approved"
                  ? "Aprobar plan"
                  : "Rechazar y sugerir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
