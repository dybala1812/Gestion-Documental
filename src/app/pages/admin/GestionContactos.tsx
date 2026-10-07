/**
 * @file GestionContactos.tsx
 * @description Pantalla de administración de contactos institucionales.
 *
 * Permite al administrador gestionar los contactos de la institución
 * (funcionarios de enlace por dependencia) que son visibles públicamente.
 *
 * Funcionalidades:
 *   - Listar todos los contactos con filtrado por nombre/cargo/correo.
 *   - Crear nuevos contactos mediante un formulario deslizable.
 *   - Editar contactos existentes (el formulario se prellena con los datos actuales).
 *   - Eliminar contactos con confirmación previa.
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
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "../../components/ui/alert-dialog";
import { Users, Plus, Edit, Trash2, Loader2, Search, Mail, Briefcase, Building2, TriangleAlert, Phone } from "lucide-react";
import {
  apiListContacts, apiCreateContact, apiUpdateContact, apiDeleteContact,
  apiListDependencies,
  formatApiError,
  type Contact, type ContactPayload, type Dependency,
} from "../../lib/api";

/** Alias del payload de contacto para tipar el formulario de creación/edición. */
interface ContactForm extends ContactPayload {}

/**
 * Componente principal de gestión de contactos institucionales.
 * @param onClose - Callback opcional para cerrar el panel cuando se usa embebido.
 */
export function GestionContactos({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();

  /** Lista completa de contactos cargados del backend */
  const [contacts, setContacts] = useState<Contact[]>([]);
  /** Lista de dependencias disponibles para el selector */
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  /** true mientras se cargan los datos inicialmente */
  const [loading, setLoading] = useState(true);
  /** true mientras se envía el formulario de creación o edición */
  const [submitting, setSubmitting] = useState(false);
  /** Controla la visibilidad del modal de creación/edición */
  const [showForm, setShowForm] = useState(false);
  /** Contacto seleccionado para editar; null si se está creando uno nuevo */
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  /** Contacto pendiente de eliminar; null si no hay confirmación abierta */
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  /** Texto libre para filtrar la lista */
  const [busqueda, setBusqueda] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactForm>({
    defaultValues: {
      nombre: "",
      cargo: "",
      dependencia: "",
      correo: "",
      telefono: "",
    },
  });

  // Pre-cargar valores en el formulario DESPUÉS de que los inputs se monten.
  // Se ejecuta cuando editingContact cambia y showForm está activo,
  // garantizando que register() ya se ejecutó antes de reset().
  useEffect(() => {
    if (showForm && editingContact) {
      reset({
        nombre: editingContact.nombre,
        cargo: editingContact.cargo,
        dependencia: editingContact.dependencia,
        correo: editingContact.correo,
        telefono: editingContact.telefono ?? "",
      });
    }
  }, [showForm, editingContact, reset]);

  // ── data loading ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [contactsRes, depsRes] = await Promise.all([
        apiListContacts(),
        apiListDependencies(),
      ]);
      const lista: Contact[] = Array.isArray(contactsRes)
        ? contactsRes
        : (contactsRes as any).results ?? [];
      const deps: Dependency[] = Array.isArray(depsRes)
        ? depsRes
        : (depsRes as any).results ?? [];
      setContacts(lista);
      setDependencies(deps);
    } catch (e) {
      toast.error("Error al cargar contactos", { description: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const resolveDependencyName = (depId: string) => {
    const dep = dependencies.find(d => d.id === depId);
    return dep?.name ?? depId;
  };

  // ── form handlers ─────────────────────────────────────────────────────────
  const handleEdit = (c: Contact) => {
    setEditingContact(c);
    setShowForm(true);
    // El reset real se hace en el useEffect de arriba, una vez que los inputs
    // ya están montados y registrados con react-hook-form.
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    reset();
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingContact(null);
    reset();
  };

  const onSubmit = async (data: ContactForm) => {
    setSubmitting(true);
    try {
      if (editingContact) {
        const updated = await apiUpdateContact(editingContact.id, data);
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success("Contacto actualizado correctamente");
      } else {
        const created = await apiCreateContact(data);
        setContacts(prev => [...prev, created]);
        toast.success("Contacto creado correctamente");
      }
      handleCancelForm();
    } catch (e) {
      toast.error("Error al guardar contacto", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteContact(deleteTarget.id);
      toast.success("Contacto eliminado");
      setContacts(prev => prev.filter(x => x.id !== deleteTarget.id));
    } catch (e) {
      toast.error("Error al eliminar contacto", { description: formatApiError(e) });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── derived (search) ──────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.cargo.toLowerCase().includes(q) ||
      c.correo.toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q) ||
      resolveDependencyName(c.dependencia).toLowerCase().includes(q)
    );
  });

  // ── render ────────────────────────────────────────────────────────────────
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Contactos Institucionales</h1>
          </div>
          <p className="text-gray-600">
            Administra los funcionarios de enlace visibles públicamente en el portal PQRS.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="outline" onClick={() => onClose ? onClose() : navigate("/admin")}>
            {onClose ? "Cerrar" : "Volver al Panel"}
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      {/* ── Modal de creación / edición ─────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) handleCancelForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
            <DialogDescription>
              Los contactos son visibles públicamente en el portal sin necesidad de iniciar sesión.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="contact-nombre">Nombre completo *</Label>
                <Input
                  id="contact-nombre"
                  placeholder="Ej: Juan Pérez"
                  {...register("nombre", {
                    required: "El nombre es obligatorio",
                    minLength: { value: 2, message: "Mínimo 2 caracteres" },
                  })}
                />
                {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
              </div>

              {/* Cargo */}
              <div className="space-y-2">
                <Label htmlFor="contact-cargo">Cargo *</Label>
                <Input
                  id="contact-cargo"
                  placeholder="Ej: Coordinador PQRS"
                  {...register("cargo", {
                    required: "El cargo es obligatorio",
                    minLength: { value: 2, message: "Mínimo 2 caracteres" },
                  })}
                />
                {errors.cargo && <p className="text-sm text-red-600">{errors.cargo.message}</p>}
              </div>

              {/* Dependencia */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-dep">Dependencia *</Label>
                <select
                  id="contact-dep"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  {...register("dependencia", { required: "Seleccione una dependencia" })}
                >
                  <option value="">— Seleccione —</option>
                  {dependencies.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.dependencia && <p className="text-sm text-red-600">{errors.dependencia.message}</p>}
              </div>

              {/* Correo */}
              <div className="space-y-2">
                <Label htmlFor="contact-correo">Correo electrónico *</Label>
                <Input
                  id="contact-correo"
                  type="email"
                  placeholder="Ej: juan.perez@universidad.edu.co"
                  {...register("correo", {
                    required: "El correo es obligatorio",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Ingrese un correo válido",
                    },
                  })}
                />
                {errors.correo && <p className="text-sm text-red-600">{errors.correo.message}</p>}
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="contact-tel">Teléfono <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <Input
                  id="contact-tel"
                  type="tel"
                  placeholder="Ej: 601 234 5678"
                  {...register("telefono", {
                    pattern: {
                      value: /^[\d\s\-+()]{6,20}$/,
                      message: "Número de teléfono no válido",
                    },
                  })}
                />
                {errors.telefono && <p className="text-sm text-red-600">{errors.telefono.message}</p>}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleCancelForm} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingContact ? "Guardar cambios" : "Crear contacto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog de confirmación de eliminación ────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <TriangleAlert className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a{" "}
              <span className="font-semibold text-gray-800">{deleteTarget?.nombre}</span>?{" "}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, cargo, correo o dependencia…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} {filtered.length === 1 ? "contacto" : "contactos"}
        </span>
      </div>

      {/* Table / Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {busqueda ? "No se encontraron contactos con ese criterio" : "No hay contactos registrados"}
            </p>
            {!busqueda && (
              <Button className="mt-4" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Crear primer contacto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Vista móvil / tablet: tarjetas ─────────────────────────── */}
          <div className="lg:hidden space-y-3">
            {filtered.map(c => (
              <div
                key={c.id}
                className="rounded-lg border bg-white shadow-sm p-4 flex items-start gap-3"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 text-sm font-bold">
                    {c.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Datos */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.nombre}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Briefcase className="h-3 w-3 text-gray-400 shrink-0" />
                    <span className="truncate">{c.cargo}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                    <span className="truncate">
                      {c.dependencia_nombre ?? resolveDependencyName(c.dependencia)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                    <a
                      href={`mailto:${c.correo}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {c.correo}
                    </a>
                  </div>
                  {c.telefono && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                      <a href={`tel:${c.telefono}`} className="hover:underline truncate">{c.telefono}</a>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-blue-600"
                    onClick={() => handleEdit(c)}
                    title="Editar contacto"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-600"
                    onClick={() => setDeleteTarget(c)}
                    title="Eliminar contacto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Vista desktop: tabla ────────────────────────────────────── */}
          <div className="hidden lg:block rounded-lg border bg-white shadow-sm">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo</th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dependencia</th>
                  <th className="w-[22%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Correo</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="w-[8%] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-blue-700 text-xs font-bold">
                            {c.nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-sm text-gray-700 min-w-0">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span className="truncate">{c.cargo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-sm text-gray-700 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span className="truncate">
                          {c.dependencia_nombre ?? resolveDependencyName(c.dependencia)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${c.correo}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline min-w-0"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.correo}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {c.telefono ? (
                        <a
                          href={`tel:${c.telefono}`}
                          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600 hover:underline min-w-0"
                        >
                          <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{c.telefono}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={() => handleEdit(c)}
                          title="Editar contacto"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(c)}
                          title="Eliminar contacto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
