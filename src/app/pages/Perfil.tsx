/**
 * @file Perfil.tsx
 * @description Página de perfil de usuario.
 *
 * Permite al usuario autenticado:
 *   1. Ver y actualizar sus datos personales (nombre, apellido, username,
 *      teléfono, dirección, ciudad) mediante la pestaña "Información Personal".
 *   2. Cambiar su contraseña mediante la pestaña "Cambiar Contraseña",
 *      con validación de coincidencia entre "nueva contraseña" y "confirmación".
 *
 * Tras actualizar el perfil, se llama a `refreshPerfil()` para sincronizar
 * el contexto de autenticación con los datos recién guardados.
 */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { User, KeyRound, Loader2, Save } from "lucide-react";
import { apiUpdatePerfil, apiChangePassword, formatApiError } from "../lib/api";
import { Controller } from "react-hook-form";
import { DeptMuniSelect } from "../components/DeptMuniSelect";

/** Estructura del formulario de datos personales del usuario. */
interface ProfileForm {
  nombre: string;
  apellido: string;
  username: string;
  telefono: string;
  direccion: string;
  ciudad: string;
}

/**
 * Estructura del formulario de cambio de contraseña.
 * `password_nuevo2` se valida localmente antes de enviar al backend.
 */
interface PasswordForm {
  password_actual: string;  // Contraseña actual para confirmar identidad
  password_nuevo: string;   // Nueva contraseña deseada
  password_nuevo2: string;  // Confirmación de la nueva contraseña (debe coincidir)
}

/** Componente de la página de perfil de usuario. */
export function Perfil() {
  const { usuario, refreshPerfil } = useAuth();
  /** true mientras se guarda el formulario de perfil */
  const [savingProfile, setSavingProfile] = useState(false);
  /** true mientras se guarda el formulario de cambio de contraseña */
  const [savingPassword, setSavingPassword] = useState(false);

  /**
   * Formulario de datos personales preinicializado con los valores actuales
   * del usuario del contexto de autenticación.
   */
  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      nombre:    usuario?.nombre    ?? "",
      apellido:  usuario?.apellido  ?? "",
      username:  usuario?.username  ?? "",
      telefono:  usuario?.telefono  ?? "",
      direccion: "",
      ciudad:    usuario?.ciudad    ?? "",
    },
  });

  /** Formulario de cambio de contraseña (sin valores por defecto). */
  const passwordForm = useForm<PasswordForm>();

  /**
   * Guarda los datos personales actualizados.
   * Solo envía los campos con valor no vacío (los vacíos se omiten como undefined).
   * Tras guardar, sincroniza el contexto de autenticación llamando a `refreshPerfil`.
   */
  const onSaveProfile = async (data: ProfileForm) => {
    setSavingProfile(true);
    try {
      await apiUpdatePerfil({
        nombre:    data.nombre   || undefined,
        apellido:  data.apellido || undefined,
        username:  data.username || undefined,
        telefono:  data.telefono || undefined,
        direccion: data.direccion || undefined,
        ciudad:    data.ciudad   || undefined,
      });
      await refreshPerfil();
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error("Error al actualizar perfil", { description: formatApiError(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  /**
   * Cambia la contraseña del usuario.
   * Valida localmente que `password_nuevo` y `password_nuevo2` sean iguales
   * antes de hacer la llamada al backend. Resetea el formulario tras el éxito.
   */
  // ── Filtros de entrada en tiempo real (typing + pegado) ──────────────────
  const _soloLetras = (s: string) => s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]/g, "");
  const _soloTel    = (s: string) => s.replace(/[^0-9+\s()\-]/g, "");
  const _wrap = (
    rhfChange: React.ChangeEventHandler<HTMLInputElement>,
    fn: (v: string) => string
  ): React.ChangeEventHandler<HTMLInputElement> =>
    (e) => { e.target.value = fn(e.target.value); rhfChange(e); };

  const pNombre   = profileForm.register("nombre",   { minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const pApellido = profileForm.register("apellido", { minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const pTelefono = profileForm.register("telefono", { pattern: { value: /^[0-9+\s()\-]{7,15}$/, message: "Número inválido" } });


  const onChangePassword = async (data: PasswordForm) => {
    if (data.password_nuevo !== data.password_nuevo2) {
      passwordForm.setError("password_nuevo2", { message: "Las contraseñas no coinciden" });
      return;
    }
    setSavingPassword(true);
    try {
      await apiChangePassword({
        password_actual: data.password_actual,
        password_nuevo:  data.password_nuevo,
        password_nuevo2: data.password_nuevo2,
      });
      toast.success("Contraseña actualizada correctamente");
      passwordForm.reset();
    } catch (err) {
      toast.error("Error al cambiar contraseña", { description: formatApiError(err) });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <User className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-sm text-gray-500">{usuario?.email}</p>
        </div>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="perfil" className="flex-1 gap-2">
            <User className="h-4 w-4" /> Datos personales
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1 gap-2">
            <KeyRound className="h-4 w-4" /> Cambiar contraseña
          </TabsTrigger>
        </TabsList>

        {/* ── Datos personales ─────────────────────────── */}
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Datos personales</CardTitle>
              <CardDescription>Actualiza tu nombre, teléfono y ciudad.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input
                      id="nombre"
                      {...pNombre}
                      onChange={_wrap(pNombre.onChange, _soloLetras)}
                    />
                    {profileForm.formState.errors.nombre && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.nombre.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido</Label>
                    <Input
                      id="apellido"
                      {...pApellido}
                      onChange={_wrap(pApellido.onChange, _soloLetras)}
                    />
                    {profileForm.formState.errors.apellido && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.apellido.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de usuario</Label>
                  <Input
                    id="username"
                    {...profileForm.register("username", {
                      required: "El nombre de usuario es requerido",
                      minLength: { value: 3, message: "Mínimo 3 caracteres" },
                    })}
                  />
                  {profileForm.formState.errors.username && (
                    <p className="text-sm text-red-600">{profileForm.formState.errors.username.message}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      type="tel"
                      inputMode="tel"
                      placeholder="3001234567"
                      {...pTelefono}
                      onChange={_wrap(pTelefono.onChange, _soloTel)}
                    />
                    {profileForm.formState.errors.telefono && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.telefono.message}</p>
                    )}
                  </div>
                </div>

                {/* Departamento y Municipio */}
                <div className="space-y-2">
                  <Controller
                    name="ciudad"
                    control={profileForm.control}
                    render={({ field }) => (
                      <DeptMuniSelect
                        value={field.value}
                        onChange={field.onChange}
                        hasError={!!profileForm.formState.errors.ciudad}
                      />
                    )}
                  />
                  {profileForm.formState.errors.ciudad && (
                    <p className="text-sm text-red-600">{profileForm.formState.errors.ciudad.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    placeholder="Calle 123 #45-67"
                    {...profileForm.register("direccion")}
                  />
                </div>

                {/* Read-only info */}
                <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-1.5 border">
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-2">Solo lectura</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Correo</span>
                    <span className="font-medium">{usuario?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rol</span>
                    <span className="font-medium capitalize">{usuario?.rol}</span>
                  </div>
                  {usuario?.dependencyName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Área</span>
                      <span className="font-medium">{usuario.dependencyName}</span>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={savingProfile}
                >
                  {savingProfile
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                    : <><Save className="h-4 w-4 mr-2" />Guardar cambios</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cambiar contraseña ────────────────────────── */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar contraseña</CardTitle>
              <CardDescription>
                La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password_actual">Contraseña actual *</Label>
                  <Input
                    id="password_actual"
                    type="password"
                    autoComplete="current-password"
                    {...passwordForm.register("password_actual", {
                      required: "Ingrese su contraseña actual",
                    })}
                  />
                  {passwordForm.formState.errors.password_actual && (
                    <p className="text-sm text-red-600">{passwordForm.formState.errors.password_actual.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password_nuevo">Nueva contraseña *</Label>
                  <Input
                    id="password_nuevo"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("password_nuevo", {
                      required: "Ingrese la nueva contraseña",
                      minLength: { value: 8, message: "Mínimo 8 caracteres" },
                    })}
                  />
                  {passwordForm.formState.errors.password_nuevo && (
                    <p className="text-sm text-red-600">{passwordForm.formState.errors.password_nuevo.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password_nuevo2">Confirmar nueva contraseña *</Label>
                  <Input
                    id="password_nuevo2"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("password_nuevo2", {
                      required: "Confirme la nueva contraseña",
                    })}
                  />
                  {passwordForm.formState.errors.password_nuevo2 && (
                    <p className="text-sm text-red-600">{passwordForm.formState.errors.password_nuevo2.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={savingPassword}
                >
                  {savingPassword
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Actualizando...</>
                    : <><KeyRound className="h-4 w-4 mr-2" />Cambiar contraseña</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
