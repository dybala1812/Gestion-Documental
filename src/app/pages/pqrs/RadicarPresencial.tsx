/**
 * RadicarPresencial.tsx
 *
 * Formulario exclusivo para funcionarios de área que necesitan radicar una PQRS
 * en nombre de un ciudadano que se presenta físicamente o de forma verbal ante
 * la institución.
 *
 * Canal "PRESENCIAL" → el ciudadano llegó en persona.
 * Canal "VERBAL"     → el ciudadano llamó o presentó la solicitud verbalmente.
 *
 * Al enviarse con éxito muestra el número de radicado generado para entregárselo
 * al ciudadano.
 *
 * @requires rol "area" o "admin" — la ruta está protegida en routes.tsx.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  UserRound,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  Building2,
  Printer,
} from "lucide-react";
import {
  apiCreatePQRSWithAttachments,
  formatApiError,
  type PqrsType,
  type PqrsPriority,
} from "../../lib/api";
import { Controller } from "react-hook-form";

// ── Opciones de formulario ──────────────────────────────────────────────────

const CANALES = [
  { value: "PRESENCIAL" as const, label: "Presencial (ciudadano en oficina)" },
  { value: "VERBAL"     as const, label: "Verbal (llamada o solicitud hablada)" },
];

const TIPOS: { value: PqrsType; label: string }[] = [
  { value: "P", label: "Petición" },
  { value: "Q", label: "Queja" },
  { value: "R", label: "Reclamo" },
  { value: "S", label: "Sugerencia" },
  { value: "F", label: "Felicitación" },
];

const PRIORIDADES: { value: PqrsPriority; label: string }[] = [
  { value: "LOW",  label: "Baja" },
  { value: "MED",  label: "Media" },
  { value: "HIGH", label: "Alta" },
];

const TIPOS_DOCUMENTO = [
  { value: "CC",  label: "Cédula de Ciudadanía" },
  { value: "CE",  label: "Cédula de Extranjería" },
  { value: "TI",  label: "Tarjeta de Identidad" },
  { value: "PA",  label: "Pasaporte" },
  { value: "PPT", label: "Permiso por Protección Temporal" },
  { value: "RC",  label: "Registro Civil" },
];

// ── Tipo del formulario ─────────────────────────────────────────────────────

interface FormData {
  canal_ingreso: "PRESENCIAL" | "VERBAL";
  pqrs_type: PqrsType;
  subject: string;
  description: string;
  priority: PqrsPriority;
  // Datos del ciudadano (todos opcionales, pero se recomienda el nombre)
  ciudadano_nombre?: string;
  ciudadano_apellido?: string;
  ciudadano_tipo_doc?: "CC" | "CE" | "TI" | "PA" | "PPT" | "RC";
  ciudadano_documento?: string;
  ciudadano_email?: string;
  ciudadano_telefono?: string;
  ciudadano_ciudad?: string;
}

// ── Componente principal ────────────────────────────────────────────────────

export function RadicarPresencial() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [isLoading,       setIsLoading]       = useState(false);
  const [radicadoGenerado, setRadicadoGenerado] = useState<string | null>(null);
  const [showModal,       setShowModal]        = useState(false);
  const [copied,          setCopied]           = useState(false);
  const [adjuntos,        setAdjuntos]         = useState<File[]>([]);
  const [lastFormData,    setLastFormData]     = useState<FormData | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      canal_ingreso:      "PRESENCIAL",
      priority:           "MED",
      ciudadano_tipo_doc: "CC",
    },
  });

  // ── Handler principal ─────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const payload = {
        type:          data.pqrs_type,
        subject:       data.subject,
        description:   data.description,
        priority:      data.priority,
        canal_ingreso: data.canal_ingreso,
        // Datos del ciudadano → van como campos anon_*
        anon_name:            data.ciudadano_nombre     || "",
        anon_last_name:       data.ciudadano_apellido   || "",
        anon_tipo_documento:  data.ciudadano_tipo_doc   || "CC",
        anon_document_number: data.ciudadano_documento  || "",
        anon_email:           data.ciudadano_email      || "",
        anon_phone:           data.ciudadano_telefono   || "",
        anon_city:            data.ciudadano_ciudad     || "",
      };

      const res = await apiCreatePQRSWithAttachments(payload, adjuntos, true);

      setRadicadoGenerado(res.numero_radicado);
      setLastFormData(data);
      setShowModal(true);
      reset();
      setAdjuntos([]);
    } catch (err) {
      toast.error("Error al radicar la PQRS", {
        description: formatApiError(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!radicadoGenerado) return;
    navigator.clipboard.writeText(radicadoGenerado).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setRadicadoGenerado(null);
  };

  /** Imprime un comprobante de radicación físico para entregar al ciudadano. */
  const handlePrintComprobante = () => {
    if (!radicadoGenerado) return;
    const now = new Date().toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const CANAL_LABEL: Record<string, string> = { PRESENCIAL: "Presencial (en persona)", VERBAL: "Verbal (telefónico/oral)" };
    const TIPO_LABEL: Record<string, string> = { P: "Petición", Q: "Queja", R: "Reclamo", S: "Sugerencia", F: "Felicitación" };
    const funcionario = usuario ? `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim() || usuario.email : "—";
    const ciudadano = [lastFormData?.ciudadano_nombre, lastFormData?.ciudadano_apellido].filter(Boolean).join(" ") || "Anónimo";
    const canal = CANAL_LABEL[lastFormData?.canal_ingreso ?? "PRESENCIAL"] ?? "Presencial";
    const tipo  = TIPO_LABEL[lastFormData?.pqrs_type ?? ""] ?? lastFormData?.pqrs_type ?? "—";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Comprobante PQRSF ${radicadoGenerado}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 32px; font-size: 13px; max-width: 480px; margin: 0 auto; }
    .border-box { border: 2px solid #1d4ed8; border-radius: 10px; padding: 24px; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed #9ca3af; }
    .header h1 { font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .header p { font-size: 11px; color: #6b7280; }
    .radicado-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
    .radicado-box label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; display: block; margin-bottom: 6px; }
    .radicado-box .num { font-size: 24px; font-weight: 900; font-family: monospace; color: #1d4ed8; letter-spacing: .1em; }
    .field { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
    .field span:first-child { color: #6b7280; }
    .field span:last-child { font-weight: 600; color: #1f2937; text-align: right; max-width: 60%; }
    .notice { margin-top: 16px; font-size: 11px; color: #6b7280; background: #f9fafb; border-radius: 6px; padding: 10px; line-height: 1.6; text-align: center; }
    .signature { margin-top: 24px; border-top: 1px dashed #9ca3af; padding-top: 16px; }
    .signature .sig-line { border-top: 1px solid #374151; margin-top: 40px; margin-bottom: 4px; }
    .signature p { font-size: 10px; color: #6b7280; text-align: center; }
    .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 10mm; } @page { margin: 0; size: 80mm auto; } }
  </style>
</head>
<body>
  <div class="border-box">
    <div class="header">
      <h1>Comprobante de Radicación PQRSF</h1>
      <p>Sistema PQRSF Institucional &nbsp;·&nbsp; ${now}</p>
    </div>
    <div class="radicado-box">
      <label>Número de radicado</label>
      <div class="num">${radicadoGenerado}</div>
    </div>
    <div class="field"><span>Tipo de solicitud</span><span>${tipo}</span></div>
    <div class="field"><span>Canal de ingreso</span><span>${canal}</span></div>
    <div class="field"><span>Ciudadano</span><span>${ciudadano}</span></div>
    ${lastFormData?.ciudadano_email ? `<div class="field"><span>Correo</span><span>${lastFormData.ciudadano_email}</span></div>` : ""}
    ${lastFormData?.ciudadano_telefono ? `<div class="field"><span>Teléfono</span><span>${lastFormData.ciudadano_telefono}</span></div>` : ""}
    <div class="field"><span>Registrado por</span><span>${funcionario}</span></div>
    <div class="notice">
      Conserve este comprobante. Con el número de radicado puede hacer seguimiento
      de su solicitud en línea o en las instalaciones de la institución.
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <p>Firma del ciudadano</p>
      <div class="sig-line" style="margin-top:32px;"></div>
      <p>Firma y sello del funcionario receptor</p>
    </div>
  </div>
  <div class="footer">Documento generado por el Sistema PQRSF Institucional</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);
    const iframeWin = iframe.contentWindow;
    if (!iframeWin) { document.body.removeChild(iframe); return; }
    iframeWin.document.write(html);
    iframeWin.document.close();
    iframeWin.focus();
    iframeWin.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 2000);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/area")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Button>
        <div className="h-6 w-px bg-gray-200" />
        <Building2 className="h-5 w-5 text-blue-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 leading-none">
            Radicar PQRS Presencial / Verbal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Funcionario:{" "}
            <span className="font-medium">
              {usuario?.nombre} {usuario?.apellido}
            </span>{" "}
            · {usuario?.dependencyName ?? "Sin área asignada"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Canal de ingreso ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Canal de ingreso
              </CardTitle>
              <CardDescription>
                Indique cómo presentó la solicitud el ciudadano.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="canal_ingreso"
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CANALES.map((c) => (
                      <label
                        key={c.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          field.value === c.value
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="radio"
                          value={c.value}
                          checked={field.value === c.value}
                          onChange={() => field.onChange(c.value)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium text-gray-800">
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Datos del ciudadano ───────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserRound className="h-4 w-4 text-blue-600" />
                Datos del ciudadano
              </CardTitle>
              <CardDescription>
                Registre la información de la persona que presenta la solicitud.
                Todos los campos son opcionales pero se recomienda capturar al menos
                el nombre y el correo para notificarle el número de radicado.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_nombre">Nombre(s)</Label>
                <Input
                  id="ciudadano_nombre"
                  placeholder="Ej. Carlos Andrés"
                  {...register("ciudadano_nombre")}
                />
              </div>

              {/* Apellido */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_apellido">Apellido(s)</Label>
                <Input
                  id="ciudadano_apellido"
                  placeholder="Ej. Gómez Reyes"
                  {...register("ciudadano_apellido")}
                />
              </div>

              {/* Tipo de documento */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_tipo_doc">Tipo de documento</Label>
                <select
                  id="ciudadano_tipo_doc"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("ciudadano_tipo_doc")}
                >
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número de documento */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_documento">Número de documento</Label>
                <Input
                  id="ciudadano_documento"
                  placeholder="Ej. 1234567890"
                  {...register("ciudadano_documento")}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_email">Correo electrónico</Label>
                <Input
                  id="ciudadano_email"
                  type="email"
                  placeholder="ciudadano@correo.com"
                  {...register("ciudadano_email")}
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <Label htmlFor="ciudadano_telefono">Teléfono</Label>
                <Input
                  id="ciudadano_telefono"
                  placeholder="Ej. 3001234567"
                  {...register("ciudadano_telefono")}
                />
              </div>

              {/* Ciudad */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ciudadano_ciudad">Ciudad / Municipio</Label>
                <Input
                  id="ciudadano_ciudad"
                  placeholder="Ej. Bogotá D.C."
                  {...register("ciudadano_ciudad")}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Detalles de la PQRS ───────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Detalles de la solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label>Tipo de PQRS *</Label>
                <Controller
                  control={control}
                  name="pqrs_type"
                  rules={{ required: "Seleccione el tipo de PQRS." }}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {TIPOS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => field.onChange(t.value)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            field.value === t.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.pqrs_type && (
                  <p className="text-xs text-red-600">{errors.pqrs_type.message}</p>
                )}
              </div>

              {/* Prioridad */}
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {PRIORIDADES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => field.onChange(p.value)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            field.value === p.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Asunto */}
              <div className="space-y-1.5">
                <Label htmlFor="subject">Asunto *</Label>
                <Input
                  id="subject"
                  placeholder="Resumen breve de la solicitud (10–200 caracteres)"
                  {...register("subject", {
                    required: "El asunto es obligatorio.",
                    minLength: { value: 10, message: "Mínimo 10 caracteres." },
                    maxLength: { value: 200, message: "Máximo 200 caracteres." },
                  })}
                />
                {errors.subject && (
                  <p className="text-xs text-red-600">{errors.subject.message}</p>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  placeholder="Describa con detalle la solicitud del ciudadano (20–2000 caracteres)"
                  rows={5}
                  {...register("description", {
                    required: "La descripción es obligatoria.",
                    minLength: { value: 20, message: "Mínimo 20 caracteres." },
                    maxLength: { value: 2000, message: "Máximo 2000 caracteres." },
                  })}
                />
                {errors.description && (
                  <p className="text-xs text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Adjuntos */}
              <div className="space-y-1.5">
                <Label htmlFor="adjuntos">Adjuntos (opcional)</Label>
                <Input
                  id="adjuntos"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.zip"
                  onChange={(e) => {
                    if (e.target.files) {
                      setAdjuntos(Array.from(e.target.files));
                    }
                  }}
                  className="cursor-pointer"
                />
                {adjuntos.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {adjuntos.length} archivo(s) seleccionado(s)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Acciones ─────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/area")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Radicando…" : "Radicar PQRS"}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Modal de confirmación ─────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 text-base sm:text-lg">
              <CheckCircle2 className="h-5 w-5" />
              PQRS radicada exitosamente
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              La solicitud fue registrada. Entregue el número de radicado al ciudadano
              para que pueda hacer seguimiento en línea.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-lg bg-gray-50 border p-3 sm:p-4 text-center">
            <p className="text-xs text-gray-500 mb-2">Número de radicado</p>
            <p className="text-xl sm:text-2xl font-bold tracking-widest text-blue-700 break-all">
              {radicadoGenerado}
            </p>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintComprobante}
              className="gap-2 w-full"
            >
              <Printer className="h-4 w-4" />
              Imprimir comprobante
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2 w-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar radicado
                </>
              )}
            </Button>
            <Button onClick={handleCloseModal} className="w-full">Radicar otra PQRS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
