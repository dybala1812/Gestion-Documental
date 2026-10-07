/**
 * SolicitudCertificados.tsx
 * Página pública para solicitar certificados académicos.
 * Los egresados y estudiantes seleccionan el tipo de certificado mediante
 * cards visuales, llenan sus datos de contacto, adjuntan foto de documento
 * de identidad y envían la solicitud. Al completarse, se muestra el número.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  BookOpen as GraduationCap,
  CheckCircle2,
  Copy,
  Check,
  Upload,
  X,
  FileCheck,
  ClipboardList,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import {
  apiCreateCertificateRequest,
  formatApiError,
  type CertificateType,
  type CreateCertificatePayload,
} from "../../lib/api";

/** Estructura del formulario de solicitud de certificado. */
interface CertificateForm {
  certificate_type: CertificateType;
  nombres: string;
  apellidos: string;
  correo_personal: string;
  celular: string;
  correo_institucional: string;
  programa_academico: string;
  observaciones: string;
}

/** Tipos de certificado con información descriptiva para las cards. */
const CERTIFICATE_TYPES: {
  value: CertificateType;
  label: string;
  description: string;
  icon: typeof FileCheck;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    value: "CONSTANCIA",
    label: "Constancia de estudio",
    description:
      "Documento que certifica que usted se encuentra matriculado o fue estudiante de nuestra institución. Ideal para trámites laborales, bancarios o personales.",
    icon: FileCheck,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-300",
  },
  {
    value: "NOTAS",
    label: "Certificado de notas",
    description:
      "Historial académico oficial con el detalle de las asignaturas cursadas y sus calificaciones. Útil para estudios de posgrado o procesos de homologación.",
    icon: ClipboardList,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  {
    value: "CONTENIDOS",
    label: "Contenidos programáticos",
    description:
      "Información detallada de los planes de estudio y contenidos de cada asignatura. Requerido frecuentemente para procesos de convalidación o equivalencia académica.",
    icon: BookOpen,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
  {
    value: "OTRO",
    label: "Otro certificado",
    description:
      "¿Necesita un documento diferente? Seleccione esta opción y descríbanos en las observaciones qué certificado requiere. Estaremos encantados de ayudarle.",
    icon: HelpCircle,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
];

export function SolicitudCertificados() {
  const { usuario, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Estado
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<CertificateType>("CONSTANCIA");
  const [numeroSolicitud, setNumeroSolicitud] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adjuntosIdentidad, setAdjuntosIdentidad] = useState<File[]>([]);

  // Formulario
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CertificateForm>({
    defaultValues: {
      certificate_type: "CONSTANCIA",
      correo_institucional: "",
      observaciones: "",
    },
  });

  // Pre-llenar datos del usuario autenticado
  useEffect(() => {
    if (usuario) {
      if (usuario.nombre) setValue("nombres", usuario.nombre);
      if (usuario.apellido) setValue("apellidos", usuario.apellido);
      if (usuario.email) setValue("correo_institucional", usuario.email);
      if (usuario.telefono) setValue("celular", usuario.telefono);
    }
  }, [usuario, setValue]);

  /** Handler para selección de tipo de certificado via cards */
  const handleSelectType = (type: CertificateType) => {
    setSelectedType(type);
    setValue("certificate_type", type);
  };

  /** Handler de adjuntos de identidad */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}" excede 10 MB`);
        return false;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
        toast.error(`"${f.name}" no es un formato válido (imagen o PDF)`);
        return false;
      }
      return true;
    });
    setAdjuntosIdentidad((prev) => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAdjuntosIdentidad((prev) => prev.filter((_, i) => i !== index));
  };

  /** Envío del formulario */
  const onSubmit = async (data: CertificateForm) => {
    if (adjuntosIdentidad.length === 0) {
      toast.error("Debe adjuntar al menos una fotografía de su documento de identidad.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: CreateCertificatePayload = {
        certificate_type: data.certificate_type,
        nombres: data.nombres.trim(),
        apellidos: data.apellidos.trim(),
        correo_personal: data.correo_personal.trim().toLowerCase(),
        celular: data.celular.trim(),
        correo_institucional: data.correo_institucional?.trim() || undefined,
        programa_academico: data.programa_academico.trim(),
        observaciones: data.observaciones?.trim() || undefined,
      };

      const result = await apiCreateCertificateRequest(
        payload,
        adjuntosIdentidad,
        isAuthenticated,
      );

      setNumeroSolicitud(result.numero_solicitud);
      setShowModal(true);
      setAdjuntosIdentidad([]);
    } catch (err) {
      toast.error("Error al enviar solicitud", { description: formatApiError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  /** Copiar número de solicitud */
  const handleCopy = () => {
    if (!numeroSolicitud) return;
    navigator.clipboard.writeText(numeroSolicitud).then(() => {
      setCopied(true);
      toast.success("Número de solicitud copiado");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filtros de entrada
  const _soloLetras = (s: string) => s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]/g, "");
  const _soloTel = (s: string) => s.replace(/[^0-9+\s()\-]/g, "");

  const rNombres = register("nombres", {
    required: "Los nombres son requeridos",
    minLength: { value: 2, message: "Mínimo 2 caracteres" },
    pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]+$/, message: "Solo letras y espacios" },
  });
  const rApellidos = register("apellidos", {
    required: "Los apellidos son requeridos",
    minLength: { value: 2, message: "Mínimo 2 caracteres" },
    pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]+$/, message: "Solo letras y espacios" },
  });
  const rCelular = register("celular", {
    required: "El celular es requerido",
    pattern: { value: /^[0-9+\s()\-]{7,15}$/, message: "Número inválido (7-15 dígitos)" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ── Encabezado ── */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <GraduationCap className="h-8 w-8 text-blue-700" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Mesa de Ayuda</h1>
        <p className="mt-2 text-base text-gray-600">
          Solicitud de certificados académicos para egresados y estudiantes
        </p>
        <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-blue-600" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Tipo de certificado (cards) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">¿Qué certificado necesita?</CardTitle>
            <p className="text-sm text-gray-500">
              Seleccione el tipo de documento que desea solicitar
            </p>
          </CardHeader>
          <CardContent>
            <input type="hidden" {...register("certificate_type", { required: "Seleccione un tipo de certificado" })} />
            <div className="grid gap-4 sm:grid-cols-2">
              {CERTIFICATE_TYPES.map((ct) => {
                const isSelected = selectedType === ct.value;
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => handleSelectType(ct.value)}
                    className={`group relative flex flex-col items-start rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                      isSelected
                        ? `${ct.borderColor} ${ct.bgColor} shadow-md ring-2 ring-offset-1 ring-${ct.borderColor.replace("border-", "")}`
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Indicador de selección */}
                    {isSelected && (
                      <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                        <Check className={`h-4 w-4 ${ct.color}`} />
                      </span>
                    )}

                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${ct.bgColor}`}>
                      <Icon className={`h-6 w-6 ${ct.color}`} />
                    </div>

                    <h3 className={`text-base font-semibold ${isSelected ? ct.color : "text-gray-900"}`}>
                      {ct.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {ct.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* ── Detalle del certificado seleccionado ── */}
            {(() => {
              const selected = CERTIFICATE_TYPES.find((ct) => ct.value === selectedType);
              if (!selected) return null;
              const Icon = selected.icon;
              return (
                <div className={`mt-4 flex items-start gap-3 rounded-lg border ${selected.borderColor} ${selected.bgColor} px-4 py-3`}>
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected.color}`} />
                  <div>
                    <p className={`text-sm font-semibold ${selected.color}`}>{selected.label}</p>
                    <p className="mt-0.5 text-sm text-gray-700 leading-relaxed">{selected.description}</p>
                  </div>
                </div>
              );
            })()}
            {errors.certificate_type && (
              <p className="mt-2 text-sm text-red-500">{errors.certificate_type.message}</p>
            )}
          </CardContent>
        </Card>

        {/* ── Datos académicos ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Datos académicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="programa_academico">
                Programa académico cursado o culminado <span className="text-red-500">*</span>
              </Label>
              <Input
                id="programa_academico"
                placeholder="Ej: Ingeniería de Sistemas, Derecho, Contaduría Pública..."
                {...register("programa_academico", {
                  required: "El programa académico es requerido",
                  minLength: { value: 3, message: "Mínimo 3 caracteres" },
                })}
              />
              {errors.programa_academico && (
                <p className="mt-1 text-sm text-red-500">{errors.programa_academico.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Documento de identidad ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Fotografía de documento de identidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Adjunte una fotografía clara de ambos lados de su documento de identidad (imagen o PDF).
              </p>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  adjuntosIdentidad.length > 0
                    ? "border-green-300 bg-green-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  Agregar archivos aquí o <span className="text-blue-600 underline">elegirlos</span>
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  Formatos: JPG, PNG, GIF, WEBP, PDF — Máximo 10 MB por archivo
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {adjuntosIdentidad.length > 0 && (
                <ul className="space-y-2">
                  {adjuntosIdentidad.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {adjuntosIdentidad.length === 0 && (
                <p className="text-xs text-red-500">
                  * Debe adjuntar al menos una fotografía de su documento de identidad
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Datos de contacto ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nombres">
                  Nombres <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombres"
                  placeholder="Sus nombres"
                  {...rNombres}
                  onChange={(e) => {
                    e.target.value = _soloLetras(e.target.value);
                    rNombres.onChange(e);
                  }}
                />
                {errors.nombres && (
                  <p className="mt-1 text-sm text-red-500">{errors.nombres.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="apellidos">
                  Apellidos <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="apellidos"
                  placeholder="Sus apellidos"
                  {...rApellidos}
                  onChange={(e) => {
                    e.target.value = _soloLetras(e.target.value);
                    rApellidos.onChange(e);
                  }}
                />
                {errors.apellidos && (
                  <p className="mt-1 text-sm text-red-500">{errors.apellidos.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="correo_personal">
                Correo personal <span className="text-red-500">*</span>
              </Label>
              <Input
                id="correo_personal"
                type="email"
                placeholder="sucorreo@ejemplo.com"
                {...register("correo_personal", {
                  required: "El correo personal es requerido",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Correo electrónico inválido",
                  },
                })}
              />
              {errors.correo_personal && (
                <p className="mt-1 text-sm text-red-500">{errors.correo_personal.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="celular">
                Número celular personal <span className="text-red-500">*</span>
              </Label>
              <Input
                id="celular"
                type="tel"
                placeholder="3001234567"
                {...rCelular}
                onChange={(e) => {
                  e.target.value = _soloTel(e.target.value);
                  rCelular.onChange(e);
                }}
              />
              {errors.celular && (
                <p className="mt-1 text-sm text-red-500">{errors.celular.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="correo_institucional">
                Correo institucional (si tiene)
              </Label>
              <Input
                id="correo_institucional"
                type="email"
                placeholder="usuario@uniautonoma.edu.co"
                {...register("correo_institucional", {
                  pattern: {
                    value: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Correo electrónico inválido",
                  },
                })}
              />
              {errors.correo_institucional && (
                <p className="mt-1 text-sm text-red-500">{errors.correo_institucional.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Observaciones ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Observaciones adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Si tiene alguna observación adicional, escríbala aquí..."
              rows={4}
              {...register("observaciones", {
                maxLength: { value: 2000, message: "Máximo 2000 caracteres" },
              })}
            />
            {errors.observaciones && (
              <p className="mt-1 text-sm text-red-500">{errors.observaciones.message}</p>
            )}
          </CardContent>
        </Card>

        {/* ── Botón de envío ── */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading}
            className="min-w-[200px] bg-[#003366] hover:bg-[#002244]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Enviando solicitud...
              </span>
            ) : (
              "Enviar solicitud"
            )}
          </Button>
        </div>
      </form>

      {/* ── Modal de confirmación ── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center">¡Solicitud registrada!</DialogTitle>
            <DialogDescription className="text-center">
              Su solicitud de certificado ha sido recibida exitosamente.
              Guarde su número de solicitud para consultar el estado.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex items-center justify-between rounded-lg border-2 border-blue-200 bg-blue-50 px-4 py-3">
            <span className="font-mono text-lg font-bold text-blue-800">
              {numeroSolicitud}
            </span>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-gray-500" />
              )}
            </Button>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-[#003366] hover:bg-[#002244]"
              onClick={() => {
                setShowModal(false);
                navigate("/consulta-certificado");
              }}
            >
              Consultar estado
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowModal(false);
                reset();
                setAdjuntosIdentidad([]);
                setNumeroSolicitud(null);
              }}
            >
              Realizar otra solicitud
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setShowModal(false);
                navigate("/");
              }}
            >
              Ir al inicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
