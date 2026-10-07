/**
 * ConsultaCertificado.tsx
 * Página pública para que los solicitantes consulten el estado de su
 * solicitud de certificado usando el número de solicitud y su correo.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Search, BookOpen as GraduationCap, Calendar, FileCheck, Clock } from "lucide-react";
import {
  apiConsultarCertificado,
  formatApiError,
  type ConsultaCertificadoResponse,
} from "../../lib/api";

interface ConsultaForm {
  numero_solicitud: string;
  correo: string;
}

/** Mapeo de estados a colores para los badges */
const STATUS_COLORS: Record<string, string> = {
  Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  "En revisión": "bg-blue-100 text-blue-800 border-blue-300",
  Aprobada: "bg-green-100 text-green-800 border-green-300",
  Rechazada: "bg-red-100 text-red-800 border-red-300",
  Entregada: "bg-purple-100 text-purple-800 border-purple-300",
};

export function ConsultaCertificado() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<ConsultaCertificadoResponse | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsultaForm>();

  const onSubmit = async (data: ConsultaForm) => {
    setIsLoading(true);
    setResultado(null);
    try {
      const res = await apiConsultarCertificado(
        data.numero_solicitud.trim().toUpperCase(),
        data.correo.trim().toLowerCase(),
      );
      setResultado(res);
    } catch (err) {
      toast.error("No se encontró la solicitud", { description: formatApiError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusColor = resultado
    ? STATUS_COLORS[resultado.estado] || "bg-gray-100 text-gray-800 border-gray-300"
    : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Encabezado */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <GraduationCap className="h-8 w-8 text-blue-700" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Consultar solicitud de certificado</h1>
        <p className="mt-2 text-gray-600">
          Ingrese su número de solicitud y correo electrónico para verificar el estado.
        </p>
      </div>

      {/* Formulario de consulta */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="numero_solicitud">
                Número de solicitud <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numero_solicitud"
                placeholder="SOL-20260326-A1B2C3D4"
                {...register("numero_solicitud", {
                  required: "Ingrese el número de solicitud",
                })}
              />
              {errors.numero_solicitud && (
                <p className="mt-1 text-sm text-red-500">{errors.numero_solicitud.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="correo">
                Correo electrónico <span className="text-red-500">*</span>
              </Label>
              <Input
                id="correo"
                type="email"
                placeholder="sucorreo@ejemplo.com"
                {...register("correo", {
                  required: "Ingrese su correo electrónico",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Correo inválido",
                  },
                })}
              />
              {errors.correo && (
                <p className="mt-1 text-sm text-red-500">{errors.correo.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#003366] hover:bg-[#002244]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Consultando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Search className="h-4 w-4" />
                  Consultar
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Resultado de la consulta */}
      {resultado && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="h-5 w-5 text-blue-600" />
              Resultado de la consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm font-medium text-gray-500">Número de solicitud</span>
                <p className="font-mono font-bold text-gray-900">{resultado.numero_solicitud}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Estado</span>
                <p>
                  <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${statusColor}`}>
                    {resultado.estado}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Tipo de certificado</span>
                <p className="text-gray-900">{resultado.tipo_certificado}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Programa académico</span>
                <p className="text-gray-900">{resultado.programa_academico}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-sm font-medium text-gray-500">Fecha de solicitud</span>
                  <p className="text-sm text-gray-900">{formatDate(resultado.fecha_solicitud)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-sm font-medium text-gray-500">Fecha de resolución</span>
                  <p className="text-sm text-gray-900">{formatDate(resultado.fecha_resolucion)}</p>
                </div>
              </div>
            </div>

            {resultado.respuesta && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <span className="mb-1 block text-sm font-semibold text-green-800">Respuesta:</span>
                <p className="text-sm text-green-900 whitespace-pre-line">{resultado.respuesta}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
