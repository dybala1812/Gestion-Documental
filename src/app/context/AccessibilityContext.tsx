import { createContext, useContext, useEffect, useState } from "react";

export type FontSize = "normal" | "large" | "xl";

interface AccessibilityState {
  fontSize: FontSize;
  highContrast: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
}

interface AccessibilityContextValue extends AccessibilityState {
  setFontSize: (s: FontSize) => void;
  toggleHighContrast: () => void;
  toggleUnderlineLinks: () => void;
  toggleReduceMotion: () => void;
  reset: () => void;
}

const DEFAULTS: AccessibilityState = {
  fontSize: "normal",
  highContrast: false,
  underlineLinks: false,
  reduceMotion: false,
};

function loadPrefs(): AccessibilityState {
  try {
    const raw = localStorage.getItem("a11y_prefs");
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function applyToDOM(state: AccessibilityState) {
  const el = document.documentElement;
  // Font size
  el.classList.remove("a11y-fs-large", "a11y-fs-xl");
  if (state.fontSize === "large") el.classList.add("a11y-fs-large");
  if (state.fontSize === "xl")    el.classList.add("a11y-fs-xl");
  // Toggles
  el.classList.toggle("a11y-high-contrast",   state.highContrast);
  el.classList.toggle("a11y-underline-links",  state.underlineLinks);
  el.classList.toggle("a11y-reduce-motion",    state.reduceMotion);
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(loadPrefs);

  useEffect(() => {
    applyToDOM(state);
    try { localStorage.setItem("a11y_prefs", JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const setFontSize       = (fontSize: FontSize) => setState(s => ({ ...s, fontSize }));
  const toggleHighContrast  = () => setState(s => ({ ...s, highContrast:   !s.highContrast }));
  const toggleUnderlineLinks = () => setState(s => ({ ...s, underlineLinks: !s.underlineLinks }));
  const toggleReduceMotion   = () => setState(s => ({ ...s, reduceMotion:   !s.reduceMotion }));
  const reset = () => setState(DEFAULTS);

  return (
    <AccessibilityContext.Provider value={{
      ...state,
      setFontSize,
      toggleHighContrast,
      toggleUnderlineLinks,
      toggleReduceMotion,
      reset,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be inside <AccessibilityProvider>");
  return ctx;
}
