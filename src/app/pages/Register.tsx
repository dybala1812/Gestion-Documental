/**
 * @file Register.tsx
 * @description Página de registro de nuevos usuarios en el sistema PQRS.
 *
 * Recoge los datos personales, de identidad y de contacto del ciudadano
 * para crear una cuenta. Tras el registro exitoso, redirige al login.
 *
 * Validaciones de React Hook Form:
 *   - email, username, nombres, apellidos: requeridos.
 *   - Tipo y número de documento: requeridos.
 *   - password / password2: requeridos; la coincidencia se delega al backend
 *     aunque también puede validarse en cliente con `watch`.
 */
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { UserPlus, Eye, EyeOff, Shield, Scale } from "lucide-react";
import { apiRegister, formatApiError, type RegisterPayload, type DocumentType } from "../lib/api";
import { Controller } from "react-hook-form";
import { DeptMuniSelect } from "../components/DeptMuniSelect";
import { useAuth } from "../context/AuthContext";

/**
 * Alias de `RegisterPayload` para tipar el formulario.
 * Ya incluye `password2`; este alias evita redeclaración de la interfaz.
 */
type RegisterForm = RegisterPayload;

/** Opciones del selector de tipo de documento de identidad. */
const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
  { value: "PPT", label: "Permiso de Protección Temporal" },
  { value: "RC", label: "Registro Civil" },
];

/** Componente de la página de registro de nueva cuenta. */
export function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  /** URL a la que redirigir tras completar el registro y el rol (query param ?redirect=) */
  const redirectTo = searchParams.get("redirect") ?? null;
  const redirectSuffix = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "";
  /** true mientras se envía el formulario de registro al backend */
  const [isLoading, setIsLoading] = useState(false);
  /** true si el usuario acepta la política de datos y PQRS */
  const [consentData, setConsentData] = useState(false);
  const [consentPQRS, setConsentPQRS] = useState(false);
  /** Controla la visibilidad del campo de contraseña (texto plano o enmascarado) */
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<RegisterForm>();

  /**
   * Observa el valor del campo `password` en tiempo real.
   * Se usa para validar que `password2` coincida con `password` mediante la
   * regla `validate` registrada en ese campo.
   */
  const password = watch("password");

  /**
   * Handler de envío del formulario.
   * Registra la cuenta, realiza el login automático y redirige a la página
   * de selección de rol institucional.
   */
  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await apiRegister({
        email: data.email,
        username: data.username,
        password: data.password,
        password2: data.password2,
        nombre: data.nombre,
        apellido: data.apellido,
        tipo_documento: data.tipo_documento,
        cedula: data.cedula,
        telefono: data.telefono,
        ciudad: data.ciudad,
      });
      // Intentar login automático para ir directo a la selección de rol
      const loginResult = await login(data.email, data.password);
      if (loginResult.ok) {
        toast.success("¡Cuenta creada!", {
          description: "Selecciona tu perfil institucional para continuar.",
        });
        navigate(`/seleccionar-rol${redirectSuffix}`);
      } else {
        // Si el auto-login falla por cualquier razón, ir al login clásico
        toast.success("¡Registro exitoso!", {
          description: "Tu cuenta ha sido creada. Inicia sesión para continuar.",
        });
        navigate(`/login${redirectSuffix}`);
      }
    } catch (err) {
      toast.error("Error en el registro", { description: formatApiError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clases de Tailwind para los campos de entrada estándar del formulario.
   * Se define como string para reutilizarlo en los `<select>` nativos que
   * no aceptan el componente `<Input>` de la librería UI.
   */
  const inputCls = "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50";

  // ── Filtros de entrada en tiempo real (typing + pegado) ──────────────────
  const _soloLetras = (s: string) => s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]/g, "");
  const _soloTel    = (s: string) => s.replace(/[^0-9+\s()\-]/g, "");
  const _soloDoc    = (s: string) => s.replace(/[^0-9A-Za-z\-]/g, "");
  const _wrap = (
    rhfChange: React.ChangeEventHandler<HTMLInputElement>,
    fn: (v: string) => string
  ): React.ChangeEventHandler<HTMLInputElement> =>
    (e) => { e.target.value = fn(e.target.value); rhfChange(e); };

  const rNombre   = register("nombre",   { required: "El nombre es requerido", minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const rApellido = register("apellido", { minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const rTelefono = register("telefono", { pattern: { value: /^[0-9+\s()\-]{7,15}$/, message: "Número de teléfono inválido" } });
  const rCedula   = register("cedula",   { required: "El número de documento es requerido", minLength: { value: 4, message: "Mínimo 4 caracteres" }, maxLength: { value: 20, message: "Máximo 20 caracteres" }, pattern: { value: /^[0-9A-Za-z\-]+$/, message: "Sin espacios ni caracteres especiales" } });

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center">Crear Cuenta</CardTitle>
          <CardDescription className="text-center">
            Complete el formulario para registrarse en el sistema PQRSF
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* ── Datos de acceso ── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Datos de Acceso
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de usuario *</Label>
                  <Input
                    id="username"
                    placeholder="juan.perez"
                    autoComplete="username"
                    {...register("username", {
                      required: "El nombre de usuario es requerido",
                      minLength: { value: 4, message: "Mínimo 4 caracteres" },
                      pattern: {
                        value: /^[a-zA-Z0-9._-]+$/,
                        message: "Solo letras, números, punto, guión y underscore",
                      },
                    })}
                  />
                  {errors.username && <p className="text-sm text-red-600">{errors.username.message}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@universidad.edu.co"
                    autoComplete="email"
                    {...register("email", {
                      required: "El correo es requerido",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Correo electrónico inválido",
                      },
                    })}
                  />
                  {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                      {...register("password", {
                        required: "La contraseña es requerida",
                        minLength: { value: 8, message: "Mínimo 8 caracteres" },
                        pattern: {
                          value: /^(?=.*[A-Z])(?=.*\d).+$/,
                          message: "Debe incluir al menos una mayúscula y un número",
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
                  {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="password2">Confirmar Contraseña *</Label>
                  <Input
                    id="password2"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register("password2", {
                      required: "Debe confirmar la contraseña",
                      validate: (v) => v === password || "Las contraseñas no coinciden",
                    })}
                  />
                  {errors.password2 && <p className="text-sm text-red-600">{errors.password2.message}</p>}
                </div>
              </div>
            </div>

            {/* ── Datos personales ── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Datos Personales
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nombre */}
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre(s) *</Label>
                  <Input
                    id="nombre"
                    placeholder="Juan Carlos"
                    {...rNombre}
                    onChange={_wrap(rNombre.onChange, _soloLetras)}
                  />
                  {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
                </div>

                {/* Apellido */}
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido(s)</Label>
                  <Input
                    id="apellido"
                    placeholder="Pérez Gómez"
                    {...rApellido}
                    onChange={_wrap(rApellido.onChange, _soloLetras)}
                  />
                  {errors.apellido && <p className="text-sm text-red-600">{errors.apellido.message}</p>}
                </div>

                {/* Tipo documento */}
                <div className="space-y-2">
                  <Label htmlFor="tipo_documento">Tipo de Documento *</Label>
                  <select
                    id="tipo_documento"
                    className={inputCls}
                    {...register("tipo_documento", { required: "Seleccione el tipo de documento" })}
                  >
                    <option value="">Seleccione…</option>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  {errors.tipo_documento && <p className="text-sm text-red-600">{errors.tipo_documento.message}</p>}
                </div>

                {/* Cédula */}
                <div className="space-y-2">
                  <Label htmlFor="cedula">Número de Documento *</Label>
                  <Input
                    id="cedula"
                    placeholder="1234567890"
                    inputMode="text"
                    {...rCedula}
                    onChange={_wrap(rCedula.onChange, _soloDoc)}
                  />
                  {errors.cedula && <p className="text-sm text-red-600">{errors.cedula.message}</p>}
                </div>

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    inputMode="tel"
                    placeholder="3001234567"
                    {...rTelefono}
                    onChange={_wrap(rTelefono.onChange, _soloTel)}
                  />
                  {errors.telefono && <p className="text-sm text-red-600">{errors.telefono.message}</p>}
                </div>
              </div>

              {/* Departamento y Municipio */}
              <div className="space-y-2">
                <Controller
                  name="ciudad"
                  control={control}
                  render={({ field }) => (
                    <DeptMuniSelect
                      value={field.value}
                      onChange={field.onChange}
                      hasError={!!errors.ciudad}
                    />
                  )}
                />
                {errors.ciudad && <p className="text-sm text-red-600">{errors.ciudad.message}</p>}
              </div>
            </div>

            {/* ── Consentimientos ── */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1e3a5f] mb-1">
                Consentimiento informado (requerido)
              </p>

              {/* Política de datos */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentData}
                  onChange={(e) => setConsentData(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#1e3a5f] cursor-pointer"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  <span className="flex items-center gap-1.5 mb-0.5">
                    <Shield className="w-3.5 h-3.5 text-[#ff9800] flex-shrink-0" />
                    <strong>Autorización de tratamiento de datos personales</strong>
                  </span>
                  He leído y acepto la{" "}
                  <Link
                    to="/politica-datos"
                    target="_blank"
                    className="text-[#1e3a5f] font-semibold hover:underline underline-offset-2"
                  >
                    Política de Tratamiento de Datos Personales
                  </Link>{" "}
                  conforme a la <strong>Ley 1581 de 2012</strong> y autorizo expresamente
                  el tratamiento de mis datos para la gestión de PQRS institucionales.
                </span>
              </label>

              {/* Política PQRS */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentPQRS}
                  onChange={(e) => setConsentPQRS(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#1e3a5f] cursor-pointer"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  <span className="flex items-center gap-1.5 mb-0.5">
                    <Scale className="w-3.5 h-3.5 text-[#ff9800] flex-shrink-0" />
                    <strong>Conocimiento de la política PQRS</strong>
                  </span>
                  Declaro haber leído y comprendido la{" "}
                  <Link
                    to="/politica-pqrs"
                    target="_blank"
                    className="text-[#1e3a5f] font-semibold hover:underline underline-offset-2"
                  >
                    Política PQRS Institucional
                  </Link>,{" "}
                  los términos de respuesta establecidos en la <strong>Ley 1755 de 2015</strong> y
                  los derechos y obligaciones del peticionario.
                </span>
              </label>

              {(!consentData || !consentPQRS) && (
                <p className="text-xs text-[#1e3a5f]/70 italic">
                  Debe aceptar ambas políticas para completar el registro.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold"
              disabled={isLoading || !consentData || !consentPQRS}
            >
              {isLoading ? "Registrando..." : "Crear Cuenta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              ¿Ya tiene cuenta?{" "}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">
                Inicie sesión aquí
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

