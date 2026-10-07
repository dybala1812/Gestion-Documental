import { API_BASE, ApiError, tokens } from "./api";
import type { Usuario } from "../context/AuthContext";

const CLASSROOM_TOKEN_KEY = "classroom_plan_token";
const EXCHANGE_SECRET =
  import.meta.env.VITE_PQRS_TOKEN_EXCHANGE_SECRET ?? "";

export type ClassroomRoleId = 1 | 2 | 3 | 4;

// Semestres del plan de aula en números romanos (hasta XV por si algún programa lo requiere).
export const SEMESTER_ROMAN_OPTIONS = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV",
];

// Componente del curso (plantilla micro-curricular), agrupado por campo según la malla curricular.
// DEPRECATED: lista fija basada solo en Ingeniería Civil. Se mantiene como fallback para cursos
// antiguos que ya guardaron un slug de esta lista; el desplegable actual usa apiGetComponentOptions
// (catálogo real por programa, ver ProgramComponent en el backend).
export const COMPONENT_OPTIONS: Array<{ value: string; label: string; group: string }> = [
  { value: "emprendimiento", label: "Emprendimiento", group: "Campo Común" },
  { value: "investigacion", label: "Investigación", group: "Campo Común" },
  { value: "segunda_lengua", label: "Segunda Lengua", group: "Campo Común" },
  { value: "medio_ambiente", label: "Medio Ambiente", group: "Campo Común" },
  { value: "formacion_socio_humanistica", label: "Formación Socio Humanística", group: "Campo Común" },
  { value: "matematicas_estadistica", label: "Matemáticas y Estadística", group: "Ciencias Básicas" },
  { value: "fisica", label: "Física", group: "Ciencias Básicas" },
  { value: "administracion", label: "Administración", group: "Campo Disciplinar" },
  { value: "ciencias_naturales_basicas", label: "Ciencias Naturales Básicas", group: "Campo Disciplinar" },
  { value: "construccion", label: "Construcción", group: "Campo Disciplinar" },
  { value: "electivos", label: "Electivos", group: "Campo Disciplinar" },
  { value: "estructuras", label: "Estructuras", group: "Campo Disciplinar" },
  { value: "geotecnia", label: "Geotecnia", group: "Campo Disciplinar" },
  { value: "interdisciplinar", label: "Interdisciplinar", group: "Campo Disciplinar" },
  { value: "saneamiento_hidraulica", label: "Saneamiento Ambiental e Hidráulica", group: "Campo Disciplinar" },
  { value: "vias_transportes", label: "Vías y Transportes", group: "Campo Disciplinar" },
];

// Etiqueta legible del campo devuelto por apiGetComponentOptions.
export const COMPONENT_CAMPO_LABELS: Record<ProgramComponentOption["campo"], string> = {
  comun: "Campo Común",
  ciencias_basicas: "Ciencias Básicas",
  disciplinar: "Campo Disciplinar",
};

// Tipo de Curso (modalidad).
export const MODALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "hibrida", label: "Híbrida" },
  { value: "dual", label: "Dual" },
  { value: "unica", label: "Única" },
];

export interface ClassroomUser {
  id: string;
  name: string;
  email: string;
  role_id: ClassroomRoleId;
  role?: string;
  active?: boolean;
}

export interface ClassroomCourse {
  id: string;
  name: string;
  code: string;
  component?: string | null;
  credits?: number;
  semester?: number | null;
  is_common_field?: boolean;
  program?: {
    id: string;
    name: string;
    code: string;
    faculty?: { id: string; name: string; code: string };
  } | null;
}

export interface ClassroomPlan {
  id: string;
  course_id: string;
  author_id: string;
  academic_period: string;
  status: "planeacion" | "revision" | "aprobado";
  general_description?: string | null;
  class_type?: "teorico" | "practico" | "teorico_practico" | null;
  modality?: "presencial" | "virtual" | "hibrida" | "dual" | "unica" | null;
  disciplinary_field?: "comun" | "basico_disciplinar" | null;
  semester?: string | null;
  semester_roman?: string | null;
  credits?: number | null;
  competency?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  course?: ClassroomCourse;
  author?: ClassroomUser;
  generalObjectives?: Array<{
    id: string;
    description: string;
    order?: number;
    specificObjectives?: Array<{
      id: string;
      description: string;
      order?: number;
      topics?: Array<{ id: string; title: string; content?: string; weeks?: number; order?: number }>;
    }>;
  }>;
  evaluationMethods?: Array<{ id: string; name: string; percentage: number; description?: string }>;
  bibliographicReferences?: Array<{
    id: string;
    type?: string;
    title: string;
    author?: string;
    year?: string;
    publisher?: string;
    url?: string;
    isbn_issn?: string;
    order?: number;
    apa_citation?: string;
  }>;
  activities?: Array<{
    id: string;
    activity_type: string;
    notes?: string | null;
    created_at: string;
    user?: ClassroomUser;
  }>;
}

interface Paginated<T> {
  data: T[];
  total: number;
  current_page: number;
  last_page: number;
}

function normalizeRoleCodes(roles?: string[]): string[] {
  return (roles ?? []).map((r) => String(r).trim().toUpperCase());
}

function mapUserToClassroomRoleId(user: Usuario): ClassroomRoleId {
  const roles = normalizeRoleCodes(user.roles);
  
  // 1 = Admin
  if (user.is_staff || roles.includes("ADMIN") || roles.includes("SUPERADMIN")) return 1;
  
  // 2 = Vicerrector
  if (roles.includes("RECTOR") || roles.includes("VICERRECTOR") || roles.includes("VICERRECTORIA")) return 2;
  
  // 3 = Coordinador (múltiples variantes posibles)
  const coordinadorPatterns = ["COORDINATOR", "COORDINADOR", "COORDINACION", "COORDINADOR_PQRS", "COORDINADOR_ACADEMICO", "DEAN"];
  if (coordinadorPatterns.some(pattern => roles.some(r => r.includes(pattern)))) return 3;
  
  // 4 = Docente (default)
  return 4;
}

export function getClassroomSessionKey(user: Usuario): string {
  return [
    user.id,
    user.email.toLowerCase(),
    `${user.nombre} ${user.apellido ?? ""}`.trim(),
    mapUserToClassroomRoleId(user),
  ].join(":");
}

function getClassroomToken(): string | null {
  return localStorage.getItem(CLASSROOM_TOKEN_KEY);
}

function setClassroomToken(token: string): void {
  localStorage.setItem(CLASSROOM_TOKEN_KEY, token);
}

function clearClassroomToken(): void {
  localStorage.removeItem(CLASSROOM_TOKEN_KEY);
}

function buildExchangePayload(user: Usuario) {
  return {
    pqrs_user_id: user.id,
    email: user.email,
    name: `${user.nombre} ${user.apellido ?? ""}`.trim(),
    role_id: mapUserToClassroomRoleId(user),
    exchange_secret: EXCHANGE_SECRET,
  };
}

function getStoredUserForExchange(): Usuario | null {
  const raw = localStorage.getItem("usuario");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Usuario>;
    if (!parsed?.id || !parsed?.email || !parsed?.nombre) return null;
    return parsed as Usuario;
  } catch {
    return null;
  }
}

let classroomReExchangePromise: Promise<boolean> | null = null;

async function tryReExchangeClassroomToken(): Promise<boolean> {
  if (classroomReExchangePromise) return classroomReExchangePromise;

  classroomReExchangePromise = (async () => {
    const pqrsToken = tokens.getAccess();
    const storedUser = getStoredUserForExchange();

    if (!pqrsToken || !storedUser) return false;

    const res = await fetch(`${API_BASE}/api/planes-aula/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pqrsToken}`,
      },
      body: JSON.stringify(buildExchangePayload(storedUser)),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as { token: string; user: ClassroomUser };
    setClassroomToken(data.token);
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      classroomReExchangePromise = null;
    });

  return classroomReExchangePromise;
}

async function classroomFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getClassroomToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}/api/planes-aula${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 419) {
    const refreshed = await tryReExchangeClassroomToken();
    if (refreshed) {
      const newToken = getClassroomToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        res = await fetch(`${API_BASE}/api/planes-aula${path}`, {
          ...options,
          headers,
        });
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err);
  }

  return res;
}

async function classroomFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await classroomFetchRaw(path, options);

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  return undefined as T;
}

async function initializeClassroomSession(user: Usuario): Promise<ClassroomUser> {
  const currentToken = getClassroomToken();
  const pqrsToken = tokens.getAccess();

  if (currentToken) {
    try {
      const currentUser = await classroomFetch<ClassroomUser>("/auth/me", { method: "GET" });
      const roleIsCurrent = currentUser.role_id === mapUserToClassroomRoleId(user);
      const emailIsCurrent = currentUser.email.toLowerCase() === user.email.toLowerCase();

      if (!pqrsToken || (roleIsCurrent && emailIsCurrent)) return currentUser;
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 419)) throw e;
      clearClassroomToken();
    }
  }

  if (!pqrsToken) {
    throw new ApiError(401, { detail: "No hay sesión activa de PQRS para realizar el intercambio." });
  }

  const res = await fetch(`${API_BASE}/api/planes-aula/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pqrsToken}`,
    },
    body: JSON.stringify(buildExchangePayload(user)),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err);
  }

  const data = (await res.json()) as { token: string; user: ClassroomUser };
  setClassroomToken(data.token);

  return data.user;
}

let classroomSessionInitialization: { key: string; promise: Promise<ClassroomUser> } | null = null;

export function ensureClassroomSession(user: Usuario): Promise<ClassroomUser> {
  const key = getClassroomSessionKey(user);

  if (classroomSessionInitialization?.key === key) {
    return classroomSessionInitialization.promise;
  }

  const promise = initializeClassroomSession(user).finally(() => {
    if (classroomSessionInitialization?.promise === promise) {
      classroomSessionInitialization = null;
    }
  });

  classroomSessionInitialization = { key, promise };
  return promise;
}

export function clearClassroomSession(): void {
  classroomSessionInitialization = null;
  clearClassroomToken();
}

export async function apiListMyAssignedCourses(): Promise<ClassroomCourse[]> {
  return classroomFetch<ClassroomCourse[]>("/courses/my/assigned", { method: "GET" });
}

export interface ClassroomProgram {
  id: string;
  name: string;
  code: string;
  faculty?: { id: string; name: string; code: string } | null;
}

export async function apiListPrograms(params: { faculty_id?: string; search?: string; active_only?: boolean } = {}): Promise<ClassroomProgram[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  return classroomFetch<ClassroomProgram[]>(`/programs${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function apiCreateProgram(body: { faculty_id: string; name: string; code: string }): Promise<ClassroomProgram> {
  return classroomFetch<ClassroomProgram>("/programs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface ClassroomFaculty {
  id: string;
  name: string;
  code: string;
}

export async function apiListFaculties(params: { search?: string; active_only?: boolean } = {}): Promise<ClassroomFaculty[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  return classroomFetch<ClassroomFaculty[]>(`/faculties${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function apiListCourses(params: {
  search?: string;
  program_id?: string;
  common_field_only?: boolean;
  active_only?: boolean;
} = {}): Promise<ClassroomCourse[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  return classroomFetch<ClassroomCourse[]>(`/courses${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function apiCreateCourse(body: {
  name: string;
  code: string;
  program_id?: string | null;
  component?: string | null;
  credits?: number;
  semester?: number | null;
  is_common_field?: boolean;
}): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>("/courses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface CourseDuplicateMatch {
  id: string;
  code: string;
  program_id: string | null;
  program_name: string;
}

export async function apiCheckCourseDuplicate(params: {
  name: string;
  program_id?: string | null;
  exclude_id?: string;
}): Promise<{ exists_in_same_program: boolean; matches: CourseDuplicateMatch[] }> {
  const qs = new URLSearchParams();
  qs.set("name", params.name);
  if (params.program_id) qs.set("program_id", params.program_id);
  if (params.exclude_id) qs.set("exclude_id", params.exclude_id);

  return classroomFetch(`/courses/check-duplicate?${qs.toString()}`, { method: "GET" });
}

export interface ProgramComponentOption {
  campo: "comun" | "ciencias_basicas" | "disciplinar";
  componente: string;
}

/**
 * Catálogo real de Componentes por programa (extraído de las mallas micro-curriculares).
 * Reemplaza el desplegable fijo COMPONENT_OPTIONS: sin program_id solo devuelve Campo Común.
 */
export async function apiGetComponentOptions(
  programId?: string | null
): Promise<{ matched: boolean; options: ProgramComponentOption[] }> {
  const qs = new URLSearchParams();
  if (programId) qs.set("program_id", programId);

  return classroomFetch(`/courses/component-options${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function apiUpdateCourse(
  id: string,
  body: {
    name?: string;
    code?: string;
    program_id?: string | null;
    component?: string | null;
    credits?: number;
    semester?: number | null;
    is_common_field?: boolean;
    active?: boolean;
  }
): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>(`/courses/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Endpoint acotado (solo `component`): permitido al docente autor de su propio plan, sin requerir rol admin/coordinador. */
export async function apiUpdateCourseComponent(id: string, component: string | null): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>(`/courses/${id}/component`, {
    method: "PATCH",
    body: JSON.stringify({ component }),
  });
}

export async function apiDeleteCourse(id: string): Promise<{ message: string }> {
  return classroomFetch<{ message: string }>(`/courses/${id}`, {
    method: "DELETE",
  });
}

/** Duplica un curso con un nuevo código; copia el plan de aula más reciente como base editable. */
export async function apiDuplicateCourse(
  id: string,
  body: { code: string; name?: string; program_id?: string | null }
): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>(`/courses/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiListPlans(params: {
  status?: string;
  course_id?: string;
  academic_period?: string;
  author_id?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<Paginated<ClassroomPlan>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  return classroomFetch<Paginated<ClassroomPlan>>(`/plans${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function apiCreatePlan(body: {
  course_id: string;
  general_description?: string;
  class_type?: "teorico" | "practico" | "teorico_practico";
  modality?: "presencial" | "virtual" | "hibrida" | "dual" | "unica";
  disciplinary_field?: "comun" | "basico_disciplinar";
  semester?: string;
  credits?: number;
  competency?: string;
}): Promise<ClassroomPlan> {
  return classroomFetch<ClassroomPlan>("/plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiGetPlan(id: string): Promise<ClassroomPlan> {
  return classroomFetch<ClassroomPlan>(`/plans/${id}`, { method: "GET" });
}

export async function apiUpdatePlan(id: string, body: {
  general_description?: string;
  class_type?: "teorico" | "practico" | "teorico_practico";
  modality?: "presencial" | "virtual" | "hibrida" | "dual" | "unica";
  disciplinary_field?: "comun" | "basico_disciplinar";
  semester?: string;
  credits?: number;
  competency?: string;
}): Promise<ClassroomPlan> {
  return classroomFetch<ClassroomPlan>(`/plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiSubmitPlanForReview(id: string): Promise<ClassroomPlan> {
  return classroomFetch<ClassroomPlan>(`/plans/${id}/submit-review`, { method: "POST" });
}

export async function apiDeletePlan(id: string): Promise<{ message: string }> {
  return classroomFetch<{ message: string }>(`/plans/${id}`, { method: "DELETE" });
}

export async function apiUpdatePlanStatus(id: string, status: "planeacion" | "revision" | "aprobado", notes?: string): Promise<ClassroomPlan> {
  return classroomFetch<ClassroomPlan>(`/plans/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export interface PlanLockConflict { locked: true; locked_by: string; locked_at: string; }

/** Intenta bloquear el plan para editar; si otro usuario ya lo tiene bloqueado, devuelve el conflicto (409) en vez de lanzar. */
export async function apiAcquirePlanLock(id: string): Promise<PlanLockConflict | { locked: false }> {
  try {
    const res = await classroomFetchRaw(`/plans/${id}/lock`, { method: "POST" });
    return res.json();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return e.data as unknown as PlanLockConflict;
    }
    throw e;
  }
}

export async function apiReleasePlanLock(id: string): Promise<void> {
  await classroomFetchRaw(`/plans/${id}/lock`, { method: "DELETE" });
}

export async function apiExportPlanPdf(id: string): Promise<void> {
  const res = await classroomFetchRaw(`/plans/${id}/export/pdf`, { method: "GET" });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plan-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiExportPlanExcel(id: string): Promise<void> {
  const res = await classroomFetchRaw(`/plans/${id}/export/excel`, { method: "GET" });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plan-${id}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiListObjectives(planId: string): Promise<NonNullable<ClassroomPlan["generalObjectives"]>> {
  const objectives = await classroomFetch<Array<NonNullable<ClassroomPlan["generalObjectives"]>[number] & {
    specific_objectives?: NonNullable<NonNullable<ClassroomPlan["generalObjectives"]>[number]["specificObjectives"]>;
  }>>(`/plans/${planId}/objectives`, { method: "GET" });

  return objectives.map(({ specific_objectives, ...objective }) => ({
    ...objective,
    specificObjectives: specific_objectives ?? objective.specificObjectives ?? [],
  }));
}

export async function apiCreateGeneralObjective(planId: string, body: { description: string; order?: number }) {
  return classroomFetch<{ id: string; description: string; order?: number }>(`/plans/${planId}/objectives`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateGeneralObjective(planId: string, objectiveId: string, body: { description: string; order?: number }) {
  return classroomFetch(`/plans/${planId}/objectives/${objectiveId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteGeneralObjective(planId: string, objectiveId: string) {
  return classroomFetch(`/plans/${planId}/objectives/${objectiveId}`, {
    method: "DELETE",
  });
}

export async function apiCreateSpecificObjective(planId: string, generalObjectiveId: string, body: { description: string; order?: number }) {
  return classroomFetch<{ id: string; description: string; order?: number }>(`/plans/${planId}/objectives/${generalObjectiveId}/specific`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateSpecificObjective(planId: string, generalObjectiveId: string, objectiveId: string, body: { description: string; order?: number }) {
  return classroomFetch(`/plans/${planId}/objectives/${generalObjectiveId}/specific/${objectiveId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteSpecificObjective(planId: string, generalObjectiveId: string, objectiveId: string) {
  return classroomFetch(`/plans/${planId}/objectives/${generalObjectiveId}/specific/${objectiveId}`, {
    method: "DELETE",
  });
}

export async function apiCreateTopic(planId: string, generalObjectiveId: string, specificObjectiveId: string, body: { title: string; content?: string; order?: number; weeks?: number }) {
  return classroomFetch<{ id: string; title: string; content?: string; order?: number; weeks?: number }>(`/plans/${planId}/objectives/${generalObjectiveId}/specific/${specificObjectiveId}/topics`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateTopic(planId: string, generalObjectiveId: string, specificObjectiveId: string, topicId: string, body: { title: string; content?: string; order?: number; weeks?: number }) {
  return classroomFetch(`/plans/${planId}/objectives/${generalObjectiveId}/specific/${specificObjectiveId}/topics/${topicId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteTopic(planId: string, generalObjectiveId: string, specificObjectiveId: string, topicId: string) {
  return classroomFetch(`/plans/${planId}/objectives/${generalObjectiveId}/specific/${specificObjectiveId}/topics/${topicId}`, {
    method: "DELETE",
  });
}

export async function apiListEvaluations(planId: string): Promise<Array<{ id: string; name: string; percentage: number; description?: string }>> {
  return classroomFetch(`/plans/${planId}/evaluations`, { method: "GET" });
}

export async function apiCreateEvaluation(planId: string, body: { name: string; percentage: number; description?: string }) {
  return classroomFetch(`/plans/${planId}/evaluations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateEvaluation(planId: string, evaluationId: string, body: { name?: string; percentage?: number; description?: string }) {
  return classroomFetch(`/plans/${planId}/evaluations/${evaluationId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteEvaluation(planId: string, evaluationId: string) {
  return classroomFetch(`/plans/${planId}/evaluations/${evaluationId}`, {
    method: "DELETE",
  });
}

export async function apiListReferences(planId: string): Promise<Array<{
  id: string;
  type?: string;
  title: string;
  author?: string;
  year?: string;
  publisher?: string;
  url?: string;
  isbn_issn?: string;
  order?: number;
}>> {
  return classroomFetch(`/plans/${planId}/references`, { method: "GET" });
}

export async function apiCreateReference(planId: string, body: {
  type?: string;
  title: string;
  author?: string;
  year?: string;
  publisher?: string;
  url?: string;
  isbn_issn?: string;
  order?: number;
}) {
  return classroomFetch(`/plans/${planId}/references`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateReference(planId: string, referenceId: string, body: {
  type?: string;
  title?: string;
  author?: string;
  year?: string;
  publisher?: string;
  url?: string;
  isbn_issn?: string;
  order?: number;
}) {
  return classroomFetch(`/plans/${planId}/references/${referenceId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── Course Teacher Assignments ──────────────────────────────────────────────

/**
 * POST /api/planes-aula/courses/{courseId}/assign
 * Asignar docentes a un curso (coordinador solamente)
 */
export async function apiAssignTeachersToCourse(courseId: string, userIds: string[]): Promise<{ message: string; course: ClassroomCourse }> {
  return classroomFetch(`/courses/${courseId}/assign`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

/**
 * GET /api/planes-aula/courses/{courseId}/teachers
 * Obtener docentes asignados a un curso
 */
export interface AssignedTeacher {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
}

export async function apiGetAssignedTeachers(courseId: string): Promise<AssignedTeacher[]> {
  return classroomFetch<AssignedTeacher[]>(`/courses/${courseId}/teachers`, {
    method: "GET",
  });
}

// ── Plan Reviews ────────────────────────────────────────────────────────────

export interface PlanReview {
  id: string;
  plan_id: string;
  reviewer_id: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
  suggestions?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  reviewer?: ClassroomUser;
  plan?: ClassroomPlan;
}

/**
 * POST /api/planes-aula/reviews
 * Crear una revisión (aprobar o rechazar un plan)
 */
export async function apiCreatePlanReview(body: {
  plan_id: string;
  status: "approved" | "rejected";
  comments?: string;
  suggestions?: string;
}): Promise<PlanReview> {
  return classroomFetch<PlanReview>("/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface BulkApprovePlanningResult {
  approved: number;
  skipped: number;
  approved_ids: string[];
}

export async function apiBulkApprovePlanning(planIds: string[]): Promise<BulkApprovePlanningResult> {
  return classroomFetch<BulkApprovePlanningResult>("/reviews/bulk-approve-planning", {
    method: "POST",
    body: JSON.stringify({ plan_ids: planIds }),
  });
}

/**
 * GET /api/planes-aula/reviews
 * Obtener todas las revisiones (filtrado por rol)
 */
export async function apiListReviews(params: {
  status?: string;
  plan_id?: string;
  author_id?: string;
  program_id?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<Paginated<PlanReview>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  return classroomFetch<Paginated<PlanReview>>(`/reviews${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
  });
}

/**
 * GET /api/planes-aula/reviews/plan/{planId}
 * Obtener todas las revisiones de un plan específico
 */
export async function apiGetPlanReviews(planId: string): Promise<PlanReview[]> {
  return classroomFetch<PlanReview[]>(`/reviews/plan/${planId}`, {
    method: "GET",
  });
}

export async function apiDeleteReference(planId: string, referenceId: string) {
  return classroomFetch(`/plans/${planId}/references/${referenceId}`, {
    method: "DELETE",
  });
}

export async function apiExportBulkPdf(planIds: string[]): Promise<void> {
  const res = await classroomFetchRaw(`/plans/export/bulk-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan_ids: planIds }),
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planes-aula-${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiExportCsv(filters?: {
  faculty_id?: string;
  program_id?: string;
  status?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.faculty_id) params.append("faculty_id", filters.faculty_id);
  if (filters?.program_id) params.append("program_id", filters.program_id);
  if (filters?.status) params.append("status", filters.status);

  const res = await classroomFetchRaw(`/plans/export/csv?${params.toString()}`, { method: "GET" });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planes-aula-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface BulkImportResult {
  academic_period: string;
  total_sheets: number;
  created: number;
  skipped: number;
  errors: number;
  warnings: number;
  detail: {
    created: Array<{ sheet: string; course: string; missing_fields?: string[] }>;
    skipped: Array<{ sheet: string; course?: string; reason: string }>;
    errors:  Array<{ sheet: string; error: string }>;
  };
}

export async function apiBulkImportExcel(
  file: File,
  academicPeriod: string,
  authorId?: string,
): Promise<BulkImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("academic_period", academicPeriod);
  if (authorId) form.append("author_id", authorId);

  return classroomFetch<BulkImportResult>("/plans/import/excel", {
    method: "POST",
    body: form,
  });
}

// ── Teacher Search ──────────────────────────────────────────────────────────

/**
 * GET /api/planes-aula/users
 * Buscar docentes por correo, nombre o role_id
 * Laravel retorna paginado: {data: [...], total, current_page, last_page}
 */
export async function apiSearchTeachers(params: {
  search?: string;
  email?: string;
  role_id?: number;
  limit?: number;
} = {}): Promise<ClassroomUser[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });

  const response = await classroomFetch<Paginated<ClassroomUser>>(
    `/users${qs.toString() ? `?${qs.toString()}` : ""}`,
    { method: "GET" }
  );
  
  return response?.data ?? [];
}
