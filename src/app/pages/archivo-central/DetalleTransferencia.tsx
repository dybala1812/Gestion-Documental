/**
 * @file DetalleTransferencia.tsx
 * @description Detalle de una transferencia registrada (Ingreso › Transferencias › TR-AAAA-NNN):
 * datos generales, verificaciones, inventario por caja y carpeta, acta de entrega y rótulos.
 * Carga todo desde GET /api/transferencias/[id].
 */
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { transferenciasApi, type DetalleTransferenciaApi } from "../../services/archivoCentralApi";
import { ListaVerificaciones, RevisionActa, verificaciones } from "./RevisionActa";
import type { FilaFuid } from "./FuidInventario";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const verFecha = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return a ? `${d} ${MESES[m - 1]} ${a}` : "—";
};
const ETIQUETA_TIPO = { fisica: "Física", digital: "Digital", ambas: "Física y digital" } as const;

export function DetalleTransferencia({ id, onVolver }: { id: number; onVolver: () => void }) {
  const [t, setT] = useState<DetalleTransferenciaApi | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setT(null);
    setError("");
    transferenciasApi.obtener(id).then(setT).catch(e => setError(e instanceof Error ? e.message : "No se pudo cargar la transferencia"));
  }, [id]);

  const volver = (
    <button
      onClick={onVolver}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Volver a transferencias
    </button>
  );

  if (error)
    return (
      <div>
        {volver}
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      </div>
    );

  if (!t)
    return (
      <div>
        {volver}
        <p className="py-10 text-center text-sm text-[#6b7a8d]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando transferencia…</p>
      </div>
    );

  // El inventario guardado se convierte al formato que usan las verificaciones, el acta y los rótulos
  const filas: FilaFuid[] = t.carpetas.map((c, i) => ({
    id: `c${i}`, caja: c.caja, carpeta: c.carpeta ?? "", asunto: c.asunto ?? "",
    fechaInicial: c.fechaInicial ?? "", fechaFinal: c.fechaFinal ?? "",
    folios: String(c.folios ?? 0), docs: String(c.docs ?? 0), descripcion: c.descripcion ?? "",
  }));

  const datos: [string, string][] = [
    ["Dependencia", t.dependencia], ["Año transferido", String(t.anio)],
    ["Contenido", t.contenido || "Documentos"], ["Tipo de entrega", ETIQUETA_TIPO[t.tipo]],
    ["Responsable", t.responsable], ["Recibió", t.recibio || "—"],
    ["Fecha de entrega", verFecha(t.fecha)], ["Ubicación en bodega", t.ubicacion || "Sin asignar"],
  ];
  const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap";

  return (
    <div className="space-y-6">
      <div>
        {volver}
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso · Transferencia</p>
        <h2 className="text-3xl font-bold text-[#1e3a5f] sm:text-4xl">{t.codigo}</h2>
        <p className="mt-2 text-sm text-[#6b7a8d]">
          {t.dependencia} entrega el año {t.anio} · {ETIQUETA_TIPO[t.tipo].toLowerCase()} ·{" "}
          {t.estado === "Recibida" ? "recibida" : "registrada"} el {verFecha(t.fecha)}.
        </p>
      </div>

      {/* Datos generales */}
      <dl className="grid grid-cols-2 border-y-2 border-t-[#1e3a5f] border-b-[rgba(30,58,95,0.15)] lg:grid-cols-4">
        {datos.map(([k, v], i) => (
          <div key={k} className={`px-5 py-3 ${i % 4 !== 0 ? "lg:border-l" : ""} ${i >= 4 ? "border-t" : ""} border-[rgba(30,58,95,0.12)]`}>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{k}</dt>
            <dd className="text-sm font-bold text-[#2c3e50]">{v}</dd>
          </div>
        ))}
      </dl>

      <ListaVerificaciones items={verificaciones(filas)} />

      {/* Inventario */}
      <section>
        <h3 className="mb-2 text-lg font-bold text-[#1e3a5f]">Inventario por caja y carpeta</h3>
        <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
                {["Caja", "Carpeta", "Asunto · serie", "Fecha inicial", "Fecha final", "Folios", "Docs.", "Consecutivos", "Descripción"].map(h => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.carpetas.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#6b7a8d]">Esta transferencia no tiene inventario registrado.</td></tr>
              )}
              {t.carpetas.map((c, i) => (
                <tr key={i} className="border-t border-[rgba(30,58,95,0.09)] odd:bg-white even:bg-[#f3ede1]/40">
                  <td className="px-3 py-2 text-sm text-[#2c3e50]">{c.caja}</td>
                  <td className="px-3 py-2 text-sm text-[#2c3e50]">{c.carpeta ?? "—"}</td>
                  <td className="px-3 py-2 text-sm font-bold text-[#1e3a5f]">{c.asunto ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-[#2c3e50]">{verFecha(c.fechaInicial)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-[#2c3e50]">{verFecha(c.fechaFinal)}</td>
                  <td className="px-3 py-2 text-sm text-[#2c3e50]">{c.folios ?? "—"}</td>
                  <td className="px-3 py-2 text-sm text-[#2c3e50]">{c.docs ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-[#2c3e50]">
                    {c.consecutivoDesde || c.consecutivoHasta ? `${c.consecutivoDesde ?? "—"}–${c.consecutivoHasta ?? "—"}` : "—"}
                  </td>
                  <td className="min-w-[220px] px-3 py-2 text-xs text-[#6b7a8d]">{c.descripcion ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Acta y rótulos */}
      {filas.length > 0 && (
        <RevisionActa
          ocultarResumen
          datos={{ dependencia: t.dependencia, anio: String(t.anio), contenido: t.contenido || "Documentos", responsable: t.responsable, ubicacion: t.ubicacion ?? "" }}
          tipo={t.tipo}
          filas={filas}
          codigo={t.codigo}
          recibe={t.recibio || "Archivo Central"}
          fecha={t.fecha}
        />
      )}
    </div>
  );
}