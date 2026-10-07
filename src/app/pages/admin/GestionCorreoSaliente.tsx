import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Send, Loader2, Save, Eye, EyeOff } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  apiGetSmtpConfig,
  apiUpdateSmtpConfig,
  formatApiError,
  type SmtpConfigAPI,
} from "../../lib/api";

const EMPTY_FORM: SmtpConfigAPI = {
  enabled: false,
  host: "smtp.gmail.com",
  port: 587,
  use_tls: true,
  use_ssl: false,
  username: "",
  has_password: false,
  default_from_email: "",
  sistema_nombre: "",
  updated_at: "",
};

export function GestionCorreoSaliente() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SmtpConfigAPI>(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGetSmtpConfig();
        setForm(data);
      } catch (error) {
        toast.error("No se pudo cargar la configuración de correo saliente", {
          description: formatApiError(error),
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateField = <K extends keyof SmtpConfigAPI>(key: K, value: SmtpConfigAPI[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<SmtpConfigAPI> & { password?: string } = {
        enabled: form.enabled,
        host: form.host,
        port: form.port,
        use_tls: form.use_tls,
        use_ssl: form.use_ssl,
        username: form.username,
        default_from_email: form.default_from_email,
        sistema_nombre: form.sistema_nombre,
      };
      if (password.trim()) payload.password = password.trim();

      const updated = await apiUpdateSmtpConfig(payload);
      setForm(updated);
      setPassword("");
      toast.success("Configuración de correo saliente actualizada");
    } catch (error) {
      toast.error("No se pudo guardar la configuración", {
        description: formatApiError(error),
      });
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Send className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Correo Saliente (SMTP)</h1>
          </div>
          <p className="text-gray-600">
            Configura la cuenta desde la que se envían todas las notificaciones del sistema (PQRS, tickets,
            certificados, diplomas).
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

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
              />
              Activo (si se desactiva, se usan las variables de entorno del servidor)
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conexión SMTP</CardTitle>
            <CardDescription>
              Para Gmail usa una <strong>contraseña de aplicación</strong> (myaccount.google.com/apppasswords,
              requiere verificación en 2 pasos activa).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host">Servidor SMTP</Label>
                <Input id="host" value={form.host} onChange={(e) => updateField("host", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Puerto</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={(e) => updateField("port", Number(e.target.value) || 587)}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.use_tls}
                onChange={(e) => updateField("use_tls", e.target.checked)}
              />
              Usar STARTTLS (puerto 587, recomendado para Gmail)
            </label>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.use_ssl}
                onChange={(e) => updateField("use_ssl", e.target.checked)}
              />
              Usar SSL directo (puerto 465)
            </label>

            <div className="space-y-2">
              <Label htmlFor="username">Correo remitente</Label>
              <Input
                id="username"
                type="email"
                placeholder="notificaciones@tu-institucion.edu.co"
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Contraseña de aplicación{" "}
                {form.has_password && <span className="text-xs font-normal text-gray-500">(ya hay una guardada; deja vacío para conservarla)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={form.has_password ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remitente</CardTitle>
            <CardDescription>
              Cómo se muestra el correo en la bandeja de entrada del destinatario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default_from_email">Dirección "De" (From)</Label>
              <Input
                id="default_from_email"
                type="email"
                placeholder="Déjalo vacío para usar el correo remitente de arriba"
                value={form.default_from_email}
                onChange={(e) => updateField("default_from_email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sistema_nombre">Nombre visible del remitente</Label>
              <Input
                id="sistema_nombre"
                placeholder="Ej: Mesa de Ayuda PQRS"
                value={form.sistema_nombre}
                onChange={(e) => updateField("sistema_nombre", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
