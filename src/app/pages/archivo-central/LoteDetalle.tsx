/**
 * @file LoteDetalle.tsx
 * @description Detalle de un lote de carga (p. ej. L-2026-044): proceso común, contadores,
 * barra de avance y tabla por archivo. Se procesa por partes y se puede pausar y retomar.
 * Por ahora el procesamiento es SIMULADO en el navegador (ver TODO); luego lo reemplaza el seguimiento al backend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { alertaCarga, plural } from "../../lib/alertasCarga";
import { ArrowLeft, Check, Download, Pause, Play, RotateCw } from "lucide-react";

export type EstadoArchivo = "Pendiente" | "Aceptado" | "Duplicado" | "Error";

export interface ArchivoLote {
  id: string;
  nombre: string;
  tamano: number;       // bytes
  huella: string;       // SHA-256 en hexadecimal
  estado: EstadoArchivo; // estado inicial: Duplicado / Error ya vienen resueltos de la vista previa
  detalle: string;
  estudiante: string;
  /** true si el error fue de red/tiempo y se puede volver a intentar. */
  reintentable?: boolean;
  /** Texto de detalle cuando pasa a "Aceptado" (si no, se usa uno genérico). */
  detalleAceptado?: string;
}

export interface LoteData {
  codigo: string;
  tituloCarga: string;   // "Historias académicas masivas"
  destino: string;
  usuario: string;
  fecha: string;
  /** Qué cuenta el lote: archivos (por defecto) o filas (registro histórico). */
  unidad?: "archivos" | "filas";
  archivos: ArchivoLote[];
  /** Si viene, cada pendiente se procesa de verdad (p. ej. se sube al backend) en vez de simularse. */
  procesar?: (item: ArchivoLote) => Promise<Pick<ArchivoLote, "estado" | "detalle"> & { reintentable?: boolean }>;
}

const PASOS = [
  { titulo: "Recepción", detalle: "Directo al almacenamiento" },
  { titulo: "Validación", detalle: "Formato, tamaño y daño" },
  { titulo: "Huella y duplicados", detalle: "SHA-256" },
  { titulo: "Registro", detalle: "Documento o inventario" },
  { titulo: "Auditoría", detalle: "Quién, qué y cuándo" },
  { titulo: "Resultado", detalle: "Informe descargable" },
];

const ESTILO: Record<EstadoArchivo, string> = {
  Pendiente: "bg-slate-100 text-slate-500",
  Aceptado: "bg-emerald-50 text-emerald-700",
  Duplicado: "bg-amber-50 text-amber-700",
  Error: "bg-red-50 text-red-700",
};
const TEXTO_DETALLE: Record<EstadoArchivo, string> = {
  Pendiente: "text-[#6b7a8d]", Aceptado: "text-emerald-700", Duplicado: "text-amber-700", Error: "text-red-700",
};

export const tamanoLegible = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

export function LoteDetalle({ lote, onVolver }: { lote: LoteData; onVolver: () => void }) {
  const [items, setItems] = useState<ArchivoLote[]>(lote.archivos);
  const [pausado, setPausado] = useState(false);

  const total = items.length;
  const cuenta = (e: EstadoArchivo) => items.filter(i => i.estado === e).length;
  const pendientes = cuenta("Pendiente");
  const errores = cuenta("Error");
  const terminado = pendientes === 0;
  const pct = total ? Math.round(((total - pendientes) / total) * 100) : 100;
  const fallidosReintentables = items.filter(i => i.estado === "Error" && i.reintentable).length;

  // Con `procesar`, uno a la vez y de verdad; sin él, simulado.
  // TODO: en las cargas que aún no tienen `procesar`, reemplazar por el seguimiento real del lote en el backend.
  const enCurso = useRef(false);
  useEffect(() => {
    if (pausado || pendientes === 0 || enCurso.current) return;
    if (lote.procesar) {
      const item = items.find(x => x.estado === "Pendiente");
      if (!item) return;
      enCurso.current = true;
      lote.procesar(item)
        .catch((e: unknown) => ({ estado: "Error" as const, detalle: e instanceof Error ? e.message : "No se pudo cargar", reintentable: true }))
        .then(r => {
          enCurso.current = false;
          setItems(prev => prev.map(x => (x.id === item.id ? { ...x, ...r } : x)));
        });
      return;
    }
    const t = setTimeout(() => {
      setItems(prev => {
        const i = prev.findIndex(x => x.estado === "Pendiente");
        if (i < 0) return prev;
        const copia = [...prev];
        copia[i] = { ...copia[i], estado: "Aceptado", detalle: copia[i].detalleAceptado ?? `Aceptado: se agregó a la historia de ${copia[i].estudiante}.` };
        return copia;
      });
    }, 450);
    return () => clearTimeout(t);
  }, [pausado, pendientes, items]);

  // Aviso de cierre del lote: una sola vez cuando no queda nada pendiente (y de nuevo si se reintenta).
  const avisado = useRef(false);
  useEffect(() => {
    if (!terminado) { avisado.current = false; return; }
    if (avisado.current) return;
    avisado.current = true;
    const unidad = lote.unidad === "filas" ? ["fila", "filas"] as const : ["archivo", "archivos"] as const;
    const aceptados = cuenta("Aceptado");
    const resumen = `${aceptados} aceptados · ${cuenta("Duplicado")} duplicados · ${errores} con error`;
    if (total === 0) alertaCarga.info(`Lote ${lote.codigo} sin ${unidad[1]}`, "No había nada que procesar.");
    else if (errores > 0) alertaCarga.aviso(`Lote ${lote.codigo} terminado con errores`, `${plural(total, unidad[0], unidad[1])}: ${resumen}.`);
    else if (aceptados === 0) alertaCarga.aviso(`Lote ${lote.codigo} sin ${unidad[1]} nuevos`, `${resumen}.`);
    else alertaCarga.ok(`Lote ${lote.codigo} completado`, `${plural(total, unidad[0], unidad[1])}: ${resumen}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminado]);

  const reintentar = () => {
    const n = items.filter(i => i.estado === "Error" && i.reintentable).length;
    setItems(prev => prev.map(i => (i.estado === "Error" && i.reintentable ? { ...i, estado: "Pendiente", detalle: "Reintentando…" } : i)));
    if (n > 0) alertaCarga.info("Reintentando", `${plural(n, "elemento fallido vuelve", "elementos fallidos vuelven")} a la cola.`);
  };

  const alternarPausa = () => {
    if (pausado) alertaCarga.info("Proceso reanudado", `Quedan ${plural(pendientes, "pendiente", "pendientes")}.`);
    else alertaCarga.aviso("Proceso en pausa", "Pulsa Reanudar para continuar con el lote.");
    setPausado(p => !p);
  };

  const pasosHechos = useMemo(() => (terminado ? PASOS.length : Math.min(PASOS.length - 1, 1 + Math.floor((pct / 100) * 4))), [terminado, pct]);

  const descargarInforme = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const filas = [
      ["#", "Archivo", "Tamaño", "Huella SHA-256", "Estado", "Detalle"],
      ...items.map((i, n) => [String(n + 1), i.nombre, i.tamano ? tamanoLegible(i.tamano) : "—", i.huella, i.estado, i.detalle]),
    ];
    const csv = "\ufeff" + filas.map(f => f.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `informe-${lote.codigo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    alertaCarga.ok("Informe descargado", `informe-${lote.codigo}.csv`);
  };

  const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap";
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al Centro de cargas
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Lote · {lote.tituloCarga}</p>
        <h2 className="text-2xl font-bold text-[#1e3a5f] sm:text-3xl">{lote.codigo}</h2>
        <p className="mt-1 text-sm text-[#6b7a8d]">{lote.destino} · {lote.usuario} · {lote.fecha}</p>
      </div>

      {/* Proceso común */}
      <ol className="grid grid-cols-2 divide-[rgba(30,58,95,0.1)] border-y-2 border-t-[#1e3a5f] border-b-[rgba(30,58,95,0.12)] bg-white/50 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        {PASOS.map((p, i) => {
          const hecho = i < pasosHechos || terminado;
          return (
            <li key={p.titulo} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${hecho ? "bg-emerald-600 text-white" : "bg-[#ede6d8] text-[#6b7a8d]"}`}>
                {hecho ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#2c3e50]">{p.titulo}</span>
                <span className="block truncate text-xs text-[#6b7a8d]">{p.detalle}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Contadores */}
      <dl className="grid grid-cols-2 divide-[rgba(30,58,95,0.1)] border-y-2 border-t-[#1e3a5f] border-b-[rgba(30,58,95,0.12)] bg-white/50 sm:grid-cols-5 sm:divide-x">
        {([
          ["Total", total, "text-[#1e3a5f]"], ["Aceptados", cuenta("Aceptado"), "text-emerald-700"],
          ["Duplicados", cuenta("Duplicado"), "text-amber-700"], ["Con error", errores, "text-red-700"],
          ["Pendientes", pendientes, "text-[#6b7a8d]"],
        ] as const).map(([k, v, c]) => (
          <div key={k} className="px-5 py-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{k}</dt>
            <dd className={`text-3xl font-bold ${c}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* Avance */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[#2c3e50]">
          <span>
            {terminado ? (errores > 0 ? "Con errores" : "Completado") : pausado ? "En pausa" : "Procesando"} · {total - pendientes} de {total} {lote.unidad ?? "archivos"}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#ede6d8]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-full transition-all duration-300 ${terminado ? (errores > 0 ? "bg-red-600" : "bg-emerald-600") : "bg-[#1e3a5f]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!terminado && (
          <button className={btn} onClick={alternarPausa}>
            {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {pausado ? "Reanudar" : "Pausar"}
          </button>
        )}
        <button className={btn} disabled={fallidosReintentables === 0} onClick={reintentar}>
          <RotateCw className="h-4 w-4" /> Reintentar fallidos
        </button>
        <button className={btn} onClick={descargarInforme}>
          <Download className="h-4 w-4" /> Descargar informe
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b-[3px] border-[#e8740e] bg-[#1e3a5f]">
              {["#", "Archivo", "Tamaño", "Huella SHA-256", "Estado", "Detalle"].map(h => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id} className="border-t border-[rgba(30,58,95,0.09)] odd:bg-white even:bg-[#f3ede1]/40">
                <td className="px-3 py-2 text-sm text-[#6b7a8d]">{n + 1}</td>
                <td className="px-3 py-2 text-sm font-bold text-[#1e3a5f]">{i.nombre}</td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-[#6b7a8d]">{i.tamano ? tamanoLegible(i.tamano) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[#2c3e50]" title={i.huella}>{i.huella.slice(0, 14)}…</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO[i.estado]}`}>{i.estado}</span>
                </td>
                <td className={`px-3 py-2 text-xs ${TEXTO_DETALLE[i.estado]}`}>{i.detalle || "En cola…"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}