import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { MessageSquare, Upload, Send, ArrowLeft, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  apiSendWhatsAppBulkMessage,
  formatApiError,
  type WhatsAppBulkRecipient,
  type WhatsAppBulkSendResponse,
} from "../../lib/api";

type ParsedRow = WhatsAppBulkRecipient & { source: string };

type Provider = "auto" | "meta" | "twilio";

const PROVIDER_LABELS: Record<Provider, string> = {
  auto: "Auto (detectar)",
  meta: "Meta Cloud API",
  twilio: "Twilio",
};

function parseRecipients(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedRow[] = [];

  for (const line of lines) {
    const parts = line.split(/[;,\t|]/).map((p) => p.trim());
    const phone = (parts[0] ?? "").trim();
    const name = (parts.slice(1).join(" ") ?? "").trim();

    if (!phone) continue;
    parsed.push({ phone, name, source: line });
  }

  return parsed;
}

export function GestionWhatsAppMasivo() {
  const navigate = useNavigate();

  const [rawRecipients, setRawRecipients] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(
    "Hola {nombre}, este es un mensaje informativo de la Universidad."
  );
  const [fallbackName, setFallbackName] = useState("Usuario");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [provider, setProvider] = useState<Provider>("auto");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WhatsAppBulkSendResponse | null>(null);

  const parsedRecipients = useMemo(() => parseRecipients(rawRecipients), [rawRecipients]);

  const uniqueRecipients = useMemo(() => {
    const map = new Map<string, WhatsAppBulkRecipient>();
    for (const row of parsedRecipients) {
      const normalized = row.phone.replace(/\D/g, "");
      if (!normalized) continue;
      if (!map.has(normalized)) {
        map.set(normalized, { phone: normalized, name: row.name });
      }
    }
    return Array.from(map.values());
  }, [parsedRecipients]);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      setRawRecipients((prev) => (prev.trim() ? `${prev}\n${text}` : text));
      toast.success(`Archivo ${file.name} cargado correctamente`);
    } catch {
      toast.error("No se pudo leer el archivo seleccionado");
    }
  };

  const handleSend = async () => {
    if (!messageTemplate.trim()) {
      toast.error("Debe escribir un mensaje");
      return;
    }
    if (uniqueRecipients.length === 0) {
      toast.error("Debe cargar al menos un destinatario válido");
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const response = await apiSendWhatsAppBulkMessage({
        message_template: messageTemplate,
        recipients: uniqueRecipients,
        fallback_name: fallbackName,
        phone_number_id: phoneNumberId.trim() || undefined,
        provider,
      });
      setResult(response);
      toast.success(`Envío completado: ${response.summary.sent} enviados`);
    } catch (error) {
      toast.error("No se pudo enviar la campaña", {
        description: formatApiError(error),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Masivo</h1>
          </div>
          <p className="text-gray-600">
            Cargue números y nombres para enviar mensajes personalizados usando la etiqueta {" "}
            <span className="font-semibold">{"{nombre}"}</span>.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al panel
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Destinatarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipients">Lista de teléfonos y nombres</Label>
              <Textarea
                id="recipients"
                rows={12}
                value={rawRecipients}
                onChange={(e) => setRawRecipients(e.target.value)}
                placeholder={"3001234567, Juan Perez\n573001112233; Maria Lopez\n573002224455"}
              />
              <p className="text-xs text-gray-500">
                Formatos admitidos por línea: telefono,nombre o telefono;nombre.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileRecipients">Cargar archivo CSV/TXT</Label>
              <Input
                id="fileRecipients"
                type="file"
                accept=".csv,.txt"
                onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
              <p className="mb-1 font-semibold">Resumen de carga</p>
              <p>Total líneas detectadas: {parsedRecipients.length}</p>
              <p>Destinatarios únicos válidos: {uniqueRecipients.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Plantilla del mensaje</Label>
              <Textarea
                id="template"
                rows={8}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hola {nombre}, te escribimos para..."
              />
              <p className="text-xs text-gray-500">
                Use {"{nombre}"} para insertar el nombre del destinatario en cada mensaje.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fallbackName">Nombre por defecto</Label>
                <Input
                  id="fallbackName"
                  value={fallbackName}
                  onChange={(e) => setFallbackName(e.target.value)}
                  placeholder="Usuario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID (opcional)</Label>
                <Input
                  id="phoneNumberId"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Usar configuración global"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Proveedor de envío</Label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {(Object.entries(PROVIDER_LABELS) as [Provider, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                <strong>Auto:</strong> usa Meta si está configurado, si no usa Twilio.
              </p>
            </div>

            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando campaña...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar mensajes masivos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Resultado del envío
              {result.provider && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  result.provider === "twilio"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {result.provider === "twilio" ? "Twilio" : "Meta Cloud API"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-semibold">{result.summary.total}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Enviados</p>
                <p className="text-lg font-semibold text-emerald-600">{result.summary.sent}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Fallidos</p>
                <p className="text-lg font-semibold text-red-600">{result.summary.failed}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Inválidos</p>
                <p className="text-lg font-semibold text-amber-600">{result.summary.invalid}</p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Teléfono</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row, idx) => (
                    <tr key={`${row.phone ?? "row"}-${idx}`} className="border-t">
                      <td className="px-3 py-2">{row.phone ?? "-"}</td>
                      <td className="px-3 py-2">{row.name || "-"}</td>
                      <td className="px-3 py-2 uppercase">{row.status}</td>
                      <td className="px-3 py-2 text-gray-600">{row.error || "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border-dashed">
        <CardContent className="pt-6 text-sm text-gray-600">
          <p className="mb-2 flex items-center gap-2 font-semibold text-gray-700">
            <Upload className="h-4 w-4" />
            Recomendaciones
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Incluya código de país en cada número (ejemplo Colombia: 57XXXXXXXXXX).</li>
            <li>En listas grandes, envíe campañas por bloques para facilitar trazabilidad.</li>
            <li>Valide previamente el texto para evitar errores en toda la campaña.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
