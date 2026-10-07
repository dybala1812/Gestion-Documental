/**
 * @file ForgotPassword.tsx
 * @description Página para solicitar el enlace de recuperación de contraseña.
 *
 * El usuario ingresa su correo y el backend envía un email con el link si existe.
 * Siempre muestra el mismo mensaje de éxito para no revelar si el email está registrado.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiPasswordResetRequest, formatApiError } from "../lib/api";

interface ForgotForm {
  email: string;
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotForm>();

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true);
    try {
      await apiPasswordResetRequest(data.email.trim().toLowerCase());
      setSent(true);
      setCooldown(60);
    } catch (err) {
      // El backend siempre devuelve 200; solo llegaría aquí si hay error de red o 400/429
      toast.error("No se pudo enviar el correo", { description: formatApiError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              {sent ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <Mail className="h-6 w-6 text-blue-600" />
              )}
            </div>
          </div>
          <CardTitle className="text-center">
            {sent ? "Correo enviado" : "Recuperar contraseña"}
          </CardTitle>
          <CardDescription className="text-center">
            {sent
              ? `Si el correo ${getValues("email")} está registrado, recibirás un enlace en tu bandeja de entrada.`
              : "Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                Revisa tu bandeja de entrada y carpeta de spam. El enlace expira en poco tiempo.
              </div>
              <div className="text-center text-sm text-gray-600">
                ¿No llegó el correo?{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline font-medium disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                  disabled={cooldown > 0}
                  onClick={() => setSent(false)}
                >
                  {cooldown > 0 ? `Intentar de nuevo en ${cooldown}s` : "Intentar de nuevo"}
                </button>
              </div>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  {...register("email", {
                    required: "El correo es requerido",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Correo electrónico inválido",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
