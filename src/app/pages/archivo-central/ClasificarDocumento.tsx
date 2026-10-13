/**
 * @file ClasificarDocumento.tsx
 * @description Archivo Central › Bandejas › Por clasificar › Clasificar un documento.
 * Visor del documento a la izquierda y datos a la derecha; la ruta "Quedará en" se arma sola.
 * Mismo estilo que Comunicaciones › Bandeja. Aún no llama al backend (ver TODO en `clasificar` y `guardar`).
 */
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, FolderOpen, Loader2, ScanText } from "lucide-react";

export interface DocumentoPendiente {
  id: string;
  nombre: string;
  dependencia: string;
  anio: number;
  origen: string;
  fechaCarga: string;
  paginas: number;
}

/* ───────────────────── Catálogos de ejemplo (luego, de la API) ───────────────────── */
const TIPOS = ["Entrada (recibida)", "Salida (enviada)", "Interno"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);
const ASUNTOS: Record<string, string[]> = {
  "Secretaría General": ["Resoluciones", "Actas", "Circulares", "Comunicaciones"],
  Mercadeo: ["Campañas", "Convenios", "Comunicaciones"],
};
const ASUNTOS_GENERICOS = ["Comunicaciones", "Actas", "Contratos", "Resoluciones"];

interface Datos {
  tipo: string; consecutivo: string; dia: string; mes: string; anio: string;
  asunto: string; remitente: string; recibio: string; caja: string; carpeta: string;
}
const datosIniciales = (d: DocumentoPendiente): Datos => ({
  tipo: TIPOS[0], consecutivo: "", dia: "", mes: "", anio: String(d.anio),
  asunto: "", remitente: "", recibio: "", caja: "", carpeta: "",
});

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

function Campo({ label, requerido, className = "", children }: {
  label: string; requerido?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
        {label}{requerido && <span className="text-[#e8740e]"> *</span>}
      </span>
      {children}
    </label>
  );
}

/* ───────────────────── Visor (marcador de posición) ───────────────────── */
function Visor({ doc }: { doc: DocumentoPendiente }) {
  const [pagina, setPagina] = useState(1);
  return (
    <section className={`${panel} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-4 py-3 text-white">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.nombre}</span>
        <button
          aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
          className="rounded p-1 hover:bg-white/10 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums">{pagina} / {doc.paginas}</span>
        <button
          aria-label="Página siguiente" disabled={pagina >= doc.paginas} onClick={() => setPagina(p => p + 1)}
          className="rounded p-1 hover:bg-white/10 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col bg-[#ede6d8] p-6">
        {/* TODO: reemplazar por el visor del PDF/imagen real (por ejemplo un <iframe> con la URL del archivo). */}
        <div className="flex min-h-[460px] flex-1 flex-col items-center justify-center gap-2 rounded bg-white p-6 text-center shadow-sm">
          <FileText className="h-10 w-10 text-[#6b7a8d]" />
          <p className="text-sm font-semibold text-[#2c3e50]">Vista previa de la página {pagina}</p>
          <p className="text-xs text-[#6b7a8d]">Aquí se mostrará el documento cuando esté conectado al almacenamiento.</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Componente ───────────────────── */
export function ClasificarDocumento({ documentos, indiceInicial, onClasificado, onVolver }: {
  documentos: DocumentoPendiente[];
  indiceInicial: number;
  onClasificado: (id: string) => void;
  onVolver: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [borradores, setBorradores] = useState<Record<string, Datos>>({});
  const [guardando, setGuardando] = useState(false);

  const doc = documentos[indice];
  if (!doc) return null;

  const datos = borradores[doc.id] ?? datosIniciales(doc);
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBorradores(b => ({ ...b, [doc.id]: { ...datos, [k]: e.target.value } }));

  const asuntos = ASUNTOS[doc.dependencia] ?? ASUNTOS_GENERICOS;
  const completo = !!(datos.asunto && datos.anio && datos.consecutivo.trim() && datos.caja.trim() && datos.carpeta.trim());

  const guardar = async () => {
    // TODO: guardar `datos` del documento en el backend sin clasificarlo.
    toast.success("Datos guardados");
  };

  const clasificar = async () => {
    setGuardando(true);
    try {
      // TODO: enviar `datos` al backend: clasifica el documento y lo mueve a la ruta dependencia / año / asunto.
      await new Promise(r => setTimeout(r, 400));
      onClasificado(doc.id);
      const quedan = documentos.length - 1;
      if (quedan === 0) {
        toast.success("No quedan documentos por clasificar");
        onVolver();
      } else {
        toast.success(`${doc.nombre} clasificado`);
        setIndice(i => Math.min(i, quedan - 1));
      }
    } catch {
      toast.error("No se pudo clasificar el documento");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm transition-colors hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a por clasificar
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Clasificar · {doc.dependencia}</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <FileText className="h-6 w-6 text-[#e8740e]" />
          {doc.nombre}
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">
          Lee el documento y completa asunto, año, consecutivo y ubicación física. La ruta se arma sola.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Visor key={doc.id} doc={doc} />

        <div className="space-y-4">
          {/* ── Navegación entre pendientes ─────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-[rgba(30,58,95,0.09)] pb-3">
            <button
              aria-label="Documento anterior" disabled={indice === 0} onClick={() => setIndice(i => i - 1)}
              className="rounded-lg border border-[rgba(30,58,95,0.15)] bg-white p-2 text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-0 flex-1 text-sm text-[#6b7a8d]">
              Pendiente <strong className="text-[#2c3e50]">{indice + 1} de {documentos.length}</strong> · {doc.origen.replace("Transferencia ", "")}
            </p>
            <button
              aria-label="Documento siguiente" disabled={indice >= documentos.length - 1} onClick={() => setIndice(i => i + 1)}
              className="rounded-lg border border-[rgba(30,58,95,0.15)] bg-white p-2 text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* ── Datos ───────────────────────────────────────────────────── */}
          <section className={`${panel} p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Datos del documento</p>
              <button
                type="button"
                onClick={() => toast.info("La lectura automática del documento aún no está conectada")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
              >
                <ScanText className="h-3.5 w-3.5" /> Tomar del documento
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Tipo" requerido>
                <select className={campo} value={datos.tipo} onChange={set("tipo")}>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label="Consecutivo" requerido>
                <input className={campo} placeholder="Ej. 385" value={datos.consecutivo} onChange={set("consecutivo")} />
              </Campo>
              <Campo label="Día">
                <input inputMode="numeric" className={campo} placeholder="Ej. 29" value={datos.dia} onChange={set("dia")} />
              </Campo>
              <Campo label="Mes">
                <select className={campo} value={datos.mes} onChange={set("mes")}>
                  <option value="">Elegir…</option>
                  {MESES.map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo label="Año" requerido>
                <select className={campo} value={datos.anio} onChange={set("anio")}>
                  {ANIOS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Campo>
              <Campo label={`Asunto (${doc.dependencia})`} requerido>
                <select className={campo} value={datos.asunto} onChange={set("asunto")}>
                  <option value="">Elegir…</option>
                  {asuntos.map(a => <option key={a}>{a}</option>)}
                </select>
              </Campo>
              <Campo label="Remitente" className="sm:col-span-2">
                <input className={campo} placeholder="Persona o entidad" value={datos.remitente} onChange={set("remitente")} />
              </Campo>
              <Campo label="Quién recibió" className="sm:col-span-2">
                <input className={campo} placeholder="Funcionario" value={datos.recibio} onChange={set("recibio")} />
              </Campo>
              <Campo label="Caja" requerido>
                <input className={campo} placeholder="Ej. 12" value={datos.caja} onChange={set("caja")} />
              </Campo>
              <Campo label="Carpeta" requerido>
                <input className={campo} placeholder="Ej. 3" value={datos.carpeta} onChange={set("carpeta")} />
              </Campo>
            </div>
          </section>

          {/* ── Quedará en ──────────────────────────────────────────────── */}
          <section className="rounded-xl border border-[#1e3a5f]/20 bg-[#f3ede1]/60 p-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Quedará en</p>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#1e3a5f]">
              <FolderOpen className="h-4 w-4 shrink-0 text-[#e8740e]" />
              <span>{doc.dependencia}</span>
              <span className="text-[#6b7a8d]">/</span>
              <span className={datos.anio ? "" : "font-normal text-[#6b7a8d]"}>{datos.anio || "Año"}</span>
              <span className="text-[#6b7a8d]">/</span>
              <span className={datos.asunto ? "" : "font-normal text-[#6b7a8d]"}>{datos.asunto || "Asunto"}</span>
            </p>
          </section>

          {/* ── Acciones ────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            <button
              disabled={!completo || guardando} onClick={clasificar}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Clasificar y siguiente
            </button>
            <button
              onClick={guardar}
              className="inline-flex h-10 items-center rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
            >
              Solo guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}