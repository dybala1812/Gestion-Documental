/**
 * @file Transferencias.tsx
 * @description Archivo Central › Ingreso › Transferencias. Lista de transferencias y acceso a "Nueva transferencia".
 * La lista es de EJEMPLO (no había mockup): se reemplaza por los datos de la API.
 * Si recibe `tipoInicial` (desde Centro de cargas B o C), abre directo el asistente con ese tipo de entrega.
 */
import { useState } from "react";
import { Plus, Truck } from "lucide-react";
import { NuevaTransferencia } from "./NuevaTransferencia";

export type TipoEntrega = "fisica" | "digital" | "ambas";

type Estado = "Borrador" | "En revisión" | "Recibida";

interface Transferencia {
  codigo: string; dependencia: string; anio: number; entrega: string; fecha: string; estado: Estado;
}

const TRANSFERENCIAS: Transferencia[] = [
  { codigo: "TR-2026-004", dependencia: "Dirección Administrativa", anio: 2024, entrega: "Física", fecha: "9 de oct de 2026", estado: "Borrador" },
  { codigo: "TR-2026-003", dependencia: "Mercadeo", anio: 2024, entrega: "Digital", fecha: "2 de mar de 2026", estado: "Recibida" },
  { codigo: "TR-2026-002", dependencia: "Talento Humano", anio: 2023, entrega: "Física y digital", fecha: "14 de feb de 2026", estado: "En revisión" },
];

const PILDORA: Record<Estado, string> = {
  Borrador: "bg-slate-100 text-slate-600 border-slate-200",
  "En revisión": "bg-amber-50 text-amber-700 border-amber-200",
  Recibida: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function Transferencias({ tipoInicial }: { tipoInicial?: TipoEntrega }) {
  // Si llega un tipo (desde Centro de cargas), abre directo el asistente.
  const [nueva, setNueva] = useState(!!tipoInicial);
  const [tipo, setTipo] = useState<TipoEntrega>(tipoInicial ?? "fisica");

  if (nueva) return <NuevaTransferencia tipoInicial={tipo} onVolver={() => setNueva(false)} />;

  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <Truck className="h-6 w-6 text-[#e8740e]" />
            Transferencias
          </h2>
          <p className="mt-0.5 text-sm text-[#6b7a8d]">Entregas de las dependencias al Archivo Central.</p>
        </div>
        <button
          onClick={() => { setTipo("fisica"); setNueva(true); }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nueva transferencia
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-[#f3ede1]/60">
              {["Código", "Dependencia", "Año", "Entrega", "Fecha", "Estado"].map(h => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {TRANSFERENCIAS.map(t => (
              <tr key={t.codigo} className="border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[#2c3e50]">{t.codigo}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#2c3e50]">{t.dependencia}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">{t.anio}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#2c3e50]">{t.entrega}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#6b7a8d]">{t.fecha}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA[t.estado]}`}>{t.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
