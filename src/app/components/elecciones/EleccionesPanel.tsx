/**
 * EleccionesPanel.tsx
 * Panel del estudiante para el módulo de elecciones: postulación, votación,
 * resultados y veeduría. Se muestra dentro del panel de usuario de NOVA.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Vote as VoteIcon, UserPlus, BarChart3, Eye, Loader2, AlertCircle,
  CheckCircle2, Info, ThumbsUp, FileDown, Check, X, ClipboardCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ResultadosEnVivo } from "./ResultadosEnVivo";
import { useAuth } from "../../context/AuthContext";
import {
  apiGetActivePeriod, apiGetMyEligibility, apiGetMyCandidacy, apiGetMyVotes,
  apiCreateCandidacy, apiCompleteCandidacy, apiRegisterSubstitute, apiGetVotableBallots, apiCastVote,
  apiRegisterObserver, apiListEndorsableCandidacies, apiEndorseCandidacy,
  apiDownloadCandidacySheet, apiGetMyAcademicRegistrations, apiListActiveRoles, apiSubmitAcademicRegistration,
  apiListAdminObservers, apiReviewObserver,
  apiListPendingAcademicRegistrations, apiReviewAcademicRegistration, apiListEligibleCollegiates,
  unwrapList,
  type ActivePeriodInfo, type EligibilityResult, type Candidacy, type Ballot,
  type ParticipantRole, type ElectionRole, type Observer, type Collegiate,
} from "../../lib/eleccionesApi";
import { API_BASE, formatApiError, ApiError } from "../../lib/api";
import { cn } from "../../lib/utils";

type SubTab = "postular" | "validar_registros" | "avalar" | "votar" | "resultados" | "veeduria" | "validar_veedores";

function resolveImg(url?: string | null): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export function EleccionesPanel() {
  const { usuario } = useAuth();
  const roleCodes = (usuario?.roles ?? []).map((r) => r.trim().toUpperCase());
  const esRegistroControl = roleCodes.includes("REGISTRO_CONTROL");
  const puedeAvalar = usuario?.is_staff || roleCodes.includes("ADMIN") || esRegistroControl;
  // Registro y Control solo valida (candidatos/veedores) y consulta resultados; no se inscribe ni vota aquí.
  // Estudiantes, docentes y administrativos pueden postularse/votar (cada uno para
  // su propio rol/colegiado); también coordinadores y demás cuentas de área
  // (identificadas por dependencyId, igual que en el guard de la ruta /elecciones),
  // ya que la elegibilidad real por colegiado la valida el backend. Registro y
  // Control queda excluido de este flujo.
  const esEstudiante =
    (["estudiante", "docente", "admin_area"].includes(usuario?.perfil_tipo ?? "") || !!usuario?.dependencyId) &&
    !esRegistroControl;
  const [info, setInfo] = useState<ActivePeriodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SubTab>(esEstudiante ? "postular" : "avalar");

  useEffect(() => {
    apiGetActivePeriod()
      .then(setInfo)
      .catch(() => setInfo({ active: false, detail: "No hay periodo electoral activo." }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Cargando módulo de elecciones…
      </div>
    );
  }

  if (!info?.active || !info.period) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-gray-400" />
          <p className="text-lg font-medium text-gray-700">No hay periodo electoral activo</p>
          <p className="text-sm text-gray-500">Vuelve cuando se habilite un proceso electoral.</p>
        </CardContent>
      </Card>
    );
  }

  if (!info.is_institutional) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500" />
          <p className="text-lg font-medium text-gray-700">Acceso restringido</p>
          <p className="max-w-md text-sm text-gray-500">
            Solo las cuentas con correo institucional pueden participar en las elecciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!info.is_participant) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Info className="h-10 w-10 text-blue-400" />
          <p className="text-lg font-medium text-gray-700">No estás habilitado para este proceso</p>
          <p className="max-w-md text-sm text-gray-500">
            Tu cuenta no figura en el padrón del período <strong>{info.period.name}</strong>.
            Si crees que es un error, comunícate con la administración.
          </p>
        </CardContent>
      </Card>
    );
  }

  const stages = info.stages!;
  const tabs: Array<{ id: SubTab; label: string; icon: ReactNode; show: boolean }> = [
    { id: "postular", label: "Inscribirme", icon: <UserPlus className="h-4 w-4" />, show: esEstudiante },
    { id: "validar_registros", label: "Validar registros", icon: <ClipboardCheck className="h-4 w-4" />, show: puedeAvalar },
    { id: "avalar", label: "Validar candidatos", icon: <ThumbsUp className="h-4 w-4" />, show: puedeAvalar },
    { id: "votar", label: "Votar", icon: <VoteIcon className="h-4 w-4" />, show: esEstudiante },
    { id: "validar_veedores", label: "Validar veedores", icon: <Eye className="h-4 w-4" />, show: puedeAvalar },
    { id: "resultados", label: "Resultados", icon: <BarChart3 className="h-4 w-4" />, show: true },
    { id: "veeduria", label: "Veeduría", icon: <Eye className="h-4 w-4" />, show: esEstudiante },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <strong>{info.period.name}</strong> · Inscripción {stages.inscription_open ? "abierta" : "cerrada"} ·
        Votación {stages.voting_open ? "abierta" : "cerrada"}
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "postular" && <PostularSection inscriptionOpen={stages.inscription_open} />}
      {tab === "validar_registros" && <ValidarRegistrosSection periodId={info.period.id} />}
      {tab === "avalar" && <AvalarSection inscriptionOpen={stages.inscription_open} />}
      {tab === "votar" && <VotarSection votingOpen={stages.voting_open} />}
      {tab === "validar_veedores" && <ValidarVeedoresSection periodId={info.period.id} />}
      {tab === "resultados" && <ResultadosEnVivo periodId={info.period.id} />}
      {tab === "veeduria" && <VeeduriaSection observersOpen={stages.observers_open} />}
    </div>
  );
}

// ── Sección: Postulación ──────────────────────────────────────

function PostularSection({ inscriptionOpen }: { inscriptionOpen: boolean }) {
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [candidacy, setCandidacy] = useState<Candidacy | null>(null);
  const [academicReg, setAcademicReg] = useState<ParticipantRole | null>(null);
  const [roles, setRoles] = useState<ElectionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [collegiate, setCollegiate] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [workPlanPdf, setWorkPlanPdf] = useState<File | null>(null);

  // Datos personales requeridos por Registro y Control.
  const [documentoIdentidad, setDocumentoIdentidad] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");

  // Autoregistro académico (reemplaza la carga por Excel del padrón); es a la vez el
  // formulario único de postulación a candidato (datos personales + plan de trabajo).
  const [regRole, setRegRole] = useState("");
  const [regSemestre, setRegSemestre] = useState("");
  const [regDocumento, setRegDocumento] = useState("");
  const [regImage, setRegImage] = useState<File | null>(null);
  const [regFechaNacimiento, setRegFechaNacimiento] = useState("");
  const [regTelefono, setRegTelefono] = useState("");
  const [regDireccion, setRegDireccion] = useState("");
  const [regCiudad, setRegCiudad] = useState("");
  const [regOcupacionActual, setRegOcupacionActual] = useState("");
  const [regWorkPlanPdf, setRegWorkPlanPdf] = useState<File | null>(null);
  const [regSuplenteEmail, setRegSuplenteEmail] = useState("");
  const [regSuplenteDocumento, setRegSuplenteDocumento] = useState("");
  const [regSuplenteImage, setRegSuplenteImage] = useState<File | null>(null);
  const [regTermsAccepted, setRegTermsAccepted] = useState(false);
  const [eligibleCollegiates, setEligibleCollegiates] = useState<Collegiate[]>([]);
  const [regCollegiateId, setRegCollegiateId] = useState("");
  const [regFieldErrors, setRegFieldErrors] = useState<Record<string, string[]>>({});

  const [subEmail, setSubEmail] = useState("");
  const [subDocumento, setSubDocumento] = useState("");
  const [subImage, setSubImage] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [elig, myCand, regs, activeRoles] = await Promise.all([
        apiGetMyEligibility(), apiGetMyCandidacy(), apiGetMyAcademicRegistrations(), apiListActiveRoles(),
      ]);
      setEligibility(elig);
      setCandidacy(myCand.candidacy);
      setAcademicReg(regs[0] ?? null);
      setRoles(unwrapList(activeRoles));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mensaje de error de un campo del autoregistro devuelto por el backend (DRF),
  // para resaltar la casilla exacta en vez de un mensaje genérico.
  const regErr = (field: string): string | undefined => {
    const value = regFieldErrors[field];
    if (!value) return undefined;
    return Array.isArray(value) ? value.join(", ") : String(value);
  };
  const regErrClass = (field: string) => (regErr(field) ? "border-red-500 focus-visible:ring-red-500" : undefined);

  // El campo "ocupación actual" solo aplica al rol de Representante de Egresados.
  const regSelectedRole = roles.find((r) => r.id === regRole);
  const regEsEgresado = regSelectedRole?.code === "REP_EGR";

  // Un mismo rol puede tener varios comés/consejos posibles (Consejo Académico
  // general, Consejo de Facultad de cada escuela, Comité Curricular/Investigación
  // de cada programa, Bienestar Universitario); se listan TODOS apenas se elige el
  // rol, para que el estudiante apunte directamente a cuál se postula sin tener
  // que completar antes facultad/programa.
  useEffect(() => {
    setRegCollegiateId("");
    if (!regRole) {
      setEligibleCollegiates([]);
      return;
    }
    apiListEligibleCollegiates(regRole)
      .then(setEligibleCollegiates)
      .catch(() => setEligibleCollegiates([]));
  }, [regRole]);

  const onSubmitAcademicRegistration = async () => {
    if (!regRole) {
      setRegFieldErrors({ role: ["Selecciona tu rol electoral."] });
      toast.error("Selecciona tu rol electoral.");
      return;
    }
    if (eligibleCollegiates.length > 1 && !regCollegiateId) {
      setRegFieldErrors({ collegiate: ["Selecciona a qué comité/consejo te postulas."] });
      toast.error("Selecciona a qué comité/consejo te postulas.");
      return;
    }
    if (eligibleCollegiates.length === 0) {
      toast.error("No hay comités/consejos configurados para este rol.");
      return;
    }
    if (!regImage) {
      setRegFieldErrors({ image: ["Adjunta tu foto."] });
      toast.error("Adjunta tu foto.");
      return;
    }
    if (!regDocumento.trim() || !regFechaNacimiento || !regTelefono.trim() || !regDireccion.trim() || !regCiudad.trim()) {
      setRegFieldErrors({
        ...(!regDocumento.trim() && { documento_identidad: ["Ingresa tu cédula."] }),
        ...(!regFechaNacimiento && { fecha_nacimiento: ["Ingresa tu fecha de nacimiento."] }),
        ...(!regTelefono.trim() && { telefono: ["Ingresa tu teléfono."] }),
        ...(!regDireccion.trim() && { direccion: ["Ingresa tu dirección."] }),
        ...(!regCiudad.trim() && { ciudad: ["Ingresa tu ciudad."] }),
      });
      toast.error("Completa tus datos personales: cédula, fecha de nacimiento, teléfono, dirección y ciudad.");
      return;
    }
    if (regEsEgresado && !regOcupacionActual.trim()) {
      setRegFieldErrors({ ocupacion_actual: ["Indica a qué te dedicas actualmente."] });
      toast.error("Indica a qué te dedicas actualmente.");
      return;
    }
    if (!regWorkPlanPdf) {
      setRegFieldErrors({ work_plan_pdf: ["Adjunta tu plan de trabajo en PDF."] });
      toast.error("Adjunta tu plan de trabajo en PDF.");
      return;
    }
    if (!regSuplenteEmail.trim() || regSuplenteDocumento.trim().length < 5) {
      setRegFieldErrors({
        ...(!regSuplenteEmail.trim() && { suplente_email: ["Ingresa el correo institucional del suplente."] }),
        ...(regSuplenteDocumento.trim().length < 5 && {
          suplente_documento_identidad: ["Ingresa una cédula válida para el suplente."],
        }),
      });
      toast.error("Indica el correo institucional y la cédula de tu suplente.");
      return;
    }
    if (!regTermsAccepted) {
      toast.error("Debes aceptar los términos y condiciones de inscripción de la candidatura.");
      return;
    }
    setSubmitting(true);
    setRegFieldErrors({});
    try {
      await apiSubmitAcademicRegistration({
        role: regRole,
        semestre: regSemestre ? Number(regSemestre) : null,
        collegiate: regCollegiateId || (eligibleCollegiates.length === 1 ? eligibleCollegiates[0].id : undefined),
        documento_identidad: regDocumento.trim(), image: regImage,
        fecha_nacimiento: regFechaNacimiento,
        telefono: regTelefono.trim(),
        direccion: regDireccion.trim(),
        ciudad: regCiudad.trim(),
        ocupacion_actual: regEsEgresado ? regOcupacionActual.trim() : undefined,
        work_plan_pdf: regWorkPlanPdf,
        suplente_email: regSuplenteEmail.trim(),
        suplente_documento_identidad: regSuplenteDocumento.trim(),
        suplente_image: regSuplenteImage ?? undefined,
        terms_accepted: regTermsAccepted,
      });
      toast.success(
        "Postulación enviada (con tu suplente). Queda pendiente de revisión por Registro y Control.",
      );
      await load();
    } catch (e) {
      if (e instanceof ApiError) setRegFieldErrors(e.data as Record<string, string[]>);
      toast.error("No se pudo enviar el registro", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const onCompleteCandidacy = async () => {
    if (!candidacy || (!image && !candidacy.image) || (!workPlanPdf && !candidacy.work_plan_pdf)) {
      toast.error("Completa la foto y el plan de trabajo en PDF.");
      return;
    }
    if (!documentoIdentidad.trim() || !fechaNacimiento || !telefono.trim() || !direccion.trim() || !ciudad.trim()) {
      toast.error("Completa tus datos personales: cédula, fecha de nacimiento, teléfono, dirección y ciudad.");
      return;
    }
    setSubmitting(true);
    try {
      await apiCompleteCandidacy(candidacy.id, {
        image: image ?? undefined, work_plan_pdf: workPlanPdf ?? undefined,
        documento_identidad: documentoIdentidad.trim(),
        fecha_nacimiento: fechaNacimiento,
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
      });
      toast.success("Candidatura completada. Registro y Control puede avalarla para publicarla.");
      await load();
    } catch (e) {
      toast.error("No se pudo completar la candidatura", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitCandidacy = async () => {
    if (!collegiate || !image || !workPlanPdf) {
      toast.error("Completa colegiado, foto y el plan de trabajo en PDF.");
      return;
    }
    if (!documentoIdentidad.trim() || !fechaNacimiento || !telefono.trim() || !direccion.trim() || !ciudad.trim()) {
      toast.error("Completa tus datos personales: cédula, fecha de nacimiento, teléfono, dirección y ciudad.");
      return;
    }
    setSubmitting(true);
    try {
      await apiCreateCandidacy({
        collegiate, image, work_plan_pdf: workPlanPdf,
        documento_identidad: documentoIdentidad.trim(),
        fecha_nacimiento: fechaNacimiento,
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
      });
      toast.success("Inscripción registrada. Ahora registra tu suplente; un candidato oficial solo se confirma cuando Registro y Control lo valide.");
      await load();
    } catch (e) {
      toast.error("No se pudo inscribir", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitSubstitute = async () => {
    if (!candidacy || !subEmail.trim() || subDocumento.trim().length < 5) {
      toast.error("Indica el correo institucional y la cédula del suplente.");
      return;
    }
    if (!termsAccepted) {
      toast.error("Debes aceptar los términos y condiciones de inscripción de la candidatura.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRegisterSubstitute(candidacy.id, subEmail.trim(), subDocumento.trim(), termsAccepted, subImage ?? undefined);
      toast.success("Suplente registrado.");
      await load();
    } catch (e) {
      toast.error("No se pudo registrar el suplente", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  // Candidatura otorgada automáticamente al aprobar el registro académico, pero
  // aún falta foto/propuesta/plan de acción/datos personales.
  if (candidacy && !candidacy.is_complete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completa tu candidatura</CardTitle>
          <p className="text-sm text-gray-500">
            Registro y Control aprobó tu registro académico y te otorgó la candidatura a{" "}
            <strong>{candidacy.collegiate_name}</strong>. Falta tu propuesta y plan de acción para poder
            publicarla.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Foto{candidacy.image ? " (ya registrada, opcional cambiarla)" : ""}</Label>
            {candidacy.image && (
              <img src={resolveImg(candidacy.image)} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="mb-3 text-sm font-medium text-blue-800">
              Datos personales para Registro y Control Académico
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cédula / documento de identidad</Label>
                <Input value={documentoIdentidad} onChange={(e) => setDocumentoIdentidad(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono de contacto</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ciudad de residencia</Label>
                <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Dirección de residencia</Label>
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plan de trabajo (PDF){candidacy.work_plan_pdf ? " (ya registrado, opcional reemplazarlo)" : ""}</Label>
            {candidacy.work_plan_pdf && (
              <a href={resolveImg(candidacy.work_plan_pdf)} target="_blank" rel="noreferrer"
                className="block text-sm text-blue-600 underline">Ver PDF actual</a>
            )}
            <Input type="file" accept="application/pdf" onChange={(e) => setWorkPlanPdf(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={onCompleteCandidacy} disabled={submitting || !inscriptionOpen}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Completar candidatura
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Ya tiene candidatura → mostrar estado + suplente.
  if (candidacy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {candidacy.status === "INSCRITO" ? "Mi inscripción" : "Mi candidatura"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {candidacy.image && (
              <img src={resolveImg(candidacy.image)} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div>
              <p className="font-medium">{candidacy.collegiate_name}</p>
              <p className="text-sm text-gray-500">Estado: {candidacy.status_display ?? candidacy.status}</p>
            </div>
          </div>

          {candidacy.status === "INSCRITO" && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <Info className="h-4 w-4 shrink-0" /> Tu inscripción está pendiente de validación por Registro y
              Control. Solo serás candidato oficial cuando la validen.
            </div>
          )}

          <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <p><span className="text-gray-500">Cédula:</span> {candidacy.documento_identidad || "—"}</p>
            <p><span className="text-gray-500">Fecha de nacimiento:</span> {candidacy.fecha_nacimiento || "—"}</p>
            <p><span className="text-gray-500">Teléfono:</span> {candidacy.telefono || "—"}</p>
            <p><span className="text-gray-500">Ciudad:</span> {candidacy.ciudad || "—"}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Dirección:</span> {candidacy.direccion || "—"}</p>
          </div>

          {!candidacy.substitute ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertCircle className="h-4 w-4" /> Debes registrar un suplente antes de generar el tarjetón.
              </p>
              <div className="space-y-2">
                <Label>Correo del suplente</Label>
                <Input type="email" value={subEmail} onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="correo@uniautonoma.edu.co" />
                <Label>Cédula del suplente</Label>
                <Input value={subDocumento} onChange={(e) => setSubDocumento(e.target.value)} />
                <Label>Foto del suplente (opcional)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setSubImage(e.target.files?.[0] ?? null)} />

                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600">
                  Nosotros, <strong>{candidacy.participant_name || "—"}</strong>, con cédula{" "}
                  <strong>{candidacy.documento_identidad || "—"}</strong>, como Candidato Principal, y quien acredite
                  el correo <strong>{subEmail.trim() || "—"}</strong>, con cédula{" "}
                  <strong>{subDocumento.trim() || "—"}</strong>, como Candidato Suplente, inscribimos nuestra
                  candidatura como representantes al <strong>{candidacy.collegiate_name || "—"}</strong>, allegando
                  los requisitos contemplados en el artículo 3 del Acuerdo 007 del 3 de marzo de 2004.
                </div>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-1" checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)} />
                  He leído y acepto los términos y condiciones de inscripción anteriores.
                </label>

                <Button onClick={onSubmitSubstitute} disabled={submitting || !inscriptionOpen}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar suplente
                </Button>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Suplente: {candidacy.substitute.participant_name}
              {candidacy.substitute.documento_identidad ? ` (C.C. ${candidacy.substitute.documento_identidad})` : ""}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // No elegible → motivo explícito, con la acción correspondiente.
  if (!eligibility?.eligible) {
    const reason = eligibility?.reason;

    if (reason === "SIN_REGISTRO_ACADEMICO" || reason === "REGISTRO_ACADEMICO_RECHAZADO") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Postularme como candidato</CardTitle>
            <p className="text-sm text-gray-500">
              Indica tu facultad, programa y currículo, tus datos personales, tu plan de trabajo y los datos de
              tu candidato suplente. Registro y Control revisa esta información y, si coincide con un colegiado
              activo, te otorga la candidatura (con suplente ya registrado) directamente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {reason === "REGISTRO_ACADEMICO_RECHAZADO" && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" /> {eligibility?.detail}
              </div>
            )}
            <div className="space-y-2">
              <Label>Rol electoral</Label>
              <select className={cn("w-full rounded-md border border-gray-300 px-3 py-2 text-sm", regErr("role") && "border-red-500")}
                value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                <option value="">Selecciona…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {regErr("role") && <p className="text-xs text-red-600">{regErr("role")}</p>}
            </div>
            {regRole && eligibleCollegiates.length > 1 && (
              <div className="space-y-2">
                <Label>Comité / consejo al que te postulas</Label>
                <select className={cn("w-full rounded-md border border-gray-300 px-3 py-2 text-sm", regErr("collegiate") && "border-red-500")}
                  value={regCollegiateId} onChange={(e) => setRegCollegiateId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {eligibleCollegiates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {regErr("collegiate") && <p className="text-xs text-red-600">{regErr("collegiate")}</p>}
              </div>
            )}
            {regRole && eligibleCollegiates.length === 1 && (
              <p className="text-sm text-gray-500">
                Te postulas a: <strong>{eligibleCollegiates[0].name}</strong>
              </p>
            )}
            <div className="space-y-2">
              <Label>Foto</Label>
              <Input type="file" accept="image/*" className={regErrClass("image")}
                onChange={(e) => setRegImage(e.target.files?.[0] ?? null)} />
              {regErr("image") && <p className="text-xs text-red-600">{regErr("image")}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cédula / documento de identidad</Label>
                <Input value={regDocumento} className={regErrClass("documento_identidad")}
                  onChange={(e) => setRegDocumento(e.target.value)} />
                {regErr("documento_identidad") && <p className="text-xs text-red-600">{regErr("documento_identidad")}</p>}
              </div>
              <div className="space-y-2">
                <Label>Semestre (si aplica)</Label>
                <Input type="number" min={1} value={regSemestre} className={regErrClass("semestre")}
                  onChange={(e) => setRegSemestre(e.target.value)} />
                {regErr("semestre") && <p className="text-xs text-red-600">{regErr("semestre")}</p>}
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-medium text-blue-800">
                Datos personales para Registro y Control Académico
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={regFechaNacimiento} className={regErrClass("fecha_nacimiento")}
                    onChange={(e) => setRegFechaNacimiento(e.target.value)} />
                  {regErr("fecha_nacimiento") && <p className="text-xs text-red-600">{regErr("fecha_nacimiento")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Teléfono de contacto</Label>
                  <Input value={regTelefono} className={regErrClass("telefono")}
                    onChange={(e) => setRegTelefono(e.target.value)} />
                  {regErr("telefono") && <p className="text-xs text-red-600">{regErr("telefono")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Ciudad de residencia</Label>
                  <Input value={regCiudad} className={regErrClass("ciudad")}
                    onChange={(e) => setRegCiudad(e.target.value)} />
                  {regErr("ciudad") && <p className="text-xs text-red-600">{regErr("ciudad")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Dirección de residencia</Label>
                  <Input value={regDireccion} className={regErrClass("direccion")}
                    onChange={(e) => setRegDireccion(e.target.value)} />
                  {regErr("direccion") && <p className="text-xs text-red-600">{regErr("direccion")}</p>}
                </div>
                {regEsEgresado && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>¿A qué te dedicas actualmente?</Label>
                    <Input value={regOcupacionActual} className={regErrClass("ocupacion_actual")}
                      placeholder="Ej: Empleado en..., Independiente, Estudios de posgrado..."
                      onChange={(e) => setRegOcupacionActual(e.target.value)} />
                    {regErr("ocupacion_actual") && <p className="text-xs text-red-600">{regErr("ocupacion_actual")}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Plan de trabajo (PDF)</Label>
              <Input type="file" accept="application/pdf" className={regErrClass("work_plan_pdf")}
                onChange={(e) => setRegWorkPlanPdf(e.target.files?.[0] ?? null)} />
              {regErr("work_plan_pdf") && <p className="text-xs text-red-600">{regErr("work_plan_pdf")}</p>}
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-medium text-blue-800">Candidato suplente (obligatorio)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Correo institucional del suplente</Label>
                  <Input type="email" value={regSuplenteEmail} className={regErrClass("suplente_email")}
                    onChange={(e) => setRegSuplenteEmail(e.target.value)} />
                  {regErr("suplente_email") && <p className="text-xs text-red-600">{regErr("suplente_email")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Cédula del suplente</Label>
                  <Input value={regSuplenteDocumento} className={regErrClass("suplente_documento_identidad")}
                    onChange={(e) => setRegSuplenteDocumento(e.target.value)} />
                  {regErr("suplente_documento_identidad") && (
                    <p className="text-xs text-red-600">{regErr("suplente_documento_identidad")}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Foto del suplente (opcional)</Label>
                  <Input type="file" accept="image/*" className={regErrClass("suplente_image")}
                    onChange={(e) => setRegSuplenteImage(e.target.files?.[0] ?? null)} />
                  {regErr("suplente_image") && <p className="text-xs text-red-600">{regErr("suplente_image")}</p>}
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-0.5" checked={regTermsAccepted}
                  onChange={(e) => setRegTermsAccepted(e.target.checked)} />
                <span>
                  Nosotros, el candidato titular y el candidato suplente indicados, aceptamos los términos y
                  condiciones de inscripción de la candidatura.
                </span>
              </label>
              {regErr("terms_accepted") && <p className="text-xs text-red-600">{regErr("terms_accepted")}</p>}
            </div>

            <Button onClick={onSubmitAcademicRegistration} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar postulación
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (reason === "REGISTRO_ACADEMICO_PENDIENTE") {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Info className="h-9 w-9 text-blue-400" />
            <p className="font-medium text-gray-700">Registro académico en revisión</p>
            <p className="max-w-md text-sm text-gray-500">
              Tu registro ({academicReg?.facultad} · {academicReg?.programa} · {academicReg?.curriculum}) está
              pendiente de aprobación por Registro y Control.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-9 w-9 text-amber-500" />
          <p className="font-medium text-gray-700">No cumples las políticas para inscribirte</p>
          <p className="max-w-md text-sm text-gray-500">{eligibility?.detail}</p>
        </CardContent>
      </Card>
    );
  }

  // Elegible → formulario de inscripción.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar inscripción</CardTitle>
        <p className="text-sm text-gray-500">
          Esta inscripción no te convierte en candidato de inmediato: Registro y Control debe validarla
          (avalarla) para que quedes publicado como candidato oficial.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!inscriptionOpen && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La inscripción de candidaturas no está abierta en este momento.
          </div>
        )}
        <div className="space-y-2">
          <Label>Colegiado</Label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={collegiate}
            onChange={(e) => setCollegiate(e.target.value)}
          >
            <option value="">Selecciona un colegiado…</option>
            {eligibility.collegiates.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.curriculum}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Foto</Label>
          <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="mb-3 text-sm font-medium text-blue-800">
            Datos personales para Registro y Control Académico
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cédula / documento de identidad</Label>
              <Input value={documentoIdentidad} onChange={(e) => setDocumentoIdentidad(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de contacto</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ciudad de residencia</Label>
              <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección de residencia</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Plan de trabajo (PDF)</Label>
          <Input type="file" accept="application/pdf" onChange={(e) => setWorkPlanPdf(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={onSubmitCandidacy} disabled={submitting || !inscriptionOpen}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Registrar inscripción
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Sección: Validar registros académicos (previo a poder avalar candidatos) ──

function ValidarRegistrosSection({ periodId }: { periodId: string }) {
  const [pending, setPending] = useState<ParticipantRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [manualAssign, setManualAssign] = useState<Record<string, Collegiate[]>>({});
  const [manualSelected, setManualSelected] = useState<Record<string, string>>({});
  const [detailItem, setDetailItem] = useState<ParticipantRole | null>(null);

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      setPending(unwrapList(await apiListPendingAcademicRegistrations(periodId)));
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: "aprobar" | "rechazar", collegiate?: string) => {
    const notes = action === "rechazar" ? window.prompt("Motivo del rechazo (opcional):") ?? "" : "";
    setReviewingId(id);
    try {
      const res = await apiReviewAcademicRegistration(id, action, notes, collegiate);
      if (action === "rechazar") {
        toast.success("Registro rechazado.");
        setDetailItem((d) => (d?.id === id ? null : d));
        await load();
        return;
      }
      if (res.candidacy_granted) {
        toast.success(`Registro aprobado. Candidatura otorgada a "${res.candidacy_granted.collegiate_name}".`);
        setManualAssign((m) => { const n = { ...m }; delete n[id]; return n; });
        setDetailItem((d) => (d?.id === id ? null : d));
        await load();
      } else if (res.possible_collegiates.length > 0) {
        toast.success("Registro aprobado. Ningún colegiado coincide automáticamente: selecciona uno.");
        setManualAssign((m) => ({ ...m, [id]: res.possible_collegiates }));
      } else {
        toast.error("Registro aprobado, pero no hay colegiados activos para este rol.");
        await load();
      }
    } catch (e) {
      toast.error("No se pudo revisar", { description: formatApiError(e) });
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  if (pending.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          No hay solicitudes de registro académico pendientes.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        Aprueba el registro académico (facultad, programa, currículo y rol) para otorgar la candidatura;
        luego podrás validarla en "Validar candidatos".
      </div>
      {pending.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-center gap-3 py-3">
            {r.image && (
              <img src={resolveImg(r.image)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.participant_name || r.participant_email}</p>
              <p className="truncate text-xs text-gray-500">
                {r.role_name} · {r.facultad} · {r.programa} · {r.curriculum}
                {r.semestre ? ` · Sem. ${r.semestre}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setDetailItem(r)}>
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle>{detailItem.participant_name || detailItem.participant_email}</DialogTitle>
                <DialogDescription>Registro académico pendiente de validación</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {detailItem.image && (
                    <img src={resolveImg(detailItem.image)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    <p><span className="text-gray-500">Correo:</span> {detailItem.participant_email || "—"}</p>
                    <p><span className="text-gray-500">Rol:</span> {detailItem.role_name || "—"}</p>
                    <p><span className="text-gray-500">Facultad:</span> {detailItem.facultad || "—"}</p>
                    <p><span className="text-gray-500">Programa:</span> {detailItem.programa || "—"}</p>
                    <p><span className="text-gray-500">Currículo:</span> {detailItem.curriculum || "—"}</p>
                    <p><span className="text-gray-500">Semestre:</span> {detailItem.semestre ?? "—"}</p>
                    <p><span className="text-gray-500">Teléfono:</span> {detailItem.telefono || "—"}</p>
                    <p><span className="text-gray-500">Ciudad:</span> {detailItem.ciudad || "—"}</p>
                    <p><span className="text-gray-500">Dirección:</span> {detailItem.direccion || "—"}</p>
                    <p><span className="text-gray-500">Fecha nacimiento:</span> {detailItem.fecha_nacimiento || "—"}</p>
                    {detailItem.ocupacion_actual && (
                      <p className="sm:col-span-2"><span className="text-gray-500">Ocupación actual:</span> {detailItem.ocupacion_actual}</p>
                    )}
                  </div>
                </div>

                {detailItem.suplente_email && (
                  <p className="rounded-lg bg-gray-50 p-2 text-sm text-gray-600">
                    Suplente: {detailItem.suplente_email}
                    {detailItem.suplente_documento_identidad ? ` (C.C. ${detailItem.suplente_documento_identidad})` : ""}
                  </p>
                )}

                {detailItem.work_plan_pdf ? (
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">Plan de trabajo</p>
                    <iframe
                      src={resolveImg(detailItem.work_plan_pdf)}
                      title="Previsualización del plan de trabajo"
                      className="h-[420px] w-full rounded-lg border border-gray-200"
                    />
                    <a href={resolveImg(detailItem.work_plan_pdf)} target="_blank" rel="noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 underline">
                      Abrir en una pestaña nueva
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No se adjuntó plan de trabajo.</p>
                )}

                {manualAssign[detailItem.id] && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                    <span className="text-amber-800">Ningún colegiado coincide: asigna uno manualmente:</span>
                    <select className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      value={manualSelected[detailItem.id] ?? ""}
                      onChange={(e) => setManualSelected((m) => ({ ...m, [detailItem.id]: e.target.value }))}>
                      <option value="">Selecciona un colegiado…</option>
                      {manualAssign[detailItem.id].map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" disabled={!manualSelected[detailItem.id] || reviewingId === detailItem.id}
                      onClick={() => review(detailItem.id, "aprobar", manualSelected[detailItem.id])}>
                      Asignar colegiado
                    </Button>
                  </div>
                )}
              </div>

              {!manualAssign[detailItem.id] && (
                <DialogFooter>
                  <Button variant="outline" className="text-red-600 hover:text-red-700"
                    onClick={() => review(detailItem.id, "rechazar")} disabled={reviewingId === detailItem.id}>
                    <X className="mr-1 h-4 w-4" /> Rechazar
                  </Button>
                  <Button onClick={() => review(detailItem.id, "aprobar")} disabled={reviewingId === detailItem.id}>
                    <Check className="mr-1 h-4 w-4" /> Aprobar
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sección: Avales ───────────────────────────────────────────

function AvalarSection({ inscriptionOpen }: { inscriptionOpen: boolean }) {
  const [candidacies, setCandidacies] = useState<Candidacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [endorsing, setEndorsing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCandidacies(await apiListEndorsableCandidacies());
    } catch (e) {
      toast.error("No se pudieron cargar las candidaturas", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const endorse = async (candidacyId: string) => {
    setEndorsing(candidacyId);
    try {
      await apiEndorseCandidacy(candidacyId);
      toast.success("Aval registrado.");
      setCandidacies((prev) =>
        prev.map((c) => (c.id === candidacyId ? { ...c, already_endorsed: true } : c)),
      );
    } catch (e) {
      toast.error("No se pudo avalar", { description: (e as Error).message });
    } finally {
      setEndorsing(null);
    }
  };

  const downloadSheet = async (candidacyId: string, name: string) => {
    try {
      await apiDownloadCandidacySheet(candidacyId, (name || "candidato").replace(/\s+/g, "_"));
    } catch (e) {
      toast.error("No se pudo generar el PDF", { description: (e as Error).message });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  if (candidacies.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          No hay inscripciones pendientes de validación.
        </CardContent>
      </Card>
    );
  }

  // Agrupar por colegiado para dejar claro qué roles/colegiados ya tienen postulantes.
  const byCollegiate = new Map<string, { name: string; items: Candidacy[] }>();
  for (const c of candidacies) {
    const key = c.collegiate;
    const entry = byCollegiate.get(key) ?? { name: c.collegiate_name ?? "", items: [] };
    entry.items.push(c);
    byCollegiate.set(key, entry);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        Al validar (avalar) una inscripción, el estudiante queda publicado como candidato oficial.
      </div>
      {!inscriptionOpen && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          La etapa de inscripción está cerrada; ya no se pueden registrar nuevas validaciones.
        </div>
      )}
      {[...byCollegiate.entries()].map(([collegiateId, group]) => (
        <div key={collegiateId} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.name}</p>
          {group.items.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center gap-3">
                  {c.image && (
                    <img src={resolveImg(c.image)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.participant_name}</p>
                    <p className="truncate text-xs text-gray-500">Estado: {c.status_display ?? c.status}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadSheet(c.id, c.participant_name ?? "")}>
                    <FileDown className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  {c.already_endorsed ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Validado
                    </span>
                  ) : (
                    <Button size="sm" disabled={endorsing === c.id || !inscriptionOpen} onClick={() => endorse(c.id)}>
                      {endorsing === c.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-1 h-4 w-4" />}
                      Validar
                    </Button>
                  )}
                </div>
                {c.work_plan_pdf ? (
                  <p className="text-xs">
                    <span className="text-gray-500">Plan de trabajo:</span>{" "}
                    <a href={resolveImg(c.work_plan_pdf)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      Ver PDF
                    </a>
                  </p>
                ) : (
                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                    <p><span className="text-gray-500">Propuesta:</span> {c.proposal || "—"}</p>
                    <p><span className="text-gray-500">Acciones:</span> {c.action_plan || "—"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sección: Votación ─────────────────────────────────────────

function VotarSection({ votingOpen }: { votingOpen: boolean }) {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [votedCollegiates, setVotedCollegiates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bs, votes] = await Promise.all([apiGetVotableBallots(), apiGetMyVotes()]);
      setBallots(bs);
      setVotedCollegiates(new Set(votes.voted_collegiates));
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const vote = async (collegiateId: string, ballotId: string | null, isBlank: boolean) => {
    setSubmitting(collegiateId);
    try {
      await apiCastVote({ collegiate: collegiateId, ballot: ballotId, is_blank: isBlank });
      toast.success("Voto registrado.");
      setVotedCollegiates((prev) => new Set(prev).add(collegiateId));
    } catch (e) {
      toast.error("No se pudo registrar el voto", { description: (e as Error).message });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  if (!votingOpen) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          La votación no está abierta en este momento.
        </CardContent>
      </Card>
    );
  }

  // Agrupar tarjetones por colegiado.
  const byCollegiate = new Map<string, { name: string; ballots: Ballot[] }>();
  for (const b of ballots) {
    const entry = byCollegiate.get(b.collegiate) ?? { name: b.collegiate_name ?? "", ballots: [] };
    entry.ballots.push(b);
    byCollegiate.set(b.collegiate, entry);
  }

  if (byCollegiate.size === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          Aún no hay tarjetones disponibles para votar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {[...byCollegiate.entries()].map(([collegiateId, group]) => {
        const alreadyVoted = votedCollegiates.has(collegiateId);
        return (
          <Card key={collegiateId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alreadyVoted ? (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Ya emitiste tu voto en este colegiado.
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.ballots.map((b) => (
                      <div
                        key={b.id}
                        className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 via-white to-white p-1 shadow-md transition-transform hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="rounded-xl bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="rounded-full bg-[#1e3a5f] px-2.5 py-0.5 text-xs font-bold text-white">
                              #{b.number}
                            </span>
                            <VoteIcon className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="mx-auto mb-3 h-32 w-32 overflow-hidden rounded-xl border-4 border-blue-100 shadow-inner">
                            {b.candidate_image ? (
                              <img src={resolveImg(b.candidate_image)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                                <UserPlus className="h-10 w-10" />
                              </div>
                            )}
                          </div>
                          <p className="text-center text-base font-bold text-gray-900">{b.candidate_name}</p>
                          {b.candidate_program && (
                            <p className="mt-0.5 text-center text-sm text-gray-600">{b.candidate_program}</p>
                          )}
                          {b.substitute_name && (
                            <p className="mx-auto mt-2 w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-center text-xs text-blue-700">
                              Suplente: {b.substitute_name}
                            </p>
                          )}
                          <Button
                            className="mt-3 w-full bg-[#1e3a5f] hover:bg-[#16293f]"
                            disabled={submitting === collegiateId}
                            onClick={() => vote(collegiateId, b.id, false)}
                          >
                            Votar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" disabled={submitting === collegiateId}
                    onClick={() => vote(collegiateId, null, true)}>
                    Voto en blanco
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Sección: Veeduría ─────────────────────────────────────────

function VeeduriaSection({ observersOpen }: { observersOpen: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const register = async () => {
    setSubmitting(true);
    try {
      await apiRegisterObserver(null);
      toast.success("Inscripción de veedor enviada. Queda pendiente de aprobación.");
      setDone(true);
    } catch (e) {
      toast.error("No se pudo inscribir como veedor", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Veeduría electoral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">
          Inscríbete como veedor para acompañar la transparencia del proceso. Tu solicitud será
          revisada por la administración.
        </p>
        {done ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Solicitud enviada.
          </p>
        ) : (
          <Button onClick={register} disabled={submitting || !observersOpen}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Inscribirme como veedor
          </Button>
        )}
        {!observersOpen && !done && (
          <p className="text-xs text-amber-600">La inscripción de veedores no está abierta.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sección: Validar veedores (Registro y Control / Admin) ───────────────────

function ValidarVeedoresSection({ periodId }: { periodId: string }) {
  const [observers, setObservers] = useState<Observer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const res = await apiListAdminObservers(periodId);
      setObservers(unwrapList(res));
    } finally {
      setLoading(false);
    }
  }, [periodId]);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: "approve" | "reject") => {
    try {
      await apiReviewObserver(id, action);
      toast.success(action === "approve" ? "Veedor aprobado" : "Veedor rechazado");
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando veedores…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Validar veedores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {observers.length === 0 && <p className="text-sm text-gray-500">Sin veedores inscritos.</p>}
        {observers.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="font-medium">{o.participant_name}</p>
              <p className="text-sm text-gray-500">{o.collegiate_name || "General"} · {o.status_display}</p>
            </div>
            {o.status === "PENDIENTE" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review(o.id, "approve")}>Aprobar</Button>
                <Button size="sm" variant="outline" onClick={() => review(o.id, "reject")}>Rechazar</Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
