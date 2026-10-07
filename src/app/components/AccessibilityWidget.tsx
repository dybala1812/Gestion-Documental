import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SlidersHorizontal, Eye, Type, Link2, Zap,
  RotateCcw, X, Volume2, Square,
} from "lucide-react";
import { useAccessibility, FontSize } from "../context/AccessibilityContext";
import { useTTS } from "../lib/useSpeech";

const FONT_OPTIONS: { value: FontSize; label: string; title: string }[] = [
  { value: "normal", label: "A",    title: "Tamaño normal" },
  { value: "large",  label: "A+",   title: "Tamaño grande" },
  { value: "xl",     label: "A++",  title: "Tamaño muy grande" },
];

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    fontSize, highContrast, underlineLinks, reduceMotion,
    setFontSize, toggleHighContrast, toggleUnderlineLinks,
    toggleReduceMotion, reset,
  } = useAccessibility();
  const { read, stop, isReading, supported: ttsSupported } = useTTS();

  const isModified = fontSize !== "normal" || highContrast || underlineLinks || reduceMotion;

  /* Alt+A keyboard shortcut */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointer, { capture: true });
  }, [open]);

  const toggleRows = [
    {
      key: "highContrast",
      label: "Alto contraste",
      icon: <Eye className="w-3.5 h-3.5" aria-hidden="true" />,
      value: highContrast,
      toggle: toggleHighContrast,
    },
    {
      key: "underlineLinks",
      label: "Subrayar enlaces",
      icon: <Link2 className="w-3.5 h-3.5" aria-hidden="true" />,
      value: underlineLinks,
      toggle: toggleUnderlineLinks,
    },
    {
      key: "reduceMotion",
      label: "Reducir animaciones",
      icon: <Zap className="w-3.5 h-3.5" aria-hidden="true" />,
      value: reduceMotion,
      toggle: toggleReduceMotion,
    },
  ] as const;

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      {/* ── Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="a11y-panel"
            role="dialog"
            aria-label="Opciones de accesibilidad"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 12,  scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-72 rounded-2xl shadow-2xl border border-gray-100 bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1e3a5f]">
              <div className="flex items-center gap-2 text-white">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-semibold">Accesibilidad</span>
              </div>
              <div className="flex items-center gap-1">
                {isModified && (
                  <button
                    onClick={reset}
                    title="Restablecer configuración"
                    className="flex items-center gap-1 text-[11px] text-[#ffc107] hover:text-white transition-colors px-2 py-1 rounded"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Restablecer
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar panel de accesibilidad"
                  className="text-white/60 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">

              {/* Font size */}
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <Type className="w-3 h-3" aria-hidden="true" />
                  Tamaño de texto
                </p>
                <div className="flex gap-2" role="group" aria-label="Tamaño de texto">
                  {FONT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFontSize(opt.value)}
                      title={opt.title}
                      aria-pressed={fontSize === opt.value}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                        fontSize === opt.value
                          ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle rows */}
              {toggleRows.map(row => (
                <button
                  key={row.key}
                  onClick={row.toggle}
                  role="switch"
                  aria-checked={row.value}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    row.value
                      ? "bg-[#e8f0f7] border-[#1e3a5f]/30 text-[#1e3a5f]"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {row.icon}
                    {row.label}
                  </span>
                  {/* Toggle pill */}
                  <span
                    aria-hidden="true"
                    className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                      row.value ? "bg-[#1e3a5f]" : "bg-gray-200"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      row.value ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </span>
                </button>
              ))}
            </div>

            {/* Lectura en voz alta */}
            {ttsSupported && (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                  Lectura en voz alta
                </p>
                <button
                  onClick={() => (isReading ? stop() : read())}
                  role="switch"
                  aria-checked={isReading}
                  aria-label={isReading ? "Detener lectura" : "Leer página en voz alta"}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    isReading
                      ? "bg-[#e8f0f7] border-[#1e3a5f]/30 text-[#1e3a5f]"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {isReading ? (
                      <Square className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {isReading ? "Detener lectura" : "Leer página"}
                  </span>
                  {isReading && (
                    <span
                      aria-hidden="true"
                      className="flex gap-0.5 items-end h-4"
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-[#1e3a5f] animate-bounce"
                          style={{
                            height: i === 1 ? "14px" : "8px",
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </button>
                <p className="mt-1.5 text-[10px] text-gray-400 text-center">
                  Lee el contenido visible de la página en español
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 pb-3.5 text-center text-[10px] text-gray-400">
              Atajo:{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono text-[10px]">
                Alt + A
              </kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trigger button ── */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(v => !v)}
        aria-label="Opciones de accesibilidad (Alt + A)"
        title="Opciones de accesibilidad (Alt + A)"
        aria-expanded={open}
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          open
            ? "bg-[#1e3a5f] text-white"
            : "bg-white text-[#1e3a5f] border border-gray-200 hover:bg-[#1e3a5f] hover:text-white"
        }`}
      >
        <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
        {/* Active indicator dot */}
        {isModified && !open && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#ff9800] rounded-full border-2 border-white"
          />
        )}
      </motion.button>
    </div>
  );
}
