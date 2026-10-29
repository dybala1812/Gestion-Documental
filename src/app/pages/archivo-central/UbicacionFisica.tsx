/**
 * @file UbicacionFisica.tsx
 * @description Ubicación física de Archivo Central con la misma distribución en todas las pantallas:
 * Caja + Carpeta siempre, y Bodega · Estante · Módulo como bloque opcional que sale del catálogo
 * "Ubicaciones físicas" y solo aparece si hay ubicaciones activas (P-08 sigue abierta).
 * Lectura: `textoUbicacion` → "Caja 12 · Carpeta 3 (B1 · Estante 4 · Módulo 2)".
 */
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { listarCatalogo } from "../../lib/catalogosApi";
import type { UbicacionBodega } from "../../lib/clasificadosApi";

export type { UbicacionBodega };

export interface ValorUbicacion {
  caja: string;
  carpeta: string;
  /** Id del catálogo como texto ("" = sin bodega). */
  ubicacion_id: string;
}

export const UBICACION_VACIA: ValorUbicacion = { caja: "", carpeta: "", ubicacion_id: "" };

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

function Etiqueta({ texto, requerido }: { texto: string; requerido?: boolean }) {
  return (
    <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
      {texto}{requerido && <span className="text-[#e8740e]"> *</span>}
    </span>
  );
}

/** "B1 · Estante 4 · Módulo 2" */
export function textoBodega(u: UbicacionBodega | null | undefined): string {
  if (!u) return "";
  return [u.bodega, u.estante && `Estante ${u.estante}`, u.modulo && `Módulo ${u.modulo}`].filter(Boolean).join(" · ");
}

/** "Caja 12 · Carpeta 3 (B1 · Estante 4 · Módulo 2)"; "—" si no hay nada. */
export function textoUbicacion(d: { caja?: string | null; carpeta?: string | null; ubicacion?: UbicacionBodega | null }): string {
  const limpio = (v?: string | null) => (v && v.trim() && v.trim() !== "—" ? v.trim() : "");
  const caja = limpio(d.caja), carpeta = limpio(d.carpeta);
  const base = [caja && `Caja ${caja}`, carpeta && `Carpeta ${carpeta}`].filter(Boolean).join(" · ");
  const bodega = textoBodega(d.ubicacion);
  if (!base) return bodega || "—";
  return bodega ? `${base} (${bodega})` : base;
}

/** Ubicaciones activas del catálogo. Lista vacía si no hay o si el catálogo no se puede leer. */
export function useUbicacionesActivas(): UbicacionBodega[] {
  const [ubicaciones, setUbicaciones] = useState<UbicacionBodega[]>([]);
  useEffect(() => {
    let vivo = true;
    listarCatalogo<UbicacionBodega>("ubicaciones", { estado: "activo", limite: 200 })
      .then(r => { if (vivo) setUbicaciones(r.datos ?? []); })
      .catch(() => { if (vivo) setUbicaciones([]); });
    return () => { vivo = false; };
  }, []);
  return ubicaciones;
}

/** Selector opcional de bodega. No se muestra si el catálogo no tiene ubicaciones activas. */
export function SelectorBodega({ valor, onChange, ubicaciones }: {
  valor: string; onChange: (id: string) => void; ubicaciones: UbicacionBodega[];
}) {
  if (ubicaciones.length === 0) return null;
  return (
    <details className="group rounded-lg border border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/40 px-3 py-2" open={!!valor}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-[#1e3a5f]">
        <MapPin className="h-3.5 w-3.5" /> Ubicación en bodega <span className="font-normal text-[#6b7a8d]">(opcional)</span>
      </summary>
      <label className="mt-2 block">
        <Etiqueta texto="Bodega · Estante · Módulo" />
        <select className={campo} value={valor} onChange={e => onChange(e.target.value)}>
          <option value="">Sin asignar</option>
          {ubicaciones.map(u => <option key={u.id} value={u.id}>{textoBodega(u)}</option>)}
        </select>
      </label>
    </details>
  );
}

/** Caja + Carpeta (y bodega opcional). Mismo orden, etiquetas y ejemplos en todas las pantallas. */
export function UbicacionCampos({ valor, onChange, requerido = false, ubicaciones }: {
  valor: ValorUbicacion;
  onChange: (v: ValorUbicacion) => void;
  requerido?: boolean;
  ubicaciones: UbicacionBodega[];
}) {
  const set = (k: keyof ValorUbicacion) => (v: string) => onChange({ ...valor, [k]: v });
  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6b7a8d]">Ubicación física</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <Etiqueta texto="Caja" requerido={requerido} />
          <input className={campo} placeholder="Ej. 12" value={valor.caja} onChange={e => set("caja")(e.target.value)} />
        </label>
        <label className="block">
          <Etiqueta texto="Carpeta" requerido={requerido} />
          <input className={campo} placeholder="Ej. 3" value={valor.carpeta} onChange={e => set("carpeta")(e.target.value)} />
        </label>
      </div>
      <SelectorBodega valor={valor.ubicacion_id} onChange={set("ubicacion_id")} ubicaciones={ubicaciones} />
    </fieldset>
  );
}
