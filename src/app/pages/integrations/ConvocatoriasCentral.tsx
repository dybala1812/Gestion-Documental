import { useEffect, useMemo } from "react";
import { ExternalLink } from "lucide-react";

const CONVOCATORIAS_ROOT = import.meta.env.VITE_CONVOCATORIAS_APP_URL ?? "/convocatorias-app";
export function ConvocatoriasCentral() {
  const portalUrl = useMemo(() => {
    return CONVOCATORIAS_ROOT.endsWith("/") ? CONVOCATORIAS_ROOT : `${CONVOCATORIAS_ROOT}/`;
  }, []);

  useEffect(() => {
    window.location.replace(portalUrl);
  }, [portalUrl]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-[#1e3a5f] sm:text-2xl">Redirigiendo a Convocatorias</h1>
        <p className="mt-2 text-sm text-slate-600">
          Si no eres redirigido automáticamente, usa el siguiente enlace.
        </p>
        <a
          href={portalUrl}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#25476f]"
        >
          Abrir Convocatorias
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}