/**
 * VoiceFormWizard.tsx
 * Asistente de voz guiado para radicar una PQRS mediante preguntas y respuestas de audio.
 *
 * ARQUITECTURA (corrección bug Chrome):
 * Chrome bloquea SpeechRecognition.start() si no se llama desde un gesto directo del usuario.
 * Por eso el flujo es:
 *   boot → asking (TTS) → ready (botón visible) → usuario presiona → listening (STT activo)
 *   → siguiente campo → ... → summary → yn_ready → usuario presiona → yn_listening → done
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Mic, Volume2, X, Send } from "lucide-react";
import { useTTS } from "../lib/useSpeech";
import type { PqrsPriority, PqrsType } from "../lib/api";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export interface VoiceWizardData {
  pqrs_type?: PqrsType;
  priority?: PqrsPriority;
  subject?: string;
  description?: string;
  anon_nombre?: string;
  anon_documento?: string;
  anon_email?: string;
}

interface VoiceFormWizardProps {
  isAnonymous: boolean;
  onComplete: (data: VoiceWizardData, shouldSubmit: boolean) => void;
  onClose: () => void;
  skipFields?: Array<keyof VoiceWizardData>;
}

// ── Helpers de parseo ──────────────────────────────────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseType(t: string): { value: PqrsType; label: string } | null {
  const n = norm(t);
  if (n.includes("peticion"))   return { value: "P", label: "Petición" };
  if (n.includes("queja"))      return { value: "Q", label: "Queja" };
  if (n.includes("reclamo"))    return { value: "R", label: "Reclamo" };
  if (n.includes("sugerencia")) return { value: "S", label: "Sugerencia" };
  if (n.includes("felicit"))    return { value: "F", label: "Felicitación" };
  return null;
}

function parsePriority(t: string): { value: PqrsPriority; label: string } | null {
  const n = norm(t);
  if (n.includes("baj"))                        return { value: "LOW",  label: "Baja"  };
  if (n.includes("alt") || n.includes("urgen")) return { value: "HIGH", label: "Alta"  };
  if (n.includes("medi") || n.includes("normal")) return { value: "MED", label: "Media" };
  return null;
}

function parseYesNo(t: string): boolean {
  return /\b(si|sí|afirmativo|correcto|ok|claro|adelante|enviar|aceptar|confirmar)\b/i.test(
    norm(t)
  );
}

// ── Pasos ──────────────────────────────────────────────────────────────────

interface ParseResult { value: string; display: string }

interface Step {
  id: keyof VoiceWizardData;
  label: string;
  icon: string;
  question: string;
  retry: string;
  parse: (t: string) => ParseResult | null;
  confirmMsg: (d: string) => string;
}

const BASE_STEPS: Step[] = [
  {
    id: "pqrs_type",
    label: "Tipo",
    icon: "📋",
    question: "Tipo de solicitud: diga Petición, Queja, Reclamo, Sugerencia o Felicitación.",
    retry: "No reconocí el tipo. Opciones: Petición, Queja, Reclamo, Sugerencia, Felicitación.",
    parse: (t) => { const r = parseType(t); return r ? { value: r.value, display: r.label } : null; },
    confirmMsg: (d) => `Tipo: ${d}.`,
  },
  {
    id: "priority",
    label: "Prioridad",
    icon: "⚡",
    question: "Prioridad: diga Baja, Media o Alta.",
    retry: "No entendí la prioridad. Por favor diga Baja, Media o Alta.",
    parse: (t) => { const r = parsePriority(t); return r ? { value: r.value, display: r.label } : null; },
    confirmMsg: (d) => `Prioridad ${d}.`,
  },
  {
    id: "subject",
    label: "Asunto",
    icon: "📝",
    question: "Asunto: diga brevemente el motivo de su solicitud.",
    retry: "El asunto quedó muy corto. Por favor elabore un poco más.",
    parse: (t) => t.trim().length >= 8 ? { value: t.trim(), display: t.trim() } : null,
    confirmMsg: (d) => `Asunto: "${d.substring(0, 40)}".`,
  },
  {
    id: "description",
    label: "Descripción",
    icon: "📄",
    question: "Descripción: explique detalladamente su solicitud.",
    retry: "La descripción es muy corta. Por favor elabore.",
    parse: (t) => t.trim().length >= 15 ? { value: t.trim(), display: "registrada" } : null,
    confirmMsg: () => "Descripción registrada.",
  },
];

const ANON_NOMBRE_STEP: Step = {
  id: "anon_nombre",
  label: "Nombre",
  icon: "👤",
  question: "Nombre completo (opcional): dígalo o diga omitir.",
  retry: "Diga su nombre o diga omitir.",
  parse: (t) => {
    if (/\b(omitir|saltar)\b/i.test(norm(t))) return { value: "", display: "omitido" };
    return t.trim().length >= 2 ? { value: t.trim(), display: t.trim() } : null;
  },
  confirmMsg: (d) => d === "omitido" ? "Nombre omitido." : `Nombre: ${d}.`,
};

const ANON_DOCUMENTO_STEP: Step = {
  id: "anon_documento",
  label: "Documento",
  icon: "🪪",
  question: "Número de documento de identidad (opcional): díctelo dígito a dígito o diga omitir.",
  retry: "No reconocí el número. Díctelo dígito a dígito o diga omitir.",
  parse: (t) => {
    if (/\b(omitir|saltar)\b/i.test(norm(t))) return { value: "", display: "omitido" };
    // Extraer solo dígitos del transcript (STT suele convertir números a palabras)
    const digits = t.replace(/[^\d]/g, "");
    return digits.length >= 5 ? { value: digits, display: digits } : null;
  },
  confirmMsg: (d) => d === "omitido" ? "Documento omitido." : `Documento: ${d}.`,
};

const ANON_EMAIL_STEP: Step = {
  id: "anon_email",
  label: "Correo",
  icon: "✉️",
  question: "Correo electrónico (opcional): puede dictarlo en voz alta, por ejemplo: 'juan punto perez arroba gmail punto com'. O use el campo de texto. O diga omitir.",
  retry: "No reconocí un correo válido. Use el campo de texto o diga omitir.",
  parse: (t) => {
    if (/\b(omitir|saltar)\b/i.test(norm(t))) return { value: "", display: "omitido" };
    const normalized = t.trim()
      .replace(/\bguión?\s*bajo\b/gi, "_")
      .replace(/\bguión?\b/gi, "-")
      .replace(/\barroba\b/gi, "@")
      .replace(/\bpunto\b/gi, ".")
      .replace(/\bmas\b/gi, "+")
      .replace(/\s+/g, "")
      // Quitar tildes y diacríticos — el STT a veces transcribe "Jesús" con tilde
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRx.test(normalized) ? { value: normalized, display: normalized } : null;
  },
  confirmMsg: (d) => d === "omitido" ? "Correo omitido." : `Correo: ${d}.`,
};

const TYPE_MAP: Record<PqrsType, string>     = { P: "Petición", Q: "Queja", R: "Reclamo", S: "Sugerencia", F: "Felicitación" };
const PRIO_MAP: Record<PqrsPriority, string> = { LOW: "Baja", MED: "Media", HIGH: "Alta" };

// ── Fases ──────────────────────────────────────────────────────────────────

type Phase =
  | "start"          // Pantalla inicial — usuario debe presionar "Iniciar"
  | "asking"         // TTS: pregunta del paso actual
  | "ready"          // ESPERANDO clic del usuario para activar micrófono
  | "listening"      // STT activo (hay grabación en curso)
  | "confirm_tts"    // TTS: leyendo de vuelta el valor capturado + "¿Es correcto?"
  | "confirm_ready"  // ESPERANDO clic para confirmar con voz (Sí/No)
  | "confirm_listen" // STT activo escuchando Sí/No de confirmación
  | "summary"        // TTS: resumen de campos
  | "yn_ready"       // ESPERANDO clic para activar micrófono (respuesta sí/no)
  | "yn_listening"   // STT activo escuchando sí/no
  | "done";

// ── startRecognition — LLAMAR SOLO DESDE GESTOS DE USUARIO ──────────────
// Ya se asume que getUserMedia fue concedido antes de llamar esto.

type SttErrorType = "no-speech" | "network" | "audio-capture" | "not-allowed" | "unknown";

function startRecognition(
  onResult: (transcript: string) => void,
  onError: (type: SttErrorType, rawCode?: string) => void,
): (() => void) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  if (!SR) { onError("unknown", "no-api"); return null; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any = new SR();
  rec.lang            = "es-CO";
  rec.continuous      = true;   // Sigue escuchando hasta que el usuario termine — sin corte brusco
  rec.interimResults  = true;   // Captura parciales → ayuda con palabras cortas ("sí")
  rec.maxAlternatives = 3;

  let gotResult     = false;
  let resultEmitted = false;
  let lastTranscript = "";
  let errorType: SttErrorType | null = null;
  let rawCode = "";

  // Timer global: si el usuario no habla nada en 20 s, cerramos
  const globalTimer = setTimeout(() => {
    try { rec.stop(); } catch { /* ignore */ }
  }, 20000);

  // Timer de silencio post-habla: espera 1.5 s después del último fragmento
  // final antes de emitir — permite capturar nombres con varios apellidos
  // aunque Chrome haga una pausa entre ellos.
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    if (resultEmitted) return;
    resultEmitted = true;
    clearTimeout(globalTimer);
    if (pauseTimer) clearTimeout(pauseTimer);
    onResult(lastTranscript);
    try { rec.stop(); } catch { /* ignore */ }
  };

  rec.onresult = (e: Event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = e as any;
    const results: SpeechRecognitionResultList = ev.results;
    const all = Array.from(results).map((r: any) => r[0].transcript).join(" ").trim();
    if (all) { gotResult = true; lastTranscript = all; }

    const lastResult: any = results[results.length - 1];
    if (lastResult?.isFinal) {
      // Reiniciar el temporizador de silencio cada vez que llega un fragmento
      // final — emite 1.5 s después del último (da tiempo para apellidos).
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = setTimeout(emit, 1500);
    }
  };

  rec.onend = () => {
    clearTimeout(globalTimer);
    if (pauseTimer) clearTimeout(pauseTimer);
    if (!resultEmitted) {
      if (gotResult && lastTranscript) onResult(lastTranscript);
      else onError(errorType ?? "no-speech", rawCode);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    rawCode = e?.error ?? "";
    if (rawCode === "no-speech" || rawCode === "aborted")                    errorType = "no-speech";
    else if (rawCode === "network")                                          errorType = "network";
    else if (rawCode === "audio-capture")                                    errorType = "audio-capture";
    else if (rawCode === "not-allowed" || rawCode === "service-not-allowed") errorType = "not-allowed";
    else                                                                     errorType = "unknown";
  };

  try {
    rec.start();
  } catch (err) {
    clearTimeout(globalTimer);
    if (pauseTimer) clearTimeout(pauseTimer);
    console.error("[STT] rec.start() lanzó excepción:", err);
    onError("unknown", "start-exception");
    return null;
  }

  return () => {
    clearTimeout(globalTimer);
    if (pauseTimer) clearTimeout(pauseTimer);
    try { rec.stop(); } catch { /* ignore */ }
  };
}

// ── Componente principal ───────────────────────────────────────────────────

export function VoiceFormWizard({
  isAnonymous,
  onComplete,
  onClose,
  skipFields = [],
}: VoiceFormWizardProps) {
  const steps = useRef<Step[]>(
    [...BASE_STEPS, ...(isAnonymous ? [ANON_NOMBRE_STEP, ANON_DOCUMENTO_STEP, ANON_EMAIL_STEP] : [])].filter(
      (s) => !skipFields.includes(s.id)
    )
  ).current;

  const collectedRef = useRef<VoiceWizardData>({});
  const stepIdxRef   = useRef(0);
  const retriesRef   = useRef(0);
  const submitRef        = useRef(false);
  const pendingResultRef = useRef<{ value: string; display: string; confirmMsg: string } | null>(null);
  const stopRecRef       = useRef<(() => void) | null>(null);

  const [phase,        setPhase]       = useState<Phase>("start");
  const [uiStepIdx,    setUiStepIdx]   = useState(0);
  const [uiTranscript, setUiTranscript] = useState("");
  const [uiCollected,  setUiCollected] = useState<VoiceWizardData>({});
  const [textInput,    setTextInput]   = useState("");
  const [ttsText,      setTtsText]     = useState("");
  const [sttError,     setSttError]    = useState<string | null>(null);

  const { read: ttsRead, stop: ttsStop } = useTTS();

  // Habla un texto; al terminar cambia de fase
  const speak = useCallback(
    (text: string, nextPhase: Phase) => {
      setTtsText(text);
      ttsRead(text, () => setPhase(nextPhase));
    },
    [ttsRead]
  );

  // ── Avanzar al siguiente campo o al resumen ────────────────────────────
  const advance = useCallback(
    (confirmText: string) => {
      stepIdxRef.current++;
      retriesRef.current = 0;

      if (stepIdxRef.current >= steps.length) {
        speak(confirmText + " ", "summary");
      } else {
        setUiStepIdx(stepIdxRef.current);
        setUiTranscript("");
        speak(confirmText, "asking");
      }
    },
    [speak, steps.length]
  );

  // ── Procesar respuesta STT ─────────────────────────────────────────────
  const processAnswer = useCallback(
    (transcript: string) => {
      const step = steps[stepIdxRef.current];
      const result = step.parse(transcript);
      setUiTranscript(transcript);

      if (!result) {
        retriesRef.current++;
        if (retriesRef.current >= 3) {
          // Omite campo tras 3 intentos fallidos
          speak("Campo omitido. Continuando.", "asking");
          stepIdxRef.current++;
          retriesRef.current = 0;
          if (stepIdxRef.current >= steps.length) setPhase("summary");
          else { setUiStepIdx(stepIdxRef.current); setUiTranscript(""); }
          return;
        }
        speak(step.retry, "ready");
        return;
      }

      // Almacenar resultado pendiente y pedir confirmación vocal antes de avanzar
      pendingResultRef.current = {
        value: result.value,
        display: result.display,
        confirmMsg: step.confirmMsg(result.display),
      };
      const readback = result.display.length > 60
        ? result.display.substring(0, 60) + "…"
        : result.display;
      setPhase("confirm_tts");
      speak(
        `Escuché: ${readback}. ¿Es correcto? Diga Sí para continuar o No para repetir.`,
        "confirm_ready",
      );
    },
    [speak, steps]
  );

  // ── handleStart — llamado desde onClick, primer gesto del usuario ──────────
  // Llamar speak() AQUÍ (dentro del onClick) activa speechSynthesis en Chrome.
  // NO hacemos pre-check de permisos: dejamos que getUserMedia muestre su propio diálogo.
  const handleStart = useCallback(() => {
    setSttError(null);
    speak(
      `Bienvenido. Le haré ${steps.length} preguntas. ${steps[stepIdxRef.current].question}`,
      "ready",
    );
  }, [speak, steps]);

  // ── Máquina de estados (solo fases TTS, sin arrancar STT) ─────────────
  // IMPORTANTE: "start" NO está aquí — se maneja con handleStart desde onClick
  useEffect(() => {
    if (phase === "asking") {
      speak(steps[stepIdxRef.current].question, "ready");
    } else if (phase === "summary") {
      const c = collectedRef.current;
      const parts = [
        "Listo, campos completados.",
        c.pqrs_type    ? `Tipo: ${TYPE_MAP[c.pqrs_type]}.` : "",
        c.priority     ? `Prioridad: ${PRIO_MAP[c.priority]}.` : "",
        c.subject      ? `Asunto: ${c.subject.substring(0, 50)}.` : "",
        c.anon_nombre  ? `Nombre: ${c.anon_nombre}.` : "",
        c.anon_email   ? `Correo registrado.` : "",
        "\u00bfDesea enviar la solicitud? Presione el botón rojo y diga Sí o No.",
      ]
        .filter(Boolean)
        .join(" ");
      speak(parts, "yn_ready");
    } else if (phase === "confirm_ready") {
      // El permiso de micrófono ya fue concedido en el paso anterior,
      // Chrome permite auto-arrancar getUserMedia sin nuevo gesto de usuario.
      handleConfirmMicPress();
    } else if (phase === "done") {
      onComplete(collectedRef.current, submitRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── activateMic — solicita permiso explícito con getUserMedia, luego inicia STT ──
  // Patrón: getUserMedia (gesto directo) → .then() → recognition.start()
  // Chrome propaga la activación de usuario a través de promise chains desde onClick.
  // activateMic — patrón correcto para Chrome:
  //  1. getUserMedia abre el stream (muestra el diálogo si no hay permiso)
  //  2. Con el stream ACTIVO se llama rec.start() — Chrome transfiere el permiso
  //  3. Pasados 500 ms (SpeechRecognition ya tomó el mic) se libera el stream
  // Liberar el stream antes de start() causa not-allowed aunque el permiso esté concedido.
  const activateMic = useCallback(
    (
      targetPhase: "listening" | "yn_listening" | "confirm_listen",
      onTranscript: (t: string) => void,
      fallbackPhase: "ready" | "yn_ready" | "confirm_ready",
    ) => {
      ttsStop();
      setUiTranscript("");
      setTextInput("");
      setSttError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setSttError("El micrófono no está disponible. Esta función requiere una conexión segura (HTTPS) o localhost.");
        setPhase(fallbackPhase);
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          setPhase(targetPhase);

          const stopRec = startRecognition(
            (transcript) => {
              stream.getTracks().forEach((t) => t.stop());
              stopRecRef.current = null;
              setSttError(null);
              onTranscript(transcript);
            },
            (errType, rawCode) => {
              stream.getTracks().forEach((t) => t.stop());
              stopRecRef.current = null;
              const code = rawCode ? ` [${rawCode}]` : "";
              if (errType === "not-allowed") {
                setSttError("BLOCKED");
                setPhase("start");
                return;
              } else if (errType === "no-speech") {
                setSttError(`No se detectó voz. Hable más cerca del micrófono e intente de nuevo.${code}`);
              } else if (errType === "network") {
                setSttError(
                  `Error de red${code}: Chrome necesita conexión a internet para reconocer voz. Verifique su conexión.`,
                );
              } else if (errType === "audio-capture") {
                setSttError(
                  `No se pudo capturar audio${code}. Verifique que el micrófono no esté en uso por otra aplicación.`,
                );
              } else {
                setSttError(`El reconocimiento de voz falló${code}. Use el campo de texto o intente de nuevo.`);
              }
              setPhase(fallbackPhase);
            },
          );

          stopRecRef.current = () => {
            stream.getTracks().forEach((t) => t.stop());
            stopRec?.();
          };

          // Liberar el stream solo después de que SpeechRecognition haya tomado el mic
          setTimeout(() => stream.getTracks().forEach((t) => t.stop()), 500);
        })
        .catch((err: DOMException) => {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setSttError("BLOCKED");
            setPhase("start");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setSttError("No se encontró micrófono. Conecte un micrófono o use el campo de texto.");
            setPhase(fallbackPhase);
          } else {
            setSttError(`No se pudo acceder al micrófono: ${err.message}`);
            setPhase(fallbackPhase);
          }
        });
    },
    [ttsStop],
  );

  const handleMicPress = useCallback(() => {
    activateMic("listening", (transcript) => processAnswer(transcript), "ready");
  }, [activateMic, processAnswer]);

  const handleYnMicPress = useCallback(() => {
    activateMic(
      "yn_listening",
      (transcript) => {
        const yes = parseYesNo(transcript);
        submitRef.current = yes;
        setUiTranscript(transcript);
        speak(yes ? "Perfecto, enviando." : "De acuerdo. Revise el formulario.", "done");
      },
      "yn_ready",
    );
  }, [activateMic, speak]);

  const handleConfirmMicPress = useCallback(() => {
    activateMic(
      "confirm_listen",
      (transcript) => {
        const yes = parseYesNo(transcript);
        const pending = pendingResultRef.current;
        pendingResultRef.current = null;
        if (yes && pending) {
          const step = steps[stepIdxRef.current];
          if (pending.value !== "") {
            collectedRef.current = { ...collectedRef.current, [step.id]: pending.value };
          }
          setUiCollected({ ...collectedRef.current });
          advance(pending.confirmMsg);
        } else {
          speak(steps[stepIdxRef.current].question, "ready");
        }
      },
      "confirm_ready",
    );
  }, [activateMic, advance, speak, steps]);

  // ── Respaldo de texto ─────────────────────────────────────────────────
  const handleTextSubmit = useCallback(() => {
    const t = textInput.trim();
    if (!t) return;
    stopRecRef.current?.();
    stopRecRef.current = null;

    if (phase === "listening" || phase === "ready") {
      processAnswer(t);
    } else if (phase === "yn_ready" || phase === "yn_listening") {
      const yes = parseYesNo(t);
      submitRef.current = yes;
      setUiTranscript(t);
      speak(yes ? "Perfecto, enviando." : "De acuerdo.", "done");
    } else if (phase === "confirm_ready" || phase === "confirm_listen") {
      const yes = parseYesNo(t);
      const pending = pendingResultRef.current;
      pendingResultRef.current = null;
      if (yes && pending) {
        const step = steps[stepIdxRef.current];
        if (pending.value !== "") {
          collectedRef.current = { ...collectedRef.current, [step.id]: pending.value };
        }
        setUiCollected({ ...collectedRef.current });
        advance(pending.confirmMsg);
      } else {
        speak(steps[stepIdxRef.current].question, "ready");
      }
    }
    setTextInput("");
  }, [textInput, phase, processAnswer, speak, advance, steps]);

  // Limpieza
  useEffect(
    () => () => {
      ttsStop();
      stopRecRef.current?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Helpers de UI ──────────────────────────────────────────────────────
  const handleClose = () => { ttsStop(); stopRecRef.current?.(); onClose(); };

  const isSpeaking      = phase === "asking" || phase === "summary" || phase === "confirm_tts";
  const isStart         = phase === "start";
  const isReady         = phase === "ready";
  const isListening     = phase === "listening";
  const isYnReady       = phase === "yn_ready";
  const isYnListen      = phase === "yn_listening";
  const isConfirmReady  = phase === "confirm_ready";
  const isConfirmListen = phase === "confirm_listen";
  const showTextInput   = isReady || isListening || isYnReady || isYnListen || isConfirmReady || isConfirmListen;

  const progress = steps.length > 0 ? (uiStepIdx / steps.length) * 100 : 0;
  const currentStep = steps[uiStepIdx];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de voz para PQRS"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="bg-[#1e3a5f] px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Asistente de Voz</p>
              <p className="text-white/60 text-xs">Radicar PQRS por audio</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Cerrar asistente de voz"
            className="text-white/60 hover:text-white p-1.5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="h-1.5 bg-gray-100 flex-shrink-0">
          <motion.div
            className="h-full bg-[#ff9800]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">

          {/* ── PANTALLA INICIAL: el usuario debe presionar Iniciar ── */}
          {isStart && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-20 h-20 rounded-full bg-[#e8f0f7] flex items-center justify-center">
                <Volume2 className="w-10 h-10 text-[#1e3a5f]" aria-hidden="true" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-[#1e3a5f]">
                  Asistente de voz listo
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  El asistente le leerá cada pregunta en voz alta.
                  Presione <strong>Iniciar</strong> para comenzar y permitir el micrófono.
                </p>
              </div>
              {sttError === "BLOCKED" ? (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4 w-full space-y-3" role="alert">
                  <p className="text-sm font-bold text-red-700">🎤 Habilite el micrófono en 3 pasos</p>
                  <ol className="space-y-3">
                    <li className="flex gap-2.5">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[11px]">1</span>
                      <div className="text-xs text-gray-800 leading-relaxed">
                        Haga clic en el ícono{" "}
                        <strong className="bg-gray-800 text-white rounded px-1.5 py-0.5 text-[11px]">ⓘ</strong>
                        {" "}que aparece a la <strong>izquierda de la URL</strong> en la barra de dirección.
                      </div>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[11px]">2</span>
                      <div className="text-xs text-gray-800 leading-relaxed">
                        En el menú que aparece, haga clic en{" "}
                        <strong className="underline decoration-dotted">"Configuración del sitio"</strong>.
                      </div>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[11px]">3</span>
                      <div className="text-xs text-gray-800 leading-relaxed">
                        Busque <strong>Micrófono</strong> y cámbielo a{" "}
                        <strong className="text-green-700">"Permitir"</strong>.
                        Luego presione el botón Recargar de abajo.
                      </div>
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
                  >
                    Recargar página ahora
                  </button>
                </div>
              ) : sttError ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 w-full" role="alert">
                  <p className="text-xs font-semibold text-orange-700">⚠ Problema con el micrófono</p>
                  <p className="text-xs text-orange-600 leading-relaxed mt-0.5">{sttError}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#1e3a5f] hover:bg-[#15294a] text-white text-base font-bold shadow-md transition-all active:scale-95"
              >
                <Mic className="w-5 h-5" aria-hidden="true" />
                Iniciar asistente de voz
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                Necesita micrófono y altavoces (o audífonos con micrófono)
              </p>
            </div>
          )}

          {/* Indicadores de pasos */}
          {!isStart && (
            <div className="flex gap-2 justify-center flex-wrap">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex flex-col items-center gap-1 transition-opacity ${
                    i > uiStepIdx && phase !== "summary" && phase !== "yn_ready" && phase !== "yn_listening"
                      ? "opacity-30"
                      : "opacity-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${
                      i < uiStepIdx || phase === "summary" || phase === "yn_ready" || phase === "yn_listening"
                        ? "bg-green-100 text-green-700 text-sm font-bold"
                        : i === uiStepIdx
                        ? "bg-[#1e3a5f] text-white ring-2 ring-[#1e3a5f]/30 ring-offset-1"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {i < uiStepIdx || phase === "summary" || phase === "yn_ready" || phase === "yn_listening"
                      ? "✓"
                      : s.icon}
                  </div>
                  <span className="text-[9px] text-gray-500 text-center max-w-[44px] truncate">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pregunta activa */}
          {!isStart && currentStep && phase !== "summary" && phase !== "yn_ready" && phase !== "yn_listening" && (
            <div className="rounded-xl bg-[#f0f4f9] px-4 py-3">
              <p className="text-[10px] text-[#1e3a5f]/50 font-semibold uppercase tracking-wide mb-1">
                Pregunta {uiStepIdx + 1} de {steps.length}
              </p>
              <p className="text-sm text-[#1e3a5f] font-medium leading-relaxed">
                {currentStep.question}
              </p>
            </div>
          )}

          {/* Banner resumen / confirmación final */}
          {(phase === "summary" || phase === "yn_ready" || phase === "yn_listening") && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-green-800">¡Campos completados!</p>
              <p className="text-xs text-green-700">
                ¿Desea enviar ahora? Presione el botón rojo y diga <strong>Sí</strong> o <strong>No</strong>.
              </p>
            </div>
          )}

          {/* Texto que está leyendo el TTS */}
          {isSpeaking && ttsText && (
            <p className="text-xs text-center text-gray-400 italic px-2 line-clamp-2">
              {ttsText}
            </p>
          )}

          {/* ── Botón central ── */}
          <div className="flex flex-col items-center gap-3 py-1">

            {/* HABLANDO: animación + botón de interrupción */}
            {isSpeaking && (
              <>
                <div className="w-20 h-20 rounded-full bg-[#e8f0f7] flex items-center justify-center">
                  <div className="flex gap-1 items-end h-7" aria-hidden="true">
                    {[5, 13, 9, 17, 7].map((h, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-[#1e3a5f] animate-bounce"
                        style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {phase === "confirm_tts" ? "Verificando su respuesta…" : "Escuche la pregunta…"}
                </p>
                <button
                  type="button"
                  onClick={
                    phase === "summary"
                      ? handleYnMicPress
                      : phase === "confirm_tts"
                      ? handleConfirmMicPress
                      : handleMicPress
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                  aria-label="Responder ahora sin esperar que termine"
                >
                  <Mic className="w-4 h-4" aria-hidden />
                  {phase === "confirm_tts" ? "Confirmar ya" : "Responder ya"}
                </button>
              </>
            )}

            {/* LISTO — usuario debe presionar para activar micrófono */}
            {(isReady || isYnReady) && (
              <>
                <button
                  type="button"
                  onClick={isYnReady ? handleYnMicPress : handleMicPress}
                  className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex flex-col items-center justify-center gap-1 shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
                  aria-label="Presione y hable"
                >
                  <Mic className="w-9 h-9" aria-hidden="true" />
                  <span className="text-[10px] font-bold tracking-wide">TOQUE</span>
                </button>
                <p className="text-sm font-semibold text-gray-700">Presione y hable</p>
                {isYnReady && (
                  <p className="text-xs text-gray-500">
                    Diga <strong>Sí</strong> para enviar o <strong>No</strong> para editar
                  </p>
                )}
              </>
            )}

            {/* ESCUCHANDO */}
            {(isListening || isYnListen) && (
              <>
                <div className="relative w-24 h-24 rounded-full bg-red-100 border-4 border-red-500 flex items-center justify-center">
                  <Mic className="w-9 h-9 text-red-600" aria-hidden="true" />
                  <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-40" />
                </div>
                <p
                  className="text-sm font-bold text-red-600"
                  role="status"
                  aria-live="assertive"
                >
                  Escuchando… hable ahora
                </p>
              </>
            )}

            {/* CONFIRMACIÓN — valor capturado, pide Sí/No */}
            {(isConfirmReady || isConfirmListen) && pendingResultRef.current && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 w-full text-center">
                <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-1">
                  ¿Es correcto?
                </p>
                <p className="text-sm text-amber-900 font-medium break-all">
                  {pendingResultRef.current.display.length > 60
                    ? pendingResultRef.current.display.substring(0, 60) + "…"
                    : pendingResultRef.current.display}
                </p>
              </div>
            )}

            {/* CONFIRM_READY — botón verde para activar micrófono de confirmación */}
            {isConfirmReady && (
              <>
                <button
                  type="button"
                  onClick={handleConfirmMicPress}
                  className="w-24 h-24 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex flex-col items-center justify-center gap-1 shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
                  aria-label="Presione para confirmar con voz"
                >
                  <Mic className="w-9 h-9" aria-hidden="true" />
                  <span className="text-[10px] font-bold tracking-wide">SÍ / NO</span>
                </button>
                <p className="text-sm font-semibold text-gray-700">
                  Diga <strong className="text-emerald-700">Sí</strong> para confirmar o{" "}
                  <strong className="text-red-600">No</strong> para repetir
                </p>
              </>
            )}

            {/* CONFIRM_LISTEN — animación verde escuchando Sí/No */}
            {isConfirmListen && (
              <>
                <div className="relative w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center">
                  <Mic className="w-9 h-9 text-emerald-600" aria-hidden="true" />
                  <span className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-40" />
                </div>
                <p
                  className="text-sm font-bold text-emerald-600"
                  role="status"
                  aria-live="assertive"
                >
                  Escuchando confirmación…
                </p>
              </>
            )}
          </div>

          {/* Error de micrófono con instrucciones específicas (fuera de start) */}
          {sttError && !isStart && (
            <div
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 space-y-1"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-xs font-semibold text-orange-700">⚠ Problema con el micrófono</p>
              <p className="text-xs text-orange-600 leading-relaxed">{sttError}</p>
            </div>
          )}

          {/* Campo de texto de respaldo */}
          {showTextInput && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400 text-center">O escriba su respuesta:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
                  placeholder="Escriba aquí…"
                  className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  aria-label="Respuesta escrita"
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#1e3a5f] disabled:opacity-40 text-white flex items-center justify-center hover:bg-[#15294a] transition-colors"
                  aria-label="Enviar respuesta escrita"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Transcripción reciente */}
          {uiTranscript && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Escuché:</p>
              <p className="text-sm text-gray-700 italic">"{uiTranscript}"</p>
            </div>
          )}

          {/* Campos recopilados */}
          {Object.keys(uiCollected).length > 0 && (
            <div className="space-y-1">
              {(
                Object.entries(uiCollected) as [keyof VoiceWizardData, string | undefined][]
              ).map(([key, val]) => {
                if (!val) return null;
                const step = steps.find((s) => s.id === key);
                let dv = val;
                if (key === "pqrs_type") dv = TYPE_MAP[val as PqrsType]  ?? val;
                if (key === "priority")  dv = PRIO_MAP[val as PqrsPriority] ?? val;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="font-medium text-gray-700 flex-shrink-0">
                      {step?.label ?? key}:
                    </span>
                    <span className="truncate text-gray-500">
                      {dv.length > 50 ? dv.substring(0, 48) + "…" : dv}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-5 flex-shrink-0">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancelar y rellenar manualmente
          </button>
        </div>
      </motion.div>
    </div>
  );
}
