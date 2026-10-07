/**
 * @file EleccionesAnuncio.tsx
 * @description Anuncio flotante (esquina inferior izquierda) informando la apertura
 * de las elecciones, con botón de acceso directo. El cierre es solo para la vista
 * actual: al recargar o volver a abrir la web, el anuncio aparece de nuevo.
 */
import { useState } from "react";
import { X, Vote } from "lucide-react";

const ELECCIONES_URL = "https://nova.uniautonoma.edu.co/elecciones";

export function EleccionesAnuncio() {
  const [visible, setVisible] = useState(true);

  const cerrar = () => setVisible(false);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-4 z-40 w-[min(24rem,calc(100vw-2rem))] animate-in slide-in-from-left-4 fade-in duration-300">
      <div className="relative rounded-2xl border-2 border-purple-300 bg-white p-5 pr-10 shadow-2xl shadow-purple-300/60">
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar anuncio"
          title="Cerrar por ahora"
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <Vote className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900">¡Iniciaron las Elecciones!</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Postúlate o vota por tus representantes institucionales.
            </p>
            <a
              href={ELECCIONES_URL}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
            >
              Ir a Elecciones
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
