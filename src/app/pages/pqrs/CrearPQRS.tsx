/**
 * CrearPQRS.tsx
 * Página que permite a usuarios autenticados y anónimos radicar una PQRS
 * (Petición, Queja, Reclamo, Sugerencia o Felicitación) ante la institución.
 * Al enviarse con éxito, se muestra un modal con el número de radicado generado.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext"; // Contexto de autenticación: provee datos del usuario y estado de sesión
import { useForm } from "react-hook-form"; // Librería de manejo de formularios con validación
import { toast } from "sonner"; // Notificaciones toast (alertas emergentes)
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { FileText, CheckCircle2, Copy, Check, Mic, MicOff, UserRound, EyeOff } from "lucide-react"; // Íconos SVG de la librería Lucide
import {
  apiCreatePQRSWithAttachments,
  formatApiError,   // Formatea los errores de la API para mostrarlos al usuario
  type PqrsType,    // Tipo union: 'P' | 'Q' | 'R' | 'S' | 'F'
  type PqrsPriority, // Tipo union: 'LOW' | 'MED' | 'HIGH'
} from "../../lib/api";
import { Controller } from "react-hook-form";
import { DeptMuniSelect } from "../../components/DeptMuniSelect";
import { useSpeechToText } from "../../lib/useSpeech";
import { VoiceFormWizard, type VoiceWizardData } from "../../components/VoiceFormWizard";

/**
 * Estructura del formulario de PQRS.
 * Los campos obligatorios aplican a todos los usuarios.
 * Los campos opcionales (prefijo "anon_") solo se envían cuando el usuario NO está autenticado,
 * permitiendo radicaciones anónimas con datos de contacto voluntarios.
 */
interface PQRSForm {
  pqrs_type: PqrsType;       // Tipo de solicitud: P=Petición, Q=Queja, R=Reclamo, S=Sugerencia, F=Felicitación
  subject: string;           // Asunto breve de la solicitud (10–200 caracteres)
  description: string;       // Descripción detallada de la solicitud (20–2000 caracteres)
  priority: PqrsPriority;    // Prioridad: LOW=Baja, MED=Media, HIGH=Alta
  // Campos exclusivos para usuarios anónimos — todos opcionales según la especificación del backend
  anon_nombre?: string;
  anon_apellido?: string;
  anon_tipo_documento?: "CC" | "CE" | "TI" | "PA" | "PPT" | "RC"; // Tipos de documento reconocidos en Colombia
  anon_documento?: string;
  anon_email?: string;    // Si se provee, se usará para notificaciones y para consultar el radicado
  anon_telefono?: string;
  anon_ciudad?: string;
}

/** Opciones del selector de tipo de PQRS. Cada valor corresponde al código enviado al backend. */
const TYPES: { value: PqrsType; label: string }[] = [
  { value: "P", label: "Petición" },
  { value: "Q", label: "Queja" },
  { value: "R", label: "Reclamo" },
  { value: "S", label: "Sugerencia" },
  { value: "F", label: "Felicitación" },
];

/** Opciones del selector de prioridad. Se usa "MED" como valor por defecto en el formulario. */
const PRIORITIES: { value: PqrsPriority; label: string }[] = [
  { value: "LOW",  label: "Baja" },
  { value: "MED",  label: "Media" },
  { value: "HIGH", label: "Alta" },
];

/** Componente principal de la página para radicar una PQRS. */
export function CrearPQRS() {
  // Datos del usuario autenticado e indicador de sesión activa
  const { usuario, isAuthenticated } = useAuth();
  // Hook de navegación programática entre rutas
  const navigate = useNavigate();

  // Estado de carga mientras la solicitud al backend está en proceso
  const [isLoading, setIsLoading] = useState(false);
  // Número de radicado devuelto por el backend tras crear la PQRS exitosamente
  const [radicadoGenerado, setRadicadoGenerado] = useState<string | null>(null);
  // Controla la visibilidad del modal de confirmación con el número de radicado
  const [showModal, setShowModal] = useState(false);
  // Indica si el usuario ya copió el número de radicado al portapapeles
  const [copied, setCopied] = useState(false);
  // Archivos adjuntos seleccionados
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  // Indica si el usuario no autenticado quiere radicar de forma anónima
  const [isAnonymous, setIsAnonymous] = useState(false);

  /**
   * Configuración del formulario con react-hook-form.
   * - register: vincula campos del formulario con la validación.
   * - handleSubmit: envuelve el handler del submit con la lógica de validación.
   * - errors: objeto con los errores de validación actuales.
   * - reset: limpia todos los campos del formulario.
   * Se establece "MED" y "CC" como valores por defecto para prioridad y tipo de documento.
   */
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    getValues,
  } = useForm<PQRSForm>({
    defaultValues: { priority: "MED", anon_tipo_documento: "CC" },
  });

  // Speech-to-Text para dictado de asunto y descripción
  const { startListening, stopListening, isListening, supported: sttSupported } = useSpeechToText();
  // Campo actualmente en modo dictado: null | 'subject' | 'description'
  const [listeningField, setListeningField] = useState<"subject" | "description" | null>(null);
  // Asistente de voz completo (pregunta-respuesta)
  const [showVoiceWizard, setShowVoiceWizard] = useState(false);
  const voiceWizardSupported =
    sttSupported &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window;

  const handleVoiceComplete = (data: VoiceWizardData, shouldSubmit: boolean) => {
    if (data.pqrs_type)      setValue("pqrs_type",   data.pqrs_type);
    if (data.priority)       setValue("priority",    data.priority);
    if (data.subject)        setValue("subject",     data.subject,     { shouldValidate: true });
    if (data.description)    setValue("description", data.description, { shouldValidate: true });
    if (data.anon_nombre)    setValue("anon_nombre",  data.anon_nombre);
    if (data.anon_documento) setValue("anon_document_number", data.anon_documento);
    if (data.anon_email)     setValue("anon_email",   data.anon_email);
    setShowVoiceWizard(false);
    if (shouldSubmit) {
      // Esperar un tick para que react-hook-form registre los setValue anteriores
      setTimeout(() => handleSubmit(onSubmit)(), 80);
    }
  };

  const handleMicToggle = (field: "subject" | "description") => {
    if (isListening && listeningField === field) {
      stopListening();
      setListeningField(null);
      return;
    }
    // Si estaba escuchando en otro campo, detenerlo primero
    if (isListening) stopListening();
    setListeningField(field);
    startListening(
      (transcript) => {
        const prev = getValues(field)?.trim() ?? "";
        const joined = prev ? `${prev} ${transcript}` : transcript;
        setValue(field, joined, { shouldValidate: true });
        setListeningField(null);
      },
      () => {
        toast.error("No se pudo acceder al micrófono", {
          description: "Verifique que el navegador tenga permiso para usar el micrófono.",
        });
        setListeningField(null);
      }
    );
  };

  /**
   * Handler del envío del formulario.
   * Construye el payload para la API y gestiona el flujo de éxito/error:
   * - En éxito: guarda el número de radicado y muestra el modal de confirmación.
   * - En error: muestra una notificación toast con el mensaje de error formateado.
   * Los campos anónimos solo se incluyen en el payload cuando el usuario NO está autenticado.
   */
  const onSubmit = async (data: PQRSForm) => {
    setIsLoading(true);
    try {
      // Paso 1: crear la PQRS con los campos base (siempre en JSON)
      const basePayload = {
        type: data.pqrs_type,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
      };
      let payload: import("../../lib/api").CreatePqrsPayload = basePayload;
      if (!isAuthenticated) {
        payload = {
          ...basePayload,
          anon_name: data.anon_nombre ?? undefined,
          anon_last_name: data.anon_apellido ?? undefined,
          anon_tipo_documento: (data.anon_tipo_documento as "CC" | "CE" | "TI" | "PA" | "PPT" | "RC") || "CC",
          anon_document_number: data.anon_documento ?? undefined,
          anon_email: data.anon_email ?? undefined,
          anon_phone: data.anon_telefono ?? undefined,
          anon_city: data.anon_ciudad ?? undefined,
        };
      }
      const result = await apiCreatePQRSWithAttachments(payload, adjuntos, isAuthenticated);
      console.log('[CrearPQRS] PQRS creada — respuesta completa:', result);

      const numeroRadicado = result.numero_radicado ?? "";
      setRadicadoGenerado(numeroRadicado);
      setShowModal(true);
      setAdjuntos([]);
    } catch (err) {
      toast.error("Error al radicar PQRS", { description: formatApiError(err) });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clases de Tailwind reutilizadas en todos los elementos <select> nativos.
   * Se usa un string en lugar de un componente UI porque el select nativo
   * requiere compatibilidad con react-hook-form mediante spread de {...register(...)}.
   */
  const selectCls =
    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

  // ── Filtros de entrada en tiempo real (typing + pegado) ──────────────────
  const _soloLetras = (s: string) => s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''-]/g, "");
  const _soloTel    = (s: string) => s.replace(/[^0-9+\s()\-]/g, "");
  const _soloDoc    = (s: string) => s.replace(/[^0-9A-Za-z\-]/g, "");
  const _wrap = (
    rhfChange: React.ChangeEventHandler<HTMLInputElement>,
    fn: (v: string) => string
  ): React.ChangeEventHandler<HTMLInputElement> =>
    (e) => { e.target.value = fn(e.target.value); rhfChange(e); };

  const rAnonNombre   = register("anon_nombre",   { validate: v => (isAnonymous || !!v?.trim()) || "El nombre es requerido", minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const rAnonApellido = register("anon_apellido", { minLength: { value: 2, message: "Mínimo 2 caracteres" }, pattern: { value: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s''\-]+$/, message: "Solo se permiten letras y espacios" } });
  const rAnonDoc      = register("anon_documento", { minLength: { value: 5, message: "Mínimo 5 caracteres" }, pattern: { value: /^[0-9A-Za-z\-]+$/, message: "Sin espacios ni caracteres especiales" } });
  const rAnonTelefono = register("anon_telefono",  { pattern: { value: /^[0-9+\s()\-]{7,15}$/, message: "Número inválido" } });


  /**
   * Copia el número de radicado al portapapeles del usuario.
   * Cambia temporalmente el ícono del botón a un check verde durante 2 segundos
   * para confirmar visualmente que la acción fue exitosa.
   */
  const handleCopy = () => {
    if (!radicadoGenerado) return;
    navigator.clipboard.writeText(radicadoGenerado).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Restaura el ícono original tras 2 segundos
    });
  };

  /**
   * Cierra el modal de confirmación y deja el formulario listo para una nueva radicación:
   * - Oculta el modal.
   * - Limpia el número de radicado almacenado.
   * - Resetea todos los campos del formulario a sus valores por defecto.
   */
  const handleCloseModal = () => {
    setShowModal(false);
    setRadicadoGenerado(null);
    reset();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // El componente renderiza dos secciones principales:
  //  1. Un <Dialog> (modal) que aparece solo tras un submit exitoso.
  //  2. Un <Card> con el formulario de radicación, siempre visible.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Asistente de voz — modal de pregunta-respuesta */}
      {showVoiceWizard && (
        <VoiceFormWizard
          isAnonymous={!isAuthenticated && isAnonymous}
          onComplete={handleVoiceComplete}
          onClose={() => setShowVoiceWizard(false)}
        />
      )}
      {/*
       * ── Modal de radicado exitoso ────────────────────────────────────────────
       * Se muestra automáticamente cuando showModal=true (tras un submit exitoso).
       * Al cerrarse (clic fuera o tecla Escape), llama a handleCloseModal para
       * limpiar el estado y dejar el formulario listo para una nueva radicación.
       */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-2">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-green-900 text-xl">¡PQRS Radicada Exitosamente!</DialogTitle>
            <DialogDescription>
              Su solicitud ha sido recibida y será procesada en un plazo de hasta{" "}
              <strong>15 días hábiles</strong> según la Ley 1755 de 2015.
            </DialogDescription>
          </DialogHeader>

          {/* Sección destacada con el número de radicado y botón para copiarlo al portapapeles */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-5 text-center my-2">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Número de Radicado</p>
            <p className="text-3xl font-bold text-blue-600 tracking-wider mb-3">{radicadoGenerado}</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-4 w-4 text-green-600" /> ¡Copiado!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copiar radicado</>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Guarde este número. Lo necesitará para consultar el estado de su solicitud.
          </p>

          {/*
           * Pie del modal con tres opciones de navegación post-radicación:
           *   1. "Consultar Estado"  → navega a /consulta para verificar el radicado.
           *   2. "Radicar Otra PQRS" → cierra el modal y limpia el formulario (handleCloseModal).
           *   3. "Volver al Inicio"  → navega a la página principal /.
           */}
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {/* Botón primario: lleva al usuario a la pantalla de consulta por radicado */}
            <Button
              className="w-full bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold"
              onClick={() => navigate("/consulta")}
            >
              Consultar Estado
            </Button>
            {/* Botón secundario: resetea el formulario para una nueva radicación */}
            <Button variant="outline" className="w-full" onClick={handleCloseModal}>
              Radicar Otra PQRS
            </Button>
            {/* Botón terciario: regresa al home sin realizar más acciones */}
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Volver al Inicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
       * ── Formulario principal de radicación ─────────────────────────────────
       * Envuelto en un Card para un diseño consistente con el resto del sistema.
       * Si el usuario está autenticado, se muestra su información en una barra
       * informativa superior. El bloque de datos anónimos aparece únicamente
       * cuando isAuthenticated es false.
       */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Radicar PQRS</CardTitle>
              <CardDescription>Complete el formulario para presentar su solicitud</CardDescription>
            </div>
          </div>
          {/*
           * Banner informativo que se muestra SOLO cuando hay sesión activa.
           * Confirma visualmente al usuario la identidad con la que se radicará la PQRS,
           * evitando confusiones entre cuentas o radicaciones anónimas accidentales.
           */}
          {isAuthenticated && usuario && (
            <div className="mt-2 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
              Radicando como: <strong>{usuario.nombre} {usuario.apellido}</strong> · {usuario.email}
            </div>
          )}

          {/* Botón para activar el asistente de voz completo */}
          {voiceWizardSupported && (
            <button
              type="button"
              onClick={() => setShowVoiceWizard(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#15294a] active:scale-[0.98] text-white py-3 px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2"
              aria-label="Radicar PQRS mediante asistente de voz guiado"
            >
              <Mic className="w-4 h-4" aria-hidden="true" />
              Radicar por voz — asistente guiado
            </button>
          )}
        </CardHeader>
        <CardContent>
          {/*
           * handleSubmit(onSubmit): react-hook-form ejecuta primero todas las
           * validaciones registradas; solo si pasan llama a onSubmit con los datos tipados.
           */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Fila con dos columnas: tipo de solicitud y prioridad */}
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Selector de tipo: campo obligatorio — la opción vacía fuerza una elección consciente */}
              <div className="space-y-2">
                <Label htmlFor="pqrs_type">Tipo de Solicitud *</Label>
                <select
                  id="pqrs_type"
                  className={selectCls}
                  {...register("pqrs_type", { required: "Debe seleccionar un tipo" })}
                >
                  <option value="">Seleccione una opción</option>
                  {/* Las opciones se generan dinámicamente desde la constante TYPES */}
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {/* Muestra el mensaje de error de validación si el campo no fue completado */}
                {errors.pqrs_type && <p className="text-sm text-red-600">{errors.pqrs_type.message}</p>}
              </div>

              {/* Selector de prioridad: campo obligatorio — el valor por defecto "MED" viene de useForm */}
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad *</Label>
                <select
                  id="priority"
                  className={selectCls}
                  {...register("priority", { required: "Seleccione la prioridad" })}
                >
                  {/* Las opciones se generan dinámicamente desde la constante PRIORITIES */}
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {errors.priority && <p className="text-sm text-red-600">{errors.priority.message}</p>}
              </div>
            </div>

            {/*
             * Campo de asunto — obligatorio.
             * Reglas de validación:
             *   - Mínimo 10 caracteres: evita asuntos demasiado vagos.
             *   - Máximo 200 caracteres: límite definido por el backend (campo CharField).
             */}
            <div className="space-y-2">
              <Label htmlFor="subject">Asunto *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="subject"
                  className="flex-1"
                  placeholder="Resuma brevemente su solicitud (10–200 caracteres)"
                  {...register("subject", {
                    required: "El asunto es requerido",
                    minLength: { value: 10, message: "Mínimo 10 caracteres" },
                    maxLength: { value: 200, message: "Máximo 200 caracteres" },
                  })}
                />
                {sttSupported && (
                  <button
                    type="button"
                    onClick={() => handleMicToggle("subject")}
                    title={
                      listeningField === "subject"
                        ? "Detener dictado"
                        : "Dictar asunto por micrófono"
                    }
                    aria-label={
                      listeningField === "subject"
                        ? "Detener dictado del asunto"
                        : "Dictar asunto por micrófono"
                    }
                    aria-pressed={listeningField === "subject"}
                    className={`flex-shrink-0 h-10 w-10 rounded-md border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      listeningField === "subject"
                        ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                        : "bg-white border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {listeningField === "subject" ? (
                      <MicOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Mic className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
              {listeningField === "subject" && (
                <p className="text-xs text-red-600 flex items-center gap-1" role="status" aria-live="polite">
                  <span aria-hidden="true">●</span> Escuchando... hable ahora
                </p>
              )}
              {errors.subject && <p className="text-sm text-red-600">{errors.subject.message}</p>}
            </div>

            {/*
             * Campo de descripción — obligatorio.
             * Reglas de validación:
             *   - Mínimo 20 caracteres: garantiza un contexto suficiente para gestionar la solicitud.
             *   - Máximo 2000 caracteres: límite definido por el backend (campo TextField).
             * Se usa <Textarea> en lugar de <Input> para facilitar la escritura de textos largos.
             */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Descripción *</Label>
                {sttSupported && (
                  <button
                    type="button"
                    onClick={() => handleMicToggle("description")}
                    title={
                      listeningField === "description"
                        ? "Detener dictado"
                        : "Dictar descripción por micrófono"
                    }
                    aria-label={
                      listeningField === "description"
                        ? "Detener dictado de la descripción"
                        : "Dictar descripción por micrófono"
                    }
                    aria-pressed={listeningField === "description"}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      listeningField === "description"
                        ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                        : "bg-white border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {listeningField === "description" ? (
                      <><MicOff className="w-3.5 h-3.5" aria-hidden="true" /> Detener</>
                    ) : (
                      <><Mic className="w-3.5 h-3.5" aria-hidden="true" /> Dictar…</>
                    )}
                  </button>
                )}
              </div>
              <Textarea
                id="description"
                placeholder="Describa detalladamente su solicitud (mínimo 20 caracteres)"
                rows={6}
                {...register("description", {
                  required: "La descripción es requerida",
                  minLength: { value: 20, message: "Mínimo 20 caracteres" },
                  maxLength: { value: 2000, message: "Máximo 2000 caracteres" },
                })}
              />
              {listeningField === "description" && (
                <p className="text-xs text-red-600 flex items-center gap-1" role="status" aria-live="polite">
                  <span aria-hidden="true">●</span> Escuchando... hable ahora
                </p>
              )}
              {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
            </div>


            {/* Adjuntar archivos y datos de contacto solo para usuarios anónimos */}
            {!isAuthenticated && (
              <>
                {/* El usuario elige explícitamente cómo desea radicar. */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-gray-800">¿Cómo desea radicar su PQRS?</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                      !isAnonymous ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="filingMode"
                        value="identified"
                        checked={!isAnonymous}
                        onChange={() => setIsAnonymous(false)}
                        className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <UserRound className="h-4 w-4 text-blue-600" aria-hidden="true" />
                          Con mis datos
                        </span>
                        <span className="mt-1 block text-xs text-gray-600">
                          Registre su nombre y correo para identificarse y recibir notificaciones.
                        </span>
                      </span>
                    </label>
                    <label className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                      isAnonymous ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="filingMode"
                        value="anonymous"
                        checked={isAnonymous}
                        onChange={() => setIsAnonymous(true)}
                        className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <EyeOff className="h-4 w-4 text-gray-600" aria-hidden="true" />
                          De forma anónima
                        </span>
                        <span className="mt-1 block text-xs text-gray-600">
                          Puede presentar la solicitud sin proporcionar datos personales.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="adjuntos">Adjuntar archivos (opcional)</Label>
                  <input
                    id="adjuntos"
                    type="file"
                    multiple
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={e => {
                      setAdjuntos(e.target.files ? Array.from(e.target.files) : []);
                    }}
                  />
                  {adjuntos.length > 0 && (
                    <ul className="text-xs text-gray-500 mt-1">
                      {adjuntos.map(file => (
                        <li key={file.name}>{file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Sección de datos de contacto */}
                <div className="border-t pt-6">
                  <h3 className="font-medium mb-1">Datos de Contacto</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {isAnonymous
                      ? "Todos los campos son opcionales. Si proporciona su correo electrónico, recibirá notificaciones sobre su solicitud."
                      : "Complete con sus datos de contacto. Los campos marcados con * son obligatorios."
                    }
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Nombre del radicante — requerido si no es anónimo */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_nombre">
                        Nombre{" "}
                        {isAnonymous
                          ? <span className="text-gray-400 text-xs">(opcional)</span>
                          : <span className="text-red-500">*</span>
                        }
                      </Label>
                      <Input
                        id="anon_nombre"
                        placeholder="Su nombre"
                        {...rAnonNombre}
                        onChange={_wrap(rAnonNombre.onChange, _soloLetras)}
                      />
                      {errors.anon_nombre && <p className="text-sm text-red-600">{errors.anon_nombre.message}</p>}
                    </div>
                    {/* Apellido del radicante anónimo — mínimo 2 caracteres si se proporciona */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_apellido">Apellido <span className="text-gray-400 text-xs">(opcional)</span></Label>
                      <Input
                        id="anon_apellido"
                        placeholder="Su apellido"
                        {...rAnonApellido}
                        onChange={_wrap(rAnonApellido.onChange, _soloLetras)}
                      />
                      {errors.anon_apellido && <p className="text-sm text-red-600">{errors.anon_apellido.message}</p>}
                    </div>
                    {/* Selector de tipo de documento de identidad */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_tipo_documento">Tipo de Documento <span className="text-gray-400 text-xs">(por defecto CC)</span></Label>
                      <select
                        id="anon_tipo_documento"
                        className={selectCls}
                        {...register("anon_tipo_documento")}
                      >
                        <option value="CC">Cédula de Ciudadanía (CC)</option>
                        <option value="CE">Cédula de Extranjería (CE)</option>
                        <option value="TI">Tarjeta de Identidad (TI)</option>
                        <option value="PA">Pasaporte (PA)</option>
                        <option value="PPT">Permiso por Protección Temporal (PPT)</option>
                        <option value="RC">Registro Civil (RC)</option>
                      </select>
                    </div>
                    {/* Número de documento — mínimo 5 dígitos si se proporciona */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_documento">Número de Documento <span className="text-gray-400 text-xs">(opcional)</span></Label>
                      <Input
                        id="anon_documento"
                        placeholder="Ej: 1234567890"
                        inputMode="text"
                        {...rAnonDoc}
                        onChange={_wrap(rAnonDoc.onChange, _soloDoc)}
                      />
                      {errors.anon_documento && <p className="text-sm text-red-600">{errors.anon_documento.message}</p>}
                    </div>
                    {/* Correo electrónico — requerido si no es anónimo */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_email">
                        Correo Electrónico{" "}
                        {isAnonymous
                          ? <span className="text-gray-400 text-xs">(opcional)</span>
                          : <span className="text-red-500">*</span>
                        }
                      </Label>
                      <Input
                        id="anon_email"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        {...register("anon_email", {
                          required: !isAnonymous ? "El correo electrónico es requerido" : false,
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Correo inválido",
                          },
                        })}
                      />
                      {errors.anon_email && <p className="text-sm text-red-600">{errors.anon_email.message}</p>}
                    </div>
                    {/* Teléfono de contacto del radicante anónimo */}
                    <div className="space-y-2">
                      <Label htmlFor="anon_telefono">Teléfono <span className="text-gray-400 text-xs">(opcional)</span></Label>
                      <Input
                        id="anon_telefono"
                        type="tel"
                        inputMode="tel"
                        placeholder="3001234567"
                        {...rAnonTelefono}
                        onChange={_wrap(rAnonTelefono.onChange, _soloTel)}
                      />
                      {errors.anon_telefono && <p className="text-sm text-red-600">{errors.anon_telefono.message}</p>}
                    </div>
                    {/* Departamento y Municipio del radicante anónimo */}
                    <div className="space-y-2">
                      <Controller
                        name="anon_ciudad"
                        control={control}
                        render={({ field }) => (
                          <DeptMuniSelect
                            value={field.value}
                            onChange={field.onChange}
                            hasError={!!errors.anon_ciudad}
                          />
                        )}
                      />
                      {errors.anon_ciudad && <p className="text-sm text-red-600">{errors.anon_ciudad.message}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Botones de acción: enviar el formulario o cancelar y volver al inicio */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-[#ff9800] hover:bg-[#f57c00] text-white font-bold"
                disabled={isLoading} // Se deshabilita mientras la petición al backend está en curso
              >
                {/* Texto dinámico: cambia según el estado de carga */}
                {isLoading ? "Radicando..." : "Radicar PQRS"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
