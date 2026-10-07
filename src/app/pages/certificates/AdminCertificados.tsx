/**
 * AdminCertificados.tsx
 * Panel de gestión de solicitudes de certificados para admins.
 * Lista las solicitudes con filtros, muestra detalle, y permite
 * cambiar estado / agregar respuestas-indicaciones con adjuntos.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  BookOpen as GraduationCap, Search, Filter, ArrowLeft,
  User, Calendar, Loader2, Clock, CheckCircle2,
  AlertCircle, FileCheck, XCircle, PackageCheck,
  Paperclip, Download, RefreshCw, Eye,
  Send, MessageSquare, Lock, Upload, X,
  Building2,
} from "lucide-react";
import {
  apiListCertificateRequests,
  apiGetCertificateRequest,
  apiUpdateCertificateStatus,
  apiCreateCertificateResponse,
  apiAssignCertificate,
  apiListDependencies,
  formatApiError,
  API_BASE,
  type CertificateRequestListAPI,
  type CertificateRequestDetailAPI,
  type CertificateStatus,
  type CertificateResponseAPI,
  type CertificateResponseType,
  type Dependency,
} from "../../lib/api";
import { formatDateTime } from "../../lib/utils";

/* ── Mapas de estado ──────────────────────────────── */
const STATUS_LABEL: Record<CertificateStatus, string> = {
  PEN: "Pendiente",
  REV: "En revisión",
  APR: "Aprobada",
  REC: "Rechazada",
  ENT: "Entregada",
};
const STATUS_COLOR: Record<CertificateStatus, string> = {
  PEN: "bg-yellow-100 text-yellow-800 border-yellow-300",
  REV: "bg-blue-100 text-blue-800 border-blue-300",
  APR: "bg-green-100 text-green-800 border-green-300",
  REC: "bg-red-100 text-red-800 border-red-300",
  ENT: "bg-purple-100 text-purple-800 border-purple-300",
};

const CERT_TYPE_LABEL: Record<string, string> = {
  CONSTANCIA: "Constancia de estudio",
  NOTAS: "Certificado de notas",
  CONTENIDOS: "Contenidos programáticos",
  OTRO: "Otro",
};

/* Stat-card config */
const STAT_CARDS: {
  key: CertificateStatus | "ALL";
  label: string;
  icon: typeof GraduationCap;
  iconColor: string;
}[] = [
  { key: "ALL",  label: "Total",       icon: GraduationCap, iconColor: "text-blue-600"   },
  { key: "PEN",  label: "Pendientes",  icon: AlertCircle,   iconColor: "text-yellow-600" },
  { key: "REV",  label: "En revisión", icon: Clock,         iconColor: "text-blue-500"   },
  { key: "APR",  label: "Aprobadas",   icon: CheckCircle2,  iconColor: "text-green-600"  },
  { key: "REC",  label: "Rechazadas",  icon: XCircle,       iconColor: "text-red-500"    },
  { key: "ENT",  label: "Entregadas",  icon: PackageCheck,  iconColor: "text-purple-600" },
];

/* ── Formulario de gestión ────────────────────────── */
interface GestionForm {
  status: CertificateStatus | "";
  notas_internas: string;
  respuesta: string;
}

/* ── Config hilo de respuestas ────────────────────── */
const RESPONSE_TYPE_LABEL: Record<CertificateResponseType, string> = {
  INSTRUCCION: "Instrucción / Indicación",
  RESPUESTA: "Respuesta al solicitante",
  INTERNA: "Nota interna",
};
const RESPONSE_TYPE_COLOR: Record<CertificateResponseType, string> = {
  INSTRUCCION: "bg-amber-50 border-amber-300 text-amber-800",
  RESPUESTA: "bg-green-50 border-green-300 text-green-800",
  INTERNA: "bg-gray-50 border-gray-300 text-gray-600",
};
const RESPONSE_TYPE_ICON: Record<CertificateResponseType, typeof MessageSquare> = {
  INSTRUCCION: AlertCircle,
  RESPUESTA: MessageSquare,
  INTERNA: Lock,
};

/* ══════════════════════════════════════════════════ */
export function AdminCertificados() {
  /* ── Estado lista ── */
  const [items, setItems] = useState<CertificateRequestListAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<CertificateStatus | "ALL">("ALL");
  const [showFilter, setShowFilter] = useState(false);

  /* ── Estado detalle ── */
  const [selected, setSelected] = useState<CertificateRequestDetailAPI | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ── Estado formulario gestión ── */
  const { register, handleSubmit, reset: resetForm } = useForm<GestionForm>({
    defaultValues: { status: "", notas_internas: "", respuesta: "" },
  });

  /* ── Estado formulario respuesta/indicación ── */
  const [respType, setRespType] = useState<CertificateResponseType>("INSTRUCCION");
  const [respContent, setRespContent] = useState("");
  const [respFiles, setRespFiles] = useState<File[]>([]);
  const [sendingResp, setSendingResp] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Estado asignación a áreas ── */
  const [allDeps, setAllDeps] = useState<Dependency[]>([]);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  /* ── Cargar lista ── */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiListCertificateRequests({
        status: filterStatus === "ALL" ? undefined : filterStatus,
        search: search || undefined,
        page_size: 200,
      });
      setItems(res.results);
    } catch (err) {
      toast.error("Error cargando solicitudes", { description: formatApiError(err) });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ── Cargar dependencias activas para asignación ── */
  useEffect(() => {
    apiListDependencies(true, true)
      .then((res) => setAllDeps(res.results))
      .catch(() => {});
  }, []);

  /* ── Seleccionar item ── */
  const handleSelect = async (id: string) => {
    setLoadingDetail(true);
    try {
      const detail = await apiGetCertificateRequest(id);
      setSelected(detail);
      resetForm({
        status: "",
        notas_internas: detail.notas_internas || "",
        respuesta: detail.respuesta || "",
      });
      setRespContent("");
      setRespFiles([]);
      setSelectedDeps(detail.assigned_dependencies || []);
    } catch (err) {
      toast.error("Error cargando detalle", { description: formatApiError(err) });
    } finally {
      setLoadingDetail(false);
    }
  };

  /* ── Guardar gestión (cambio estado) ── */
  const onSubmitGestion = async (data: GestionForm) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const payload: { status?: CertificateStatus; notas_internas?: string; respuesta?: string } = {};
      if (data.status) payload.status = data.status as CertificateStatus;
      if (data.notas_internas?.trim()) payload.notas_internas = data.notas_internas.trim();
      if (data.respuesta?.trim()) payload.respuesta = data.respuesta.trim();

      if (!Object.keys(payload).length) {
        toast.warning("No hay cambios para guardar");
        setSubmitting(false);
        return;
      }

      const updated = await apiUpdateCertificateStatus(selected.id, payload);
      const refreshed = await apiGetCertificateRequest(selected.id);
      setSelected(refreshed);
      resetForm({
        status: "",
        notas_internas: refreshed.notas_internas || "",
        respuesta: refreshed.respuesta || "",
      });
      toast.success("Solicitud actualizada correctamente");
      fetchList();
    } catch (err) {
      toast.error("Error actualizando solicitud", { description: formatApiError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Enviar respuesta/indicación ── */
  const handleSendResponse = async () => {
    if (!selected || !respContent.trim()) return;
    setSendingResp(true);
    try {
      await apiCreateCertificateResponse(
        selected.id,
        { response_type: respType, content: respContent.trim() },
        respFiles.length > 0 ? respFiles : undefined,
      );
      // Reload detail to get updated responses
      const updated = await apiGetCertificateRequest(selected.id);
      setSelected(updated);
      setRespContent("");
      setRespFiles([]);
      toast.success(
        respType === "INTERNA"
          ? "Nota interna registrada"
          : "Indicación enviada al solicitante",
      );
      // Scroll to bottom of thread
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error("Error enviando respuesta", { description: formatApiError(err) });
    } finally {
      setSendingResp(false);
    }
  };

  /* ── Adjuntos del formulario de respuesta ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const arr = Array.from(files);
      console.log("📎 Archivos seleccionados:", arr.map(f => f.name));
      setRespFiles((prev) => [...prev, ...arr]);
    }
  };
  const removeFile = (idx: number) => {
    setRespFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── Contadores por estado ── */
  const counts: Record<string, number> = { ALL: items.length };
  for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;

  /* ── Badge de estado ── */
  const StatusBadge = ({ status }: { status: CertificateStatus }) => (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );

  /* ══════════════════════════════════════════════════ */
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* ── Encabezado ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#1e3a5f] shadow-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Certificados</h1>
            <p className="text-sm text-gray-500">Gestión de solicitudes académicas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((sc) => {
          const Icon = sc.icon;
          const active = filterStatus === sc.key;
          return (
            <button
              key={sc.key}
              onClick={() => setFilterStatus(sc.key as CertificateStatus | "ALL")}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? "border-[#003366] bg-blue-50 ring-2 ring-[#003366]/20 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${sc.iconColor}`} />
              <div>
                <p className="text-xl font-bold text-gray-900">{counts[sc.key] || 0}</p>
                <p className="text-xs text-gray-500">{sc.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Layout lista + detalle ── */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Columna lista ── */}
        <div className={`w-full ${selected ? "lg:w-1/2 xl:w-2/5" : ""}`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Solicitudes Registradas</CardTitle>
              <button onClick={() => setShowFilter(!showFilter)} className="rounded p-1.5 hover:bg-gray-100">
                <Filter className="h-4 w-4 text-gray-500" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Barra de búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por solicitud, nombre o programa..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filtro estado (toggle) */}
              {showFilter && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as CertificateStatus | "ALL")}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ALL">Todos los estados</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}

              {/* Lista */}
              <div className="max-h-[60vh] divide-y overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <GraduationCap className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm">No se encontraron solicitudes</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const isActive = selected?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className={`w-full px-3 py-3 text-left transition-colors hover:bg-gray-50 ${
                          isActive ? "bg-blue-50 border-l-4 border-l-[#003366]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-blue-700">{item.numero_solicitud}</p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-900 truncate">
                              {item.solicitante}
                            </p>
                            <p className="text-xs text-gray-500">
                              {CERT_TYPE_LABEL[item.certificate_type] || item.certificate_type_display} · {item.programa_academico}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusBadge status={item.status} />
                            <p className="mt-1 text-[10px] text-gray-400">
                              {new Date(item.created_at).toLocaleDateString("es-CO")}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Columna detalle ── */}
        {selected && (
          <div className="w-full lg:w-1/2 xl:w-3/5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded p-1 hover:bg-gray-100 lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <CardTitle className="text-base">Detalle de Solicitud</CardTitle>
                </div>
                <StatusBadge status={selected.status} />
              </CardHeader>
              <CardContent className="space-y-5">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {/* Info general */}
                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <span className="font-medium text-gray-500">Nº Solicitud</span>
                          <p className="font-mono font-bold text-gray-900">{selected.numero_solicitud}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Tipo de certificado</span>
                          <p className="text-gray-900">{CERT_TYPE_LABEL[selected.certificate_type] || selected.certificate_type_display}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Programa académico</span>
                          <p className="text-gray-900">{selected.programa_academico}</p>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <Calendar className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
                          <div>
                            <span className="font-medium text-gray-500">Fecha</span>
                            <p className="text-gray-900">{formatDateTime(selected.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Datos del solicitante */}
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
                        <User className="h-4 w-4 text-gray-500" />
                        Datos del solicitante
                      </h3>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <span className="text-gray-500">Nombre completo</span>
                          <p className="font-medium">{selected.nombres} {selected.apellidos}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Correo personal</span>
                          <p className="font-medium">{selected.correo_personal}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Celular</span>
                          <p className="font-medium">{selected.celular}</p>
                        </div>
                        {selected.correo_institucional && (
                          <div>
                            <span className="text-gray-500">Correo institucional</span>
                            <p className="font-medium">{selected.correo_institucional}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Observaciones del solicitante */}
                    {selected.observaciones && (
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h3 className="mb-2 text-sm font-bold text-gray-800">Observaciones del solicitante</h3>
                        <p className="whitespace-pre-line text-sm text-gray-700">{selected.observaciones}</p>
                      </div>
                    )}

                    {/* Adjuntos (documento identidad) */}
                    {selected.attachments.filter(a => a.attachment_type !== "RESPONSE").length > 0 && (
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
                          <Paperclip className="h-4 w-4 text-gray-500" />
                          Documentos del solicitante
                        </h3>
                        <div className="space-y-2">
                          {selected.attachments.filter(a => a.attachment_type !== "RESPONSE").map((att) => (
                            <div key={att.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                              <span className="truncate text-gray-700">{att.filename}</span>
                              <div className="flex gap-2">
                                <a
                                  href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                                <a
                                  href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                                  download
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Asignación a áreas ── */}
                    <div className="rounded-lg border-2 border-purple-200 bg-purple-50/30 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-purple-800">
                        <Building2 className="h-4 w-4" />
                        Asignar a áreas
                      </h3>

                      {/* Áreas actualmente asignadas */}
                      {selected.assigned_dependencies_detail.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {selected.assigned_dependencies_detail.map((d) => (
                            <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800">
                              <Building2 className="h-3 w-3" />
                              {d.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Selector múltiple de dependencias */}
                      <div className="space-y-2">
                        <select
                          multiple
                          value={selectedDeps}
                          onChange={(e) => {
                            const vals = Array.from(e.target.selectedOptions, o => o.value);
                            setSelectedDeps(vals);
                          }}
                          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                          size={Math.min(allDeps.length || 3, 6)}
                        >
                          {allDeps.map((d) => (
                            <option key={d.id} value={d.id}>
                              [{d.code}] {d.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-gray-500">
                          Mantén Ctrl presionado para seleccionar varias áreas.
                        </p>
                        <Button
                          onClick={async () => {
                            if (!selected || selectedDeps.length === 0) {
                              toast.error("Seleccione al menos un área");
                              return;
                            }
                            setAssigning(true);
                            try {
                              const updated = await apiAssignCertificate(selected.id, selectedDeps);
                              setSelected(updated);
                              setSelectedDeps(updated.assigned_dependencies || []);
                              toast.success(`Asignada a ${updated.assigned_dependencies_detail.map(d => d.name).join(", ")}`);
                            } catch (err) {
                              toast.error("Error asignando", { description: formatApiError(err) });
                            } finally {
                              setAssigning(false);
                            }
                          }}
                          disabled={assigning || selectedDeps.length === 0}
                          className="w-full bg-purple-700 hover:bg-purple-800"
                        >
                          {assigning ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Asignando...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Asignar a áreas seleccionadas
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* ── Hilo de respuestas / indicaciones ── */}
                    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#003366]">
                        <MessageSquare className="h-4 w-4" />
                        Hilo de indicaciones y respuestas
                        {selected.responses.length > 0 && (
                          <span className="ml-auto rounded-full bg-[#003366] px-2 py-0.5 text-[10px] font-bold text-white">
                            {selected.responses.length}
                          </span>
                        )}
                      </h3>

                      {/* Thread */}
                      <div className="mb-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                        {selected.responses.length === 0 ? (
                          <p className="py-6 text-center text-sm text-gray-400">
                            Aún no hay indicaciones o respuestas registradas.
                          </p>
                        ) : (
                          selected.responses.map((resp) => {
                            const RIcon = RESPONSE_TYPE_ICON[resp.response_type];
                            return (
                              <div
                                key={resp.id}
                                className={`rounded-lg border p-3 ${RESPONSE_TYPE_COLOR[resp.response_type]}`}
                              >
                                <div className="mb-1 flex items-center gap-2 text-xs">
                                  <RIcon className="h-3.5 w-3.5" />
                                  <span className="font-semibold">
                                    {RESPONSE_TYPE_LABEL[resp.response_type]}
                                  </span>
                                  <span className="ml-auto font-medium opacity-70">
                                    {resp.author_name} · {formatDateTime(resp.created_at)}
                                  </span>
                                </div>
                                <p className="whitespace-pre-line text-sm">{resp.content}</p>

                                {/* Adjuntos de la respuesta */}
                                {resp.attachments.length > 0 && (
                                  <div className="mt-2 rounded-md border border-white/50 bg-white/70 p-2 space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
                                      <Paperclip className="h-3 w-3" />
                                      Archivos adjuntos ({resp.attachments.length})
                                    </p>
                                    {resp.attachments.map((att) => (
                                      <div key={att.id} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs shadow-sm border">
                                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                        <span className="flex-1 truncate font-medium text-gray-800">{att.filename || 'Documento adjunto'}</span>
                                        <a
                                          href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-blue-600 hover:bg-blue-100 transition-colors"
                                          title="Ver / Descargar"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          <span>Ver</span>
                                        </a>
                                        <a
                                          href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                                          download
                                          className="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-gray-600 hover:bg-gray-100 transition-colors"
                                          title="Descargar"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div ref={threadEndRef} />
                      </div>

                      {/* Formulario nueva respuesta */}
                      <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold text-gray-600">Tipo:</Label>
                          <select
                            value={respType}
                            onChange={(e) => setRespType(e.target.value as CertificateResponseType)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="INSTRUCCION">Instrucción / Indicación</option>
                            <option value="RESPUESTA">Respuesta al solicitante</option>
                            <option value="INTERNA">Nota interna</option>
                          </select>
                          {respType === "INTERNA" && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Lock className="h-3 w-3" /> No se notifica al solicitante
                            </span>
                          )}
                        </div>

                        <Textarea
                          placeholder="Escriba la indicación, respuesta o nota..."
                          rows={3}
                          value={respContent}
                          onChange={(e) => setRespContent(e.target.value)}
                        />

                        {/* Adjuntos */}
                        <div>
                          <div className="flex items-center gap-2">
                            <Upload className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Adjuntar archivo:</span>
                          </div>
                          <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
                          />
                          {respFiles.length > 0 && (
                            <div className="mt-2 space-y-1.5 rounded-md border border-green-200 bg-green-50 p-2">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                                <Paperclip className="h-3.5 w-3.5" />
                                {respFiles.length} archivo{respFiles.length > 1 ? 's' : ''} seleccionado{respFiles.length > 1 ? 's' : ''}:
                              </p>
                              {respFiles.map((f, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5 text-xs border shadow-sm"
                                >
                                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                  <span className="flex-1 truncate font-medium text-gray-800">{f.name}</span>
                                  <span className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="rounded-full p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                                    title="Quitar archivo"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={handleSendResponse}
                          disabled={sendingResp || !respContent.trim()}
                          className="w-full bg-[#003366] hover:bg-[#002244]"
                        >
                          {sendingResp ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              Enviar {respType === "INTERNA" ? "nota interna" : "al solicitante"}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* ── Formulario de gestión (cambio estado) ── */}
                    <form onSubmit={handleSubmit(onSubmitGestion)} className="space-y-4 rounded-lg border-2 border-[#003366]/20 bg-blue-50/50 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-[#003366]">
                          <FileCheck className="h-4 w-4" />
                          Cambiar estado de la solicitud
                        </h3>
                        <StatusBadge status={selected.status} />
                      </div>

                      <div>
                        <Label htmlFor="status" className="text-sm">Nuevo estado</Label>
                        <select
                          id="status"
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                          {...register("status")}
                        >
                          <option value="">— Sin cambiar —</option>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#003366] hover:bg-[#002244]"
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Guardando...
                          </span>
                        ) : (
                          "Guardar estado"
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
