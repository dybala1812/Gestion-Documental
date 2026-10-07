import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Mail, Loader2, Save, Eye, EyeOff, Lock } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  apiGetTicketEmailConfig,
  apiUpdateTicketEmailConfig,
  apiListDependencies,
  apiGetTicketDeleteConfig,
  apiSetTicketDeletePassword,
  formatApiError,
  type TicketEmailConfigAPI,
  type Dependency,
} from "../../lib/api";

const NONE_VALUE = "__none__";

const EMPTY_FORM: TicketEmailConfigAPI = {
  enabled: false,
  imap_host: "imap.gmail.com",
  imap_port: 993,
  use_ssl: true,
  imap_user: "",
  has_password: false,
  inbox_folder: "INBOX",
  processed_folder: "Tickets-Procesados",
  max_batch: 20,
  default_dependency: null,
  default_dependency_name: null,
  updated_at: "",
};

export function GestionCorreoTickets() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TicketEmailConfigAPI>(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);

  const [deleteHasPassword, setDeleteHasPassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [savingDeletePassword, setSavingDeletePassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, deps, deleteCfg] = await Promise.all([
          apiGetTicketEmailConfig(),
          apiListDependencies(true, true),
          apiGetTicketDeleteConfig(),
        ]);
        setForm(data);
        setDependencies(deps.results ?? []);
        setDeleteHasPassword(deleteCfg.has_password);
      } catch (error) {
        toast.error("No se pudo cargar la configuración del correo de tickets", {
          description: formatApiError(error),
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateField = <K extends keyof TicketEmailConfigAPI>(key: K, value: TicketEmailConfigAPI[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<TicketEmailConfigAPI> & { imap_password?: string } = {
        enabled: form.enabled,
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        use_ssl: form.use_ssl,
        imap_user: form.imap_user,
        inbox_folder: form.inbox_folder,
        processed_folder: form.processed_folder,
        max_batch: form.max_batch,
        default_dependency: form.default_dependency,
      };
      if (password.trim()) payload.imap_password = password.trim();

      const updated = await apiUpdateTicketEmailConfig(payload);
      setForm(updated);
      setPassword("");
      toast.success("Configuración del correo de tickets actualizada");
    } catch (error) {
      toast.error("No se pudo guardar la configuración", {
        description: formatApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDeletePassword = async () => {
    if (!deletePassword.trim()) {
      toast.error("Escribe una contraseña antes de guardar");
      return;
    }
    setSavingDeletePassword(true);
    try {
      const updated = await apiSetTicketDeletePassword(deletePassword.trim());
      setDeleteHasPassword(updated.has_password);
      setDeletePassword("");
      toast.success("Contraseña de eliminación de tickets actualizada");
    } catch (error) {
      toast.error("No se pudo guardar la contraseña", {
        description: formatApiError(error),
      });
    } finally {
      setSavingDeletePassword(false);
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
            <Mail className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Correo de Tickets (IMAP)</h1>
          </div>
          <p className="text-gray-600">
            Configura el buzón desde el que se crean tickets internos automáticamente al recibir correos.
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
              Activo (revisa el buzón cada minuto)
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conexión IMAP</CardTitle>
            <CardDescription>
              Para Gmail usa una <strong>contraseña de aplicación</strong> (myaccount.google.com/apppasswords,
              requiere verificación en 2 pasos activa). No se necesitan credenciales de Google Cloud Console —
              esas son para APIs OAuth, no para IMAP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imap_host">Servidor IMAP</Label>
                <Input id="imap_host" value={form.imap_host} onChange={(e) => updateField("imap_host", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap_port">Puerto</Label>
                <Input
                  id="imap_port"
                  type="number"
                  value={form.imap_port}
                  onChange={(e) => updateField("imap_port", Number(e.target.value) || 993)}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.use_ssl}
                onChange={(e) => updateField("use_ssl", e.target.checked)}
              />
              Usar SSL/TLS directo (puerto 993). Desmárcalo si usas STARTTLS (puerto 143).
            </label>

            <div className="space-y-2">
              <Label htmlFor="imap_user">Correo del buzón</Label>
              <Input
                id="imap_user"
                type="email"
                placeholder="tickets@tu-institucion.edu.co"
                value={form.imap_user}
                onChange={(e) => updateField("imap_user", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imap_password">
                Contraseña de aplicación{" "}
                {form.has_password && <span className="text-xs font-normal text-gray-500">(ya hay una guardada; deja vacío para conservarla)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="imap_password"
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
            <CardTitle>Carpetas y lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inbox_folder">Carpeta de entrada</Label>
                <Input id="inbox_folder" value={form.inbox_folder} onChange={(e) => updateField("inbox_folder", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processed_folder">Carpeta de procesados</Label>
                <Input
                  id="processed_folder"
                  value={form.processed_folder}
                  onChange={(e) => updateField("processed_folder", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_batch">Máximo de correos por ciclo</Label>
              <Input
                id="max_batch"
                type="number"
                value={form.max_batch}
                onChange={(e) => updateField("max_batch", Number(e.target.value) || 20)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Área de destino</CardTitle>
            <CardDescription>
              Si el correo no coincide con ninguna dependencia (por su correo institucional), el ticket se
              asignará a esta área por defecto. Déjalo vacío para que quede sin área (visible solo para staff).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Área por defecto</Label>
              <Select
                value={form.default_dependency ?? NONE_VALUE}
                onValueChange={(value) => updateField("default_dependency", value === NONE_VALUE ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin área por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sin área por defecto</SelectItem>
                  {dependencies.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id}>
                      {dep.name} ({dep.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Eliminación de tickets
            </CardTitle>
            <CardDescription>
              Contraseña que se pedirá antes de eliminar un ticket interno desde el panel.
              {deleteHasPassword && (
                <span className="ml-1 font-medium text-green-700">Ya hay una contraseña configurada.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete_password">
                {deleteHasPassword ? "Nueva contraseña (deja vacío para conservar la actual)" : "Contraseña de eliminación"}
              </Label>
              <div className="relative">
                <Input
                  id="delete_password"
                  type={showDeletePassword ? "text" : "password"}
                  placeholder="Contraseña para autorizar eliminaciones"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowDeletePassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleSaveDeletePassword} disabled={savingDeletePassword} variant="outline">
              {savingDeletePassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar contraseña
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
