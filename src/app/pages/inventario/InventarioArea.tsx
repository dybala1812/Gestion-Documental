/**
 * @file InventarioArea.tsx
 * @description Módulo de Inventario del Área — conectado al backend REST.
 *
 * Gestiona dos categorías de recursos del área:
 *   1. Licencias de Software — con fecha de vencimiento y alertas automáticas.
 *   2. Material Físico       — sillas, computadores, impresoras, etc.
 *
 * Datos sincronizados con los endpoints /api/pqrs/inventory/* del backend.
 */
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Plus, Edit, Trash2, X, Search, AlertTriangle,
  Package, Monitor, Calendar, AlertCircle, CheckCircle2,
  Clock, Wrench, ChevronRight, FileText, Loader2, History,
  Image as ImageIcon, QrCode, Download, Upload,
  ClipboardList, ExternalLink, Copy as CopyIcon, HardDrive,
} from "lucide-react";
import { AreaInventarioTI } from "../inventario/AreaInventarioTI";
import {
  SoftwareLicenseAPI,
  PhysicalAssetAPI,
  PhysicalAssetImageAPI,
  PhysicalAssetLogEntryAPI,
  AssetLogType,
  ASSET_LOG_TYPE_LABEL,
  CreateAssetLogPayload,
  InventoryProblemAPI,
  LicenseStatus,
  AssetCondicion,
  ProblemEstado,
  apiListSoftwareLicenses,
  apiCreateSoftwareLicense,
  apiUpdateSoftwareLicense,
  apiDeleteSoftwareLicense,
  apiListPhysicalAssets,
  apiCreatePhysicalAsset,
  apiUpdatePhysicalAsset,
  apiDeletePhysicalAsset,
  apiUploadAssetImage,
  apiDeleteAssetImage,
  apiFetchAssetQRBlobUrl,
  apiListAssetLogs,
  apiCreateAssetLog,
  apiDeleteAssetLog,
  apiListInventoryProblems,
  apiCreateInventoryProblem,
  apiUpdateInventoryProblemEstado,
  apiDeleteInventoryProblem,
} from "../../lib/api";

// ─── Re-export compatibilidad ────────────────────────────────────────────────
export type SoftwareLicenseStatus = LicenseStatus;
export type MaterialCondicion = AssetCondicion;

// Legacy local aliases (usados en el JSX heredado)
type SoftwareLicense  = SoftwareLicenseAPI;
type MaterialFisico   = PhysicalAssetAPI;
type ProblemReport    = InventoryProblemAPI;

// ─── Helper: estado de licencia desde fecha (sin API) ───────────────────────

function computeLicenseStatus(fechaVencimiento: string | null): LicenseStatus {
  if (!fechaVencimiento) return "VIGENTE";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const diffDias = Math.ceil((venc.getTime() - hoy.getTime()) / 86_400_000);
  if (diffDias < 0) return "VENCIDA";
  if (diffDias <= 30) return "POR_VENCER";
  return "VIGENTE";
}

function diasHastaVencimiento(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + "T00:00:00");
  return Math.ceil((venc.getTime() - hoy.getTime()) / 86_400_000);
}

// ─── Badge de estado de licencia ────────────────────────────────────────────

function LicenseStatusBadge({ status, fecha }: { status: SoftwareLicenseStatus; fecha: string | null }) {
  if (!fecha) {
    return <Badge variant="outline" className="text-gray-500 border-gray-300">Perpetua</Badge>;
  }
  if (status === "VIGENTE") {
    return <Badge className="bg-green-100 text-green-700 border-green-200 font-medium">Vigente</Badge>;
  }
  if (status === "POR_VENCER") {
    const dias = diasHastaVencimiento(fecha);
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Vence en {dias}d
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 font-medium flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      Vencida
    </Badge>
  );
}

// ─── Badge condición material ────────────────────────────────────────────────

const CONDICION_CONFIG: Record<MaterialCondicion, { label: string; cls: string }> = {
  BUENO:        { label: "Bueno",          cls: "bg-green-100 text-green-700 border-green-200" },
  REGULAR:      { label: "Regular",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
  MALO:         { label: "Malo",           cls: "bg-red-100 text-red-700 border-red-200" },
  EN_REPARACION:{ label: "En reparación",  cls: "bg-purple-100 text-purple-700 border-purple-200" },
};

function CondicionBadge({ condicion }: { condicion: MaterialCondicion }) {
  const cfg = CONDICION_CONFIG[condicion];
  return <Badge className={`${cfg.cls} font-medium`}>{cfg.label}</Badge>;
}

// ─── Formulario de licencia ──────────────────────────────────────────────────

interface LicenseForm {
  nombre: string;
  proveedor: string;
  tipo: string;
  puestos: number;
  fechaVencimiento: string;
  notas: string;
}

// ─── Formulario de material ──────────────────────────────────────────────────

interface MaterialForm {
  nombre: string;
  categoria: string;
  cantidad: number;
  condicion: MaterialCondicion;
  numeroSerie: string;
  descripcion: string;
}

// ─── Formulario de reporte de problema ──────────────────────────────────────

interface ReportForm {
  descripcion: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

interface InventarioAreaProps {
  areaId: string;
  areaNombre: string;
}

export function InventarioArea({ areaId, areaNombre }: InventarioAreaProps) {
  // ── Sección activa ──────────────────────────────────────────────────────
  const [seccion, setSeccion] = useState<"software" | "material" | "reportes" | "equiposTI">("software");

  // ── Datos ───────────────────────────────────────────────────────────────
  const [licencias, setLicencias] = useState<SoftwareLicense[]>([]);
  const [materiales, setMateriales] = useState<MaterialFisico[]>([]);
  const [reportes, setReportes] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────
  const [busquedaLic, setBusquedaLic] = useState("");
  const [filtroStatusLic, setFiltroStatusLic] = useState<"todos" | LicenseStatus>("todos");
  const [busquedaMat, setBusquedaMat] = useState("");
  const [filtroCondicion, setFiltroCondicion] = useState<"todos" | AssetCondicion>("todos");

  // ── Modales ─────────────────────────────────────────────────────────────
  const [showLicForm, setShowLicForm] = useState(false);
  const [editingLic, setEditingLic] = useState<SoftwareLicense | null>(null);
  const [showMatForm, setShowMatForm] = useState(false);
  const [editingMat, setEditingMat] = useState<MaterialFisico | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; tipo: "software" | "material"; nombre: string } | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  // ── Imágenes y QR de activos físicos ───────────────────────────────────
  const [imagesTarget, setImagesTarget] = useState<MaterialFisico | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [qrTarget, setQrTarget] = useState<MaterialFisico | null>(null);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [qrTargetUrl, setQrTargetUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // ── Bitácora del activo (mantenimientos, reparaciones, traslados…) ───────
  const [assetLogTarget, setAssetLogTarget] = useState<MaterialFisico | null>(null);
  const [assetLogs, setAssetLogs] = useState<PhysicalAssetLogEntryAPI[]>([]);
  const [loadingAssetLogs, setLoadingAssetLogs] = useState(false);
  const [submittingAssetLog, setSubmittingAssetLog] = useState(false);
  const [newLog, setNewLog] = useState<CreateAssetLogPayload>({
    entry_type: "MANTENIMIENTO",
    titulo: "",
    descripcion: "",
    ubicacion_anterior: "",
    ubicacion_nueva: "",
  });

  // ── Forms ───────────────────────────────────────────────────────────────
  const licForm  = useForm<LicenseForm>();
  const matForm  = useForm<MaterialForm>();
  const repForm  = useForm<ReportForm>();

  // ── Carga de datos desde API ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lics, mats, probs] = await Promise.all([
        apiListSoftwareLicenses(areaId),
        apiListPhysicalAssets(areaId),
        apiListInventoryProblems({ depId: areaId }),
      ]);
      setLicencias(lics);
      setMateriales(mats);
      setReportes(probs);

      // Alertas automáticas en carga
      const vencidasHoy = lics.filter(l => computeLicenseStatus(l.fecha_vencimiento) === "VENCIDA");
      const porVencer   = lics.filter(l => computeLicenseStatus(l.fecha_vencimiento) === "POR_VENCER");
      if (vencidasHoy.length > 0) {
        toast.error(`${vencidasHoy.length} licencia(s) vencida(s) en ${areaNombre}`, {
          description: vencidasHoy.map(l => l.nombre).join(", "),
        });
      } else if (porVencer.length > 0) {
        toast.warning(`${porVencer.length} licencia(s) por vencer en ${areaNombre}`, {
          description: porVencer.map(l => `${l.nombre} (${diasHastaVencimiento(l.fecha_vencimiento)}d)`).join(", "),
        });
      }
    } catch {
      toast.error("Error al cargar el inventario");
    } finally {
      setLoading(false);
    }
  }, [areaId, areaNombre]);

  useEffect(() => { loadData(); }, [loadData]);

  // ════════════════════════════════════════════════════════════════════════
  //  CRUD — Licencias
  // ════════════════════════════════════════════════════════════════════════

  const saveLicense = async (data: LicenseForm) => {
    try {
      if (editingLic) {
        const updated = await apiUpdateSoftwareLicense(editingLic.id, {
          nombre: data.nombre,
          proveedor: data.proveedor,
          tipo: data.tipo,
          puestos: Number(data.puestos),
          fecha_vencimiento: data.fechaVencimiento || null,
          notas: data.notas,
        });
        setLicencias(prev => prev.map(l => l.id === updated.id ? updated : l));
        toast.success("Licencia actualizada");
      } else {
        const nueva = await apiCreateSoftwareLicense({
          dependency: areaId,
          nombre: data.nombre,
          proveedor: data.proveedor,
          tipo: data.tipo,
          puestos: Number(data.puestos),
          fecha_vencimiento: data.fechaVencimiento || null,
          notas: data.notas,
        });
        setLicencias(prev => [...prev, nueva]);
        toast.success("Licencia agregada al inventario");
      }
    } catch {
      toast.error("Error al guardar la licencia");
    }
    setShowLicForm(false);
    setEditingLic(null);
    licForm.reset();
  };

  const deleteLicense = async (id: string) => {
    if (!confirm("¿Eliminar esta licencia del inventario?")) return;
    try {
      await apiDeleteSoftwareLicense(id);
      setLicencias(prev => prev.filter(l => l.id !== id));
      toast.success("Licencia eliminada");
    } catch {
      toast.error("Error al eliminar la licencia");
    }
  };

  const openEditLicense = (l: SoftwareLicense) => {
    setEditingLic(l);
    licForm.reset({
      nombre: l.nombre,
      proveedor: l.proveedor,
      tipo: l.tipo,
      puestos: l.puestos,
      fechaVencimiento: l.fecha_vencimiento ?? "",
      notas: l.notas,
    });
    setShowLicForm(true);
  };

  // ════════════════════════════════════════════════════════════════════════
  //  CRUD — Materiales
  // ════════════════════════════════════════════════════════════════════════

  const saveMaterial = async (data: MaterialForm) => {
    try {
      if (editingMat) {
        const updated = await apiUpdatePhysicalAsset(editingMat.id, {
          nombre: data.nombre,
          categoria: data.categoria,
          cantidad: Number(data.cantidad),
          condicion: data.condicion,
          numero_serie: data.numeroSerie,
          descripcion: data.descripcion,
        });
        setMateriales(prev => prev.map(m => m.id === updated.id ? updated : m));
        toast.success("Material actualizado");
      } else {
        const nuevo = await apiCreatePhysicalAsset({
          dependency: areaId,
          nombre: data.nombre,
          categoria: data.categoria,
          cantidad: Number(data.cantidad),
          condicion: data.condicion,
          numero_serie: data.numeroSerie,
          descripcion: data.descripcion,
        });
        setMateriales(prev => [...prev, nuevo]);
        toast.success("Material agregado al inventario");
      }
    } catch {
      toast.error("Error al guardar el material");
    }
    setShowMatForm(false);
    setEditingMat(null);
    matForm.reset();
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("¿Eliminar este material del inventario?")) return;
    try {
      await apiDeletePhysicalAsset(id);
      setMateriales(prev => prev.filter(m => m.id !== id));
      toast.success("Material eliminado");
    } catch {
      toast.error("Error al eliminar el material");
    }
  };

  const openEditMaterial = (m: MaterialFisico) => {
    setEditingMat(m);
    matForm.reset({
      nombre: m.nombre,
      categoria: m.categoria,
      cantidad: m.cantidad,
      condicion: m.condicion,
      numeroSerie: m.numero_serie,
      descripcion: m.descripcion,
    });
    setShowMatForm(true);
  };

  // ── Imágenes del material ──────────────────────────────────────────────

  const uploadAssetImage = async (file: File, caption = "") => {
    if (!imagesTarget || uploadingImage) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sólo se permiten archivos de imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB");
      return;
    }
    setUploadingImage(true);
    try {
      const nueva = await apiUploadAssetImage(imagesTarget.id, file, caption);
      const updated: MaterialFisico = {
        ...imagesTarget,
        images: [...(imagesTarget.images ?? []), nueva],
      };
      setImagesTarget(updated);
      setMateriales(prev => prev.map(m => m.id === updated.id ? updated : m));
      toast.success("Imagen subida");
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeAssetImage = async (img: PhysicalAssetImageAPI) => {
    if (!imagesTarget) return;
    if (!confirm("¿Eliminar esta imagen?")) return;
    try {
      await apiDeleteAssetImage(img.id);
      const updated: MaterialFisico = {
        ...imagesTarget,
        images: (imagesTarget.images ?? []).filter(i => i.id !== img.id),
      };
      setImagesTarget(updated);
      setMateriales(prev => prev.map(m => m.id === updated.id ? updated : m));
      toast.success("Imagen eliminada");
    } catch {
      toast.error("Error al eliminar la imagen");
    }
  };

  // ── QR de especificaciones ─────────────────────────────────────────────

  const openQrModal = async (mat: MaterialFisico) => {
    setQrTarget(mat);
    setQrBlobUrl(null);
    setQrTargetUrl(null);
    setQrLoading(true);
    try {
      const { url, targetUrl } = await apiFetchAssetQRBlobUrl(mat.id);
      setQrBlobUrl(url);
      setQrTargetUrl(targetUrl);
    } catch {
      toast.error("No se pudo generar el QR");
      setQrTarget(null);
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
    setQrBlobUrl(null);
    setQrTargetUrl(null);
    setQrTarget(null);
  };

  const downloadQr = () => {
    if (!qrBlobUrl || !qrTarget) return;
    const a = document.createElement("a");
    a.href = qrBlobUrl;
    a.download = `qr_${qrTarget.nombre.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copyQrUrl = async () => {
    if (!qrTargetUrl) return;
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
      toast.success("URL copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  // ── Bitácora del activo (mantenimientos / reparaciones / traslados) ────

  const openAssetLogModal = async (mat: MaterialFisico) => {
    setAssetLogTarget(mat);
    setAssetLogs([]);
    setNewLog({
      entry_type: "MANTENIMIENTO",
      titulo: "",
      descripcion: "",
      ubicacion_anterior: "",
      ubicacion_nueva: "",
    });
    setLoadingAssetLogs(true);
    try {
      const data = await apiListAssetLogs(mat.id);
      setAssetLogs(data);
    } catch {
      toast.error("No se pudo cargar la bitácora del activo");
    } finally {
      setLoadingAssetLogs(false);
    }
  };

  const closeAssetLogModal = () => {
    setAssetLogTarget(null);
    setAssetLogs([]);
  };

  const submitAssetLog = async () => {
    if (!assetLogTarget || submittingAssetLog) return;
    if (!newLog.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSubmittingAssetLog(true);
    try {
      const payload: CreateAssetLogPayload = {
        entry_type: newLog.entry_type,
        titulo: newLog.titulo.trim(),
        descripcion: (newLog.descripcion ?? "").trim(),
        ubicacion_anterior: (newLog.ubicacion_anterior ?? "").trim(),
        ubicacion_nueva:    (newLog.ubicacion_nueva ?? "").trim(),
      };
      const created = await apiCreateAssetLog(assetLogTarget.id, payload);
      setAssetLogs(prev => [created, ...prev]);
      setNewLog({
        entry_type: "MANTENIMIENTO",
        titulo: "",
        descripcion: "",
        ubicacion_anterior: "",
        ubicacion_nueva: "",
      });
      toast.success("Entrada registrada en la bitácora");
    } catch {
      toast.error("No se pudo registrar la entrada");
    } finally {
      setSubmittingAssetLog(false);
    }
  };

  const removeAssetLog = async (entry: PhysicalAssetLogEntryAPI) => {
    if (!confirm(`¿Eliminar la entrada "${entry.titulo}"?`)) return;
    try {
      await apiDeleteAssetLog(entry.id);
      setAssetLogs(prev => prev.filter(e => e.id !== entry.id));
      toast.success("Entrada eliminada");
    } catch {
      toast.error("No se pudo eliminar la entrada");
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  //  Reportes de problema
  // ════════════════════════════════════════════════════════════════════════

  const saveReport = async (data: ReportForm) => {
    if (!reportTarget || submittingReport) return;
    setSubmittingReport(true);
    try {
      const nuevo = await apiCreateInventoryProblem({
        dependency: areaId,
        item_tipo: reportTarget.tipo,
        item_nombre: reportTarget.nombre,
        software_license: reportTarget.tipo === "software" ? reportTarget.id : null,
        physical_asset:   reportTarget.tipo === "material" ? reportTarget.id : null,
        descripcion: data.descripcion,
        estado: "ABIERTO",
      });
      setReportes(prev => [nuevo, ...prev]);
      toast.success("Problema reportado correctamente");
      setReportTarget(null);
      repForm.reset();
    } catch {
      toast.error("Error al reportar el problema");
    } finally {
      setSubmittingReport(false);
    }
  };

  const updateReportEstado = async (id: string, estado: ProblemEstado) => {
    try {
      const updated = await apiUpdateInventoryProblemEstado(id, estado);
      setReportes(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch {
      toast.error("Error al actualizar el estado");
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("¿Eliminar este reporte?")) return;
    try {
      await apiDeleteInventoryProblem(id);
      setReportes(prev => prev.filter(r => r.id !== id));
    } catch {
      toast.error("Error al eliminar el reporte");
    }
  };

  // ── Filtrados ────────────────────────────────────────────────────────────

  const licFiltradas = licencias.filter(l => {
    const q = busquedaLic.toLowerCase();
    const matchQ = q === "" || l.nombre.toLowerCase().includes(q) || l.proveedor.toLowerCase().includes(q);
    const status = computeLicenseStatus(l.fecha_vencimiento);
    const matchS = filtroStatusLic === "todos" || status === filtroStatusLic;
    return matchQ && matchS;
  });

  const matFiltradas = materiales.filter(m => {
    const q = busquedaMat.toLowerCase();
    const matchQ = q === "" || m.nombre.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q);
    const matchC = filtroCondicion === "todos" || m.condicion === filtroCondicion;
    return matchQ && matchC;
  });

  // ── Contadores de alerta ──────────────────────────────────────────────────
  const vencidas   = licencias.filter(l => computeLicenseStatus(l.fecha_vencimiento) === "VENCIDA").length;
  const porVencer  = licencias.filter(l => computeLicenseStatus(l.fecha_vencimiento) === "POR_VENCER").length;
  const reportesAbiertos = reportes.filter(r => r.estado === "ABIERTO").length;

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">

      {loading && (
        <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
          <Clock className="w-4 h-4 animate-spin" />
          Cargando inventario...
        </div>
      )}

      {!loading && (
      <>
      {/* ── Cabecera del módulo ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-600" />
            Inventario del Área
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{areaNombre}</p>
        </div>
        {(vencidas > 0 || porVencer > 0) && (
          <div className="flex flex-wrap gap-2">
            {vencidas > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{vencidas} licencia(s) vencida(s)
              </Badge>
            )}
            {porVencer > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                <Clock className="w-3 h-3" />{porVencer} por vencer
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Pestañas internas del inventario ────────────────────────────── */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 w-fit">
        {([
          { key: "software",  label: "Licencias de Software", icon: Monitor  },
          { key: "material",  label: "Material Físico",       icon: Package  },
          { key: "reportes",  label: "Problemas Reportados",  icon: Wrench   },
          { key: "equiposTI", label: "Equipos TI",            icon: HardDrive },
        ] as const).map(({ key, label, icon: Icon }) => {
          const badge = key === "reportes" ? reportesAbiertos : 0;
          return (
            <button
              key={key}
              onClick={() => setSeccion(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative ${
                seccion === key
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{key === "software" ? "Software" : key === "material" ? "Físico" : key === "reportes" ? "Problemas" : "TI"}</span>
              {badge > 0 && (
                <span className="ml-0.5 bg-red-500 text-white rounded-full px-1.5 py-0 text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECCIÓN: LICENCIAS DE SOFTWARE
      ════════════════════════════════════════════════════════════════ */}
      {seccion === "software" && (
        <div className="space-y-4">
          {/* Barra superior */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Buscar licencia..."
                  value={busquedaLic}
                  onChange={e => setBusquedaLic(e.target.value)}
                />
              </div>
              <select
                className="border rounded-md px-3 py-1.5 text-sm bg-white h-9"
                value={filtroStatusLic}
                onChange={e => setFiltroStatusLic(e.target.value as typeof filtroStatusLic)}
              >
                <option value="todos">Todos</option>
                <option value="VIGENTE">Vigente</option>
                <option value="POR_VENCER">Por vencer</option>
                <option value="VENCIDA">Vencida</option>
              </select>
            </div>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
              onClick={() => { setEditingLic(null); licForm.reset(); setShowLicForm(true); }}
            >
              <Plus className="w-4 h-4 mr-1" /> Nueva Licencia
            </Button>
          </div>

          {/* Resumen de alertas */}
          {(vencidas > 0 || porVencer > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vencidas > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">{vencidas} licencia(s) vencida(s)</p>
                    <p className="text-xs text-red-500">Requieren renovación inmediata</p>
                  </div>
                </div>
              )}
              {porVencer > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">{porVencer} por vencer en 30 días</p>
                    <p className="text-xs text-amber-500">Planifique la renovación</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla / Cards de licencias */}
          {licencias.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Monitor className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="font-medium">No hay licencias registradas</p>
              <p className="text-sm mt-1">Registre las licencias de software del área</p>
            </div>
          ) : licFiltradas.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm">Sin resultados para la búsqueda</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {licFiltradas.map(lic => {
                const status = computeLicenseStatus(lic.fecha_vencimiento);
                const borderColor = status === "VENCIDA" ? "border-red-200" : status === "POR_VENCER" ? "border-amber-200" : "border-gray-200";
                return (
                  <Card key={lic.id} className={`border ${borderColor} shadow-sm`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                            <Monitor className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm leading-tight truncate">{lic.nombre}</CardTitle>
                            <p className="text-xs text-gray-400 truncate">{lic.proveedor}</p>
                          </div>
                        </div>
                        <LicenseStatusBadge status={status} fecha={lic.fecha_vencimiento} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="text-gray-400">Tipo</span>       <span className="font-medium">{lic.tipo || "—"}</span>
                        <span className="text-gray-400">Puestos</span>    <span className="font-medium">{lic.puestos}</span>
                        {lic.fecha_vencimiento && (
                          <>
                            <span className="text-gray-400">Vencimiento</span>
                            <span className={`font-medium flex items-center gap-1 ${status === "VENCIDA" ? "text-red-600" : status === "POR_VENCER" ? "text-amber-600" : ""}`}>
                              <Calendar className="w-3 h-3" />
                              {new Date(lic.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-CO")}
                            </span>
                          </>
                        )}
                      </div>
                      {lic.notas && <p className="text-xs text-gray-500 line-clamp-2 pt-1 border-t">{lic.notas}</p>}
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEditLicense(lic)}>
                          <Edit className="w-3 h-3 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={() => setReportTarget({ id: lic.id, tipo: "software", nombre: lic.nombre })}
                        >
                          <AlertCircle className="w-3 h-3 mr-1" /> Reportar
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deleteLicense(lic.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECCIÓN: MATERIAL FÍSICO
      ════════════════════════════════════════════════════════════════ */}
      {seccion === "material" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Buscar material..."
                  value={busquedaMat}
                  onChange={e => setBusquedaMat(e.target.value)}
                />
              </div>
              <select
                className="border rounded-md px-3 py-1.5 text-sm bg-white h-9"
                value={filtroCondicion}
                onChange={e => setFiltroCondicion(e.target.value as typeof filtroCondicion)}
              >
                <option value="todos">Todas condiciones</option>
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="MALO">Malo</option>
                <option value="EN_REPARACION">En reparación</option>
              </select>
            </div>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
              onClick={() => { setEditingMat(null); matForm.reset(); setShowMatForm(true); }}
            >
              <Plus className="w-4 h-4 mr-1" /> Nuevo Material
            </Button>
          </div>

          {materiales.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="font-medium">No hay materiales registrados</p>
              <p className="text-sm mt-1">Registre el material físico del área</p>
            </div>
          ) : matFiltradas.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm">Sin resultados para la búsqueda</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matFiltradas.map(mat => (
                <Card key={mat.id} className="border border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {mat.images && mat.images.length > 0 && mat.images[0].image_url ? (
                            <img
                              src={mat.images[0].image_url}
                              alt={mat.nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-tight truncate">{mat.nombre}</CardTitle>
                          <p className="text-xs text-gray-400 truncate">{mat.categoria}</p>
                        </div>
                      </div>
                      <CondicionBadge condicion={mat.condicion} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="text-gray-400">Cantidad</span>    <span className="font-medium">{mat.cantidad}</span>
                      {mat.numero_serie && (
                        <>
                          <span className="text-gray-400">N.º Serie</span>
                          <span className="font-medium font-mono truncate">{mat.numero_serie}</span>
                        </>
                      )}
                    </div>
                    {mat.descripcion && <p className="text-xs text-gray-500 line-clamp-2 pt-1 border-t">{mat.descripcion}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEditMaterial(mat)}>
                        <Edit className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 relative"
                        onClick={() => setImagesTarget(mat)}
                      >
                        <ImageIcon className="w-3 h-3 mr-1" /> Imágenes
                        {mat.images && mat.images.length > 0 && (
                          <span className="ml-1 bg-blue-500 text-white rounded-full px-1 text-[10px] font-bold">
                            {mat.images.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => openQrModal(mat)}
                      >
                        <QrCode className="w-3 h-3 mr-1" /> QR
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 relative"
                        onClick={() => openAssetLogModal(mat)}
                      >
                        <ClipboardList className="w-3 h-3 mr-1" /> Bitácora
                        {(mat.log_entries_count ?? 0) > 0 && (
                          <span className="ml-1 bg-emerald-500 text-white rounded-full px-1 text-[10px] font-bold">
                            {mat.log_entries_count}
                          </span>
                        )}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={() => setReportTarget({ id: mat.id, tipo: "material", nombre: mat.nombre })}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" /> Reportar Problema
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => deleteMaterial(mat.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECCIÓN: PROBLEMAS REPORTADOS
      ════════════════════════════════════════════════════════════════ */}
      {seccion === "reportes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {reportes.length === 0
                ? "No hay problemas reportados"
                : `${reportesAbiertos} abierto(s) / ${reportes.length} total`}
            </p>
          </div>

          {reportes.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="font-medium">Sin problemas reportados</p>
              <p className="text-sm mt-1">Use el botón "Reportar Problema" en licencias o material</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportes.map(r => (
                <div
                  key={r.id}
                  className={`rounded-xl border p-4 space-y-2 transition-opacity ${
                    r.estado === "RESUELTO" ? "opacity-50 bg-gray-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        r.estado === "ABIERTO" ? "bg-red-500" :
                        r.estado === "EN_REVISION" ? "bg-amber-400" : "bg-green-500"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                          {r.item_tipo === "software" ? <Monitor className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          <span className="truncate">{r.item_nombre}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{r.descripcion}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(r.created_at).toLocaleString("es-CO")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={
                        r.estado === "ABIERTO" ? "bg-red-100 text-red-700 border-red-200 text-[10px]" :
                        r.estado === "EN_REVISION" ? "bg-amber-100 text-amber-700 border-amber-200 text-[10px]" :
                        "bg-green-100 text-green-700 border-green-200 text-[10px]"
                      }>
                        {r.estado === "ABIERTO" ? "Abierto" : r.estado === "EN_REVISION" ? "En revisión" : "Resuelto"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1.5 pt-1 border-t flex-wrap">
                    {r.estado !== "EN_REVISION" && r.estado !== "RESUELTO" && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => updateReportEstado(r.id, "EN_REVISION")}>
                        En revisión
                      </Button>
                    )}
                    {r.estado !== "RESUELTO" && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => updateReportEstado(r.id, "RESUELTO")}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar resuelto
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => deleteReport(r.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECCIÓN: EQUIPOS TI (validación del inventario TI del área)
      ════════════════════════════════════════════════════════════════ */}
      {seccion === "equiposTI" && (
        <AreaInventarioTI embedded />
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Crear / Editar Licencia
      ════════════════════════════════════════════════════════════════ */}
      {showLicForm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-teal-600" />
                  {editingLic ? "Editar Licencia" : "Nueva Licencia de Software"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => { setShowLicForm(false); setEditingLic(null); licForm.reset(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={licForm.handleSubmit(saveLicense)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nombre del Software *</Label>
                    <Input
                      placeholder="Ej: Microsoft Office 365"
                      {...licForm.register("nombre", { required: "Requerido", minLength: { value: 2, message: "Mínimo 2 caracteres" } })}
                    />
                    {licForm.formState.errors.nombre && <p className="text-xs text-red-600">{licForm.formState.errors.nombre.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Proveedor *</Label>
                    <Input
                      placeholder="Ej: Microsoft"
                      {...licForm.register("proveedor", { required: "Requerido" })}
                    />
                    {licForm.formState.errors.proveedor && <p className="text-xs text-red-600">{licForm.formState.errors.proveedor.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Licencia</Label>
                    <Input
                      placeholder="Ej: Anual, Perpetua, Suscripción"
                      {...licForm.register("tipo")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Puestos *</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      {...licForm.register("puestos", {
                        required: "Requerido",
                        min: { value: 1, message: "Mínimo 1 puesto" },
                      })}
                    />
                    {licForm.formState.errors.puestos && <p className="text-xs text-red-600">{licForm.formState.errors.puestos.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Vencimiento</Label>
                    <Input
                      type="date"
                      {...licForm.register("fechaVencimiento")}
                    />
                    <p className="text-[10px] text-gray-400">Deje vacío si la licencia es perpetua</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea rows={2} placeholder="Información adicional..." {...licForm.register("notas")} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700">
                    {editingLic ? "Actualizar" : "Guardar Licencia"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowLicForm(false); setEditingLic(null); licForm.reset(); }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Crear / Editar Material Físico
      ════════════════════════════════════════════════════════════════ */}
      {showMatForm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-600" />
                  {editingMat ? "Editar Material" : "Nuevo Material Físico"}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => { setShowMatForm(false); setEditingMat(null); matForm.reset(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={matForm.handleSubmit(saveMaterial)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nombre del Material *</Label>
                    <Input
                      placeholder="Ej: Silla ergonómica, Monitor 24&quot;"
                      {...matForm.register("nombre", { required: "Requerido", minLength: { value: 2, message: "Mínimo 2 caracteres" } })}
                    />
                    {matForm.formState.errors.nombre && <p className="text-xs text-red-600">{matForm.formState.errors.nombre.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría *</Label>
                    <Input
                      placeholder="Ej: Mobiliario, Cómputo"
                      {...matForm.register("categoria", { required: "Requerido" })}
                    />
                    {matForm.formState.errors.categoria && <p className="text-xs text-red-600">{matForm.formState.errors.categoria.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad *</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      {...matForm.register("cantidad", {
                        required: "Requerido",
                        min: { value: 1, message: "Mínimo 1" },
                      })}
                    />
                    {matForm.formState.errors.cantidad && <p className="text-xs text-red-600">{matForm.formState.errors.cantidad.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Condición *</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                      {...matForm.register("condicion", { required: "Requerido" })}
                    >
                      <option value="BUENO">Bueno</option>
                      <option value="REGULAR">Regular</option>
                      <option value="MALO">Malo</option>
                      <option value="EN_REPARACION">En reparación</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Serie</Label>
                    <Input
                      placeholder="Opcional"
                      {...matForm.register("numeroSerie")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea rows={2} placeholder="Detalles adicionales..." {...matForm.register("descripcion")} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700">
                    {editingMat ? "Actualizar" : "Guardar Material"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowMatForm(false); setEditingMat(null); matForm.reset(); }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Reportar Problema
      ════════════════════════════════════════════════════════════════ */}
      {reportTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-5 h-5" />
                  Reportar Problema
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => { setReportTarget(null); repForm.reset(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4 p-2 bg-orange-50 border border-orange-200 rounded-md">
                {reportTarget.tipo === "software"
                  ? <Monitor className="w-4 h-4 text-teal-600 shrink-0" />
                  : <Package className="w-4 h-4 text-slate-500 shrink-0" />}
                <span className="text-sm font-medium text-gray-700">{reportTarget.nombre}</span>
              </div>
              <form onSubmit={repForm.handleSubmit(saveReport)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Descripción del Problema *</Label>
                  <Textarea
                    rows={4}
                    placeholder="Describa el problema encontrado..."
                    {...repForm.register("descripcion", {
                      required: "La descripción es requerida",
                      minLength: { value: 10, message: "Mínimo 10 caracteres" },
                    })}
                  />
                  {repForm.formState.errors.descripcion && (
                    <p className="text-xs text-red-600">{repForm.formState.errors.descripcion.message}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={submittingReport}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-60"
                  >
                    {submittingReport ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </span>
                    ) : "Reportar Problema"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittingReport}
                    onClick={() => { setReportTarget(null); repForm.reset(); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* (Bitácora de problemas eliminada — reemplazada por la nueva bitácora de mantenimientos/traslados) */}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Imágenes del activo físico
      ════════════════════════════════════════════════════════════════ */}
      {imagesTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <ImageIcon className="w-5 h-5" />
                  Imágenes del equipo
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setImagesTarget(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <Package className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{imagesTarget.nombre}</span>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 space-y-4">
              {/* Subida */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <label className="flex flex-col items-center justify-center cursor-pointer text-center gap-2">
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="text-xs text-gray-500">Subiendo imagen...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Subir imagen del físico</span>
                      <span className="text-[10px] text-gray-400">JPG / PNG / WEBP · Máx 5 MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) await uploadAssetImage(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Galería */}
              {(imagesTarget.images ?? []).length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <ImageIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm">Aún no hay imágenes registradas</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(imagesTarget.images ?? []).map(img => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                      {img.image_url && (
                        <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={img.image_url}
                            alt={img.caption || imagesTarget.nombre}
                            className="w-full h-32 object-cover"
                            loading="lazy"
                          />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAssetImage(img)}
                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {img.caption && (
                        <p className="text-[10px] text-gray-600 px-2 py-1 bg-white/80 truncate">{img.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Código QR de especificaciones
      ════════════════════════════════════════════════════════════════ */}
      {qrTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <QrCode className="w-5 h-5" />
                  Código QR del equipo
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={closeQrModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md">
                <Package className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{qrTarget.nombre}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center bg-white border border-gray-200 rounded-lg p-4 min-h-[260px]">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs">Generando QR...</span>
                  </div>
                ) : qrBlobUrl ? (
                  <img src={qrBlobUrl} alt="Código QR" className="w-56 h-56 object-contain" />
                ) : (
                  <p className="text-xs text-gray-400">Sin código QR</p>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center leading-snug">
                Escanee este QR para abrir la ficha del equipo en la app:
                fotos, especificaciones y bitácora completa de mantenimientos
                y traslados.
              </p>
              {qrTargetUrl && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-gray-500">URL del QR</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1.5 truncate">
                      {qrTargetUrl}
                    </code>
                    <Button type="button" size="icon" variant="outline" onClick={copyQrUrl} title="Copiar URL">
                      <CopyIcon className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={qrTargetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-200 hover:bg-gray-50"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                  onClick={downloadQr}
                  disabled={!qrBlobUrl}
                >
                  <Download className="w-4 h-4 mr-1" /> Descargar PNG
                </Button>
                <Button type="button" variant="outline" onClick={closeQrModal}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Bitácora del activo (mantenimientos / reparaciones / traslados)
      ════════════════════════════════════════════════════════════════ */}
      {assetLogTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl my-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <ClipboardList className="w-5 h-5" />
                  Bitácora del equipo
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={closeAssetLogModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-md">
                <Package className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">
                  {assetLogTarget.nombre}
                  {assetLogTarget.numero_serie && (
                    <span className="text-gray-500 font-mono ml-2 text-xs">
                      ({assetLogTarget.numero_serie})
                    </span>
                  )}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Formulario nuevo registro */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Registrar nuevo evento
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de evento</Label>
                    <select
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      value={newLog.entry_type}
                      onChange={e => setNewLog(l => ({ ...l, entry_type: e.target.value as AssetLogType }))}
                    >
                      {(Object.keys(ASSET_LOG_TYPE_LABEL) as AssetLogType[]).map(t => (
                        <option key={t} value={t}>{ASSET_LOG_TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Título *</Label>
                    <Input
                      placeholder="Ej. Cambio de batería, Traslado a Oficina 203…"
                      value={newLog.titulo}
                      onChange={e => setNewLog(l => ({ ...l, titulo: e.target.value }))}
                    />
                  </div>
                </div>

                {newLog.entry_type === "TRASLADO" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Ubicación anterior</Label>
                      <Input
                        placeholder="Ej. Oficina 101"
                        value={newLog.ubicacion_anterior ?? ""}
                        onChange={e => setNewLog(l => ({ ...l, ubicacion_anterior: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nueva ubicación</Label>
                      <Input
                        placeholder="Ej. Oficina 203"
                        value={newLog.ubicacion_nueva ?? ""}
                        onChange={e => setNewLog(l => ({ ...l, ubicacion_nueva: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Descripción / observaciones</Label>
                  <Textarea
                    rows={3}
                    placeholder="Detalle el evento: técnico responsable, repuestos, costos, etc."
                    value={newLog.descripcion ?? ""}
                    onChange={e => setNewLog(l => ({ ...l, descripcion: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={submitAssetLog}
                    disabled={submittingAssetLog || !newLog.titulo.trim()}
                  >
                    {submittingAssetLog ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando…</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1" /> Agregar entrada</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Listado de entradas */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <History className="w-4 h-4" /> Historial ({assetLogs.length})
                </p>

                {loadingAssetLogs ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando bitácora…
                  </div>
                ) : assetLogs.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-6 border border-dashed border-gray-300 rounded-md">
                    Aún no hay eventos registrados para este equipo.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {assetLogs.map(entry => (
                      <li key={entry.id} className="border border-gray-200 rounded-md p-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {entry.entry_type_display}
                              </Badge>
                              <span className="text-sm font-semibold text-gray-800 truncate">
                                {entry.titulo}
                              </span>
                            </div>
                            {(entry.entry_type === "TRASLADO" && (entry.ubicacion_anterior || entry.ubicacion_nueva)) && (
                              <p className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">{entry.ubicacion_anterior || "—"}</span>
                                {" → "}
                                <span className="font-medium">{entry.ubicacion_nueva || "—"}</span>
                              </p>
                            )}
                            {entry.descripcion && (
                              <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-words">
                                {entry.descripcion}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(entry.occurred_at).toLocaleString()}
                              </span>
                              {entry.created_by_nombre && (
                                <span className="truncate">por {entry.created_by_nombre}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button" size="icon" variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => removeAssetLog(entry)}
                            title="Eliminar entrada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={closeAssetLogModal}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      </>
      )}
    </div>
  );
}
