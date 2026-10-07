/**
 * @file GestionManual.tsx
 * @description Panel de administración del Manual de Usuario público:
 *   permite al admin cargar videos instructivos (archivo o enlace externo)
 *   y documentos PDF que se muestran en la página pública /manual.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent } from "../../components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "../../components/ui/alert-dialog";
import {
  BookOpen, Plus, Trash2, Loader2, ArrowLeft,
  Eye, EyeOff, Upload, X, TriangleAlert, PlayCircle, FileText, Link as LinkIcon, Pencil,
} from "lucide-react";
import {
  apiAdminListManualResources, apiCreateManualResource, apiUpdateManualResource, apiDeleteManualResource,
  formatApiError,
  type ManualResource,
  API_BASE,
} from "../../lib/api";

function resolveFileUrl(url: string | null) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export function GestionManual({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();

  const [resources, setResources] = useState<ManualResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManualResource | null>(null);
  const [editingItem, setEditingItem] = useState<ManualResource | null>(null);

  // Form fields
  const [resourceType, setResourceType] = useState<"VIDEO" | "PDF">("VIDEO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [order, setOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiAdminListManualResources();
      const lista: ManualResource[] = Array.isArray(data) ? data : (data as any).results ?? [];
      setResources(lista.sort((a, b) => a.order - b.order));
    } catch (e) {
      toast.error("Error al cargar recursos", { description: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function resetForm() {
    setResourceType("VIDEO");
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setOrder(resources.length + 1);
    setIsActive(true);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function abrirForm() {
    setEditingItem(null);
    resetForm();
    setShowForm(true);
  }

  function abrirFormEdicion(item: ManualResource) {
    setEditingItem(item);
    setResourceType(item.resource_type);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setExternalUrl(item.external_url ?? "");
    setOrder(item.order);
    setIsActive(item.is_active);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(true);
  }

  function cerrarForm() {
    setShowForm(false);
    setEditingItem(null);
    resetForm();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    // En edición, un archivo/enlace ya existente cuenta como válido aunque no se reemplace.
    const yaTieneArchivo = !!editingItem?.file;
    const yaTieneEnlace = !!editingItem?.external_url;
    if (resourceType === "PDF" && !selectedFile && !yaTieneArchivo) {
      toast.error("Selecciona un archivo PDF");
      return;
    }
    if (resourceType === "VIDEO" && !selectedFile && !yaTieneArchivo && !externalUrl.trim() && !yaTieneEnlace) {
      toast.error("Sube un video o pega un enlace externo");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("resource_type", resourceType);
      fd.append("title", title);
      fd.append("description", description);
      fd.append("order", String(order));
      fd.append("is_active", String(isActive));
      if (selectedFile) fd.append("file", selectedFile);
      if (resourceType === "VIDEO") fd.append("external_url", externalUrl.trim());
      if (editingItem) {
        await apiUpdateManualResource(editingItem.id, fd);
        toast.success("Recurso actualizado correctamente");
      } else {
        await apiCreateManualResource(fd);
        toast.success("Recurso agregado correctamente");
      }
      cerrarForm();
      cargar();
    } catch (e) {
      toast.error("Error al guardar recurso", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: ManualResource) {
    try {
      await apiUpdateManualResource(item.id, { is_active: !item.is_active });
      setResources(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !item.is_active } : i));
      toast.success(item.is_active ? "Recurso ocultado" : "Recurso activado");
    } catch (e) {
      toast.error("Error al actualizar", { description: formatApiError(e) });
    }
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    try {
      await apiDeleteManualResource(deleteTarget.id);
      toast.success("Recurso eliminado");
      setDeleteTarget(null);
      cargar();
    } catch (e) {
      toast.error("Error al eliminar", { description: formatApiError(e) });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onClose ? onClose() : navigate("/admin")}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manual de Usuario</h1>
              <p className="text-sm text-gray-500">
                Carga los videos instructivos y PDFs visibles públicamente en /manual
              </p>
            </div>
          </div>
          <Button onClick={abrirForm} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Agregar recurso
          </Button>
        </div>

        {/* Formulario de nuevo recurso */}
        {showForm && (
          <Card className="mb-6 border-indigo-200 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">{editingItem ? "Editar recurso" : "Nuevo recurso"}</h2>
                <button onClick={cerrarForm} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="mb-1 block">Tipo de recurso *</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setResourceType("VIDEO"); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 text-sm font-medium transition-colors ${
                        resourceType === "VIDEO" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"
                      }`}
                    >
                      <PlayCircle className="w-4 h-4" /> Video
                    </button>
                    <button
                      type="button"
                      onClick={() => { setResourceType("PDF"); setExternalUrl(""); }}
                      className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 text-sm font-medium transition-colors ${
                        resourceType === "PDF" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"
                      }`}
                    >
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title" className="mb-1 block">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ej: Cómo radicar una PQRS"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="mb-1 block">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    placeholder="Breve descripción del contenido"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                {/* Zona de carga de archivo */}
                <div>
                  <Label className="mb-1 block">
                    {resourceType === "PDF"
                      ? (editingItem?.file ? "Archivo PDF (deja vacío para conservar el actual)" : "Archivo PDF *")
                      : "Archivo de video (opcional si hay enlace)"}
                  </Label>
                  <div
                    className="relative border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 transition-colors bg-indigo-50/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-indigo-400" />
                    <p className="text-sm text-indigo-600 font-medium">Haz clic para seleccionar</p>
                    <p className="text-xs text-gray-400">
                      {resourceType === "PDF" ? "PDF — máx. 20 MB" : "MP4, WebM, MOV — máx. 200 MB"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={resourceType === "PDF" ? "application/pdf" : "video/*"}
                      className="hidden"
                      onChange={onFileChange}
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                {/* Enlace externo — solo para videos */}
                {resourceType === "VIDEO" && (
                  <div>
                    <Label htmlFor="external_url" className="mb-1 flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5" /> Enlace externo (opcional si hay archivo)
                    </Label>
                    <Input
                      id="external_url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={externalUrl}
                      onChange={e => setExternalUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order" className="mb-1 block">Orden</Label>
                    <Input
                      id="order"
                      type="number"
                      min={1}
                      value={order}
                      onChange={e => setOrder(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">Visible en /manual</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={cerrarForm} disabled={submitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submitting}>
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</>
                      : editingItem ? "Guardar cambios" : "Guardar recurso"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de recursos */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay recursos configurados</p>
            <p className="text-sm text-gray-400 mt-1">Agrega videos o PDFs para que aparezcan en el manual público</p>
            <Button onClick={abrirForm} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Agregar primer recurso
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold px-1">
              {resources.length} recurso{resources.length !== 1 ? "s" : ""}
            </p>
            {resources.map(item => (
              <Card
                key={item.id}
                className={`transition-all ${item.is_active ? "border-gray-200" : "border-dashed border-gray-200 opacity-60"}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                      {item.resource_type === "VIDEO"
                        ? <PlayCircle className="w-5 h-5 text-indigo-500" />
                        : <FileText className="w-5 h-5 text-orange-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400">
                        Orden #{item.order}
                        {item.resource_type === "VIDEO" && item.external_url && (
                          <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-500 hover:underline">
                            enlace externo
                          </a>
                        )}
                        {item.file && (
                          <a href={resolveFileUrl(item.file)} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-500 hover:underline">
                            ver archivo
                          </a>
                        )}
                      </p>
                    </div>

                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {item.is_active ? "Visible" : "Oculto"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirFormEdicion(item)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                        title={item.is_active ? "Ocultar" : "Mostrar"}
                      >
                        {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirmación de eliminación */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <TriangleAlert className="w-5 h-5" /> Eliminar recurso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El recurso{" "}
              <strong>{deleteTarget?.title}</strong>{" "}
              será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
