import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Filter,
  Loader2,
  Plus,
  X,
  AlertCircle,
  Users,
  Search,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
  apiListCourses,
  apiGetAssignedTeachers,
  apiAssignTeachersToCourse,
  apiCreateCourse,
  apiUpdateCourse,
  apiDeleteCourse,
  apiDuplicateCourse,
  apiSearchTeachers,
  ensureClassroomSession,
  apiListPlans,
  apiListPrograms,
  apiCreateProgram,
  apiListFaculties,
  apiCheckCourseDuplicate,
  COMPONENT_OPTIONS,
  type ClassroomCourse,
  type ClassroomUser,
  type AssignedTeacher,
  type ClassroomProgram,
  type ClassroomFaculty,
  type CourseDuplicateMatch,
} from "../../lib/classroomApi";

interface Props {
  user: Usuario;
}

export function CoordinadorAssignTeachersPanel({ user }: Props) {
  const [classroomUser, setClassroomUser] = useState<ClassroomUser | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  const [selectedCourse, setSelectedCourse] = useState<ClassroomCourse | null>(null);
  const [assignedTeachers, setAssignedTeachers] = useState<AssignedTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // CREAR / EDITAR CURSO (mismo diálogo; editingCourseId != null => modo edición con PUT)
  const [openCreateCourseDialog, setOpenCreateCourseDialog] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newCourseForm, setNewCourseForm] = useState({
    name: "",
    code: "",
    program_id: "",
    component: "",
    credits: 3,
    semester: undefined as number | undefined,
    is_common_field: false,
  });
  const [courseFormErrors, setCourseFormErrors] = useState<Record<string, string>>({});
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [allPrograms, setAllPrograms] = useState<ClassroomProgram[]>([]);
  const [faculties, setFaculties] = useState<ClassroomFaculty[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<CourseDuplicateMatch[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [duplicatingCourseId, setDuplicatingCourseId] = useState<string | null>(null);

  // Combobox de programa: permite buscar entre los existentes o crear uno nuevo si no aparece.
  const [programQuery, setProgramQuery] = useState("");
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const [creatingProgramInline, setCreatingProgramInline] = useState(false);
  const [inlineProgramForm, setInlineProgramForm] = useState({ name: "", code: "", faculty_id: "" });
  const [submittingInlineProgram, setSubmittingInlineProgram] = useState(false);

  // ASIGNAR DOCENTES
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ClassroomUser[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  
  const [filterProgramId, setFilterProgramId] = useState("");
  const [searchCourse, setSearchCourse] = useState("");

  const reloadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await apiListCourses({
        program_id: filterProgramId || undefined,
        search: searchCourse || undefined,
      });
      setCourses(res || []);
    } catch (e) {
      toast.error("No se pudieron cargar los cursos", {
        description: formatApiError(e),
      });
    } finally {
      setLoadingCourses(false);
    }
  }, [filterProgramId, searchCourse]);

  const loadAssignedTeachers = useCallback(async (courseId: string) => {
    setLoadingTeachers(true);
    try {
      const teachers = await apiGetAssignedTeachers(courseId);
      setAssignedTeachers(teachers || []);
    } catch (e) {
      toast.error("No se pudieron cargar los docentes asignados", {
        description: formatApiError(e),
      });
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  // CREAR / EDITAR CURSO
  const closeCourseDialog = () => {
    setOpenCreateCourseDialog(false);
    setEditingCourseId(null);
    setNewCourseForm({ name: "", code: "", program_id: "", component: "", credits: 3, semester: undefined, is_common_field: false });
    setCourseFormErrors({});
    setDuplicateMatches([]);
    setProgramQuery("");
    setShowProgramDropdown(false);
    setCreatingProgramInline(false);
    setInlineProgramForm({ name: "", code: "", faculty_id: "" });
  };

  const handleOpenEditCourse = (course: ClassroomCourse) => {
    setEditingCourseId(course.id);
    setNewCourseForm({
      name: course.name,
      code: course.code,
      program_id: course.program?.id ?? "",
      component: course.component ?? "",
      credits: course.credits ?? 3,
      semester: course.semester ?? undefined,
      is_common_field: course.is_common_field ?? false,
    });
    setCourseFormErrors({});
    setDuplicateMatches([]);
    setProgramQuery(course.program ? `${course.program.name}${course.program.faculty ? " · " + course.program.faculty.name : ""}` : "");
    setCreatingProgramInline(false);
    setOpenCreateCourseDialog(true);
  };

  const programLabel = (p: ClassroomProgram) => `${p.name}${p.faculty ? " · " + p.faculty.name : ""}`;

  const selectProgram = (p: ClassroomProgram) => {
    setNewCourseForm((s) => ({ ...s, program_id: p.id }));
    setProgramQuery(programLabel(p));
    setCourseFormErrors((err) => ({ ...err, program_id: "" }));
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
    if (!openCreateCourseDialog || !newCourseForm.name.trim()) {
      setDuplicateMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const res = await apiCheckCourseDuplicate({
          name: newCourseForm.name.trim(),
          program_id: newCourseForm.is_common_field ? null : newCourseForm.program_id || null,
          exclude_id: editingCourseId ?? undefined,
        });
        setDuplicateMatches(res.matches);
      } catch {
        // La verificación es solo informativa: si falla, no se bloquea el formulario.
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [openCreateCourseDialog, newCourseForm.name, newCourseForm.program_id, newCourseForm.is_common_field, editingCourseId]);

  /** El código es un identificador propio del curso, independiente del nombre (nomenclatura); se sugiere pero no se deriva automáticamente al escribir. */
  const suggestCourseCode = () => {
    const base = newCourseForm.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((word) => word.slice(0, 4))
      .filter(Boolean)
      .slice(0, 2)
      .join("-");
    const suffix = Math.floor(100 + Math.random() * 900);
    setNewCourseForm((s) => ({ ...s, code: base ? `${base}-${suffix}` : s.code }));
    setCourseFormErrors((e) => ({ ...e, code: "" }));
  };

  /** Valida campo por campo y arma el mapa de errores para retroalimentar exactamente qué falta. */
  const validateCourseForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!newCourseForm.name.trim()) errors.name = "El nombre del curso es obligatorio.";
    if (!newCourseForm.code.trim()) {
      errors.code = "El código es obligatorio (no se genera a partir del nombre).";
    } else if (!/^[A-Za-z0-9-]+$/.test(newCourseForm.code.trim())) {
      errors.code = "El código solo admite letras, números y guiones.";
    }
    if (!newCourseForm.credits || newCourseForm.credits < 1 || newCourseForm.credits > 20) {
      errors.credits = "Los créditos deben estar entre 1 y 20.";
    }
    if (newCourseForm.semester !== undefined && (newCourseForm.semester < 1 || newCourseForm.semester > 12)) {
      errors.semester = "El semestre debe estar entre 1 y 12.";
    }
    if (!newCourseForm.is_common_field && !newCourseForm.program_id) {
      errors.program_id = "Selecciona a qué programa pertenece el curso (o márcalo como Campo Común).";
    }
    return errors;
  };

  const handleCreateCourse = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errors = validateCourseForm();
    setCourseFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Faltan campos por completar", { description: Object.values(errors).join(" ") });
      return;
    }

    setSubmittingCourse(true);
    try {
      const payload = {
        name: newCourseForm.name,
        code: newCourseForm.code,
        program_id: newCourseForm.is_common_field ? null : newCourseForm.program_id,
        component: newCourseForm.component || null,
        credits: newCourseForm.credits,
        semester: newCourseForm.semester || null,
        is_common_field: newCourseForm.is_common_field,
      };

      if (editingCourseId) {
        // PUT: actualiza el curso existente, nunca crea uno nuevo.
        await apiUpdateCourse(editingCourseId, payload);
        toast.success("Curso actualizado correctamente");
      } else {
        await apiCreateCourse(payload);
        toast.success("Curso creado correctamente");
      }

      closeCourseDialog();
      await reloadCourses();
    } catch (e) {
      toast.error(editingCourseId ? "No se pudo actualizar el curso" : "No se pudo crear el curso", {
        description: formatApiError(e),
      });
    } finally {
      setSubmittingCourse(false);
    }
  };

  // ELIMINAR CURSO (solo coordinación)
  const handleDeleteCourse = async (course: ClassroomCourse) => {
    if (!window.confirm(`¿Eliminar el curso "${course.name}" (${course.code})? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingCourseId(course.id);
    try {
      await apiDeleteCourse(course.id);
      toast.success("Curso eliminado correctamente");
      if (selectedCourse?.id === course.id) {
        setSelectedCourse(null);
        setAssignedTeachers([]);
      }
      await reloadCourses();
    } catch (e) {
      toast.error("No se pudo eliminar el curso", {
        description: formatApiError(e),
      });
    } finally {
      setDeletingCourseId(null);
    }
  };


  // DUPLICAR CURSO (nuevo código; copia el plan de aula más reciente como base editable)
  const handleDuplicateCourse = async (course: ClassroomCourse) => {
    const newCode = window.prompt(`Nuevo código para la copia de "${course.name}" (${course.code}):`, "");
    if (!newCode || !newCode.trim()) return;

    setDuplicatingCourseId(course.id);
    try {
      await apiDuplicateCourse(course.id, { code: newCode.trim() });
      toast.success("Curso duplicado correctamente", {
        description: "El plan de aula más reciente se copió como base editable e independiente.",
      });
      await reloadCourses();
    } catch (e) {
      toast.error("No se pudo duplicar el curso", { description: formatApiError(e) });
    } finally {
      setDuplicatingCourseId(null);
    }
  };

  // BUSCAR DOCENTES
  const handleSearchTeachers = useCallback(async (query: string) => {
    setTeacherSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const results = await apiSearchTeachers({
        search: query,
        role_id: 4, // role_id 4 = docente
      });
      setSearchResults(results || []);
    } catch (e) {
      toast.error("No se pudieron buscar docentes", {
        description: formatApiError(e),
      });
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  // TOGGLE SELECCIÓN DE DOCENTE
  const toggleTeacherSelection = (teacherId: string) => {
    setSelectedTeachers((prev) =>
      prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  // ASIGNAR DOCENTES SELECCIONADOS
  const handleAssignTeachers = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedCourse || selectedTeachers.length === 0) return;

    setSubmittingAssignment(true);
    try {
      await apiAssignTeachersToCourse(selectedCourse.id, selectedTeachers);

      toast.success("Docentes asignados correctamente");

      setTeacherSearch("");
      setSearchResults([]);
      setSelectedTeachers([]);
      setOpenAssignDialog(false);
      await loadAssignedTeachers(selectedCourse.id);
    } catch (e) {
      toast.error("No se pudieron asignar los docentes", {
        description: formatApiError(e),
      });
    } finally {
      setSubmittingAssignment(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoadingBootstrap(true);
      try {
        const me = await ensureClassroomSession(user);
        setClassroomUser(me);
        await reloadCourses();
        apiListPrograms().then(setAllPrograms).catch(() => {});
        apiListFaculties().then(setFaculties).catch(() => {});
      } catch (e) {
        toast.error("No se pudo inicializar el módulo de asignaciones", {
          description: formatApiError(e),
        });
      } finally {
        setLoadingBootstrap(false);
      }
    };
    bootstrap();
  }, [reloadCourses, user]);

  const handleSelectCourse = async (course: ClassroomCourse) => {
    setSelectedCourse(course);
    await loadAssignedTeachers(course.id);
  };

  const programs = useMemo(
    () =>
      [
        ...new Map(
          courses.map((c) => [
            c.program?.id,
            c.program,
          ])
        ).values(),
      ].filter(Boolean),
    [courses]
  );

  const filteredProgramOptions = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    if (!q) return allPrograms;
    return allPrograms.filter((p) => p.name.toLowerCase().includes(q) || p.faculty?.name.toLowerCase().includes(q));
  }, [allPrograms, programQuery]);

  const programExactMatch = useMemo(
    () => allPrograms.some((p) => p.name.trim().toLowerCase() === programQuery.trim().toLowerCase()),
    [allPrograms, programQuery]
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (c) =>
          (!filterProgramId || c.program?.id === filterProgramId) &&
          (!searchCourse ||
            c.name.toLowerCase().includes(searchCourse.toLowerCase()) ||
            c.code.toLowerCase().includes(searchCourse.toLowerCase()))
      ),
    [courses, filterProgramId, searchCourse]
  );

  if (loadingBootstrap) {
    return (
      <div className="py-10 text-center text-gray-500">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#1e3a5f]" />
        Cargando módulo de asignaciones...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Card className="border-[#1e3a5f]/15 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-[#ffc107]" /> Asignar Docentes a Cursos
              </CardTitle>
              <CardDescription className="text-blue-100">
                Gestiona la asignación de docentes a los cursos disponibles.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingCourseId(null);
                setOpenCreateCourseDialog(true);
              }}
              className="gap-2 bg-[#ffc107] hover:bg-[#ffb300] text-[#1e3a5f]"
            >
              <Plus className="h-4 w-4" /> Crear Curso
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LISTA DE CURSOS */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <Filter className="h-4 w-4" /> Cursos
            </CardTitle>
            <CardDescription>
              {filteredCourses.length} / {courses.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* FILTROS */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Programa</Label>
              <select
                value={filterProgramId}
                onChange={(e) => setFilterProgramId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">Todos</option>
                {programs.map((p) => (
                  <option key={p!.id} value={p!.id}>
                    {p!.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Buscar</Label>
              <Input
                type="text"
                placeholder="Nombre o código..."
                value={searchCourse}
                onChange={(e) => setSearchCourse(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setFilterProgramId("");
                setSearchCourse("");
              }}
            >
              Limpiar filtros
            </Button>

            {/* LISTA */}
            <div className="space-y-2 border-t pt-3 max-h-96 overflow-y-auto">
              {loadingCourses ? (
                <div className="text-center py-4 text-gray-500">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No hay cursos disponibles
                </div>
              ) : (
                filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    className={`group cursor-pointer rounded-lg border-2 p-2 transition-all ${
                      selectedCourse?.id === course.id
                        ? "border-[#1e3a5f] bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{course.name}</p>
                        <p className="text-xs text-gray-500">{course.code}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          title="Duplicar curso (nuevo código)"
                          disabled={duplicatingCourseId === course.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateCourse(course);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-[#1e3a5f] disabled:opacity-50"
                        >
                          {duplicatingCourseId === course.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Editar curso"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditCourse(course);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-[#1e3a5f]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Eliminar curso"
                          disabled={deletingCourseId === course.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(course);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingCourseId === course.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* DETALLE */}
        {selectedCourse ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-[#1e3a5f]">
                    {selectedCourse.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedCourse.code} • {selectedCourse.program?.name}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditCourse(selectedCourse)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletingCourseId === selectedCourse.id}
                    onClick={() => handleDeleteCourse(selectedCourse)}
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {deletingCourseId === selectedCourse.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Eliminar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedTeachers([]);
                      setTeacherSearch("");
                      setSearchResults([]);
                      setOpenAssignDialog(true);
                    }}
                    className="gap-2 bg-[#1e3a5f] hover:bg-[#152a45]"
                  >
                    <Plus className="h-4 w-4" /> Asignar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Docentes asignados ({assignedTeachers.length})
                </h4>
                {loadingTeachers ? (
                  <div className="text-center py-4 text-gray-500">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </div>
                ) : assignedTeachers.length === 0 ? (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      No hay docentes asignados a este curso.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {assignedTeachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 p-3 bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{teacher.email}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-800">
                          Asignado
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-gray-500">
              <Users className="mx-auto h-12 w-12 mb-3 text-gray-300" />
              <p>Selecciona un curso para gestionar sus asignaciones</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* DIALOG PARA CREAR/EDITAR CURSO */}
      <Dialog open={openCreateCourseDialog} onOpenChange={(open) => (open ? setOpenCreateCourseDialog(true) : closeCourseDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCourseId ? "Editar Curso" : "Crear Nuevo Curso"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCourse} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="course-name" className="font-semibold">
                Nombre del Curso <span className="text-red-500">*</span>
              </Label>
              <Input
                id="course-name"
                value={newCourseForm.name}
                onChange={(e) => {
                  setNewCourseForm({ ...newCourseForm, name: e.target.value });
                  setCourseFormErrors((err) => ({ ...err, name: "" }));
                }}
                placeholder="Ej: Programación Web"
                className={`mt-1 ${courseFormErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {courseFormErrors.name && (
                <p className="mt-1 text-xs text-red-600">{courseFormErrors.name}</p>
              )}
              {checkingDuplicate && (
                <p className="mt-1 text-xs text-gray-400">Verificando si ya existe...</p>
              )}
              {!checkingDuplicate && duplicateMatches.length > 0 && (
                <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  Ya existe un curso con este nombre en: {duplicateMatches.map((m) => `${m.program_name} (${m.code})`).join(", ")}.
                  Puedes continuar si se trata de una variante distinta (ej. otros créditos); solo se bloquea si el código de curso se repite.
                </div>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="course-program" className="font-semibold">
                Programa {!newCourseForm.is_common_field && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="course-program"
                value={programQuery}
                disabled={newCourseForm.is_common_field}
                placeholder="Escribe para buscar o crear un programa…"
                onFocus={() => setShowProgramDropdown(true)}
                onBlur={() => setTimeout(() => setShowProgramDropdown(false), 150)}
                onChange={(e) => {
                  setProgramQuery(e.target.value);
                  setShowProgramDropdown(true);
                  // El texto ya no corresponde al programa seleccionado hasta que se elija uno de la lista.
                  setNewCourseForm((s) => ({ ...s, program_id: "" }));
                }}
                className={`mt-1 disabled:bg-gray-100 disabled:text-gray-400 ${courseFormErrors.program_id ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {showProgramDropdown && !newCourseForm.is_common_field && (
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
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${newCourseForm.program_id === p.id ? "bg-orange-100 font-semibold text-[#1e3a5f]" : "text-gray-700"}`}
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
              {courseFormErrors.program_id && (
                <p className="mt-1 text-xs text-red-600">{courseFormErrors.program_id}</p>
              )}
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
              <Label htmlFor="course-component" className="font-semibold">
                Componente
              </Label>
              <select
                id="course-component"
                value={newCourseForm.component}
                onChange={(e) => setNewCourseForm({ ...newCourseForm, component: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {["Campo Común", "Ciencias Básicas", "Campo Disciplinar"].map((group) => (
                  <optgroup key={group} label={group}>
                    {COMPONENT_OPTIONS.filter((o) => o.group === group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="course-code" className="font-semibold">
                Código <span className="text-red-500">*</span>
              </Label>
              {/* El código es un identificador propio del curso: no se deriva del nombre, se digita o sugiere aparte. */}
              <div className="mt-1 flex gap-2">
                <Input
                  id="course-code"
                  value={newCourseForm.code}
                  onChange={(e) => {
                    setNewCourseForm({ ...newCourseForm, code: e.target.value });
                    setCourseFormErrors((err) => ({ ...err, code: "" }));
                  }}
                  placeholder="Ej: PROG-101"
                  className={courseFormErrors.code ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                <Button type="button" variant="outline" onClick={suggestCourseCode} disabled={!newCourseForm.name.trim()}>
                  Sugerir
                </Button>
              </div>
              {courseFormErrors.code && (
                <p className="mt-1 text-xs text-red-600">{courseFormErrors.code}</p>
              )}
            </div>

            <div>
              <Label htmlFor="course-credits" className="font-semibold">
                Créditos <span className="text-red-500">*</span>
              </Label>
              <Input
                id="course-credits"
                type="number"
                value={newCourseForm.credits}
                onChange={(e) => {
                  setNewCourseForm({ ...newCourseForm, credits: parseInt(e.target.value) || 3 });
                  setCourseFormErrors((err) => ({ ...err, credits: "" }));
                }}
                className={`mt-1 ${courseFormErrors.credits ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {courseFormErrors.credits && (
                <p className="mt-1 text-xs text-red-600">{courseFormErrors.credits}</p>
              )}
            </div>

            <div>
              <Label htmlFor="course-semester" className="font-semibold">
                Semestre (Opcional)
              </Label>
              <Input
                id="course-semester"
                type="number"
                value={newCourseForm.semester || ""}
                onChange={(e) => {
                  setNewCourseForm({ ...newCourseForm, semester: e.target.value ? parseInt(e.target.value) : undefined });
                  setCourseFormErrors((err) => ({ ...err, semester: "" }));
                }}
                placeholder="Ej: 1, 2, 3..."
                className={`mt-1 ${courseFormErrors.semester ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {courseFormErrors.semester && (
                <p className="mt-1 text-xs text-red-600">{courseFormErrors.semester}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="common-field"
                checked={newCourseForm.is_common_field}
                onChange={(e) => {
                  setNewCourseForm({ ...newCourseForm, is_common_field: e.target.checked });
                  setCourseFormErrors((err) => ({ ...err, program_id: "" }));
                }}
                className="rounded"
              />
              <Label htmlFor="common-field" className="font-semibold cursor-pointer">
                Campo Común (sin programa específico)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCourseDialog}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingCourse}
                className="gap-2 bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {submittingCourse && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingCourseId ? "Guardar Cambios" : "Crear Curso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG PARA ASIGNAR DOCENTES */}
      <Dialog open={openAssignDialog} onOpenChange={setOpenAssignDialog}>
        <DialogContent className="max-w-md max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar Docentes</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleAssignTeachers(e); }} className="space-y-4">
            {/* BÚSQUEDA DE DOCENTES */}
            <div>
              <Label className="font-semibold">Buscar Docentes por Correo</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="ej: profesor@universidad.edu.co"
                  value={teacherSearch}
                  onChange={(e) => {
                    e.preventDefault();
                    handleSearchTeachers(e.target.value);
                  }}
                  className="pl-8"
                />
              </div>
              {loadingSearch && (
                <div className="mt-2 text-center text-sm text-gray-500">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              )}
            </div>

            {/* RESULTADOS DE BÚSQUEDA */}
            {teacherSearch && (
              <div className="border rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    {loadingSearch ? "Buscando..." : "No se encontraron docentes"}
                  </p>
                ) : (
                  searchResults.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white cursor-pointer hover:bg-blue-50"
                      onClick={() => toggleTeacherSelection(teacher.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeachers.includes(teacher.id)}
                        onChange={() => toggleTeacherSelection(teacher.id)}
                        className="cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                        <p className="text-xs text-gray-500">{teacher.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* DOCENTES SELECCIONADOS */}
            {selectedTeachers.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">
                  Docentes seleccionados: {selectedTeachers.length}
                </p>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {selectedTeachers.map((teacherId) => {
                    const teacher = searchResults.find((t) => t.id === teacherId);
                    return (
                      <div
                        key={teacherId}
                        className="flex items-center justify-between bg-blue-50 p-2 rounded text-sm"
                      >
                        <span>{teacher?.name || teacherId}</span>
                        <button
                          type="button"
                          onClick={() => toggleTeacherSelection(teacherId)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenAssignDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingAssignment || selectedTeachers.length === 0}
                className="gap-2 bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {submittingAssignment && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Asignar {selectedTeachers.length > 0 && `(${selectedTeachers.length})`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
