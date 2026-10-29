/**
 * @file RevisionActa.tsx
 * @description Paso 3 de "Nueva transferencia": Revisión y acta.
 * Muestra los totales del inventario, las verificaciones, el acta de entrega y los rótulos
 * de caja y de carpeta. Todo se calcula a partir del inventario FUID del paso 2.
 * Imprimir: cada zona (acta, rótulos de cajas, rótulos de carpetas) se imprime por separado con window.print().
 */
import { useEffect } from "react";
import { AlertTriangle, Check, Printer } from "lucide-react";
import type { FilaFuid } from "./FuidInventario";
import type { TipoEntrega } from "./Transferencias";

interface DatosTransferencia {
  dependencia: string; anio: string; contenido: string; responsable: string; ubicacion: string;
}

interface Props {
  datos: DatosTransferencia;
  tipo: TipoEntrega;
  filas: FilaFuid[];
  /** Código de la transferencia, p. ej. TR-2026-005. TODO: lo asigna el backend al registrar. */
  codigo: string;
  /** Quien recibe en Archivo Central. */
  recibe: string;
  /** Fecha de la transferencia (AAAA-MM-DD). Si no viene, el acta usa la fecha de hoy. */
  fecha?: string;
  /** En la pantalla de detalle los totales y las verificaciones se muestran aparte. */
  ocultarResumen?: boolean;
}

/* ───────────────────────── Utilidades ───────────────────────── */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return a && m && d ? `${d} ${MESES[m - 1]} ${a}` : "—";
};
const hoy = () => {
  const d = new Date();
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};
const num = (v: string) => Number(v) || 0;
const porNumero = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });
const unicos = <T,>(xs: T[]) => Array.from(new Set(xs));
const serieDe = (asunto: string) => asunto.split("·")[0].trim();

/* ───────────────────────── Cálculos ───────────────────────── */
function calcular(filas: FilaFuid[]) {
  const ordenadas = [...filas].sort((a, b) => porNumero(a.caja, b.caja) || porNumero(a.carpeta, b.carpeta));

  const cajas = unicos(ordenadas.map(f => f.caja.trim())).map(caja => {
    const fs = ordenadas.filter(f => f.caja.trim() === caja);
    const ini = fs.map(f => f.fechaInicial).filter(Boolean).sort()[0] ?? "";
    const fin = fs.map(f => f.fechaFinal).filter(Boolean).sort().at(-1) ?? "";
    return {
      caja,
      contenido: unicos(fs.map(f => serieDe(f.asunto))).join(", "),
      carpetas: fs.map(f => f.carpeta.trim()).join(", "),
      desde: ini, hasta: fin,
      folios: fs.reduce((s, f) => s + num(f.folios), 0),
    };
  });

  // Orden cronológico: dentro de cada asunto·serie, la fecha inicial no puede retroceder.
  const cronologico = unicos(ordenadas.map(f => f.asunto.trim())).every(asunto => {
    const fechas = ordenadas.filter(f => f.asunto.trim() === asunto).map(f => f.fechaInicial);
    return fechas.every((x, i) => i === 0 || x >= fechas[i - 1]);
  });

  return {
    ordenadas, cajas,
    folios: filas.reduce((s, f) => s + num(f.folios), 0),
    docs: filas.reduce((s, f) => s + num(f.docs), 0),
    verificaciones: [
      { titulo: "Ordenados por serie y subserie", ok: filas.every(f => f.asunto.trim()) },
      { titulo: "Orden cronológico", ok: cronologico },
      { titulo: "Foliados", ok: filas.every(f => num(f.folios) > 0) },
      { titulo: "Descritos", ok: filas.every(f => f.descripcion.trim()) },
    ],
  };
}

/* ───────────────────────── Impresión por zonas ───────────────────────── */
type Zona = "acta" | "cajas" | "carpetas";

const CSS_IMPRESION = `
@media print {
  body[data-imprimir] * { visibility: hidden !important; }
  ${(["acta", "cajas", "carpetas"] as Zona[]).map(z =>
    `body[data-imprimir="${z}"] [data-zona="${z}"], body[data-imprimir="${z}"] [data-zona="${z}"] * { visibility: visible !important; }
     body[data-imprimir="${z}"] [data-zona="${z}"] { position: absolute; left: 0; top: 0; width: 100%; background: #fff; }`
  ).join("\n")}
}`;

function imprimir(zona: Zona) {
  document.body.dataset.imprimir = zona;
  const limpiar = () => { delete document.body.dataset.imprimir; window.removeEventListener("afterprint", limpiar); };
  window.addEventListener("afterprint", limpiar);
  setTimeout(() => window.print(), 50);
}

const BtnImprimir = ({ zona, children }: { zona: Zona; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={() => imprimir(zona)}
    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
  >
    <Printer className="h-3.5 w-3.5" /> {children}
  </button>
);

/** Las cuatro verificaciones del inventario (se usan en el paso 3 y en el detalle). */
export const verificaciones = (filas: FilaFuid[]) => calcular(filas).verificaciones;

export function ListaVerificaciones({ items }: { items: { titulo: string; ok: boolean }[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(v => (
        <li key={v.titulo} className="flex items-center gap-3 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-4 py-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${v.ok ? "bg-emerald-600" : "bg-amber-500"}`}>
            {v.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#2c3e50]">{v.titulo}</span>
            <span className="block text-xs text-[#6b7a8d]">{v.ok ? "Verificado en el inventario" : "Revisa el inventario"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── Componente ───────────────────────── */
export function RevisionActa({ datos, tipo, filas, codigo, recibe, fecha: fechaTransferencia, ocultarResumen }: Props) {
  const r = calcular(filas);
  const actaNo = `ACT-${codigo}`;

  // Por si se sale de la pantalla con la impresión a medias.
  useEffect(() => () => { delete document.body.dataset.imprimir; }, []);

  const fisico = tipo === "digital" ? 0 : r.docs; // TODO: con archivos cargados, separar físico/digital según el inventario.
  const digital = tipo === "digital" ? r.docs : 0;
  const filasActa: [string, string][] = [
    ["Dependencia", datos.dependencia],
    ["Año transferido", datos.anio],
    ["Contenido", datos.contenido],
    ["Tipo de entrega", { fisica: "Física", digital: "Digital", ambas: "Física y digital" }[tipo]],
    ["Cajas", String(r.cajas.length)],
    ["Carpetas", String(filas.length)],
    ["Folios", String(r.folios)],
    ["Documentos en físico", String(fisico)],
    ["Documentos en digital", String(digital)],
    ["Archivos cargados a la nube", "0"],
    ["Ubicación en bodega", datos.ubicacion.trim() || "Sin asignar"],
  ];

  return (
    <section className="space-y-6">
      <style>{CSS_IMPRESION}</style>

      {/* Totales */}
      {!ocultarResumen && (
        <dl className="grid grid-cols-2 divide-x divide-[rgba(30,58,95,0.12)] border-t-2 border-[#1e3a5f] bg-white/50 lg:grid-cols-4">
          {([["Cajas", r.cajas.length], ["Carpetas", filas.length], ["Folios", r.folios], ["Documentos", r.docs]] as const).map(([k, v]) => (
            <div key={k} className="px-5 py-4">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{k}</dt>
              <dd className="text-3xl font-bold text-[#1e3a5f]">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Verificaciones */}
      {!ocultarResumen && <ListaVerificaciones items={r.verificaciones} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── Acta de entrega ─────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-[#1e3a5f]">Acta de entrega</h3>
            <BtnImprimir zona="acta">Imprimir acta</BtnImprimir>
          </div>
          <div className="rounded-lg bg-[#d9d5ca] p-4 sm:p-8">
            <article data-zona="acta" className="bg-white px-6 py-7 shadow-md sm:px-8 sm:py-9">
              <header className="flex items-baseline justify-between gap-3 border-b border-[#2c3e50] pb-2 text-xs font-bold text-[#2c3e50]">
                <span>Universidad Autónoma del Cauca · Archivo Central</span>
                <span className="font-mono font-normal">{actaNo}</span>
              </header>

              <h4 className="mt-6 text-lg font-bold text-[#1e3a5f]">Acta de entrega de transferencia documental</h4>
              <p className="mt-0.5 text-[11px] text-[#6b7a8d]">{fechaTransferencia ? fecha(fechaTransferencia) : hoy()} · Transferencia {codigo}</p>
              <p className="mt-4 text-xs leading-relaxed text-[#2c3e50]">
                En la fecha, {datos.responsable || "—"} entrega al Archivo Central la transferencia de {datos.dependencia} correspondiente
                al año {datos.anio}, ordenada por serie y subserie, en orden cronológico, foliada y descrita según el inventario adjunto.
              </p>

              <dl className="mt-4">
                {filasActa.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-2 gap-4 border-b border-[rgba(30,58,95,0.12)] py-2 text-xs">
                    <dt className="text-[#6b7a8d]">{k}</dt>
                    <dd className="font-bold text-[#2c3e50]">{v}</dd>
                  </div>
                ))}
              </dl>

              <footer className="mt-14 grid grid-cols-2 gap-8 text-xs">
                <div className="border-t border-[#2c3e50] pt-1.5">
                  <p className="font-bold text-[#2c3e50]">{datos.responsable || "—"}</p>
                  <p className="text-[11px] text-[#6b7a8d]">Entrega · {datos.dependencia}</p>
                </div>
                <div className="border-t border-[#2c3e50] pt-1.5">
                  <p className="font-bold text-[#2c3e50]">{recibe}</p>
                  <p className="text-[11px] text-[#6b7a8d]">Recibe · Archivo Central</p>
                </div>
              </footer>
            </article>
          </div>
        </div>

        {/* ── Rótulos ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#1e3a5f]">Rótulos</h3>
              <p className="text-xs text-[#6b7a8d]">
                {r.cajas.length} rótulo(s) de caja y {filas.length} de carpeta, listos para imprimir.
              </p>
            </div>
            <div className="flex gap-2">
              <BtnImprimir zona="cajas">Cajas</BtnImprimir>
              <BtnImprimir zona="carpetas">Carpetas</BtnImprimir>
            </div>
          </div>

          <div data-zona="cajas" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {r.cajas.map(c => (
              <div key={c.caja} className="border-2 border-[#1e3a5f] bg-white">
                <p className="bg-[#1e3a5f] px-3 py-1.5 text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-white">
                  Universidad Autónoma del Cauca · Archivo Central
                </p>
                <div className="border-t-2 border-[#e8740e] px-3 pb-3 pt-2">
                  <div className="flex items-end justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Caja</span>
                    <span className="text-4xl font-bold leading-none text-[#1e3a5f]">{c.caja}</span>
                  </div>
                  <p className="mt-2 border-b border-[rgba(30,58,95,0.2)] pb-1.5 text-sm font-bold text-[#1e3a5f]">{datos.dependencia}</p>
                  <dl className="text-[11px]">
                    {([
                      ["Año", datos.anio], ["Contenido", c.contenido], ["Carpetas", c.carpetas],
                      ["Fechas", `${fecha(c.desde)} – ${fecha(c.hasta)}`], ["Folios", String(c.folios)], ["Transferencia", codigo],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[72px_1fr] gap-2 border-b border-[rgba(30,58,95,0.1)] py-1">
                        <dt className="text-[#6b7a8d]">{k}</dt>
                        <dd className="font-bold text-[#2c3e50]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Carpetas</p>
            <div data-zona="carpetas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {r.ordenadas.map(f => (
                <div key={f.id} className="border-2 border-[#1e3a5f] border-t-[3px] border-t-[#e8740e] bg-white px-3 py-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">
                    <span>Carpeta {f.carpeta}</span><span>Caja {f.caja}</span>
                  </div>
                  <p className="text-sm font-bold text-[#1e3a5f]">{f.asunto}</p>
                  <p className="text-[11px] text-[#6b7a8d]">{datos.dependencia}</p>
                  <p className="mt-1 text-[11px] text-[#2c3e50]">{fecha(f.fechaInicial)} – {fecha(f.fechaFinal)}</p>
                  <p className="text-[11px] text-[#2c3e50]">{num(f.folios)} folios</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}