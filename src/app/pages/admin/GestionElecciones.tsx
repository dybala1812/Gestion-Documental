/**
 * GestionElecciones.tsx
 * Panel de administración del módulo de elecciones estudiantiles:
 * configuración, períodos, roles, colegiados, carga de participantes,
 * revisión de candidaturas, tarjetones, veedores y resultados.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Vote, Settings, CalendarRange, Shield, Users, Upload, ClipboardCheck,
  Ticket, Eye, BarChart3, Loader2, Plus, ArrowLeft, Lock, FileDown, Award,
  Pencil, Trash2, X, Check, GraduationCap,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ResultadosEnVivo } from "../../components/elecciones/ResultadosEnVivo";
import {
  apiGetElectionConfig, apiUpdateElectionConfig,
  apiListPeriods, apiCreatePeriod, apiUpdatePeriod, apiClosePeriod,
  apiListRolesElectorales, apiCreateRoleElectoral, apiUpdateRoleElectoral,
  apiListCollegiates, apiCreateCollegiate, apiUpdateCollegiate, apiDeleteCollegiate,
  apiListAcademicPrograms, apiCreateAcademicProgram, apiUpdateAcademicProgram, apiDeleteAcademicProgram,
  apiListParticipants, apiListPendingAcademicRegistrations, apiReviewAcademicRegistration,
  apiListAdminCandidacies, apiReviewCandidacy, apiGenerateBallots,
  apiListAdminObservers, apiReviewObserver,
  apiDownloadActaEscrutinio, apiDownloadCertificado, apiDownloadCandidacySheet,
  unwrapList,
  type ElectoralPeriod, type ElectionRole, type Collegiate, type CollegiateScope, type AcademicProgram,
  type Participant, type ParticipantRole, type Candidacy, type Observer, type ElectionConfig,
} from "../../lib/eleccionesApi";
import { formatApiError, API_BASE } from "../../lib/api";

function resolveImg(url?: string | null): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

type Section =
  | "config" | "periods" | "roles" | "collegiates" | "programs"
  | "participants" | "candidacies" | "ballots" | "observers" | "results";

const SECTIONS: Array<{ id: Section; label: string; icon: ReactNode }> = [
  { id: "config", label: "Configuración", icon: <Settings className="h-4 w-4" /> },
  { id: "periods", label: "Períodos", icon: <CalendarRange className="h-4 w-4" /> },
  { id: "roles", label: "Roles", icon: <Shield className="h-4 w-4" /> },
  { id: "collegiates", label: "Colegiados", icon: <Users className="h-4 w-4" /> },
  { id: "programs", label: "Programas académicos", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "participants", label: "Participantes", icon: <Upload className="h-4 w-4" /> },
  { id: "candidacies", label: "Candidaturas", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "ballots", label: "Tarjetones", icon: <Ticket className="h-4 w-4" /> },
  { id: "observers", label: "Veedores", icon: <Eye className="h-4 w-4" /> },
  { id: "results", label: "Resultados", icon: <BarChart3 className="h-4 w-4" /> },
];

export function GestionElecciones() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("periods");
  const [periods, setPeriods] = useState<ElectoralPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const loadPeriods = useCallback(async () => {
    try {
      const res = await apiListPeriods();
      const list = unwrapList(res);
      setPeriods(list);
      if (!selectedPeriod && list.length) setSelectedPeriod(list[0].id);
    } catch (e) {
      toast.error("Error al cargar períodos", { description: formatApiError(e) });
    }
  }, [selectedPeriod]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Vote className="h-6 w-6 text-blue-600" /> Gestión de Elecciones
          </h1>
        </div>
        {periods.length > 0 && (
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              section === s.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {section === "config" && <ConfigSection />}
      {section === "periods" && <PeriodsSection periods={periods} reload={loadPeriods} />}
      {section === "roles" && <RolesSection />}
      {section === "collegiates" && <CollegiatesSection periodId={selectedPeriod} />}
      {section === "programs" && <ProgramsSection />}
      {section === "participants" && <ParticipantsSection periodId={selectedPeriod} />}
      {section === "candidacies" && <CandidaciesSection periodId={selectedPeriod} />}
      {section === "ballots" && <BallotsSection periodId={selectedPeriod} />}
      {section === "observers" && <ObserversSection periodId={selectedPeriod} />}
      {section === "results" && selectedPeriod && <ResultadosEnVivo periodId={selectedPeriod} isAdmin />}
    </div>
  );
}

// ── Configuración ─────────────────────────────────────────────

function ConfigSection() {
  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [domains, setDomains] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGetElectionConfig().then((c) => {
      setConfig(c);
      setDomains((c.allowed_email_domains ?? []).join(", "));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiUpdateElectionConfig({
        allowed_email_domains: domains.split(",").map((d) => d.trim()).filter(Boolean),
        endorsements_required: config?.endorsements_required,
        min_endorsements: config?.min_endorsements,
      });
      setConfig(updated);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error("Error al guardar", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuración global</CardTitle>
        <CardDescription>Dominios institucionales y reglas de avales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Dominios institucionales permitidos (separados por coma)</Label>
          <Input value={domains} onChange={(e) => setDomains(e.target.value)}
            placeholder="uniautonoma.edu.co" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={config.endorsements_required}
            onChange={(e) => setConfig({ ...config, endorsements_required: e.target.checked })} />
          <Label className="!mb-0">Avales obligatorios</Label>
        </div>
        <div className="space-y-2">
          <Label>Mínimo de avales</Label>
          <Input type="number" min={0} value={config.min_endorsements}
            onChange={(e) => setConfig({ ...config, min_endorsements: Number(e.target.value) })} />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Guardar
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Períodos ──────────────────────────────────────────────────

function PeriodsSection({ periods, reload }: { periods: ElectoralPeriod[]; reload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", year_start: new Date().getFullYear(), year_end: new Date().getFullYear(),
    inscription_start: "", inscription_end: "", observers_start: "", observers_end: "",
    voting_start: "", voting_end: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(form);

  const startEdit = (p: ElectoralPeriod) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      year_start: p.year_start,
      year_end: p.year_end,
      inscription_start: p.inscription_start?.slice(0, 16) ?? "",
      inscription_end: p.inscription_end?.slice(0, 16) ?? "",
      observers_start: p.observers_start?.slice(0, 16) ?? "",
      observers_end: p.observers_end?.slice(0, 16) ?? "",
      voting_start: p.voting_start?.slice(0, 16) ?? "",
      voting_end: p.voting_end?.slice(0, 16) ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiUpdatePeriod(editingId, {
        ...editForm,
        observers_start: editForm.observers_start || null,
        observers_end: editForm.observers_end || null,
      });
      toast.success("Período actualizado");
      setEditingId(null);
      reload();
    } catch (e) {
      toast.error("Error al actualizar período", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      await apiCreatePeriod({
        ...form,
        observers_start: form.observers_start || null,
        observers_end: form.observers_end || null,
      });
      toast.success("Período creado");
      setShowForm(false);
      reload();
    } catch (e) {
      toast.error("Error al crear período", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const close = async (id: string) => {
    if (!confirm("¿Cerrar este período y publicar resultados? Esta acción es definitiva.")) return;
    try {
      await apiClosePeriod(id);
      toast.success("Período cerrado");
      reload();
    } catch (e) {
      toast.error("Error al cerrar", { description: formatApiError(e) });
    }
  };

  const downloadActa = async (id: string, name: string) => {
    try {
      await apiDownloadActaEscrutinio(id, name.replace(/\s+/g, "_"));
      toast.success("Acta generada");
    } catch (e) {
      toast.error("Error al generar el acta", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm((v) => !v)}>
        <Plus className="mr-1 h-4 w-4" /> Nuevo período
      </Button>

      {showForm && (
        <Card>
          <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Año inicial</Label>
              <Input type="number" value={form.year_start}
                onChange={(e) => setForm({ ...form, year_start: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Año final</Label>
              <Input type="number" value={form.year_end}
                onChange={(e) => setForm({ ...form, year_end: Number(e.target.value) })} />
            </div>
            {([
              ["inscription_start", "Inicio inscripción"], ["inscription_end", "Fin inscripción"],
              ["observers_start", "Inicio veedores"], ["observers_end", "Fin veedores"],
              ["voting_start", "Inicio votación"], ["voting_end", "Fin votación"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input type="datetime-local" value={(form as Record<string, string | number>)[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button onClick={create} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {periods.map((p) => (
        <Card key={p.id}>
          {editingId === p.id ? (
            <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nombre</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Año inicial</Label>
                <Input type="number" value={editForm.year_start}
                  onChange={(e) => setEditForm({ ...editForm, year_start: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Año final</Label>
                <Input type="number" value={editForm.year_end}
                  onChange={(e) => setEditForm({ ...editForm, year_end: Number(e.target.value) })} />
              </div>
              {([
                ["inscription_start", "Inicio inscripción"], ["inscription_end", "Fin inscripción"],
                ["observers_start", "Inicio veedores"], ["observers_end", "Fin veedores"],
                ["voting_start", "Inicio votación"], ["voting_end", "Fin votación"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="datetime-local" value={(editForm as Record<string, string | number>)[key] as string}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
                </div>
              ))}
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Guardar
                </Button>
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {p.year_start}-{p.year_end} · {p.closed ? "Cerrado" : p.active ? "Activo" : "Inactivo"}
                </p>
              </div>
              <div className="flex gap-2">
                {!p.closed && (
                  <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                    <Pencil className="mr-1 h-4 w-4" /> Editar
                  </Button>
                )}
                {!p.closed && (
                  <Button variant="outline" size="sm" onClick={() => close(p.id)}>
                    <Lock className="mr-1 h-4 w-4" /> Cerrar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => downloadActa(p.id, p.name)}>
                  <FileDown className="mr-1 h-4 w-4" /> Acta de escrutinio
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Roles electorales ─────────────────────────────────────────

function RolesSection() {
  const [roles, setRoles] = useState<ElectionRole[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [requiresFacultad, setRequiresFacultad] = useState(true);
  const [requiresPrograma, setRequiresPrograma] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiListRolesElectorales();
    setRoles(unwrapList(res));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name || !code) { toast.error("Nombre y código requeridos"); return; }
    setSaving(true);
    try {
      await apiCreateRoleElectoral({
        name, code: code.toUpperCase(),
        requires_facultad: requiresFacultad, requires_programa: requiresPrograma,
      });
      toast.success("Rol creado");
      setName(""); setCode(""); setRequiresFacultad(true); setRequiresPrograma(true);
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (r: ElectionRole, flag: "requires_facultad" | "requires_programa") => {
    try {
      await apiUpdateRoleElectoral(r.id, { [flag]: !r[flag] });
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <Button onClick={create} disabled={saving}><Plus className="mr-1 h-4 w-4" /> Crear</Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresFacultad} onChange={(e) => setRequiresFacultad(e.target.checked)} />
              Requiere facultad (ej. docentes, egresados, estudiantes)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresPrograma} onChange={(e) => setRequiresPrograma(e.target.checked)} />
              Requiere programa/currículo (solo estudiantes)
            </label>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
            <span><strong>{r.code}</strong> — {r.name}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleFlag(r, "requires_facultad")}
                className={r.requires_facultad ? "text-blue-600" : "text-gray-400"}>
                Facultad {r.requires_facultad ? "✓" : "✗"}
              </button>
              <button onClick={() => toggleFlag(r, "requires_programa")}
                className={r.requires_programa ? "text-blue-600" : "text-gray-400"}>
                Programa {r.requires_programa ? "✓" : "✗"}
              </button>
              <span className={r.active ? "text-green-600" : "text-gray-400"}>{r.active ? "Activo" : "Inactivo"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Programas académicos (facultad / programa / currículo) ────

function ProgramsSection() {
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [facultad, setFacultad] = useState("");
  const [programa, setPrograma] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiListAcademicPrograms();
    setPrograms(unwrapList(res));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!facultad.trim() || !programa.trim() || !curriculum.trim()) {
      toast.error("Facultad, programa y currículo son requeridos");
      return;
    }
    setSaving(true);
    try {
      await apiCreateAcademicProgram({ facultad: facultad.trim(), programa: programa.trim(), curriculum: curriculum.trim() });
      toast.success("Programa académico creado");
      setFacultad(""); setPrograma(""); setCurriculum("");
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AcademicProgram) => {
    try {
      await apiUpdateAcademicProgram(p.id, { active: !p.active });
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    }
  };

  const remove = async (p: AcademicProgram) => {
    if (!window.confirm(`¿Eliminar "${p.programa}"?`)) return;
    try {
      await apiDeleteAcademicProgram(p.id);
      toast.success("Programa eliminado");
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo de facultades y programas</CardTitle>
          <CardDescription>
            Alimenta los desplegables del autoregistro académico del estudiante (Facultad → Programa → Currículo).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Facultad</Label><Input value={facultad} onChange={(e) => setFacultad(e.target.value)} /></div>
          <div><Label>Programa</Label><Input value={programa} onChange={(e) => setPrograma(e.target.value)} /></div>
          <div><Label>Currículo / código</Label><Input value={curriculum} onChange={(e) => setCurriculum(e.target.value)} /></div>
          <Button onClick={create} disabled={saving}><Plus className="mr-1 h-4 w-4" /> Crear</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {programs.length === 0 && <p className="text-sm text-gray-500">Sin programas registrados.</p>}
        {programs.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
            <span><strong>{p.facultad}</strong> · {p.programa} · {p.curriculum}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleActive(p)} className={p.active ? "text-green-600" : "text-gray-400"}>
                {p.active ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => remove(p)} className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Colegiados ────────────────────────────────────────────────

function CollegiatesSection({ periodId }: { periodId: string }) {
  const [collegiates, setCollegiates] = useState<Collegiate[]>([]);
  const [roles, setRoles] = useState<ElectionRole[]>([]);
  const [form, setForm] = useState({ role: "", name: "", scope: "PROGRAMA" as CollegiateScope, facultad: "", curriculum: "", threshold: 0, seats: 1 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ role: "", name: "", scope: "PROGRAMA" as CollegiateScope, facultad: "", curriculum: "", threshold: 0, seats: 1 });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!periodId) return;
    const [cs, rs] = await Promise.all([apiListCollegiates(periodId), apiListRolesElectorales()]);
    setCollegiates(unwrapList(cs));
    setRoles(unwrapList(rs));
  }, [periodId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.role || !form.name) { toast.error("Rol y nombre requeridos"); return; }
    if (form.scope === "FACULTAD" && !form.facultad) { toast.error("La facultad es requerida para alcance 'Por facultad'"); return; }
    if (form.scope === "PROGRAMA" && !form.curriculum) { toast.error("El currículo es requerido para alcance 'Por programa'"); return; }
    setSaving(true);
    try {
      await apiCreateCollegiate({ ...form, period: periodId });
      toast.success("Colegiado creado");
      setForm({ role: "", name: "", scope: "PROGRAMA", facultad: "", curriculum: "", threshold: 0, seats: 1 });
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Collegiate) => {
    setEditingId(c.id);
    setEditForm({ role: c.role, name: c.name, scope: c.scope, facultad: c.facultad, curriculum: c.curriculum, threshold: c.threshold, seats: c.seats });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.role || !editForm.name) {
      toast.error("Rol y nombre requeridos");
      return;
    }
    if (editForm.scope === "FACULTAD" && !editForm.facultad) { toast.error("La facultad es requerida para alcance 'Por facultad'"); return; }
    if (editForm.scope === "PROGRAMA" && !editForm.curriculum) { toast.error("El currículo es requerido para alcance 'Por programa'"); return; }
    setSaving(true);
    try {
      await apiUpdateCollegiate(id, editForm);
      toast.success("Colegiado actualizado");
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error("Error al actualizar", { description: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el colegiado "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    try {
      await apiDeleteCollegiate(id);
      toast.success("Colegiado eliminado");
      await load();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: formatApiError(e) });
    } finally {
      setDeletingId(null);
    }
  };

  if (!periodId) return <p className="text-gray-500">Selecciona un período.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
          <div>
            <Label>Rol</Label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="">Selecciona…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Alcance</Label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as CollegiateScope })}>
              <option value="UNIVERSITARIO">Universitario</option>
              <option value="FACULTAD">Por facultad</option>
              <option value="PROGRAMA">Por programa/currículo</option>
            </select>
          </div>
          {form.scope === "FACULTAD" && (
            <div><Label>Facultad</Label><Input value={form.facultad} onChange={(e) => setForm({ ...form, facultad: e.target.value })} /></div>
          )}
          {form.scope === "PROGRAMA" && (
            <div><Label>Currículo</Label><Input value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} /></div>
          )}
          <div><Label>Umbral</Label><Input type="number" min={0} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} /></div>
          <div><Label>Cupos</Label><Input type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2">
            <Button onClick={create} disabled={saving}><Plus className="mr-1 h-4 w-4" /> Crear colegiado</Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {collegiates.map((c) => (
          editingId === c.id ? (
            <div key={c.id} className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Rol</Label>
                  <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="">Selecciona…</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div><Label>Nombre</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div>
                  <Label>Alcance</Label>
                  <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={editForm.scope} onChange={(e) => setEditForm({ ...editForm, scope: e.target.value as CollegiateScope })}>
                    <option value="UNIVERSITARIO">Universitario</option>
                    <option value="FACULTAD">Por facultad</option>
                    <option value="PROGRAMA">Por programa/currículo</option>
                  </select>
                </div>
                {editForm.scope === "FACULTAD" && (
                  <div><Label>Facultad</Label><Input value={editForm.facultad} onChange={(e) => setEditForm({ ...editForm, facultad: e.target.value })} /></div>
                )}
                {editForm.scope === "PROGRAMA" && (
                  <div><Label>Currículo</Label><Input value={editForm.curriculum} onChange={(e) => setEditForm({ ...editForm, curriculum: e.target.value })} /></div>
                )}
                <div><Label>Umbral</Label><Input type="number" min={0} value={editForm.threshold} onChange={(e) => setEditForm({ ...editForm, threshold: Number(e.target.value) })} /></div>
                <div><Label>Cupos</Label><Input type="number" min={1} value={editForm.seats} onChange={(e) => setEditForm({ ...editForm, seats: Number(e.target.value) })} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(c.id)} disabled={saving}>
                  <Check className="mr-1 h-4 w-4" /> Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
              <span>
                <strong>{c.name}</strong> ({c.role_name}) —{" "}
                {c.scope === "UNIVERSITARIO" ? "Universitario" : c.scope === "FACULTAD" ? c.facultad : c.curriculum}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">Cupos {c.seats} · Umbral {c.threshold}</span>
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                  onClick={() => remove(c.id, c.name)} disabled={deletingId === c.id}>
                  {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ── Participantes (import) ────────────────────────────────────

function ParticipantsSection({ periodId }: { periodId: string }) {
  const [pending, setPending] = useState<ParticipantRole[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [manualAssign, setManualAssign] = useState<Record<string, Collegiate[]>>({});
  const [manualSelected, setManualSelected] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [pend, parts] = await Promise.all([
        apiListPendingAcademicRegistrations(periodId),
        apiListParticipants(periodId),
      ]);
      setPending(unwrapList(pend));
      setParticipants(unwrapList(parts));
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
        toast.success("Registro rechazado");
        await load();
        return;
      }
      if (res.candidacy_granted) {
        toast.success(`Registro aprobado. Candidatura otorgada a "${res.candidacy_granted.collegiate_name}".`);
        setManualAssign((m) => { const n = { ...m }; delete n[id]; return n; });
        await load();
      } else if (res.possible_collegiates.length > 0) {
        toast.success("Registro aprobado. Ningún colegiado coincide automáticamente: selecciona uno manualmente.");
        setManualAssign((m) => ({ ...m, [id]: res.possible_collegiates }));
      } else {
        toast.error("Registro aprobado, pero no hay colegiados activos para este rol. Crea uno en 'Colegiados'.");
        await load();
      }
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    } finally {
      setReviewingId(null);
    }
  };

  if (!periodId) return <p className="text-gray-500">Selecciona un período.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitudes de registro académico pendientes</CardTitle>
          <CardDescription>
            El estudiante autoregistra su facultad, programa, currículo y rol; al aprobar se otorga la
            candidatura automáticamente si coincide con un colegiado activo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="rounded-lg border px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {r.image && (
                      <img src={resolveImg(r.image)} alt="foto" className="h-12 w-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="font-medium">{r.participant_name || r.participant_email}</p>
                      <p className="text-gray-500">
                        {r.role_name} · {r.facultad} · {r.programa} · {r.curriculum}
                        {r.semestre ? ` · Semestre ${r.semestre}` : ""}
                      </p>
                      <p className="text-gray-500">
                        Tel: {r.telefono || "—"} · Ciudad: {r.ciudad || "—"}
                        {r.work_plan_pdf && (
                          <>
                            {" · "}
                            <a href={resolveImg(r.work_plan_pdf)} target="_blank" rel="noreferrer"
                              className="text-blue-600 underline">Ver plan de trabajo</a>
                          </>
                        )}
                      </p>
                      {r.suplente_email && (
                        <p className="text-gray-500">
                          Suplente: {r.suplente_email}
                          {r.suplente_documento_identidad ? ` (C.C. ${r.suplente_documento_identidad})` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {!manualAssign[r.id] && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(r.id, "aprobar")} disabled={reviewingId === r.id}>
                        <Check className="mr-1 h-4 w-4" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                        onClick={() => review(r.id, "rechazar")} disabled={reviewingId === r.id}>
                        <X className="mr-1 h-4 w-4" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
                {manualAssign[r.id] && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <span className="text-amber-800">
                      Ningún colegiado coincide automáticamente. Asigna uno manualmente:
                    </span>
                    <select className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={manualSelected[r.id] ?? ""}
                      onChange={(e) => setManualSelected((m) => ({ ...m, [r.id]: e.target.value }))}>
                      <option value="">Selecciona un colegiado…</option>
                      {manualAssign[r.id].map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" disabled={!manualSelected[r.id] || reviewingId === r.id}
                      onClick={() => review(r.id, "aprobar", manualSelected[r.id])}>
                      Asignar colegiado
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-gray-500">{participants.length} participante(s) en el padrón.</p>
    </div>
  );
}


// ── Candidaturas (revisión) ───────────────────────────────────

function CandidaciesSection({ periodId }: { periodId: string }) {
  const [candidacies, setCandidacies] = useState<Candidacy[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const res = await apiListAdminCandidacies(periodId);
      setCandidacies(unwrapList(res));
    } finally {
      setLoading(false);
    }
  }, [periodId]);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: "publish" | "reject") => {
    try {
      await apiReviewCandidacy(id, action);
      toast.success(action === "publish" ? "Candidatura publicada" : "Candidatura rechazada");
      await load();
    } catch (e) {
      toast.error("Error", { description: formatApiError(e) });
    }
  };

  const downloadCertificado = async (id: string, name: string) => {
    try {
      await apiDownloadCertificado(id, name.replace(/\s+/g, "_"));
      toast.success("Certificado generado");
    } catch (e) {
      toast.error("No se pudo generar el certificado", { description: (e as Error).message });
    }
  };

  const downloadSheet = async (id: string, name: string) => {
    try {
      await apiDownloadCandidacySheet(id, (name || "candidato").replace(/\s+/g, "_"));
    } catch (e) {
      toast.error("No se pudo generar la ficha", { description: (e as Error).message });
    }
  };

  if (!periodId) return <p className="text-gray-500">Selecciona un período.</p>;
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  return (
    <div className="space-y-3">
      {candidacies.length === 0 && <p className="text-gray-500">Sin candidaturas.</p>}
      {candidacies.map((c) => (
        <Card key={c.id}>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{c.participant_name} — {c.collegiate_name}</p>
                <p className="text-sm text-gray-500">
                  Estado: {c.status_display} · Suplente: {c.substitute?.participant_name ?? "—"} · Avales: {c.endorsements_count ?? 0}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadSheet(c.id, c.participant_name ?? "")}>
                  <FileDown className="mr-1 h-4 w-4" /> Ficha PDF
                </Button>
                {c.status !== "PUBLICADO" && (
                  <Button size="sm" onClick={() => review(c.id, "publish")}>Publicar</Button>
                )}
                {c.status !== "RECHAZADO" && (
                  <Button size="sm" variant="outline" onClick={() => review(c.id, "reject")}>Rechazar</Button>
                )}
                {c.status === "PUBLICADO" && (
                  <Button size="sm" variant="outline" onClick={() => downloadCertificado(c.id, c.participant_name ?? "candidato")}>
                    <Award className="mr-1 h-4 w-4" /> Certificado
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-gray-500">Cédula:</span> {c.documento_identidad || "—"}</p>
              <p><span className="text-gray-500">Fecha de nacimiento:</span> {c.fecha_nacimiento || "—"}</p>
              <p><span className="text-gray-500">Teléfono:</span> {c.telefono || "—"}</p>
              <p><span className="text-gray-500">Ciudad:</span> {c.ciudad || "—"}</p>
              <p className="sm:col-span-2"><span className="text-gray-500">Dirección:</span> {c.direccion || "—"}</p>
              {c.work_plan_pdf ? (
                <p className="sm:col-span-2">
                  <span className="text-gray-500">Plan de trabajo:</span>{" "}
                  <a href={resolveImg(c.work_plan_pdf)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Ver PDF
                  </a>
                </p>
              ) : (
                <>
                  <p className="sm:col-span-2"><span className="text-gray-500">Propuesta / plan de trabajo:</span> {c.proposal || "—"}</p>
                  <p className="sm:col-span-2"><span className="text-gray-500">Acciones del plan:</span> {c.action_plan || "—"}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Tarjetones ────────────────────────────────────────────────

function BallotsSection({ periodId }: { periodId: string }) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ generated: number; skipped: Array<{ candidacy_id: string; reason: string }> } | null>(null);

  const generate = async () => {
    if (!periodId) return;
    setGenerating(true);
    try {
      const r = await apiGenerateBallots(periodId);
      setResult(r);
      toast.success(`${r.generated} tarjetón(es) generado(s).`);
    } catch (e) {
      toast.error("Error al generar", { description: formatApiError(e) });
    } finally {
      setGenerating(false);
    }
  };

  if (!periodId) return <p className="text-gray-500">Selecciona un período.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generación de tarjetones</CardTitle>
        <CardDescription>
          Genera tarjetones para las candidaturas publicadas que tengan suplente (y avales si son obligatorios).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-1 h-4 w-4" />}
          Generar tarjetones
        </Button>
        {result && (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
            <p>Generados: {result.generated}</p>
            {result.skipped.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-amber-700">
                {result.skipped.map((s, i) => <li key={i}>{s.reason}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Veedores ──────────────────────────────────────────────────

function ObserversSection({ periodId }: { periodId: string }) {
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

  if (!periodId) return <p className="text-gray-500">Selecciona un período.</p>;
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  return (
    <div className="space-y-3">
      {observers.length === 0 && <p className="text-gray-500">Sin veedores inscritos.</p>}
      {observers.map((o) => (
        <Card key={o.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{o.participant_name}</p>
              <p className="text-sm text-gray-500">
                {o.collegiate_name || "General"} · {o.status_display}
              </p>
            </div>
            {o.status === "PENDIENTE" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review(o.id, "approve")}>Aprobar</Button>
                <Button size="sm" variant="outline" onClick={() => review(o.id, "reject")}>Rechazar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
