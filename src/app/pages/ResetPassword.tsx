/**
 * @file ResetPassword.tsx
 * @description Página para establecer una nueva contraseña usando el enlace del correo.
 *
 * Lee `uid` y `token` de los query params de la URL:
 *   /reset-password?uid=<uid>&token=<token>
 *
 * Si alguno falta, muestra un aviso de enlace inválido.
 * Tras el restablecimiento exitoso, redirige al login con un mensaje de confirmación.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams, useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { KeyRound, Eye, EyeOff, ArrowLeft, AlertTriangle } from "lucide-react";
import { apiPasswordResetConfirm, formatApiError } from "../lib/api";

interface ResetForm {
  new_password: string;
  new_password2: string;
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ResetForm>();

  const onSubmit = async (data: ResetForm) => {
    setIsLoading(true);
    try {
      await apiPasswordResetConfirm({
        uid,
        token,
        new_password: data.new_password,
        new_password2: data.new_password2,
      });
      toast.success("Contraseña restablecida", {
        description: "Ahora puedes iniciar sesión con tu nueva contraseña.",
      });
      navigate("/login");
    } catch (err) {
      // Intentar mapear errores de campo específicos del backend a los campos del form
      const msg = formatApiError(err);
      if (msg.toLowerCase().includes("token") || msg.toLowerCase().includes("enlace")) {
        setError("root", { message: msg });
      } else if (msg.toLowerCase().includes("coinc")) {
        setError("new_password2", { message: msg });
      } else {
        setError("new_password", { message: msg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enlace inválido o incompleto
  if (!uid || !token) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-center">Enlace inválido</CardTitle>
            <CardDescription className="text-center">
              El enlace de recuperación no es válido o ha expirado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              Los enlaces de recuperación son de un solo uso y tienen una validez limitada.
              Solicita uno nuevo si lo necesitas.
            </div>
            <Link
              to="/forgot-password"
              className="flex items-center justify-center gap-2 w-full rounded-md bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold h-10 px-4 text-sm"
            >
              Solicitar nuevo enlace
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center">Nueva contraseña</CardTitle>
          <CardDescription className="text-center">
            Ingresa y confirma tu nueva contraseña.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Error general (enlace expirado, etc.) */}
            {errors.root && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {errors.root.message}
                <div className="mt-2">
                  <Link to="/forgot-password" className="underline font-medium">
                    Solicitar un nuevo enlace
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new_password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("new_password", {
                    required: "La contraseña es requerida",
                    minLength: { value: 8, message: "Mínimo 8 caracteres" },
                    pattern: {
                      value: /^(?=.*[A-Z])(?=.*[!@#$%^&*\-_+=?.]).{8,}$/,
                      message: "Debe incluir al menos una mayúscula y un carácter especial (!@#$%^&*-_+=?.)",
                    },
                  })}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.new_password && (
                <p className="text-sm text-red-600">{errors.new_password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password2">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="new_password2"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("new_password2", {
                    required: "La confirmación es requerida",
                    validate: (val) =>
                      val === watch("new_password") || "Las contraseñas no coinciden",
                  })}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.new_password2 && (
                <p className="text-sm text-red-600">{errors.new_password2.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold"
              disabled={isLoading}
            >
              {isLoading ? "Guardando..." : "Restablecer contraseña"}
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
