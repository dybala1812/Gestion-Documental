import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "../../components/ui/alert-dialog";
import {
  Image, Plus, Trash2, Loader2, ArrowLeft, ArrowUp, ArrowDown,
  Eye, EyeOff, Upload, X, TriangleAlert,
} from "lucide-react";
import {
  apiAdminListHeroImages, apiCreateHeroImage, apiUpdateHeroImage, apiDeleteHeroImage,
  formatApiError,
  type HeroImage,
  API_BASE,
} from "../../lib/api";

function resolveImageUrl(url: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export function GestionHeroImages({ onClose }: { onClose?: () => void } = {}) {
  const navigate = useNavigate();

  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HeroImage | null>(null);

  // Form fields
  const [altText, setAltText] = useState("");
  const [order, setOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiAdminListHeroImages();
      const lista: HeroImage[] = Array.isArray(data)
        ? data
        : (data as any).results ?? [];
      setImages(lista.sort((a, b) => a.order - b.order));
    } catch (e) {
      toast.error("Error al cargar imágenes", { description: formatApiError(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function resetForm() {
    setAltText("");
    setOrder(images.length + 1);
    setIsActive(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function abrirForm() {
    resetForm();
    setShowForm(true);
  }

  function cerrarForm() {
    setShowForm(false);
    resetForm();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Selecciona una imagen");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("image", selectedFile);
      fd.append("alt_text", altText);
      fd.append("order", String(order));
      fd.append("is_active", String(isActive));
      await apiCreateHeroImage(fd);
      toast.success("Imagen agregada correctamente");
      cerrarForm();
      cargar();
    } catch (e) {
      toast.error("Error al guardar imagen", { description: formatApiError(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(img: HeroImage) {
    try {
      await apiUpdateHeroImage(img.id, { is_active: !img.is_active });
      setImages(prev =>
        prev.map(i => i.id === img.id ? { ...i, is_active: !img.is_active } : i)
      );
      toast.success(img.is_active ? "Imagen ocultada" : "Imagen activada");
    } catch (e) {
      toast.error("Error al actualizar", { description: formatApiError(e) });
    }
  }

  async function moverOrden(img: HeroImage, direccion: "up" | "down") {
    const idx = images.findIndex(i => i.id === img.id);
    if (direccion === "up" && idx === 0) return;
    if (direccion === "down" && idx === images.length - 1) return;

    const swapIdx = direccion === "up" ? idx - 1 : idx + 1;
    const swap = images[swapIdx];

    try {
      await Promise.all([
        apiUpdateHeroImage(img.id, { order: swap.order }),
        apiUpdateHeroImage(swap.id, { order: img.order }),
      ]);
      const updated = [...images];
      updated[idx] = { ...img, order: swap.order };
      updated[swapIdx] = { ...swap, order: img.order };
      updated.sort((a, b) => a.order - b.order);
      setImages(updated);
    } catch (e) {
      toast.error("Error al reordenar", { description: formatApiError(e) });
    }
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    try {
      await apiDeleteHeroImage(deleteTarget.id);
      toast.success("Imagen eliminada");
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onClose ? onClose() : navigate("/admin")}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Image className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Imágenes del Hero</h1>
              <p className="text-sm text-gray-500">
                Configura las imágenes que aparecen en la columna derecha de la landing page
              </p>
            </div>
          </div>
          <Button onClick={abrirForm} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Agregar imagen
          </Button>
        </div>

        {/* Formulario de nueva imagen */}
        {showForm && (
          <Card className="mb-6 border-indigo-200 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">Nueva imagen</h2>
                <button onClick={cerrarForm} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Zona de carga */}
                <div>
                  <Label className="mb-1 block">Imagen *</Label>
                  <div
                    className="relative border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 transition-colors bg-indigo-50/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        className="max-h-56 w-full object-contain rounded-lg bg-gray-100"
                      />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-indigo-400" />
                        <p className="text-sm text-indigo-600 font-medium">Haz clic para seleccionar</p>
                        <p className="text-xs text-gray-400">JPG, PNG, WEBP — máx. 5 MB</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onFileChange}
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="alt_text" className="mb-1 block">Texto alternativo</Label>
                    <Input
                      id="alt_text"
                      placeholder="Descripción de la imagen (accesibilidad)"
                      value={altText}
                      onChange={e => setAltText(e.target.value)}
                    />
                  </div>
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
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Visible en la landing</Label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={cerrarForm} disabled={submitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</> : "Guardar imagen"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de imágenes */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay imágenes configuradas</p>
            <p className="text-sm text-gray-400 mt-1">Agrega imágenes para que aparezcan en la landing page</p>
            <Button onClick={abrirForm} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Agregar primera imagen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold px-1">
              {images.length} imagen{images.length !== 1 ? "es" : ""} — las activas se muestran en orden de arriba a abajo
            </p>
            {images.map((img, idx) => (
              <Card
                key={img.id}
                className={`transition-all ${img.is_active ? "border-gray-200" : "border-dashed border-gray-200 opacity-60"}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      <img
                        src={resolveImageUrl(img.image)}
                        alt={img.alt_text || "Hero image"}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {img.alt_text || <span className="italic text-gray-400">Sin texto alternativo</span>}
                      </p>
                      <p className="text-xs text-gray-400">Orden #{img.order}</p>
                    </div>

                    {/* Estado */}
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      img.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {img.is_active ? "Visible" : "Oculta"}
                    </span>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moverOrden(img, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                        title="Subir"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moverOrden(img, "down")}
                        disabled={idx === images.length - 1}
                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                        title="Bajar"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(img)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                        title={img.is_active ? "Ocultar" : "Mostrar"}
                      >
                        {img.is_active
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />
                        }
                      </button>
                      <button
                        onClick={() => setDeleteTarget(img)}
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
              <TriangleAlert className="w-5 h-5" /> Eliminar imagen
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La imagen{" "}
              <strong>{deleteTarget?.alt_text || `#${deleteTarget?.id}`}</strong>{" "}
              será eliminada permanentemente.
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
