/**
 * @file comunicacionesUi.tsx
 * @description Piezas visuales compartidas del módulo Comunicaciones.
 */
import { Paperclip } from "lucide-react";
import {
  CATEGORIA_BADGE, CATEGORIA_LABEL, ESTADO_BADGE, ESTADO_LABEL, PRIORIDAD_BADGE, PRIORIDAD_LABEL, TIPO_LABEL,
  type CategoriaCorreo, type EstadoComunicacion, type PrioridadCorreo, type TipoComunicacion, type AdjuntoCom, formatoTamano,
} from "../../lib/comunicacionesApi";

export function EstadoBadge({ estado }: { estado: EstadoComunicacion }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${ESTADO_BADGE[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

export function CategoriaBadge({ categoria }: { categoria: CategoriaCorreo }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${CATEGORIA_BADGE[categoria]}`}>
      {CATEGORIA_LABEL[categoria]}
    </span>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: PrioridadCorreo }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PRIORIDAD_BADGE[prioridad]}`}>
      Prioridad {PRIORIDAD_LABEL[prioridad].toLowerCase()}
    </span>
  );
}

export function TipoBadge({ tipo }: { tipo: TipoComunicacion }) {
  const cls = tipo === "ENT" ? "text-blue-600" : tipo === "SAL" ? "text-emerald-600" : "text-slate-500";
  return <span className={`text-[11px] font-medium ${cls}`}>{TIPO_LABEL[tipo]}</span>;
}

export function AdjuntoChip({ adjunto, seleccionable, seleccionado, onToggle }: {
  adjunto: AdjuntoCom;
  seleccionable?: boolean;
  seleccionado?: boolean;
  onToggle?: () => void;
}) {
  const contenido = (
    <>
      <Paperclip className="w-3.5 h-3.5 shrink-0 text-gray-400" />
      <span className="truncate">{adjunto.nombre_original}</span>
      <span className="text-[10px] text-gray-400 shrink-0">{formatoTamano(adjunto.tamano_bytes)}</span>
      {adjunto.de_respuesta && (
        <span className="text-[10px] font-semibold text-violet-600 shrink-0">respuesta</span>
      )}
    </>
  );
  if (seleccionable) {
    return (
      <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
        seleccionado ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}>
        <input type="checkbox" className="accent-orange-500" checked={!!seleccionado} onChange={onToggle} />
        {contenido}
      </label>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
      {contenido}
    </div>
  );
}

export function Vacio({ icon: Icon, titulo, texto }: { icon: React.ElementType; titulo: string; texto?: string }) {
  return (
    <div className="py-14 text-center text-gray-400">
      <Icon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="font-medium text-gray-500">{titulo}</p>
      {texto && <p className="text-sm mt-1">{texto}</p>}
    </div>
  );
}

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
