// ─────────────────────────────────────────────────────────────
//  eleccionesApi.ts — Capa HTTP del módulo de elecciones estudiantiles.
//  Reutiliza el wrapper autenticado `apiFetch` del backend NOVA (Django).
//  Base de rutas: /api/elecciones/
// ─────────────────────────────────────────────────────────────
import { apiFetch, API_BASE, tokens } from "./api";

// ── Tipos ─────────────────────────────────────────────────────

export interface ElectoralPeriod {
  id: string;
  name: string;
  description: string;
  year_start: number;
  year_end: number;
  inscription_start: string;
  inscription_end: string;
  observers_start: string | null;
  observers_end: string | null;
  voting_start: string;
  voting_end: string;
  results_published: boolean;
  active: boolean;
  closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ElectionRole {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  requires_facultad: boolean;
  requires_programa: boolean;
  created_at: string;
}

export type CollegiateScope = "UNIVERSITARIO" | "FACULTAD" | "PROGRAMA";

export interface Collegiate {
  id: string;
  period: string;
  role: string;
  role_name?: string;
  role_code?: string;
  name: string;
  scope: CollegiateScope;
  facultad: string;
  curriculum: string;
  threshold: number;
  seats: number;
  description: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ElectionConfig {
  id: string;
  allowed_email_domains: string[];
  endorsements_required: boolean;
  min_endorsements: number;
  updated_at: string;
}

export interface AcademicProgram {
  id: string;
  facultad: string;
  programa: string;
  curriculum: string;
  active: boolean;
  created_at?: string;
}

export interface Participant {
  id: string;
  period: string;
  email: string;
  full_name: string;
  document_number: string;
  active: boolean;
  roles?: ParticipantRole[];
}

export interface ParticipantRole {
  id: string;
  participant: string;
  participant_name?: string;
  participant_email?: string;
  role: string;
  role_code?: string;
  role_name?: string;
  curriculum: string;
  facultad: string;
  programa: string;
  semestre: number | null;
  image?: string | null;
  fecha_nacimiento?: string | null;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  ocupacion_actual?: string;
  work_plan_pdf?: string | null;
  suplente_email?: string;
  suplente_documento_identidad?: string;
  suplente_image?: string | null;
  terms_accepted?: boolean;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  status_display?: string;
  review_notes?: string;
  reviewed_at?: string | null;
  created_at?: string;
}

export interface Candidacy {
  id: string;
  period: string;
  collegiate: string;
  collegiate_name?: string;
  role: string;
  role_name?: string;
  participant: string;
  participant_name?: string;
  image: string;
  proposal: string;
  action_plan: string;
  work_plan_pdf: string | null;
  documento_identidad: string;
  fecha_nacimiento: string | null;
  telefono: string;
  direccion: string;
  ciudad: string;
  status: "INSCRITO" | "PUBLICADO" | "RECHAZADO";
  status_display?: string;
  review_notes: string;
  is_complete?: boolean;
  terms_accepted?: boolean;
  terms_accepted_at?: string | null;
  substitute?: {
    id: string;
    participant: string;
    participant_name?: string;
    documento_identidad?: string;
    image: string | null;
  } | null;
  endorsements?: Array<{ id: string; participant_name?: string; note: string }>;
  endorsements_count?: number;
  already_endorsed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ballot {
  id: string;
  period: string;
  role: string;
  collegiate: string;
  collegiate_name?: string;
  candidacy: string;
  number: number;
  active: boolean;
  candidate_name?: string;
  candidate_image?: string | null;
  candidate_program?: string;
  proposal?: string;
  action_plan?: string;
  substitute_name?: string;
  created_at: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
  detail: string;
  collegiates: Collegiate[];
  existing_registration: {
    as: string;
    collegiate: string;
    collegiate_id: string;
    role: string;
    status: string;
  } | null;
}

export interface ActivePeriodInfo {
  active: boolean;
  detail?: string;
  period?: ElectoralPeriod;
  is_institutional?: boolean;
  is_participant?: boolean;
  stages?: {
    inscription_open: boolean;
    observers_open: boolean;
    voting_open: boolean;
  };
}

export interface CollegiateTally {
  collegiate_id: string;
  collegiate: string;
  role: string;
  threshold: number;
  seats: number;
  total_votes: number;
  blank_votes: number;
  results: Array<{
    ballot_id: string;
    number: number;
    candidate: string;
    votes: number;
    elected: boolean;
  }>;
}

export interface Observer {
  id: string;
  period: string;
  collegiate: string | null;
  collegiate_name?: string;
  participant: string;
  participant_name?: string;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  status_display?: string;
  review_notes: string;
  created_at: string;
}

export interface ImportReport {
  created: number;
  updated: number;
  roles_added: number;
  total_rows: number;
  errors: Array<{ row: number; email?: string; error: string }>;
}

// ── Estudiante ────────────────────────────────────────────────

export const apiGetActivePeriod = () =>
  apiFetch<ActivePeriodInfo>("/api/elecciones/active-period/");

export const apiGetMyEligibility = () =>
  apiFetch<EligibilityResult>("/api/elecciones/me/eligibility/");

export const apiGetMyCandidacy = () =>
  apiFetch<{ candidacy: Candidacy | null }>("/api/elecciones/me/candidacy/");

export const apiGetMyVotes = () =>
  apiFetch<{ voted_collegiates: string[] }>("/api/elecciones/me/votes/");

export function apiCreateCandidacy(data: {
  collegiate: string;
  image: File;
  work_plan_pdf: File;
  proposal?: string;
  action_plan?: string;
  documento_identidad: string;
  fecha_nacimiento: string;
  telefono: string;
  direccion: string;
  ciudad: string;
}): Promise<Candidacy> {
  const fd = new FormData();
  fd.append("collegiate", data.collegiate);
  fd.append("image", data.image);
  fd.append("work_plan_pdf", data.work_plan_pdf);
  if (data.proposal) fd.append("proposal", data.proposal);
  if (data.action_plan) fd.append("action_plan", data.action_plan);
  fd.append("documento_identidad", data.documento_identidad);
  fd.append("fecha_nacimiento", data.fecha_nacimiento);
  fd.append("telefono", data.telefono);
  fd.append("direccion", data.direccion);
  fd.append("ciudad", data.ciudad);
  return apiFetch<Candidacy>("/api/elecciones/candidacies/", { method: "POST", body: fd });
}

export function apiRegisterSubstitute(
  candidacyId: string,
  email: string,
  documentoIdentidad: string,
  termsAccepted: boolean,
  image?: File,
) {
  const fd = new FormData();
  fd.append("email", email);
  fd.append("documento_identidad", documentoIdentidad);
  fd.append("terms_accepted", termsAccepted ? "true" : "false");
  if (image) fd.append("image", image);
  return apiFetch(`/api/elecciones/candidacies/${candidacyId}/substitute/`, { method: "POST", body: fd });
}

export const apiEndorseCandidacy = (candidacyId: string, note = "") =>
  apiFetch(`/api/elecciones/candidacies/${candidacyId}/endorsements/`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const apiListEndorsableCandidacies = () =>
  apiFetch<Candidacy[]>("/api/elecciones/candidacies/postulantes/");

export const apiGetVotableBallots = (collegiate?: string) =>
  apiFetch<Ballot[]>(
    `/api/elecciones/ballots/${collegiate ? `?collegiate=${encodeURIComponent(collegiate)}` : ""}`,
  );

export const apiCastVote = (payload: { collegiate: string; ballot?: string | null; is_blank: boolean }) =>
  apiFetch<{ detail: string }>("/api/elecciones/vote/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const apiRegisterObserver = (collegiate?: string | null) =>
  apiFetch<Observer>("/api/elecciones/observers/", {
    method: "POST",
    body: JSON.stringify({ collegiate: collegiate ?? null }),
  });

export const apiListActiveRoles = () =>
  apiFetch<ElectionRole[] | { results: ElectionRole[] }>("/api/elecciones/roles/activos/");

export const apiListActiveAcademicPrograms = () =>
  apiFetch<AcademicProgram[] | { results: AcademicProgram[] }>("/api/elecciones/programas-academicos/activos/");

export const apiListEligibleCollegiates = (roleId: string) =>
  apiFetch<Collegiate[]>(`/api/elecciones/colegiados-elegibles/?role=${encodeURIComponent(roleId)}`);

export const apiGetMyAcademicRegistrations = () =>
  apiFetch<ParticipantRole[]>("/api/elecciones/me/registro-academico/");

export function apiSubmitAcademicRegistration(data: {
  role: string;
  facultad?: string;
  programa?: string;
  curriculum?: string;
  semestre?: number | null;
  collegiate?: string;
  documento_identidad: string;
  image: File;
  fecha_nacimiento: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  ocupacion_actual?: string;
  work_plan_pdf: File;
  suplente_email: string;
  suplente_documento_identidad: string;
  suplente_image?: File;
  terms_accepted: boolean;
}): Promise<ParticipantRole> {
  const fd = new FormData();
  fd.append("role", data.role);
  if (data.facultad) fd.append("facultad", data.facultad);
  if (data.programa) fd.append("programa", data.programa);
  if (data.curriculum) fd.append("curriculum", data.curriculum);
  if (data.semestre != null) fd.append("semestre", String(data.semestre));
  if (data.collegiate) fd.append("collegiate", data.collegiate);
  fd.append("documento_identidad", data.documento_identidad);
  fd.append("image", data.image);
  fd.append("fecha_nacimiento", data.fecha_nacimiento);
  fd.append("telefono", data.telefono);
  fd.append("direccion", data.direccion);
  fd.append("ciudad", data.ciudad);
  if (data.ocupacion_actual) fd.append("ocupacion_actual", data.ocupacion_actual);
  fd.append("work_plan_pdf", data.work_plan_pdf);
  fd.append("suplente_email", data.suplente_email);
  fd.append("suplente_documento_identidad", data.suplente_documento_identidad);
  if (data.suplente_image) fd.append("suplente_image", data.suplente_image);
  fd.append("terms_accepted", data.terms_accepted ? "true" : "false");
  return apiFetch<ParticipantRole>("/api/elecciones/me/registro-academico/", { method: "POST", body: fd });
}

export function apiCompleteCandidacy(candidacyId: string, data: {
  image?: File;
  work_plan_pdf?: File;
  proposal?: string;
  action_plan?: string;
  documento_identidad: string;
  fecha_nacimiento: string;
  telefono: string;
  direccion: string;
  ciudad: string;
}): Promise<Candidacy> {
  const fd = new FormData();
  if (data.image) fd.append("image", data.image);
  if (data.work_plan_pdf) fd.append("work_plan_pdf", data.work_plan_pdf);
  if (data.proposal) fd.append("proposal", data.proposal);
  if (data.action_plan) fd.append("action_plan", data.action_plan);
  fd.append("documento_identidad", data.documento_identidad);
  fd.append("fecha_nacimiento", data.fecha_nacimiento);
  fd.append("telefono", data.telefono);
  fd.append("direccion", data.direccion);
  fd.append("ciudad", data.ciudad);
  return apiFetch<Candidacy>(`/api/elecciones/candidacies/${candidacyId}/completar/`, { method: "PATCH", body: fd });
}

export const apiGetResults = (period?: string) =>
  apiFetch<{ period: string; results_published: boolean; collegiates: CollegiateTally[] }>(
    `/api/elecciones/results/${period ? `?period=${encodeURIComponent(period)}` : ""}`,
  );

// ── Admin ─────────────────────────────────────────────────────

export const apiGetElectionConfig = () =>
  apiFetch<ElectionConfig>("/api/elecciones/config/");

export const apiUpdateElectionConfig = (patch: Partial<ElectionConfig>) =>
  apiFetch<ElectionConfig>("/api/elecciones/config/", { method: "PATCH", body: JSON.stringify(patch) });

export const apiListPeriods = () =>
  apiFetch<ElectoralPeriod[] | { results: ElectoralPeriod[] }>("/api/elecciones/periods/");

export const apiCreatePeriod = (data: Partial<ElectoralPeriod>) =>
  apiFetch<ElectoralPeriod>("/api/elecciones/periods/", { method: "POST", body: JSON.stringify(data) });

export const apiUpdatePeriod = (id: string, data: Partial<ElectoralPeriod>) =>
  apiFetch<ElectoralPeriod>(`/api/elecciones/periods/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const apiDeletePeriod = (id: string) =>
  apiFetch<void>(`/api/elecciones/periods/${id}/`, { method: "DELETE" });

export const apiClosePeriod = (id: string) =>
  apiFetch<ElectoralPeriod>(`/api/elecciones/periods/${id}/close/`, { method: "POST" });

export const apiGenerateBallots = (periodId: string) =>
  apiFetch<{ generated: number; skipped: Array<{ candidacy_id: string; reason: string }> }>(
    `/api/elecciones/periods/${periodId}/ballots/generate/`,
    { method: "POST" },
  );

// ── Actas y certificados (PDF) ───────────────────────────────────────────────

async function downloadPdf(path: string, filename: string) {
  const token = tokens.getAccess();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `Error al generar el PDF (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const apiDownloadActaEscrutinio = (periodId: string, periodName: string) =>
  downloadPdf(`/api/elecciones/periods/${periodId}/acta/`, `acta_escrutinio_${periodName}.pdf`);

export const apiDownloadCertificado = (candidacyId: string, candidateName: string) =>
  downloadPdf(`/api/elecciones/candidacies/${candidacyId}/certificado/`, `certificado_${candidateName}.pdf`);

export const apiDownloadCandidacySheet = (candidacyId: string, candidateName: string) =>
  downloadPdf(`/api/elecciones/candidacies/${candidacyId}/ficha/`, `ficha_candidatura_${candidateName}.pdf`);


export const apiGetAdminResults = (periodId: string) =>
  apiFetch<{ period: string; collegiates: CollegiateTally[] }>(
    `/api/elecciones/periods/${periodId}/results/`,
  );

export function apiImportParticipants(periodId: string, file: File): Promise<ImportReport> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<ImportReport>(`/api/elecciones/periods/${periodId}/participants/import/`, {
    method: "POST",
    body: fd,
  });
}

export const apiListRolesElectorales = () =>
  apiFetch<ElectionRole[] | { results: ElectionRole[] }>("/api/elecciones/roles/");

export const apiCreateRoleElectoral = (data: Partial<ElectionRole>) =>
  apiFetch<ElectionRole>("/api/elecciones/roles/", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateRoleElectoral = (id: string, data: Partial<ElectionRole>) =>
  apiFetch<ElectionRole>(`/api/elecciones/roles/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const apiListCollegiates = (period?: string) =>
  apiFetch<Collegiate[] | { results: Collegiate[] }>(
    `/api/elecciones/collegiates/${period ? `?period=${encodeURIComponent(period)}` : ""}`,
  );

export const apiCreateCollegiate = (data: Partial<Collegiate>) =>
  apiFetch<Collegiate>("/api/elecciones/collegiates/", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateCollegiate = (id: string, data: Partial<Collegiate>) =>
  apiFetch<Collegiate>(`/api/elecciones/collegiates/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const apiDeleteCollegiate = (id: string) =>
  apiFetch<void>(`/api/elecciones/collegiates/${id}/`, { method: "DELETE" });

export const apiListAcademicPrograms = () =>
  apiFetch<AcademicProgram[] | { results: AcademicProgram[] }>("/api/elecciones/programas-academicos/");

export const apiCreateAcademicProgram = (data: Partial<AcademicProgram>) =>
  apiFetch<AcademicProgram>("/api/elecciones/programas-academicos/", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateAcademicProgram = (id: string, data: Partial<AcademicProgram>) =>
  apiFetch<AcademicProgram>(`/api/elecciones/programas-academicos/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const apiDeleteAcademicProgram = (id: string) =>
  apiFetch<void>(`/api/elecciones/programas-academicos/${id}/`, { method: "DELETE" });

export const apiListParticipants = (period?: string) =>
  apiFetch<Participant[] | { results: Participant[] }>(
    `/api/elecciones/participants/${period ? `?period=${encodeURIComponent(period)}` : ""}`,
  );

export const apiListPendingAcademicRegistrations = (periodId: string) =>
  apiFetch<ParticipantRole[] | { results: ParticipantRole[] }>(
    `/api/elecciones/registro-academico/pendientes/?period=${encodeURIComponent(periodId)}`,
  );

export const apiReviewAcademicRegistration = (
  id: string, action: "aprobar" | "rechazar", notes = "", collegiate?: string,
) =>
  apiFetch<{ registration: ParticipantRole; candidacy_granted: Candidacy | null; possible_collegiates: Collegiate[] }>(
    `/api/elecciones/registro-academico/${id}/revisar/`,
    { method: "POST", body: JSON.stringify({ action, notes, collegiate }) },
  );


export const apiListAdminCandidacies = (period?: string, status?: string) => {
  const qs = new URLSearchParams();
  if (period) qs.set("period", period);
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Candidacy[] | { results: Candidacy[] }>(`/api/elecciones/candidacies/admin/${suffix}`);
};

export const apiReviewCandidacy = (id: string, action: "publish" | "reject", notes = "") =>
  apiFetch<Candidacy>(`/api/elecciones/candidacies/${id}/review/`, {
    method: "PATCH",
    body: JSON.stringify({ action, notes }),
  });

export const apiGenerateBallotForCandidacy = (id: string) =>
  apiFetch<Ballot>(`/api/elecciones/candidacies/${id}/ballot/`, { method: "POST" });

export const apiListAdminObservers = (period?: string, status?: string) => {
  const qs = new URLSearchParams();
  if (period) qs.set("period", period);
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Observer[] | { results: Observer[] }>(`/api/elecciones/observers/admin/${suffix}`);
};

export const apiReviewObserver = (id: string, action: "approve" | "reject", notes = "") =>
  apiFetch<Observer>(`/api/elecciones/observers/${id}/review/`, {
    method: "PATCH",
    body: JSON.stringify({ action, notes }),
  });

// ── WebSocket de resultados en vivo ───────────────────────────

/**
 * Abre un WebSocket al escrutinio en vivo de un período. El token JWT se pasa
 * como query param (igual que el chat de tickets). Devuelve la instancia para
 * que el llamador registre onmessage/onclose y la cierre al desmontar.
 */
export function openResultsSocket(periodId: string): WebSocket {
  const base = API_BASE.replace(/^http/, "ws");
  const token = tokens.getAccess() ?? "";
  return new WebSocket(`${base}/ws/elecciones/${periodId}/resultados/?token=${encodeURIComponent(token)}`);
}

/** Normaliza respuestas que pueden venir como array directo o paginadas {results}. */
export function unwrapList<T>(res: T[] | { results: T[] }): T[] {
  return Array.isArray(res) ? res : res.results ?? [];
}
