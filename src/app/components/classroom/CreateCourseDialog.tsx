import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { formatApiError } from "../../lib/api";
import {
  apiCreateCourse,
  apiCreateProgram,
  apiListFaculties,
  apiListPrograms,
  apiCheckCourseDuplicate,
  apiGetComponentOptions,
  COMPONENT_CAMPO_LABELS,
  type ClassroomCourse,
  type ClassroomFaculty,
  type ClassroomProgram,
  type CourseDuplicateMatch,
  type ProgramComponentOption,
} from "../../lib/classroomApi";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (course: ClassroomCourse) => void;
}

/** Diálogo de creación de curso reutilizable (coordinadores y docentes). */
export function CreateCourseDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    program_id: "",
    component: "",
    credits: 3,
    semester: undefined as number | undefined,
    is_common_field: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allPrograms, setAllPrograms] = useState<ClassroomProgram[]>([]);
  const [faculties, setFaculties] = useState<ClassroomFaculty[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<CourseDuplicateMatch[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [componentOptions, setComponentOptions] = useState<ProgramComponentOption[]>([]);

  const [programQuery, setProgramQuery] = useState("");
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const [creatingProgramInline, setCreatingProgramInline] = useState(false);
  const [inlineProgramForm, setInlineProgramForm] = useState({ name: "", code: "", faculty_id: "" });
  const [submittingInlineProgram, setSubmittingInlineProgram] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiListPrograms().then(setAllPrograms).catch(() => {});
    apiListFaculties().then(setFaculties).catch(() => {});
  }, [open]);

  // Catálogo real de Componentes: depende del programa elegido (o solo Campo Común si no hay programa).
  useEffect(() => {
    if (!open) return;
    const programId = form.is_common_field ? null : form.program_id || null;
    apiGetComponentOptions(programId)
      .then((res) => setComponentOptions(res.options))
      .catch(() => setComponentOptions([]));
  }, [open, form.program_id, form.is_common_field]);

  const resetForm = () => {
    setForm({ name: "", code: "", program_id: "", component: "", credits: 3, semester: undefined, is_common_field: false });
    setErrors({});
    setDuplicateMatches([]);
    setProgramQuery("");
    setShowProgramDropdown(false);
    setCreatingProgramInline(false);
    setInlineProgramForm({ name: "", code: "", faculty_id: "" });
  };

  const close = () => {
    onOpenChange(false);
    resetForm();
  };

  const programLabel = (p: ClassroomProgram) => `${p.name}${p.faculty ? " · " + p.faculty.name : ""}`;

  const selectProgram = (p: ClassroomProgram) => {
    setForm((s) => ({ ...s, program_id: p.id }));
    setProgramQuery(programLabel(p));
    setErrors((err) => ({ ...err, program_id: "" }));
    setShowProgramDropdown(false);
  };

  const openInlineProgramCreation = () => {
    setInlineProgramForm({ name: programQuery.trim(), code: "", faculty_id: "" });
    setCreatingProgramInline(true);
    setShowProgramDropdown(false);
  };

  const handleCreateInlineProgram = async () => {
    if (!inlineProgramForm.name.trim() || !inlineProgramForm.code.trim() || !inlineProgramForm.faculty_id) {
      toast.error("Completa nombre, código y facultad del nuevo programa");
      return;
    }
    setSubmittingInlineProgram(true);
    try {
      const created = await apiCreateProgram(inlineProgramForm);
      setAllPrograms((prev) => [...prev, created]);
      selectProgram(created);
      setCreatingProgramInline(false);
      toast.success("Programa creado y asignado al curso");
    } catch (e) {
      toast.error("No se pudo crear el programa", { description: formatApiError(e) });
    } finally {
      setSubmittingInlineProgram(false);
    }
  };

  // Consulta al backend si el nombre del curso ya existe (en este u otro programa) mientras se escribe.
  useEffect(() => {
    if (!open || !form.name.trim()) {
      setDuplicateMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const res = await apiCheckCourseDuplicate({
          name: form.name.trim(),
          program_id: form.is_common_field ? null : form.program_id || null,
        });
        setDuplicateMatches(res.matches);
      } catch {
        // La verificación es solo informativa: si falla, no se bloquea el formulario.
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [open, form.name, form.program_id, form.is_common_field]);

  const suggestCourseCode = () => {
    const base = form.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((word) => word.slice(0, 4))
      .filter(Boolean)
      .slice(0, 2)
      .join("-");
    const suffix = Math.floor(100 + Math.random() * 900);
    setForm((s) => ({ ...s, code: base ? `${base}-${suffix}` : s.code }));
    setErrors((e) => ({ ...e, code: "" }));
  };

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "El nombre del curso es obligatorio.";
    if (!form.code.trim()) {
      nextErrors.code = "El código es obligatorio (no se genera a partir del nombre).";
    } else if (!/^[A-Za-z0-9-]+$/.test(form.code.trim())) {
      nextErrors.code = "El código solo admite letras, números y guiones.";
    }
    if (!form.credits || form.credits < 1 || form.credits > 20) {
      nextErrors.credits = "Los créditos deben estar entre 1 y 20.";
    }
    if (form.semester !== undefined && (form.semester < 1 || form.semester > 12)) {
      nextErrors.semester = "El semestre debe estar entre 1 y 12.";
    }
    if (!form.is_common_field && !form.program_id) {
      nextErrors.program_id = "Selecciona a qué programa pertenece el curso (o márcalo como Campo Común).";
    }
    return nextErrors;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Faltan campos por completar", { description: Object.values(nextErrors).join(" ") });
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiCreateCourse({
        name: form.name,
        code: form.code,
        program_id: form.is_common_field ? null : form.program_id,
        component: form.component || null,
        credits: form.credits,
        semester: form.semester || null,
        is_common_field: form.is_common_field,
      });
      toast.success("Curso creado correctamente");
      onCreated(created);
      close();
    } catch (e) {
      toast.error("No se pudo crear el curso", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProgramOptions = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    if (!q) return allPrograms;
    return allPrograms.filter((p) => p.name.toLowerCase().includes(q) || p.faculty?.name.toLowerCase().includes(q));
  }, [allPrograms, programQuery]);

  const programExactMatch = useMemo(
    () => allPrograms.some((p) => p.name.trim().toLowerCase() === programQuery.trim().toLowerCase()),
    [allPrograms, programQuery]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Curso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="new-course-name" className="font-semibold">
              Nombre del Curso <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-course-name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setErrors((err) => ({ ...err, name: "" }));
              }}
              placeholder="Ej: Programación Web"
              className={`mt-1 ${errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            {checkingDuplicate && <p className="mt-1 text-xs text-gray-400">Verificando si ya existe...</p>}
            {!checkingDuplicate && duplicateMatches.length > 0 && (
              <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                Ya existe un curso con este nombre en: {duplicateMatches.map((m) => `${m.program_name} (${m.code})`).join(", ")}.
                Puedes continuar si se trata de una variante distinta (ej. otros créditos); solo se bloquea si el código de curso se repite.
              </div>
            )}
          </div>

          <div className="relative">
            <Label htmlFor="new-course-program" className="font-semibold">
              Programa {!form.is_common_field && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="new-course-program"
              value={programQuery}
              disabled={form.is_common_field}
              placeholder="Escribe para buscar o crear un programa…"
              onFocus={() => setShowProgramDropdown(true)}
              onBlur={() => setTimeout(() => setShowProgramDropdown(false), 150)}
              onChange={(e) => {
                setProgramQuery(e.target.value);
                setShowProgramDropdown(true);
                setForm((s) => ({ ...s, program_id: "" }));
              }}
              className={`mt-1 disabled:bg-gray-100 disabled:text-gray-400 ${errors.program_id ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {showProgramDropdown && !form.is_common_field && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {filteredProgramOptions.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">Sin coincidencias</p>
                )}
                {filteredProgramOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectProgram(p)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${form.program_id === p.id ? "bg-orange-100 font-semibold text-[#1e3a5f]" : "text-gray-700"}`}
                  >
                    {p.name}{p.faculty ? <span className="ml-1 text-xs text-gray-500">· {p.faculty.name}</span> : null}
                  </button>
                ))}
                {programQuery.trim() !== "" && !programExactMatch && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openInlineProgramCreation}
                    className="block w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-[#ff9800] hover:bg-orange-50"
                  >
                    <Plus className="mr-1 inline h-3 w-3" /> Crear programa "{programQuery.trim()}"
                  </button>
                )}
              </div>
            )}
            {errors.program_id && <p className="mt-1 text-xs text-red-600">{errors.program_id}</p>}
          </div>

          {creatingProgramInline && (
            <div className="space-y-3 rounded-md border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-semibold text-[#1e3a5f]">Nuevo programa</p>
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={inlineProgramForm.name}
                  onChange={(e) => setInlineProgramForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Ej: Ingeniería de Sistemas"
                />
              </div>
              <div>
                <Label className="text-xs">Código</Label>
                <Input
                  value={inlineProgramForm.code}
                  onChange={(e) => setInlineProgramForm((s) => ({ ...s, code: e.target.value }))}
                  placeholder="Ej: ING-SIS"
                />
              </div>
              <div>
                <Label className="text-xs">Facultad</Label>
                <select
                  value={inlineProgramForm.faculty_id}
                  onChange={(e) => setInlineProgramForm((s) => ({ ...s, faculty_id: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                >
                  <option value="">Selecciona una facultad…</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreatingProgramInline(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" disabled={submittingInlineProgram} onClick={handleCreateInlineProgram} className="bg-[#ff9800] text-white hover:bg-[#f57c00]">
                  {submittingInlineProgram && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Crear y usar
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="new-course-code" className="font-semibold">
              Código <span className="text-red-500">*</span>
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="new-course-code"
                value={form.code}
                onChange={(e) => {
                  setForm({ ...form, code: e.target.value });
                  setErrors((err) => ({ ...err, code: "" }));
                }}
                placeholder="Ej: PROG-101"
                className={errors.code ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <Button type="button" variant="outline" onClick={suggestCourseCode} disabled={!form.name.trim()}>
                Sugerir
              </Button>
            </div>
            {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
          </div>

          <div>
            <Label htmlFor="new-course-credits" className="font-semibold">
              Créditos <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-course-credits"
              type="number"
              value={form.credits}
              onChange={(e) => {
                setForm({ ...form, credits: parseInt(e.target.value) || 3 });
                setErrors((err) => ({ ...err, credits: "" }));
              }}
              className={`mt-1 ${errors.credits ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {errors.credits && <p className="mt-1 text-xs text-red-600">{errors.credits}</p>}
          </div>

          <div>
            <Label htmlFor="new-course-semester" className="font-semibold">
              Semestre (Opcional)
            </Label>
            <Input
              id="new-course-semester"
              type="number"
              value={form.semester || ""}
              onChange={(e) => {
                setForm({ ...form, semester: e.target.value ? parseInt(e.target.value) : undefined });
                setErrors((err) => ({ ...err, semester: "" }));
              }}
              placeholder="Ej: 1, 2, 3..."
              className={`mt-1 ${errors.semester ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {errors.semester && <p className="mt-1 text-xs text-red-600">{errors.semester}</p>}
          </div>

          <div>
            <Label htmlFor="new-course-component" className="font-semibold">
              Componente
            </Label>
            <select
              id="new-course-component"
              value={form.component}
              onChange={(e) => setForm({ ...form, component: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
            >
              <option value="">Selecciona…</option>
              {(Object.keys(COMPONENT_CAMPO_LABELS) as Array<keyof typeof COMPONENT_CAMPO_LABELS>).map((campo) => {
                const opts = componentOptions.filter((o) => o.campo === campo);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={campo} label={COMPONENT_CAMPO_LABELS[campo]}>
                    {opts.map((o) => <option key={o.componente} value={o.componente}>{o.componente}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-course-common-field"
              checked={form.is_common_field}
              onChange={(e) => {
                setForm({ ...form, is_common_field: e.target.checked });
                setErrors((err) => ({ ...err, program_id: "" }));
              }}
              className="rounded"
            />
            <Label htmlFor="new-course-common-field" className="font-semibold cursor-pointer">
              Campo Común (sin programa específico)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2 bg-[#1e3a5f] hover:bg-[#152a45]">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Curso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
