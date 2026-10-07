/**
 * AreaCertificates.tsx
 * Pestaña de solicitudes de certificados asignadas al área del funcionario.
 * Se integra dentro de AreaDashboard como un tab adicional.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  BookOpen as GraduationCap, Loader2, Clock, CheckCircle2,
  AlertCircle, FileCheck, XCircle, PackageCheck,
  Paperclip, Download, RefreshCw,
  Send, MessageSquare, Lock, X, ArrowLeft,
  User, Calendar,
} from "lucide-react";
import {
  apiListCertificateRequests,
  apiGetCertificateRequest,
  apiUpdateCertificateStatus,
  apiCreateCertificateResponse,
  formatApiError,
  API_BASE,
  type CertificateRequestListAPI,
  type CertificateRequestDetailAPI,
  type CertificateStatus,
  type CertificateResponseType,
} from "../../lib/api";
import { formatDateTime } from "../../lib/utils";

/* ── Mapas de estado ── */
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

interface Props {
  visible: boolean;
}

export function AreaCertificates({ visible }: Props) {
  const [items, setItems] = useState<CertificateRequestListAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CertificateRequestDetailAPI | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CertificateStatus | "ALL">("ALL");

  /* ── Estado cambiar estado ── */
  const [newStatus, setNewStatus] = useState<CertificateStatus | "">("");
  const [submittingStatus, setSubmittingStatus] = useState(false);

  /* ── Estado respuesta/indicación ── */
  const [respType, setRespType] = useState<CertificateResponseType>("INSTRUCCION");
  const [respContent, setRespContent] = useState("");
  const [respFiles, setRespFiles] = useState<File[]>([]);
  const [sendingResp, setSendingResp] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Cargar lista ── */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiListCertificateRequests({
        status: filterStatus === "ALL" ? undefined : filterStatus,
        page_size: 200,
      });
      setItems(res.results);
    } catch (err) {
      toast.error("Error cargando certificados", { description: formatApiError(err) });
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (visible) fetchList();
  }, [visible, fetchList]);

  /* ── Seleccionar item ── */
  const handleSelect = async (id: string) => {
    setLoadingDetail(true);
    try {
      const detail = await apiGetCertificateRequest(id);
      setSelected(detail);
      setNewStatus("");
      setRespContent("");
      setRespFiles([]);
    } catch (err) {
      toast.error("Error cargando detalle", { description: formatApiError(err) });
    } finally {
      setLoadingDetail(false);
    }
  };

  /* ── Cambiar estado ── */
  const handleChangeStatus = async () => {
    if (!selected || !newStatus) return;
    setSubmittingStatus(true);
    try {
      await apiUpdateCertificateStatus(selected.id, { status: newStatus });
      const refreshed = await apiGetCertificateRequest(selected.id);
      setSelected(refreshed);
      setNewStatus("");
      toast.success("Estado actualizado");
      fetchList();
    } catch (err) {
      toast.error("Error actualizando estado", { description: formatApiError(err) });
    } finally {
      setSubmittingStatus(false);
    }
  };

  /* ── Enviar respuesta ── */
  const handleSendResponse = async () => {
    if (!selected || !respContent.trim()) return;
    setSendingResp(true);
    try {
      await apiCreateCertificateResponse(
        selected.id,
        { response_type: respType, content: respContent.trim() },
        respFiles.length > 0 ? respFiles : undefined,
      );
      const updated = await apiGetCertificateRequest(selected.id);
      setSelected(updated);
      setRespContent("");
      setRespFiles([]);
      toast.success(
        respType === "INTERNA" ? "Nota interna registrada" : "Indicación enviada",
      );
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error("Error enviando respuesta", { description: formatApiError(err) });
    } finally {
      setSendingResp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setRespFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const StatusBadge = ({ status }: { status: CertificateStatus }) => (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );

  if (!visible) return null;

  /* ══════════════════════════════════════════════════ */
  /* LISTA */
  if (!selected) {
    return (
      <div>
        {/* Filtros */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b flex-wrap">
          {(["ALL", "PEN", "REV", "APR", "REC", "ENT"] as const).map((st) => {
            const count = st === "ALL" ? items.length : items.filter(i => i.status === st).length;
            const active = filterStatus === st;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {st === "ALL" ? "Todos" : STATUS_LABEL[st]} ({count})
              </button>
            );
          })}
          <button
            onClick={fetchList}
            className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay solicitudes de certificados asignadas a esta área</p>
          </div>
        ) : (
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {(filterStatus === "ALL" ? items : items.filter(i => i.status === filterStatus)).map(cert => (
              <button
                key={cert.id}
                onClick={() => handleSelect(cert.id)}
                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-emerald-600 mb-0.5">{cert.numero_solicitud}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {cert.nombres} {cert.apellidos}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {CERT_TYPE_LABEL[cert.certificate_type] || cert.certificate_type_display}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={cert.status} />
                    <span className="text-xs text-gray-400">{formatDateTime(cert.created_at)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* DETALLE */
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelected(null)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-emerald-600">{selected.numero_solicitud}</p>
          <p className="text-sm font-medium text-gray-900 truncate">
            {selected.nombres} {selected.apellidos}
          </p>
        </div>
        <StatusBadge status={selected.status} />
      </div>

      {loadingDetail ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
      ) : (
        <>
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-gray-600">
              <GraduationCap className="w-3.5 h-3.5" />
              {CERT_TYPE_LABEL[selected.certificate_type] || selected.certificate_type_display}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <User className="w-3.5 h-3.5" />
              {selected.correo_personal}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateTime(selected.created_at)}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <GraduationCap className="w-3.5 h-3.5" />
              {selected.programa_academico}
            </div>
          </div>

          {/* Observaciones */}
          {selected.observaciones && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Observaciones del solicitante</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.observaciones}</p>
            </div>
          )}

          {/* Adjuntos del solicitante */}
          {selected.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Adjuntos del solicitante</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.attachments.filter(a => a.attachment_type === "IDENTITY").map(att => (
                  <a
                    key={att.id}
                    href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    <Download className="w-3 h-3" /> {att.filename}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Cambiar estado */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700">Cambiar estado</p>
              <StatusBadge status={selected.status} />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as CertificateStatus)}
                className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white"
              >
                <option value="">— Sin cambio —</option>
                {(Object.entries(STATUS_LABEL) as [CertificateStatus, string][])
                  .filter(([k]) => k !== selected.status)
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)
                }
              </select>
              <Button
                size="sm"
                onClick={handleChangeStatus}
                disabled={!newStatus || submittingStatus}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submittingStatus && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>

          {/* Hilo de respuestas */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Hilo de respuestas / indicaciones</p>
            {selected.responses.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin respuestas aún</p>
            ) : (
              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {selected.responses.map(r => {
                  const Icon = RESPONSE_TYPE_ICON[r.response_type];
                  return (
                    <div key={r.id} className={`border rounded-lg p-3 ${RESPONSE_TYPE_COLOR[r.response_type]}`}>
                      <div className="flex items-start gap-2">
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {RESPONSE_TYPE_LABEL[r.response_type]}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {r.author_name} — {formatDateTime(r.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                          {r.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {r.attachments.map(att => (
                                <a
                                  key={att.id}
                                  href={att.file.startsWith("http") ? att.file : `${API_BASE}${att.file}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/50 text-[10px] text-blue-600 hover:bg-white"
                                >
                                  <Paperclip className="w-2.5 h-2.5" /> {att.filename}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>
            )}
          </div>

          {/* Formulario nueva respuesta */}
          <div className="border rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-center gap-2">
              <select
                value={respType}
                onChange={e => setRespType(e.target.value as CertificateResponseType)}
                className="border rounded-md px-2 py-1 text-xs bg-white"
              >
                {Object.entries(RESPONSE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <Textarea
              placeholder="Escriba su respuesta o indicación…"
              value={respContent}
              onChange={e => setRespContent(e.target.value)}
              rows={3}
              className="text-sm"
            />
            {/* Adjuntos */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {respFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">
                  <Paperclip className="w-2.5 h-2.5" /> {f.name}
                  <button onClick={() => setRespFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSendResponse}
                disabled={!respContent.trim() || sendingResp}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sendingResp ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Enviar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
