/**
 * @file UbicacionFisica.tsx
 * @description Ubicación física de Archivo Central con la misma distribución en todas las pantallas (D-23):
 * Carro → Estante → Bandeja → Caja → Carpeta.
 * - Documentos (carga, clasificar, detalle): los cinco campos (`UbicacionCampos`).
 * - Transferencias: cada caja se guarda en una posición del catálogo "Ubicaciones físicas"
 *   (Carro · Estante · Bandeja) y la carpeta va en el FUID.
 * Lectura: `textoUbicacion` → "Carro 1 · Estante 2 · Bandeja 3 · Caja 12 · Carpeta 3".
 */
import { useEffect, useState } from "react";
import { listarCatalogo } from "../../lib/catalogosApi";
import type { UbicacionBodega } from "../../lib/clasificadosApi";

export type { UbicacionBodega };

export interface ValorUbicacion {
  carro: string;
  estante: string;
  bandeja: string;
  caja: string;
  carpeta: string;
}

export const UBICACION_VACIA: ValorUbicacion = { carro: "", estante: "", bandeja: "", caja: "", carpeta: "" };

/** Orden, etiquetas y ejemplos de los campos: iguales en todas las pantallas. */
export const CAMPOS_UBICACION: { clave: keyof ValorUbicacion; etiqueta: string; ejemplo: string }[] = [
  { clave: "carro", etiqueta: "Carro", ejemplo: "Ej. 1" },
  { clave: "estante", etiqueta: "Estante", ejemplo: "Ej. 2" },
  { clave: "bandeja", etiqueta: "Bandeja", ejemplo: "Ej. 3" },
  { clave: "caja", etiqueta: "Caja", ejemplo: "Ej. 12" },
  { clave: "carpeta", etiqueta: "Carpeta", ejemplo: "Ej. 3" },
];

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

const limpio = (v?: string | null) => (v && v.trim() && v.trim() !== "—" ? v.trim() : "");

/** "Carro 1 · Estante 2 · Bandeja 3" de una posición del catálogo (los registros viejos usan bodega y módulo). */
export function textoPosicion(u: UbicacionBodega | null | undefined): string {
  if (!u) return "";
  const nuevo = [limpio(u.carro) && `Carro ${limpio(u.carro)}`, limpio(u.estante) && `Estante ${limpio(u.estante)}`, limpio(u.bandeja) && `Bandeja ${limpio(u.bandeja)}`];
  if (limpio(u.carro) || limpio(u.bandeja)) return nuevo.filter(Boolean).join(" · ");
  return [limpio(u.bodega), limpio(u.estante) && `Estante ${limpio(u.estante)}`, limpio(u.modulo) && `Módulo ${limpio(u.modulo)}`].filter(Boolean).join(" · ");
}

/** "Carro 1 · Estante 2 · Bandeja 3 · Caja 12 · Carpeta 3"; solo lo que tenga valor; "—" si no hay nada. */
export function textoUbicacion(d: Partial<Record<keyof ValorUbicacion, string | null>> & { ubicacion?: UbicacionBodega | null }): string {
  const propios = CAMPOS_UBICACION.filter(c => c.clave !== "caja" && c.clave !== "carpeta").some(c => limpio(d[c.clave]));
  const posicion = propios
    ? CAMPOS_UBICACION.slice(0, 3).map(c => limpio(d[c.clave]) && `${c.etiqueta} ${limpio(d[c.clave])}`).filter(Boolean).join(" · ")
    : textoPosicion(d.ubicacion);
  const resto = [limpio(d.caja) && `Caja ${limpio(d.caja)}`, limpio(d.carpeta) && `Carpeta ${limpio(d.carpeta)}`].filter(Boolean).join(" · ");
  return [posicion, resto].filter(Boolean).join(" · ") || "—";
}

/** Posiciones activas del catálogo (Carro · Estante · Bandeja). Lista vacía si no hay o no se puede leer. */
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

/** Carro · Estante · Bandeja · Caja · Carpeta, en ese orden. `requeridos` marca con * los obligatorios. */
export function UbicacionCampos({ valor, onChange, requeridos = [] }: {
  valor: ValorUbicacion;
  onChange: (v: ValorUbicacion) => void;
  requeridos?: (keyof ValorUbicacion)[];
}) {
  return (
    <fieldset className="sm:col-span-2 lg:col-span-4">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6b7a8d]">Ubicación física</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CAMPOS_UBICACION.map(c => (
          <label key={c.clave} className="block">
            <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
              {c.etiqueta}{requeridos.includes(c.clave) && <span className="text-[#e8740e]"> *</span>}
            </span>
            <input
              className={campo}
              placeholder={c.ejemplo}
              value={valor[c.clave]}
              onChange={e => onChange({ ...valor, [c.clave]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
