/**
 * useSpeech.ts
 * Hooks de accesibilidad para síntesis de voz (TTS) y reconocimiento de voz (STT).
 * Ambos usan exclusivamente la Web Speech API nativa del navegador, sin dependencias externas.
 *
 * Soporte:
 *  - TTS  (speechSynthesis):    Chrome, Edge, Firefox, Safari (todos los navegadores modernos)
 *  - STT  (SpeechRecognition):  Chrome y Edge (soporte pleno); Firefox y Safari, soporte limitado
 */

import { useEffect, useRef, useState } from "react";

// ── Text-to-Speech ───────────────────────────────────────────────────────────

/**
 * `useTTS` — Text-to-Speech usando `window.speechSynthesis`.
 *
 * Uso:
 *   const { read, stop, isReading, supported } = useTTS();
 *   read();              // Lee el contenido del <main> de la página
 *   read("texto libre"); // Lee un texto específico
 *   stop();             // Detiene la lectura
 */
export function useTTS() {
  const [isReading, setIsReading] = useState(false);
  const utterRef     = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCalledRef = useRef(false);
  // Voces precargadas en useEffect para que estén listas cuando el usuario haga click.
  // Chrome carga las voces de forma asíncrona (voiceschanged); si las pedimos dentro
  // de read() pueden llegar vacías y speak() no asigna voz → silencio.
  const voicesRef    = useRef<SpeechSynthesisVoice[]>([]);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Precarga de voces al montar el componente.
  useEffect(() => {
    if (!supported) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const read = (text?: string, onEnd?: () => void) => {
    if (!supported) { onEnd?.(); return; }

    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    window.speechSynthesis.cancel();
    endCalledRef.current = false;

    const content =
      text ??
      (document.querySelector("main") as HTMLElement | null)?.innerText ??
      document.body.innerText;

    if (!content?.trim()) { onEnd?.(); return; }

    const utter = new SpeechSynthesisUtterance(content);
    utter.rate   = 0.82;
    utter.pitch  = 1.05;
    utter.volume = 1;

    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis.getVoices();

    const esVoices = voices.filter(v => v.lang.startsWith("es"));

    // Orden de preferencia (de mayor a menor):
    //  1. Google latino: es-US, es-MX, es-CO, es-AR — más neutro/cálido
    //  2. Cualquier voz online (no local) en variante latina
    //  3. Google España como último recurso online
    //  4. Sin voz explícita → Chrome usa su default (evita imponer Helena)
    const LATIN_LANGS = ["es-US", "es-MX", "es-CO", "es-AR", "es-CL"];
    const googleLatin  = LATIN_LANGS.reduce<SpeechSynthesisVoice | null>(
      (found, lang) => found ?? esVoices.find(v => !v.localService && v.lang === lang) ?? null,
      null,
    );
    const onlineLatin  = LATIN_LANGS.reduce<SpeechSynthesisVoice | null>(
      (found, lang) => found ?? esVoices.find(v => v.lang === lang) ?? null,
      null,
    );
    const googleSpain  = esVoices.find(v => !v.localService && v.name.toLowerCase().includes("google"));
    const voice = googleLatin ?? onlineLatin ?? googleSpain ?? null;

    utter.lang = "es-CO";
    if (voice) {
      utter.voice = voice;
      utter.lang  = voice.lang;
    }

    const finish = () => {
      if (endCalledRef.current) return;
      endCalledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      setIsReading(false);
      onEnd?.();
    };

    utter.onstart = () => setIsReading(true);
    utter.onend   = finish;
    utter.onerror = (e) => {
      if ((e as SpeechSynthesisErrorEvent).error === "canceled") return;
      finish();
    };

    const estimatedMs = Math.max((content.length / 12) * 1000, 2000) + 3000;
    utterRef.current  = utter;
    timerRef.current  = setTimeout(finish, estimatedMs);

    window.speechSynthesis.speak(utter);

    // Chrome "infinite queue" bug: speak() reporta speaking=true pero nunca
    // dispara onstart ni emite audio. Fix: pause()+resume() síncrono en el mismo tick.
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();

    // Chrome congela la síntesis tras ~14 s en textos largos.
    // Solución: verificar cada segundo si Chrome auto-pausó y solo entonces reanudar.
    // NO forzamos pause() artificial — eso cortaba palabras a mitad cada 5 s.
    keepAliveRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAliveRef.current!);
        return;
      }
      // Solo reanudar si Chrome congeló el audio internamente
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 1000);
  };

  const stop = () => {
    if (!supported) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    window.speechSynthesis.cancel();
    setIsReading(false);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { read, stop, isReading, supported };
}

// ── Speech-to-Text ───────────────────────────────────────────────────────────

type SpeechResultCallback = (transcript: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

/**
 * `useSpeechToText` — Reconocimiento de voz usando `window.SpeechRecognition`.
 *
 * Uso:
 *   const { startListening, stopListening, isListening, supported } = useSpeechToText();
 *
 *   startListening((transcript) => {
 *     setValue("description", prev + " " + transcript);
 *   });
 */
export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<AnyRecognition>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = (
    onResult: SpeechResultCallback,
    onError?: () => void
  ) => {
    if (!supported || isListening) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SR: new () => AnyRecognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "es-CO";
    recognition.continuous = false;      // Una frase a la vez
    recognition.interimResults = false;  // Solo resultados finales

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e: AnyRecognition) => {
      const results: AnyRecognition[] = Array.from(e.results ?? []);
      const transcript = results
        .map((r: AnyRecognition) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) onResult(transcript);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = () => {
      setIsListening(false);
      onError?.();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // Aborta el reconocimiento al desmontar el componente que usa el hook
  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  return { startListening, stopListening, isListening, supported };
}
