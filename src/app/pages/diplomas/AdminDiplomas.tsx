import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  apiCreateDiplomaBatch,
  apiCreateSingleDiploma,
  apiCreateDiplomaTemplate,
  apiDownloadIssuedDiplomaPdf,
  apiDownloadDiplomaBatch,
  apiListDiplomaBatches,
  apiListDiplomaTemplates,
  apiSendDiplomaEmail,
  formatApiError,
  type CreateSingleDiplomaResponse,
  type DiplomaBatchDetailAPI,
  type DiplomaBatchListAPI,
  type DiplomaTemplateAPI,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  BookOpen as GraduationCap,
  Loader2,
  Mail,
  Plus,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";

interface TemplateForm {
  name: string;
  title: string;
  subtitle: string;
  body_template: string;
  footer_text: string;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
  active: boolean;
  logo_image?: FileList;
  background_image?: FileList;
}

interface BatchForm {
  template: string;
  issue_date: string;
  send_email: boolean;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
  signer_primary_name: string;
  signer_primary_role: string;
  signer_secondary_name: string;
  signer_secondary_role: string;
  source_file: FileList;
}

interface SingleForm {
  template: string;
  full_name: string;
  document_number: string;
  city: string;
  email: string;
  issue_date: string;
  send_email: boolean;
  issuer_name: string;
  issuer_title: string;
  organization_name: string;
}

interface SignerDraft {
  name: string;
  role: string;
  image: File | null;
}

const STATUS_COLORS: Record<string, string> = {
  PEN: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PRO: "bg-blue-100 text-blue-800 border-blue-300",
  COM: "bg-green-100 text-green-800 border-green-300",
  PAR: "bg-amber-100 text-amber-800 border-amber-300",
  ERR: "bg-red-100 text-red-800 border-red-300",
};

const DEFAULT_BODY_TEMPLATE =
  "Se certifica que {full_name}, identificado(a) con cédula {document_number}, de la ciudad de {city}, ha recibido este diploma en fecha {issue_date_long}. Documento emitido por {issuer_name}, {issuer_title}, {organization_name}.";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminDiplomas() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DiplomaTemplateAPI[]>([]);
  const [batches, setBatches] = useState<DiplomaBatchListAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [creatingSingle, setCreatingSingle] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [signerCount, setSignerCount] = useState(1);
  const [signers, setSigners] = useState<SignerDraft[]>([{ name: "", role: "", image: null }]);
  const [lastSingleResult, setLastSingleResult] = useState<CreateSingleDiplomaResponse | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const templateForm = useForm<TemplateForm>({
    defaultValues: {
      title: "Diploma",
      subtitle: "",
      body_template: DEFAULT_BODY_TEMPLATE,
      footer_text: "Verifique la autenticidad escaneando el código QR.",
      organization_name: "Institución",
      active: true,
    },
  });

  const batchForm = useForm<BatchForm>({
    defaultValues: {
      issue_date: new Date().toISOString().slice(0, 10),
      send_email: false,
      issuer_name: "",
      issuer_title: "",
      organization_name: "",
      signer_primary_name: "",
      signer_primary_role: "",
      signer_secondary_name: "",
      signer_secondary_role: "",
    },
  });

  const singleForm = useForm<SingleForm>({
    defaultValues: {
      issue_date: new Date().toISOString().slice(0, 10),
      send_email: false,
      email: "",
      issuer_name: "",
      issuer_title: "",
      organization_name: "",
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, batchesRes] = await Promise.all([
        apiListDiplomaTemplates(),
        apiListDiplomaBatches(),
      ]);
      setTemplates(templatesRes.results);
      setBatches(batchesRes);
    } catch (err) {
      toast.error("Error cargando módulo de diplomas", { description: formatApiError(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeTemplates = useMemo(() => templates.filter((template) => template.active), [templates]);

  const resizeSigners = useCallback((nextCount: number) => {
    const safeCount = Math.max(1, Math.min(6, nextCount));
    setSignerCount(safeCount);
    setSigners((prev) => {
      const next = [...prev];
      while (next.length < safeCount) next.push({ name: "", role: "", image: null });
      return next.slice(0, safeCount);
    });
  }, []);

  const resetTemplateModal = useCallback(() => {
    templateForm.reset({
      name: "",
      title: "Diploma",
      subtitle: "",
      body_template: DEFAULT_BODY_TEMPLATE,
      footer_text: "Verifique la autenticidad escaneando el código QR.",
      issuer_name: "",
      issuer_title: "",
      organization_name: "Institución",
      active: true,
    });
    setSignerCount(1);
    setSigners([{ name: "", role: "", image: null }]);
  }, [templateForm]);

  const updateSigner = (index: number, patch: Partial<SignerDraft>) => {
    setSigners((prev) => prev.map((signer, signerIndex) => signerIndex === index ? { ...signer, ...patch } : signer));
  };

  const handleSignerImage = (index: number, fileList?: FileList | null) => {
    const file = fileList?.[0] ?? null;
    if (!file) {
      updateSigner(index, { image: null });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg"].includes(ext)) {
      toast.error("La firma debe cargarse en formato JPEG o JPG.");
      return;
    }
    updateSigner(index, { image: file });
  };

  const submitTemplate = templateForm.handleSubmit(async (values) => {
    setCreatingTemplate(true);
    try {
      const normalizedSigners = signers.slice(0, signerCount);
      if (normalizedSigners.some((signer) => !signer.name.trim())) {
        toast.error("Cada emisor debe tener nombre.");
        return;
      }
      if (normalizedSigners.some((signer) => !signer.image)) {
        toast.error("Cada emisor debe cargar su firma en JPEG.");
        return;
      }

      const formData = new FormData();
      formData.append("name", values.name.trim());
      formData.append("title", values.title.trim());
      formData.append("subtitle", values.subtitle.trim());
      formData.append("body_template", values.body_template.trim());
      formData.append("footer_text", values.footer_text.trim());
      formData.append("issuer_name", values.issuer_name.trim());
      formData.append("issuer_title", values.issuer_title.trim());
      formData.append("organization_name", values.organization_name.trim());
      formData.append("active", values.active ? "true" : "false");

      const logo = values.logo_image?.[0];
      const background = values.background_image?.[0];
      if (logo) formData.append("logo_image", logo);
      if (background) formData.append("background_image", background);

      const signersPayload = normalizedSigners.map((signer, index) => {
        const imageKey = `signers_image_${index}`;
        formData.append(imageKey, signer.image as File);
        return {
          name: signer.name.trim(),
          role: signer.role.trim(),
          order: index,
          image_key: imageKey,
        };
      });
      formData.append("signers_payload", JSON.stringify(signersPayload));

      const created = await apiCreateDiplomaTemplate(formData);
      toast.success("Plantilla creada", { description: created.name });
      resetTemplateModal();
      setTemplateModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error("Error creando plantilla", { description: formatApiError(err) });
    } finally {
      setCreatingTemplate(false);
    }
  });

  const submitBatch = batchForm.handleSubmit(async (values) => {
    const sourceFile = values.source_file?.[0];
    if (!sourceFile) {
      toast.error("Debe adjuntar el archivo masivo CSV o XLSX.");
      return;
    }
    setCreatingBatch(true);
    try {
      const created: DiplomaBatchDetailAPI = await apiCreateDiplomaBatch({
        template: values.template,
        issue_date: values.issue_date,
        send_email: values.send_email,
        issuer_name: values.issuer_name.trim() || undefined,
        issuer_title: values.issuer_title.trim() || undefined,
        organization_name: values.organization_name.trim() || undefined,
        signer_primary_name: values.signer_primary_name.trim() || undefined,
        signer_primary_role: values.signer_primary_role.trim() || undefined,
        signer_secondary_name: values.signer_secondary_name.trim() || undefined,
        signer_secondary_role: values.signer_secondary_role.trim() || undefined,
        source_file: sourceFile,
      });
      toast.success("Lote procesado", {
        description: `${created.generated_records} diplomas generados${created.emailed_records ? ` · ${created.emailed_records} enviados` : ""}`,
      });
      batchForm.reset({
        template: values.template,
        issue_date: new Date().toISOString().slice(0, 10),
        send_email: false,
        issuer_name: "",
        issuer_title: "",
        organization_name: "",
        signer_primary_name: "",
        signer_primary_role: "",
        signer_secondary_name: "",
        signer_secondary_role: "",
      });
      await loadData();
    } catch (err) {
      toast.error("Error procesando lote", { description: formatApiError(err) });
    } finally {
      setCreatingBatch(false);
    }
  });

  const handleDownload = async (batchId: string) => {
    setDownloadingBatchId(batchId);
    try {
      const result = await apiDownloadDiplomaBatch(batchId);
      triggerDownload(result.blob, result.filename);
    } catch (err) {
      toast.error("Error descargando lote", { description: formatApiError(err) });
    } finally {
      setDownloadingBatchId(null);
    }
  };

  const handleDownloadSinglePdf = async () => {
    if (!lastSingleResult?.diploma?.id) return;
    try {
      const result = await apiDownloadIssuedDiplomaPdf(lastSingleResult.diploma.id);
      triggerDownload(result.blob, result.filename || lastSingleResult.diploma.pdf_filename);
    } catch (err) {
      toast.error("Error descargando PDF", { description: formatApiError(err) });
    }
  };

  const handleSendDiplomaEmail = async () => {
    if (!lastSingleResult?.diploma?.id) return;
    if (!lastSingleResult?.diploma?.email) {
      toast.warning("Sin correo", { description: "El diploma no tiene un correo electrónico configurado." });
      return;
    }
    setSendingEmail(true);
    try {
      const response = await apiSendDiplomaEmail(lastSingleResult.diploma.id);
      const updatedDiploma = (response as { diploma?: typeof response }).diploma || response;
      setLastSingleResult({
        ...lastSingleResult,
        diploma: updatedDiploma,
      });
      toast.success("Correo enviado", {
        description: `Diploma enviado a ${updatedDiploma.email}`,
      });
    } catch (err) {
      toast.error("Error enviando correo", { description: formatApiError(err) });
    } finally {
      setSendingEmail(false);
    }
  };

  const submitSingle = singleForm.handleSubmit(async (values) => {
    setCreatingSingle(true);
    setLastSingleResult(null);
    try {
      const result = await apiCreateSingleDiploma({
        template: values.template,
        full_name: values.full_name.trim(),
        document_number: values.document_number.trim(),
        city: values.city.trim(),
        email: values.email.trim() || undefined,
        issue_date: values.issue_date || undefined,
        send_email: values.send_email,
        issuer_name: values.issuer_name.trim() || undefined,
        issuer_title: values.issuer_title.trim() || undefined,
        organization_name: values.organization_name.trim() || undefined,
      });
      setLastSingleResult(result);
      toast.success("Diploma emitido", {
        description: result.diploma?.verification_code ?? "Diploma generado correctamente.",
      });
      await loadData();
    } catch (err) {
      toast.error("Error generando diploma individual", { description: formatApiError(err) });
    } finally {
      setCreatingSingle(false);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-lg">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Módulo de Diplomas</h1>
              <p className="mt-1 text-sm text-slate-600">
                Emisión masiva con plantillas, carga CSV/XLSX, ZIP descargable, correo opcional y QR de verificación.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => setTemplateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva plantilla
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin")}>Volver al panel</Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm text-slate-500">Plantillas activas</p>
                <p className="text-2xl font-semibold text-slate-900">{activeTemplates.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-500">Lotes procesados</p>
                <p className="text-2xl font-semibold text-slate-900">{batches.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <QrCode className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-sm text-slate-500">Validación pública</p>
                <p className="text-sm font-medium text-slate-900">/api/pqrs/diplomas/verify/&lt;código&gt;/</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-600" /> Emisión y exporte</CardTitle>
                <CardDescription>
                  La carga masiva y el exporte de diplomados permanecen en esta página. Las plantillas se crean desde un modal con emisores variables.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Variables de plantilla</p>
                  <p className="mt-2 text-sm text-slate-700">{"{full_name}"}, {"{document_number}"}, {"{city}"}, {"{issue_date_long}"}, {"{verification_code}"}, {"{verification_url}"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Formato de firmas</p>
                  <p className="mt-2 text-sm text-slate-700">Cada emisor requiere nombre, cargo opcional y firma en JPG/JPEG.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Plantillas activas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{activeTemplates.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-600" />
                  Emitir diploma individual
                </CardTitle>
                <CardDescription>
                  Genere un diploma de uno en uno con la misma plantilla institucional y descárguelo inmediatamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitSingle} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="single_template">Plantilla</Label>
                      <select id="single_template" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...singleForm.register("template", { required: true })}>
                        <option value="">Seleccione una plantilla</option>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="single_issue_date">Fecha de emisión</Label>
                      <Input id="single_issue_date" type="date" {...singleForm.register("issue_date")} />
                    </div>
                    <div>
                      <Label htmlFor="single_full_name">Nombre completo</Label>
                      <Input id="single_full_name" {...singleForm.register("full_name", { required: true })} />
                    </div>
                    <div>
                      <Label htmlFor="single_document">Número de cédula</Label>
                      <Input id="single_document" {...singleForm.register("document_number", { required: true })} />
                    </div>
                    <div>
                      <Label htmlFor="single_city">Ciudad</Label>
                      <Input id="single_city" {...singleForm.register("city", { required: true })} />
                    </div>
                    <div>
                      <Label htmlFor="single_email">Correo</Label>
                      <Input id="single_email" type="email" {...singleForm.register("email")} />
                    </div>
                    <div>
                      <Label htmlFor="single_issuer_name">Sobrescribir emisor</Label>
                      <Input id="single_issuer_name" {...singleForm.register("issuer_name")} />
                    </div>
                    <div>
                      <Label htmlFor="single_issuer_title">Sobrescribir cargo</Label>
                      <Input id="single_issuer_title" {...singleForm.register("issuer_title")} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="single_org_name">Sobrescribir entidad</Label>
                      <Input id="single_org_name" {...singleForm.register("organization_name")} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="single_send_email" checked={singleForm.watch("send_email")} onCheckedChange={(checked) => singleForm.setValue("send_email", !!checked)} />
                    <Label htmlFor="single_send_email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-500" />
                      Enviar por correo si se diligencia el email
                    </Label>
                  </div>
                  <Button type="submit" disabled={creatingSingle || activeTemplates.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                    {creatingSingle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
                    Generar uno a uno
                  </Button>
                </form>

                {lastSingleResult?.diploma && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-emerald-900">{lastSingleResult.diploma.full_name}</p>
                        <p className="text-sm text-emerald-800">Código de verificación: {lastSingleResult.diploma.verification_code}</p>
                        <p className="text-sm text-emerald-800">Archivo: {lastSingleResult.diploma.pdf_filename}</p>
                        {lastSingleResult.diploma.email && (
                          <p className="text-sm text-emerald-800">Correo: {lastSingleResult.diploma.email}</p>
                        )}
                        {lastSingleResult.diploma.status === 'EMA' && (
                          <p className="text-sm font-medium text-emerald-700">✓ Enviado por correo</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={handleDownloadSinglePdf}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Descargar PDF
                        </Button>
                        {lastSingleResult.diploma.email && lastSingleResult.diploma.status !== 'EMA' && (
                          <Button
                            variant="outline"
                            onClick={handleSendDiplomaEmail}
                            disabled={sendingEmail}
                          >
                            {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            {sendingEmail ? "Enviando..." : "Enviar por correo"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/api/pqrs/diplomas/verify/${lastSingleResult.diploma?.verification_code}/`, "_blank")}
                        >
                          <QrCode className="mr-2 h-4 w-4" />
                          Verificar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Emitir lote de diplomas
                </CardTitle>
                <CardDescription>
                  Cargue un archivo CSV o XLSX con columnas `nombre`, `numero_cedula`, `ciudad` y opcionalmente `correo`.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitBatch} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="batch_template">Plantilla</Label>
                      <select id="batch_template" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...batchForm.register("template", { required: true })}>
                        <option value="">Seleccione una plantilla</option>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="batch_date">Fecha de emisión</Label>
                      <Input id="batch_date" type="date" {...batchForm.register("issue_date", { required: true })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="batch_file">Archivo masivo</Label>
                      <Input id="batch_file" type="file" accept=".csv,.xlsx" {...batchForm.register("source_file", { required: true })} />
                    </div>
                    <div>
                      <Label htmlFor="batch_issuer_name">Sobrescribir emisor</Label>
                      <Input id="batch_issuer_name" {...batchForm.register("issuer_name")} />
                    </div>
                    <div>
                      <Label htmlFor="batch_issuer_title">Sobrescribir cargo</Label>
                      <Input id="batch_issuer_title" {...batchForm.register("issuer_title")} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="batch_org">Sobrescribir entidad</Label>
                      <Input id="batch_org" {...batchForm.register("organization_name")} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="batch_send_email" checked={batchForm.watch("send_email")} onCheckedChange={(checked) => batchForm.setValue("send_email", !!checked)} />
                    <Label htmlFor="batch_send_email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-500" />
                      Enviar diplomas por correo cuando el archivo incluya columna `correo`
                    </Label>
                  </div>
                  <Button type="submit" disabled={creatingBatch || activeTemplates.length === 0}>
                    {creatingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Procesar lote
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plantillas disponibles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay plantillas creadas.</p>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{template.name}</h3>
                        <Badge variant="outline" className={template.active ? "border-emerald-300 text-emerald-700" : "border-slate-300 text-slate-600"}>
                          {template.active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{template.title}</p>
                      {template.subtitle && <p className="text-xs text-slate-500">{template.subtitle}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><FileImage className="h-3 w-3" /> Logo/Fondo opcionales</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><QrCode className="h-3 w-3" /> QR verificable</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><Users className="h-3 w-3" /> {template.signers.length} emisores</span>
                      </div>
                      {template.signers.length > 0 && (
                        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                          {template.signers.map((signer) => (
                            <div key={signer.id} className="flex items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="font-medium text-slate-900">{signer.name}</p>
                                <p className="text-xs text-slate-500">{signer.role || "Sin cargo"}</p>
                              </div>
                              <span className="text-xs text-slate-500">JPEG</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lotes emitidos</CardTitle>
                <CardDescription>Descargue el ZIP generado y revise el resultado de procesamiento por lote.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : batches.length === 0 ? (
                  <p className="text-sm text-slate-500">Todavía no se ha emitido ningún lote.</p>
                ) : (
                  batches.map((batch) => (
                    <div key={batch.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{batch.template_name}</h3>
                          <p className="text-xs text-slate-500">{batch.original_filename || "Archivo sin nombre"}</p>
                        </div>
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[batch.status] ?? "bg-slate-100 text-slate-700 border-slate-300"}`}>
                          {batch.status_display}
                        </span>
                      </div>
                      <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                        <p>Total: <strong>{batch.total_records}</strong></p>
                        <p>Generados: <strong>{batch.generated_records}</strong></p>
                        <p>Enviados: <strong>{batch.emailed_records}</strong></p>
                        <p>Fecha: <strong>{new Date(batch.created_at).toLocaleString("es-CO")}</strong></p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(batch.id)} disabled={downloadingBatchId === batch.id || batch.generated_records === 0}>
                          {downloadingBatchId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                          Descargar ZIP
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={templateModalOpen} onOpenChange={(open) => {
        setTemplateModalOpen(open);
        if (!open && !creatingTemplate) resetTemplateModal();
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Shield className="h-5 w-5 text-amber-600" />
              Crear plantilla de diploma
            </DialogTitle>
            <DialogDescription>
              Defina el texto base, el número de emisores y cargue la firma de cada uno en formato JPEG.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitTemplate} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tpl_name">Nombre interno</Label>
                <Input id="tpl_name" {...templateForm.register("name", { required: true })} />
              </div>
              <div>
                <Label htmlFor="tpl_title">Título</Label>
                <Input id="tpl_title" {...templateForm.register("title", { required: true })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tpl_subtitle">Subtítulo</Label>
                <Input id="tpl_subtitle" {...templateForm.register("subtitle")} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tpl_body">Texto del diploma</Label>
                <Textarea id="tpl_body" rows={6} {...templateForm.register("body_template", { required: true })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tpl_footer">Pie del diploma</Label>
                <Input id="tpl_footer" {...templateForm.register("footer_text")} />
              </div>
              <div>
                <Label htmlFor="tpl_issuer_name">Emisor principal</Label>
                <Input id="tpl_issuer_name" {...templateForm.register("issuer_name", { required: true })} />
              </div>
              <div>
                <Label htmlFor="tpl_issuer_title">Cargo del emisor principal</Label>
                <Input id="tpl_issuer_title" {...templateForm.register("issuer_title", { required: true })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tpl_org">Entidad emisora</Label>
                <Input id="tpl_org" {...templateForm.register("organization_name", { required: true })} />
              </div>
              <div>
                <Label htmlFor="tpl_logo">Logo institucional</Label>
                <Input id="tpl_logo" type="file" accept="image/*" {...templateForm.register("logo_image")} />
              </div>
              <div>
                <Label htmlFor="tpl_bg">Fondo</Label>
                <Input id="tpl_bg" type="file" accept="image/*" {...templateForm.register("background_image")} />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Emisores y firmas</h3>
                  <p className="text-sm text-slate-600">Indique el número de emisores y cargue una firma JPEG por cada uno.</p>
                </div>
                <div className="w-28">
                  <Label htmlFor="signer_count">N.° emisores</Label>
                  <Input id="signer_count" type="number" min={1} max={6} value={signerCount} onChange={(e) => resizeSigners(Number(e.target.value || 1))} />
                </div>
              </div>

              <div className="space-y-4">
                {signers.slice(0, signerCount).map((signer, index) => (
                  <div key={index} className="rounded-xl border border-white bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-600" />
                        <p className="font-medium text-slate-900">Emisor {index + 1}</p>
                      </div>
                      {signerCount > 1 && index === signerCount - 1 && (
                        <button type="button" onClick={() => resizeSigners(signerCount - 1)} className="text-slate-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor={`signer_name_${index}`}>Nombre</Label>
                        <Input id={`signer_name_${index}`} value={signer.name} onChange={(e) => updateSigner(index, { name: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor={`signer_role_${index}`}>Cargo</Label>
                        <Input id={`signer_role_${index}`} value={signer.role} onChange={(e) => updateSigner(index, { role: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor={`signer_file_${index}`}>Firma JPEG</Label>
                        <Input id={`signer_file_${index}`} type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => handleSignerImage(index, e.target.files)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="tpl_active" checked={templateForm.watch("active")} onCheckedChange={(checked) => templateForm.setValue("active", !!checked)} />
              <Label htmlFor="tpl_active">Plantilla activa</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setTemplateModalOpen(false); resetTemplateModal(); }} disabled={creatingTemplate}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingTemplate} className="bg-amber-600 hover:bg-amber-700">
                {creatingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Guardar plantilla
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}