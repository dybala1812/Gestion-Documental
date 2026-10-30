/**
 * @file TransferenciaPaso3.tsx
 * @description Pasos 2 y 3 de "Nueva transferencia":
 *  - Paso 2 (`ActaExcel`): se sube el Excel que entregó la dependencia, tal cual. Queda como acta de entrega;
 *    no se lee fila por fila ni se valida.
 *  - Paso 3 física (`DatosCajas`): las cajas NO se suben; se quedan en bodega. Se llena cuántas cajas llegaron,
 *    dónde quedó guardada cada una (Bodega · Estante · Módulo del catálogo; se puede crear aquí mismo) y observaciones.
 *  - Paso 3 digital (`DocumentosDigitales`): cargue masivo de los documentos; se guardan con la transferencia (no pasan a Por clasificar).
 */
import { useId, useState } from "react";
import { toast } from "sonner";
import { Archive, Copy, FileSpreadsheet, FileText, MapPin, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { crearCatalogo } from "../../lib/catalogosApi";
import { VistaPreviaArchivo } from "../comunicaciones/VisorArchivos";
import { textoBodega, type UbicacionBodega } from "./UbicacionFisica";

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";
const btnSec =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1] disabled:opacity-50";

/* ───────────────────────── Paso 2: el Excel de la dependencia (acta) ───────────────────────── */
export function ActaExcel({ archivo, onArchivo }: { archivo: File | null; onArchivo: (f: File | null) => void }) {
  const inputId = useId();
  const [arrastrando, setArrastrando] = useState(false);
  return (
    <section className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files[0]; if (f) onArchivo(f); }}
        className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
          arrastrando ? "border-[#e8740e] bg-[#f3ede1]" : "border-[rgba(30,58,95,0.3)] bg-white hover:bg-[#f3ede1]/60"
        }`}
      >
        <FileSpreadsheet className="h-9 w-9 shrink-0 text-[#1e3a5f]" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-[#1e3a5f]">
            {archivo ? archivo.name : "Arrastra o elige el Excel que entregó la dependencia"}
          </span>
          <span className="block text-xs text-[#6b7a8d]">
            {archivo
              ? `${Math.max(1, Math.round(archivo.size / 1024))} KB · queda como acta de entrega. Haz clic para cambiarlo.`
              : "Es el inventario con la descripción de los documentos. Se guarda tal cual como acta de entrega."}
          </span>
        </span>
        <input
          id={inputId} type="file" className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ""; }}
        />
      </label>
      {archivo && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Vista previa del acta de entrega</p>
            <button type="button" className={btnSec} onClick={() => onArchivo(null)}>
              <X className="h-4 w-4" /> Quitar el archivo
            </button>
          </div>
          <VistaPreviaArchivo key={archivo.name + archivo.size} archivo={archivo} />
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Física: cajas, ubicación y observaciones ───────────────────────── */
export function DatosCajas({ numero, onNumero, observaciones, onObservaciones, children }: {
  numero: string; onNumero: (v: string) => void;
  observaciones: string; onObservaciones: (v: string) => void;
  /** La tabla de ubicación de cada caja. */
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className={`${panel} grid grid-cols-1 gap-4 p-5 sm:grid-cols-[12rem_1fr]`}>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Número de cajas <span className="text-[#e8740e]">*</span></span>
          <input
            type="number" min={1} max={2000} inputMode="numeric" className={campo} placeholder="Ej. 12"
            value={numero} onChange={e => onNumero(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Observaciones</span>
          <textarea
            rows={2} maxLength={2000}
            className="w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-2 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30"
            placeholder="Estado de las cajas, faltantes, novedades de la entrega…"
            value={observaciones} onChange={e => onObservaciones(e.target.value)}
          />
        </label>
      </div>
      {children}
    </section>
  );
}

/** Lo que va en el rótulo de cada caja. */
export interface DetalleCaja {
  contenido: string; carpetas: string; fechaInicial: string; fechaFinal: string; folios: string;
}
export const DETALLE_CAJA_VACIO: DetalleCaja = { contenido: "", carpetas: "", fechaInicial: "", fechaFinal: "", folios: "" };

/** Problemas de los datos del rótulo de una caja (vacío = bien). */
export function problemasCaja(d: DetalleCaja | undefined, anio: number): string[] {
  if (!d) return [];
  const e: string[] = [];
  if (d.fechaInicial && d.fechaFinal && d.fechaInicial > d.fechaFinal) e.push("la fecha inicial es posterior a la final");
  for (const f of [d.fechaInicial, d.fechaFinal]) {
    if (f && Number(f.slice(0, 4)) !== anio) { e.push(`las fechas deben ser de ${anio}`); break; }
  }
  if (d.folios && !(Number.isInteger(Number(d.folios)) && Number(d.folios) >= 0)) e.push("los folios deben ser un número entero");
  return e;
}

/* ───────────────────────── Física: datos y ubicación de cada caja ───────────────────────── */
export function UbicacionCajas({ cajas, valor, onChange, ubicaciones, onNuevaUbicacion, detalle, onDetalle, anio }: {
  /** Cajas: número y (si se conoce) cuántas carpetas trae. */
  cajas: { caja: string; carpetas?: number }[];
  /** caja → id de la ubicación (texto; "" = sin asignar). */
  valor: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  ubicaciones: UbicacionBodega[];
  onNuevaUbicacion: (u: UbicacionBodega) => void;
  /** caja → datos del rótulo (contenido, carpetas, fechas, folios). */
  detalle?: Record<string, DetalleCaja>;
  onDetalle?: (v: Record<string, DetalleCaja>) => void;
  /** Año de la transferencia (las fechas deben ser de ese año). */
  anio?: number;
}) {
  const conRotulo = !!detalle && !!onDetalle;
  const setDetalle = (caja: string, k: keyof DetalleCaja, v: string) =>
    onDetalle?.({ ...detalle, [caja]: { ...(detalle?.[caja] ?? DETALLE_CAJA_VACIO), [k]: v } });
  // Copia contenido y fechas de la caja 1 a las que aún no los tienen (suelen ser iguales).
  const copiarPrimera = () => {
    const p = detalle?.[cajas[0]?.caja];
    if (!p) return;
    onDetalle?.(Object.fromEntries(cajas.map(c => {
      const d = detalle?.[c.caja] ?? DETALLE_CAJA_VACIO;
      return [c.caja, { ...d, contenido: d.contenido || p.contenido, fechaInicial: d.fechaInicial || p.fechaInicial, fechaFinal: d.fechaFinal || p.fechaFinal }];
    })));
  };
  const [nueva, setNueva] = useState({ bodega: "", estante: "", modulo: "" });
  const [creando, setCreando] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(ubicaciones.length === 0);
  const faltan = cajas.filter(c => !valor[c.caja]).length;
  const conCarpetas = cajas.some(c => c.carpetas !== undefined);

  const todas = (id: string) => onChange(Object.fromEntries(cajas.map(c => [c.caja, id])));

  const crear = async () => {
    if (!nueva.bodega.trim()) return toast.error("Escribe al menos la bodega");
    setCreando(true);
    try {
      const u = await crearCatalogo<UbicacionBodega>("ubicaciones", {
        bodega: nueva.bodega.trim(),
        ...(nueva.estante.trim() ? { estante: nueva.estante.trim() } : {}),
        ...(nueva.modulo.trim() ? { modulo: nueva.modulo.trim() } : {}),
      });
      onNuevaUbicacion(u);
      // Las cajas que aún no tienen ubicación quedan en la nueva.
      onChange(Object.fromEntries(cajas.map(c => [c.caja, valor[c.caja] || String(u.id)])));
      setNueva({ bodega: "", estante: "", modulo: "" });
      setMostrarNueva(false);
      toast.success(`Ubicación creada: ${textoBodega(u)}`);
    } catch (e) {
      toast.error("No se pudo crear la ubicación", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setCreando(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border-2 border-[#1e3a5f] bg-white px-5 py-4">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-[#1e3a5f]" aria-hidden />
        <p className="text-sm text-[#2c3e50]">
          Las cajas <strong>no se suben</strong>: se quedan guardadas en físico. Registra en qué bodega, estante y módulo
          quedó guardada cada una ({cajas.length} caja{cajas.length === 1 ? "" : "s"})
          {conRotulo && " y lo que va en su rótulo: contenido, carpetas, fechas y folios"}.
        </p>
      </div>

      <div className={`${panel} p-5`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          {ubicaciones.length > 0 ? (
            <label className="block min-w-[16rem]">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Poner todas las cajas en</span>
              <select className={campo} value="" onChange={e => e.target.value && todas(e.target.value)}>
                <option value="">Elegir ubicación…</option>
                {ubicaciones.map(u => <option key={u.id} value={u.id}>{textoBodega(u)}</option>)}
              </select>
            </label>
          ) : (
            <p className="text-sm text-[#6b7a8d]">Aún no hay ubicaciones en el catálogo: crea la primera.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {conRotulo && cajas.length > 1 && (
              <button type="button" className={btnSec} onClick={copiarPrimera}>
                <Copy className="h-4 w-4" /> Copiar contenido y fechas de la caja 1
              </button>
            )}
            <button type="button" className={btnSec} onClick={() => setMostrarNueva(v => !v)}>
              <Plus className="h-4 w-4" /> Nueva ubicación
            </button>
          </div>
        </div>

        {mostrarNueva && (
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Bodega <span className="text-[#e8740e]">*</span></span>
              <input className={campo} placeholder="Ej. Bodega 1" value={nueva.bodega} onChange={e => setNueva(n => ({ ...n, bodega: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Estante</span>
              <input className={campo} placeholder="Ej. 4" value={nueva.estante} onChange={e => setNueva(n => ({ ...n, estante: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#2c3e50]">Módulo</span>
              <input className={campo} placeholder="Ej. 2" value={nueva.modulo} onChange={e => setNueva(n => ({ ...n, modulo: e.target.value }))} />
            </label>
            <button
              type="button" onClick={crear} disabled={creando}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {creando ? "Creando…" : "Crear"}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${conRotulo ? "min-w-[64rem]" : "min-w-[32rem]"}`}>
            <thead>
              <tr className="bg-[#1e3a5f] text-left text-[11px] font-bold uppercase tracking-wide text-white">
                <th className="px-3 py-2.5">Caja</th>
                {conCarpetas && !conRotulo && <th className="px-3 py-2.5">Carpetas</th>}
                {conRotulo && (
                  <>
                    <th className="px-3 py-2.5">Contenido</th>
                    <th className="px-3 py-2.5">Carpetas</th>
                    <th className="px-3 py-2.5">Fecha inicial</th>
                    <th className="px-3 py-2.5">Fecha final</th>
                    <th className="px-3 py-2.5">Folios</th>
                  </>
                )}
                <th className="px-3 py-2.5">Dónde quedó guardada <span className="text-[#e8740e]">*</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(30,58,95,0.09)]">
              {cajas.map(c => {
                const d = detalle?.[c.caja] ?? DETALLE_CAJA_VACIO;
                const problemas = conRotulo ? problemasCaja(detalle?.[c.caja], anio ?? 0) : [];
                return (
                <tr key={c.caja} className={valor[c.caja] && problemas.length === 0 ? "" : "bg-amber-50/60"} title={problemas.join(" · ") || undefined}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-[#1e3a5f]">Caja {c.caja}</td>
                  {conCarpetas && !conRotulo && <td className="px-3 py-2 text-[#2c3e50]">{c.carpetas ?? "—"}</td>}
                  {conRotulo && (
                    <>
                      <td className="px-2 py-2">
                        <input aria-label={`Contenido de la caja ${c.caja}`} className={campo} placeholder="Ej. Actas · Consejo"
                          value={d.contenido} onChange={e => setDetalle(c.caja, "contenido", e.target.value)} />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <input aria-label={`Carpetas de la caja ${c.caja}`} className={campo} placeholder="Ej. 1 a 5"
                          value={d.carpetas} onChange={e => setDetalle(c.caja, "carpetas", e.target.value)} />
                      </td>
                      <td className="w-40 px-2 py-2">
                        <input type="date" aria-label={`Fecha inicial de la caja ${c.caja}`} className={campo}
                          value={d.fechaInicial} onChange={e => setDetalle(c.caja, "fechaInicial", e.target.value)} />
                      </td>
                      <td className="w-40 px-2 py-2">
                        <input type="date" aria-label={`Fecha final de la caja ${c.caja}`} className={campo}
                          value={d.fechaFinal} onChange={e => setDetalle(c.caja, "fechaFinal", e.target.value)} />
                      </td>
                      <td className="w-24 px-2 py-2">
                        <input type="number" min={0} inputMode="numeric" aria-label={`Folios de la caja ${c.caja}`} className={campo} placeholder="0"
                          value={d.folios} onChange={e => setDetalle(c.caja, "folios", e.target.value)} />
                      </td>
                    </>
                  )}
                  <td className="min-w-[14rem] px-2 py-2">
                    <select
                      aria-label={`Ubicación de la caja ${c.caja}`}
                      className={campo} value={valor[c.caja] ?? ""}
                      onChange={e => onChange({ ...valor, [c.caja]: e.target.value })}
                    >
                      <option value="">Sin asignar</option>
                      {ubicaciones.map(u => <option key={u.id} value={u.id}>{textoBodega(u)}</option>)}
                    </select>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={`mt-3 flex items-center gap-1.5 text-xs ${faltan ? "text-amber-700" : "text-emerald-700"}`}>
          <MapPin className="h-3.5 w-3.5" />
          {faltan ? `Falta la ubicación de ${faltan} caja${faltan === 1 ? "" : "s"}.` : "Todas las cajas tienen ubicación."}
        </p>
        {conRotulo && cajas.some(c => problemasCaja(detalle?.[c.caja], anio ?? 0).length > 0) && (
          <p className="mt-1 text-xs text-amber-700">
            Revisa las cajas marcadas: {cajas.filter(c => problemasCaja(detalle?.[c.caja], anio ?? 0).length > 0)
              .map(c => `caja ${c.caja} (${problemasCaja(detalle?.[c.caja], anio ?? 0).join(", ")})`).join("; ")}.
          </p>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Digital: documentos ───────────────────────── */
const EXT_DIGITAL = /\.(pdf|jpe?g|png|tiff?|docx?|xlsx?)$/i;
const MAX_MB = 50;

export function DocumentosDigitales({ archivos, onChange }: { archivos: File[]; onChange: (f: File[]) => void }) {
  const inputId = useId();
  const [arrastrando, setArrastrando] = useState(false);

  const agregar = (lista: FileList | null) => {
    if (!lista) return;
    // Se copia ya: el FileList se vacía al limpiar el input.
    const recibidos = Array.from(lista);
    const malos = recibidos.filter(f => !EXT_DIGITAL.test(f.name) || f.size === 0 || f.size > MAX_MB * 1024 * 1024);
    if (malos.length) {
      toast.error(`${malos.length} archivo(s) no se agregaron`, { description: `Usa PDF, imagen, Word o Excel de hasta ${MAX_MB} MB.` });
    }
    const buenos = recibidos.filter(f => !malos.includes(f));
    onChange([...archivos, ...buenos.filter(f => !archivos.some(a => a.name === f.name && a.size === f.size))]);
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border-2 border-[#1e3a5f] bg-white px-5 py-4">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#1e3a5f]" aria-hidden />
        <p className="text-sm text-[#2c3e50]">
          Sube <strong>todos los documentos</strong> que entregó la dependencia. Se guardan tal cual con la transferencia,
          junto al acta de entrega, y desde su detalle se puede ver cada uno. No pasan a Por clasificar.
        </p>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          arrastrando ? "border-[#e8740e] bg-[#f3ede1]" : "border-[rgba(30,58,95,0.3)] bg-white hover:bg-[#f3ede1]/60"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-[#1e3a5f]" />
        <span className="text-sm font-bold text-[#1e3a5f]">Arrastra los documentos aquí o haz clic para elegirlos</span>
        <span className="text-xs text-[#6b7a8d]">PDF, imagen, Word o Excel · máximo {MAX_MB} MB por archivo</span>
        <input
          id={inputId} type="file" multiple className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.xls,.xlsx"
          onChange={e => { agregar(e.target.files); e.target.value = ""; }}
        />
      </label>

      {archivos.length > 0 && (
        <div className={`${panel} divide-y divide-[rgba(30,58,95,0.09)]`}>
          <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
            {archivos.length} documento{archivos.length === 1 ? "" : "s"} para subir
          </p>
          {archivos.map(f => (
            <div key={f.name + f.size} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-[#1e3a5f]" />
              <span className="min-w-0 flex-1 truncate text-sm text-[#2c3e50]">{f.name}</span>
              <span className="shrink-0 text-xs text-[#6b7a8d]">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button
                type="button" aria-label={`Quitar ${f.name}`}
                onClick={() => onChange(archivos.filter(a => a !== f))}
                className="rounded-md p-1.5 text-[#6b7a8d] hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
