/**
 * @file GestionSLA.tsx
 * @description Pantalla de administración de políticas SLA (Service Level Agreement).
 *
 * Un SLA define el número de días hábiles máximo para resolver una PQRS
 * según su tipo (P/Q/R/S/F) y nivel de prioridad (HIGH/MED/LOW).
 *
 * Funcionalidades:
 *   - Listar todas las políticas SLA existentes con filtrado por tipo y prioridad.
 *   - Crear nuevas políticas mediante un formulario deslizable.
 *   - Editar políticas existentes (el formulario se prellena con los datos actuales).
 *   - Eliminar políticas con confirmación previa.
 *
 * @param onClose - Callback opcional para cerrar el panel cuando se usa embebido.
 *
 * @requires role ADMIN — debe estar protegido en `routes.tsx`.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { TrendingUp, Plus, Edit, Trash2, Loader2, Search } from "lucide-react";
import {
  apiListSLA, apiGetSLA, apiCreateSLA, apiUpdateSLA, apiDeleteSLA,
  formatApiError,
  PQRS_TYPE_LABEL, PQRS_PRIORITY_LABEL,
  type SLAPolicy, type SLAPayload, type PqrsType, type PqrsPriority,
} from "../../lib/api";

/** Alias del payload de SLA para tipar el formulario de creación/edición. */
interface SLAForm extends SLAPayload {}

/** Orden fijo de prioridades para mostrar las políticas de mayor a menor urgencia. */
const PRIORITY_ORDER: PqrsPriority[] = ["HIGH", "MED", "LOW"];
/** Orden canónico de tipos de PQRS según el acrónimo (P-Q-R-S-F). */
const TYPE_ORDER: PqrsType[]         = ["P", "Q", "R", "S", "F"];

/** Clases de color CSS para los badges de prioridad en la tabla de SLA. */
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "bg-orange-100 text-orange-700",
  MED:  "bg-yellow-100 text-yellow-700",
  LOW:  "bg-green-100 text-green-700",
};

/**
 * Componente principal de gestión de SLAs.
 * @param onClose - Callback opcional para cerrar el panel cuando se usa embebido.
 */
export function GestionSLA({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();

  /** Lista completa de políticas SLA cargadas del backend */
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  /** true mientras se cargan las políticas inicialmente */
  const [loading, setLoading] = useState(true);
  /** true mientras se envía el formulario de creación o edición */
  const [submitting, setSubmitting] = useState(false);
  /** Controla la visibilidad del formulario deslizable */
  const [showForm, setShowForm] = useState(false);
  /** Política seleccionada para editar; null si se está creando una nueva */
  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);

  // ── Filtros de la tabla ────────────────────────────────────────────────────────
  /** Texto libre para filtrar políticas por nombre */
  const [busqueda, setBusqueda] = useState("");
  /** Filtro por tipo de PQRS ("todos" = sin filtrar) */
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  /** Filtro por nivel de prioridad ("todos" = sin filtrar) */
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("todos");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SLAForm>({
    defaultValues: {
      name: "",
      pqrs_type: "P",
      priority: "MED",
      response_days: 10,
      resolution_days: 15,
      is_business_days: true,
    },
  });

  // ── data loading ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiListSLA();
      const lista: SLAPolicy[] = Array.isArray(res) ? res : (res as any).results ?? [];
      setPolicies(lista);
    } catch (e) {
      toast.error("Error al cargar políticas SLA", { description: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── form handlers ─────────────────────────────────────────────────────────
  const handleEdit = (p: SLAPolicy) => {
    setEditingPolicy(p);
    reset({
      name: p.name,
      pqrs_type: p.pqrs_type,
      priority: p.priority,
      response_days: p.response_days,
      resolution_days: p.resolution_days,
      is_business_days: p.is_business_days ?? true,
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPolicy(null);
    reset();
  };

  const onSubmit = async (data: SLAForm) => {
    setSubmitting(true);
    try {
      if (editingPolicy) {
        const updated = await apiUpdateSLA(editingPolicy.id, data);
        // Usar la respuesta completa (incluye description) en lugar de re-fetch de lista
        setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success("Política SLA actualizada correctamente");
      } else {
        const created = await apiCreateSLA(data);
        // Agregar directamente con todos los campos (incluye description)
        setPolicies(prev => [...prev, created]);
        toast.success("Política SLA creada correctamente");
      }
      handleCancelForm();
    } catch (e) {
      toast.error("Error al guardar política SLA", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: SLAPolicy) => {
    if (!confirm(`¿Eliminar la política SLA "${p.name}"?`)) return;
    try {
      await apiDeleteSLA(p.id);
      toast.success("Política SLA eliminada");
      await cargarDatos();
    } catch (e) {
      toast.error("Error al eliminar política", { description: formatApiError(e) });
    }
  };

  // ── derived (search & filter) ────────────────────────────────────────────
  const tieneResultados = TYPE_ORDER.some(t =>
    (filtroTipo === "todos" || filtroTipo === t) &&
    policies.some(p =>
      p.pqrs_type === t &&
      (filtroPrioridad === "todos" || p.priority === filtroPrioridad) &&
      (busqueda === "" || p.name.toLowerCase().includes(busqueda.toLowerCase()))
    )
  );

  // ── render ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Políticas SLA</h1>
          </div>
          <p className="text-gray-600">
            Define los días hábiles máximos para responder según tipo y prioridad de PQRS.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onClose ? onClose() : navigate("/admin")}>
            {onClose ? "Cerrar" : "Volver al Panel"}
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva Política
          </Button>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) handleCancelForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Editar Política SLA" : "Nueva Política SLA"}</DialogTitle>
            <DialogDescription>
              Define cuántos días hábiles tiene el equipo para resolver una PQRS de este tipo y prioridad.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sla-name">Nombre *</Label>
                <Input
                  id="sla-name"
                  placeholder="Ej: SLA Queja Alta Prioridad"
                  {...register("name", {
                    required: "El nombre es obligatorio",
                    minLength: { value: 3, message: "Mínimo 3 caracteres" },
                  })}
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>

              {/* PQRS Type */}
              <div className="space-y-2">
                <Label htmlFor="sla-type">Tipo de PQRS *</Label>
                <select
                  id="sla-type"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  {...register("pqrs_type", { required: true })}
                >
                  {TYPE_ORDER.map(t => (
                    <option key={t} value={t}>{PQRS_TYPE_LABEL[t]} ({t})</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="sla-priority">Prioridad *</Label>
                <select
                  id="sla-priority"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  {...register("priority", { required: true })}
                >
                  {PRIORITY_ORDER.map(p => (
                    <option key={p} value={p}>{PQRS_PRIORITY_LABEL[p]} ({p})</option>
                  ))}
                </select>
              </div>

              {/* Response days */}
              <div className="space-y-2">
                <Label htmlFor="sla-resp-days">Días de respuesta *</Label>
                <Input
                  id="sla-resp-days"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Ej: 10"
                  {...register("response_days", {
                    required: "Los días de respuesta son obligatorios",
                    min: { value: 1, message: "Mínimo 1 día" },
                    max: { value: 365, message: "Máximo 365 días" },
                    valueAsNumber: true,
                  })}
                />
                {errors.response_days && <p className="text-sm text-red-600">{errors.response_days.message}</p>}
              </div>

              {/* Resolution days */}
              <div className="space-y-2">
                <Label htmlFor="sla-res-days">Días de resolución *</Label>
                <Input
                  id="sla-res-days"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Ej: 15"
                  {...register("resolution_days", {
                    required: "Los días de resolución son obligatorios",
                    min: { value: 1, message: "Mínimo 1 día" },
                    max: { value: 365, message: "Máximo 365 días" },
                    valueAsNumber: true,
                  })}
                />
                {errors.resolution_days && <p className="text-sm text-red-600">{errors.resolution_days.message}</p>}
              </div>

              {/* Business days toggle */}
              <div className="space-y-2 sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    {...register("is_business_days")}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Contar solo días hábiles (excluye fines de semana)
                  </span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelForm} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                  : editingPolicy ? "Actualizar Política" : "Crear Política"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      {policies.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-white h-9"
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
          >
            <option value="todos">Todos los tipos</option>
            {TYPE_ORDER.map(t => (
              <option key={t} value={t}>{PQRS_TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-white h-9"
            value={filtroPrioridad}
            onChange={e => setFiltroPrioridad(e.target.value)}
          >
            <option value="todos">Todas las prioridades</option>
            {PRIORITY_ORDER.map(p => (
              <option key={p} value={p}>{PQRS_PRIORITY_LABEL[p]}</option>
            ))}
          </select>
          {(busqueda || filtroTipo !== "todos" || filtroPrioridad !== "todos") && (
            <Button variant="ghost" size="sm" className="text-gray-500"
              onClick={() => { setBusqueda(""); setFiltroTipo("todos"); setFiltroPrioridad("todos"); }}>
              Limpiar
            </Button>
          )}
        </div>
      )}

      {/* Policies grid grouped by Type */}
      {policies.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          <TrendingUp className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="font-medium">No hay políticas SLA configuradas</p>
          <p className="text-sm mt-1">Cree la primera política usando el botón superior</p>
        </div>
      ) : (
        <div className="space-y-8">
          {!tieneResultados && policies.length > 0 && (
            <div className="py-12 text-center text-gray-500">
              <Search className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="font-medium">Sin resultados</p>
              <p className="text-sm mt-1">Intente con otro término o cambie los filtros</p>
            </div>
          )}
          {TYPE_ORDER
            .filter(t =>
              (filtroTipo === "todos" || filtroTipo === t) &&
              policies.some(p =>
                p.pqrs_type === t &&
                (filtroPrioridad === "todos" || p.priority === filtroPrioridad) &&
                (busqueda === "" || p.name.toLowerCase().includes(busqueda.toLowerCase()))
              )
            )
            .map(type => (
            <div key={type}>
              <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {PQRS_TYPE_LABEL[type]} ({type})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {PRIORITY_ORDER
                  .filter(pr =>
                    (filtroPrioridad === "todos" || filtroPrioridad === pr) &&
                    policies.some(p =>
                      p.pqrs_type === type && p.priority === pr &&
                      (busqueda === "" || p.name.toLowerCase().includes(busqueda.toLowerCase()))
                    )
                  )
                  .map(priority => {
                    const p = policies.find(pl => pl.pqrs_type === type && pl.priority === priority)!;
                    return (
                      <Card key={p.id} className="border">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge className={`text-xs mb-1 ${PRIORITY_COLOR[priority] ?? ""}`}>
                                {PQRS_PRIORITY_LABEL[priority]}
                              </Badge>
                              <CardTitle className="text-sm leading-tight">{p.name}</CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-center py-2 bg-blue-50 rounded-lg">
                              <p className="text-2xl font-bold text-blue-700">{p.response_days}</p>
                              <p className="text-xs text-blue-500">respuesta</p>
                            </div>
                            <div className="text-center py-2 bg-indigo-50 rounded-lg">
                              <p className="text-2xl font-bold text-indigo-700">{p.resolution_days}</p>
                              <p className="text-xs text-indigo-500">resolución</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">
                            {p.is_business_days ? "días hábiles" : "días calendario"}
                          </p>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleEdit(p)}
                            >
                              <Edit className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(p)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                }
              </div>
            </div>
          ))}

          {/* Flat list of any uncategorized policies */}
          {policies.some(p => !TYPE_ORDER.includes(p.pqrs_type)) && (
            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Otras políticas</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {policies.filter(p => !TYPE_ORDER.includes(p.pqrs_type)).map(p => (
                  <Card key={p.id} className="border">
                    <CardContent className="p-4">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="text-sm text-gray-500">
                        {p.pqrs_type} · {PQRS_PRIORITY_LABEL[p.priority]}
                      </p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {p.response_days}d resp / {p.resolution_days}d resol
                        {p.is_business_days ? " (háb.)" : " (cal.)"}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>
                          <Edit className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
