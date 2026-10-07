import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Bot, Loader2, Save, Upload, FileText, Trash2, Globe, RefreshCw, Plus } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  apiDeleteChatBotDocument,
  apiGetChatBotConfig,
  apiListChatBotDocuments,
  apiUploadChatBotDocuments,
  apiUpdateChatBotConfig,
  apiCreateChatBotWebSource,
  apiUpdateChatBotWebSource,
  apiDeleteChatBotWebSource,
  apiRefetchChatBotWebSource,
  formatApiError,
  type ChatBotConfigAPI,
  type ChatBotKnowledgeDocumentAPI,
  type ChatBotWebSourceAPI,
} from "../../lib/api";

const EMPTY_FORM: ChatBotConfigAPI = {
  nombre_institucion: "",
  direccion: "",
  telefono: "",
  correo_pqrs: "",
  sitio_web: "",
  horario_atencion: "",
  informacion_adicional: "",
  documento: null,
  documento_url: null,
  documento_texto_extraido: "",
  knowledge_documents: [],
  web_sources: [],
  activo: true,
  inventario_notify_email: "",
  updated_at: "",
};


export function GestionChatbot() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ChatBotConfigAPI>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [clearDocument, setClearDocument] = useState(false);
  const [newWebUrl, setNewWebUrl] = useState("");
  const [newWebTitle, setNewWebTitle] = useState("");
  const [addingWeb, setAddingWeb] = useState(false);
  const [refetchingId, setRefetchingId] = useState<number | null>(null);
  const [deletingWebId, setDeletingWebId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGetChatBotConfig();
        setForm(data);
      } catch (error) {
        toast.error("No se pudo cargar la configuración del chatbot", {
          description: formatApiError(error),
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Sondeo del estado de procesamiento de documentos (extracción de texto/OCR
  // corre en segundo plano vía Celery). Se detiene cuando ya no hay documentos
  // pendientes o en procesamiento.
  useEffect(() => {
    const hayPendientes = form.knowledge_documents.some(
      (doc) => doc.estado === "pendiente" || doc.estado === "procesando",
    );
    if (!hayPendientes) return;

    const interval = setInterval(async () => {
      try {
        const docs = await apiListChatBotDocuments();
        setForm((prev) => ({ ...prev, knowledge_documents: docs }));
      } catch {
        // Silencioso: se reintenta en el siguiente ciclo
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [form.knowledge_documents]);

  const updateField = (key: keyof ChatBotConfigAPI, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("nombre_institucion", form.nombre_institucion);
      payload.append("direccion", form.direccion);
      payload.append("telefono", form.telefono);
      payload.append("correo_pqrs", form.correo_pqrs);
      payload.append("sitio_web", form.sitio_web);
      payload.append("horario_atencion", form.horario_atencion);
      payload.append("informacion_adicional", form.informacion_adicional);
      payload.append("activo", String(form.activo));
      if (selectedFile) payload.append("documento", selectedFile);
      if (clearDocument) payload.append("clear_document", "true");

      const updated = await apiUpdateChatBotConfig(payload);
      setForm(updated);
      setSelectedFile(null);
      setClearDocument(false);
      toast.success("Configuración del chatbot actualizada");
    } catch (error) {
      toast.error("No se pudo guardar la configuración", {
        description: formatApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadKnowledgeFiles = async () => {
    if (knowledgeFiles.length === 0) return;
    setUploadingDocs(true);
    try {
      const created = await apiUploadChatBotDocuments(knowledgeFiles);
      setForm((prev) => ({
        ...prev,
        knowledge_documents: [...created, ...prev.knowledge_documents],
      }));
      setKnowledgeFiles([]);
      toast.success(`${created.length} documento(s) cargado(s) a la base de conocimiento`);
    } catch (error) {
      toast.error("No se pudieron cargar los documentos", {
        description: formatApiError(error),
      });
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDeleteKnowledgeDocument = async (doc: ChatBotKnowledgeDocumentAPI) => {
    try {
      await apiDeleteChatBotDocument(doc.id);
      setForm((prev) => ({
        ...prev,
        knowledge_documents: prev.knowledge_documents.filter((item) => item.id !== doc.id),
      }));
      toast.success("Documento eliminado");
    } catch (error) {
      toast.error("No se pudo eliminar el documento", {
        description: formatApiError(error),
      });
    }
  };

  const handleAddWebSource = async () => {
    if (!newWebUrl.trim()) return;
    setAddingWeb(true);
    try {
      const created = await apiCreateChatBotWebSource({ url: newWebUrl.trim(), title: newWebTitle.trim() || undefined });
      setForm((prev) => ({ ...prev, web_sources: [created, ...prev.web_sources] }));
      setNewWebUrl("");
      setNewWebTitle("");
      toast.success("Fuente web agregada y contenido descargado");
    } catch (error) {
      toast.error("No se pudo agregar la fuente web", { description: formatApiError(error) });
    } finally {
      setAddingWeb(false);
    }
  };

  const handleToggleWebSource = async (ws: ChatBotWebSourceAPI) => {
    try {
      const updated = await apiUpdateChatBotWebSource(ws.id, { activo: !ws.activo });
      setForm((prev) => ({
        ...prev,
        web_sources: prev.web_sources.map((s) => s.id === ws.id ? updated : s),
      }));
    } catch (error) {
      toast.error("No se pudo actualizar la fuente", { description: formatApiError(error) });
    }
  };

  const handleRefetchWebSource = async (ws: ChatBotWebSourceAPI) => {
    setRefetchingId(ws.id);
    try {
      const updated = await apiRefetchChatBotWebSource(ws.id);
      setForm((prev) => ({
        ...prev,
        web_sources: prev.web_sources.map((s) => s.id === ws.id ? updated : s),
      }));
      toast.success("Contenido actualizado desde la URL");
    } catch (error) {
      toast.error("No se pudo actualizar el contenido", { description: formatApiError(error) });
    } finally {
      setRefetchingId(null);
    }
  };

  const handleDeleteWebSource = async (ws: ChatBotWebSourceAPI) => {
    setDeletingWebId(ws.id);
    try {
      await apiDeleteChatBotWebSource(ws.id);
      setForm((prev) => ({ ...prev, web_sources: prev.web_sources.filter((s) => s.id !== ws.id) }));
      toast.success("Fuente web eliminada");
    } catch (error) {
      toast.error("No se pudo eliminar la fuente", { description: formatApiError(error) });
    } finally {
      setDeletingWebId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Configuración del Chatbot</h1>
          </div>
          <p className="text-gray-600">
            Administra la información que el asistente virtual puede usar en el frontend.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Volver al Panel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos institucionales</CardTitle>
            <CardDescription>Estos datos se usan para responder preguntas de contacto y atención.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre_institucion">Nombre de la institución</Label>
              <Input id="nombre_institucion" value={form.nombre_institucion} onChange={(e) => updateField("nombre_institucion", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" value={form.direccion} onChange={(e) => updateField("direccion", e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" value={form.telefono} onChange={(e) => updateField("telefono", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correo_pqrs">Correo PQRS</Label>
                <Input id="correo_pqrs" type="email" value={form.correo_pqrs} onChange={(e) => updateField("correo_pqrs", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sitio_web">Sitio web</Label>
                <Input id="sitio_web" value={form.sitio_web} onChange={(e) => updateField("sitio_web", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario_atencion">Horario</Label>
                <Input id="horario_atencion" value={form.horario_atencion} onChange={(e) => updateField("horario_atencion", e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => updateField("activo", e.target.checked)}
              />
              Chatbot activo
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base de conocimiento</CardTitle>
            <CardDescription>
              Puedes escribir texto libre o subir un documento TXT, PDF o DOCX para alimentar al chatbot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="informacion_adicional">Información adicional</Label>
              <Textarea
                id="informacion_adicional"
                className="min-h-[180px]"
                value={form.informacion_adicional}
                onChange={(e) => updateField("informacion_adicional", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">Documento base</Label>
              <Input
                id="documento"
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file) setClearDocument(false);
                }}
              />
              <p className="text-xs text-gray-500">Formatos: TXT, PDF, DOC, DOCX. Máximo 5 MB.</p>
            </div>

            {(form.documento_url || selectedFile) && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile?.name ?? "Documento actual cargado"}</span>
                  </div>
                  <div className="flex gap-2">
                    {form.documento_url && !selectedFile && (
                      <Button asChild size="sm" variant="outline">
                        <a href={form.documento_url} target="_blank" rel="noreferrer">Ver</a>
                      </Button>
                    )}
                    {(form.documento_url || selectedFile) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedFile(null);
                          setClearDocument(true);
                          setForm((prev) => ({ ...prev, documento_url: null, documento: null, documento_texto_extraido: "" }));
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-dashed bg-blue-50 p-4 text-sm text-blue-900">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Upload className="h-4 w-4" />
                Texto extraído del documento
              </div>
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-gray-700">
                {form.documento_texto_extraido || "Aún no hay texto extraído. Sube un documento y guarda la configuración."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Base documental múltiple</CardTitle>
            <CardDescription>
              Sube varios archivos para que el chatbot seleccione los más relevantes según la pregunta del usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1 space-y-2">
                <Label htmlFor="knowledge-files">Archivos para base de conocimiento</Label>
                <Input
                  id="knowledge-files"
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  multiple
                  onChange={(e) => setKnowledgeFiles(Array.from(e.target.files ?? []))}
                />
                <p className="text-xs text-gray-500">Puedes seleccionar varios TXT, PDF, DOC o DOCX en una sola carga.</p>
              </div>
              <Button onClick={handleUploadKnowledgeFiles} disabled={uploadingDocs || knowledgeFiles.length === 0}>
                {uploadingDocs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Cargar archivos
              </Button>
            </div>

            {knowledgeFiles.length > 0 && (
              <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Archivos listos para subir</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {knowledgeFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {form.knowledge_documents.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-sm text-gray-500">
                  Aún no has cargado documentos adicionales para la base de conocimiento.
                </div>
              )}
              {form.knowledge_documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{doc.title || doc.file_name}</p>
                      <p className="truncate text-xs text-gray-500">{doc.file_name}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteKnowledgeDocument(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    {doc.documento_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={doc.documento_url} target="_blank" rel="noreferrer">Ver</a>
                      </Button>
                    )}
                    {(doc.estado === "pendiente" || doc.estado === "procesando") && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Procesando documento...
                      </span>
                    )}
                    {doc.estado === "error" && (
                      <span className="text-xs font-medium text-red-600">No se pudo extraer texto</span>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                    {doc.estado === "pendiente" || doc.estado === "procesando"
                      ? "El documento se está procesando en segundo plano (puede tardar varios minutos en archivos escaneados grandes)."
                      : (doc.texto_extraido || 'No se pudo extraer texto de este documento.')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-600" />Fuentes web públicas</CardTitle>
            <CardDescription>
              Agrega URLs de sitios públicos. El chatbot descargará y usará su contenido como base de conocimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="web-url">URL</Label>
                <Input
                  id="web-url"
                  type="url"
                  placeholder="https://www.institucion.gov.co/pqrs"
                  value={newWebUrl}
                  onChange={(e) => setNewWebUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddWebSource()}
                />
              </div>
              <div className="w-full space-y-2 md:w-56">
                <Label htmlFor="web-title">Título (opcional)</Label>
                <Input
                  id="web-title"
                  placeholder="Ej: Página PQRS"
                  value={newWebTitle}
                  onChange={(e) => setNewWebTitle(e.target.value)}
                />
              </div>
              <Button onClick={handleAddWebSource} disabled={addingWeb || !newWebUrl.trim()}>
                {addingWeb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Agregar
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {form.web_sources.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-sm text-gray-500">
                  Aún no has configurado fuentes web. Agrega una URL arriba.
                </div>
              )}
              {form.web_sources.map((ws) => (
                <div key={ws.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{ws.title || ws.url}</p>
                      <a
                        href={ws.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-blue-600 hover:underline block"
                      >
                        {ws.url}
                      </a>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Actualizar contenido"
                        disabled={refetchingId === ws.id}
                        onClick={() => handleRefetchWebSource(ws)}
                      >
                        {refetchingId === ws.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Eliminar"
                        disabled={deletingWebId === ws.id}
                        onClick={() => handleDeleteWebSource(ws)}
                      >
                        {deletingWebId === ws.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ws.activo}
                        onChange={() => handleToggleWebSource(ws)}
                        className="accent-blue-600"
                      />
                      Activa
                    </label>
                    {ws.last_fetched_at && (
                      <span>· Última descarga: {new Date(ws.last_fetched_at).toLocaleString("es-CO")}</span>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                    {ws.texto_extraido || "El contenido aún no fue descargado o no se pudo extraer texto."}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}