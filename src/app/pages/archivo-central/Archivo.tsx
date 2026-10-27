/**
 * @file Archivo.tsx
 * @description Archivo Central › Consulta › Archivo (repositorio histórico).
 * Carpetas virtuales Dependencia → Año → Asunto. Cada dependencia ya viene creada;
 * el asunto reemplaza la serie documental. Árbol a la izquierda y documentos de la carpeta a la derecha.
 * Los datos son de EJEMPLO: se reemplazan por la API. "Abrir PDF" aún no abre el archivo (ver TODO).
 */
import { useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen, Search, Upload, Archive as ArchiveIcon } from "lucide-react";
import { DetalleDocumento, type DocumentoDetalle } from "./DetalleDocumento";

type Tipo = "Entrada" | "Salida" | "Interno";

interface Documento {
  consecutivo: string;
  fecha: string;
  tipo: Tipo;
  titulo: string;
  dependencia: string;
  anio: number;
  asunto: string;
  trd: string;
}

const d = (
  consecutivo: string, fecha: string, tipo: Tipo, titulo: string,
  dependencia: string, anio: number, asunto: string, trd: string,
): Documento => ({ consecutivo, fecha, tipo, titulo, dependencia, anio, asunto, trd });

/** Ordenados del más reciente al más antiguo. */
const DOCUMENTOS: Documento[] = [
  d("412/2024", "8 dic 2024", "Entrada", "Resolución de calendario académico", "Secretaría General", 2024, "Resoluciones", "110.01"),
  d("228/2024", "24 oct 2024", "Interno", "Otrosí a convenio interinstitucional", "Secretaría General", 2024, "Convenios", "110.03"),
  d("406/2024", "20 oct 2024", "Entrada", "Acta de Consejo Académico", "Secretaría General", 2024, "Actas", "110.04"),
  d("403/2024", "4 sep 2024", "Entrada", "Circular de uso de espacios", "Secretaría General", 2024, "Circulares", "110.02"),
  d("398/2024", "4 jul 2024", "Entrada", "Circular de cierre de semestre", "Secretaría General", 2024, "Circulares", "110.02"),
  d("392/2024", "23 abr 2024", "Entrada", "Otrosí a convenio interinstitucional", "Secretaría General", 2024, "Convenios", "110.03"),
  d("183/2024", "26 feb 2024", "Salida", "Otrosí a convenio interinstitucional", "Secretaría General", 2024, "Convenios", "110.03"),
  d("382/2024", "19 ene 2024", "Entrada", "Acta de comité de rectoría", "Secretaría General", 2024, "Actas", "110.04"),
  d("194/2024", "20 dic 2024", "Salida", "Informe a Consejo Superior", "Rectoría", 2024, "Informes de gestión", "100.03"),
  d("410/2024", "3 dic 2024", "Entrada", "Solicitud de información", "Rectoría", 2024, "Comunicaciones", "100.02"),
  d("301/2023", "12 nov 2023", "Salida", "Informe de gestión 2023", "Rectoría", 2023, "Informes de gestión", "100.03"),
  d("118/2022", "9 mar 2022", "Interno", "Resolución rectoral de nombramiento", "Rectoría", 2022, "Resoluciones", "100.01"),
  d("45/2019", "15 may 2019", "Entrada", "Solicitud de apoyo institucional", "Rectoría", 2019, "Comunicaciones", "100.02"),
  d("411/2024", "6 dic 2024", "Entrada", "Remisión de documentos", "Mercadeo", 2024, "Comunicaciones", "120.02"),
  d("229/2024", "1 dic 2024", "Interno", "Contrato de prestación de servicios", "Mercadeo", 2024, "Contratos", "120.03"),
  d("230/2024", "10 dic 2024", "Interno", "Invitación a evento institucional", "Gestión Documental", 2024, "Comunicaciones", "140.02"),
  d("409/2024", "25 nov 2024", "Entrada", "Soporte de nómina mensual", "Talento Humano", 2024, "Nómina", "160.01"),
  d("407/2024", "7 nov 2024", "Entrada", "Solicitud de certificación", "Registro Académico", 2024, "Comunicaciones", "150.02"),
];

/** Datos extra del detalle (ejemplo). El resto de documentos usa valores por defecto. */
const EXTRA: Record<string, Partial<DocumentoDetalle>> = {
  "194/2024": {
    contraparte: "Cámara de Comercio del Cauca", persona: "Marcela Ordóñez", caja: "36", carpeta: "4",
    archivo: "194-2024-informe-a-consejo-superior.pdf", paginas: 4, origen: "Transferencia TR-2026-001",
  },
};

function detalleDe(x: Documento): DocumentoDetalle {
  return {
    ...x, contraparte: "—", persona: "—", caja: "—", carpeta: "—",
    archivo: `${x.consecutivo.replace("/", "-")}.pdf`, paginas: 1, origen: "—", estado: "Clasificado",
    ...EXTRA[x.consecutivo],
  };
}

/** Cada dependencia ya viene creada, aunque todavía no tenga documentos. */
const DEPENDENCIAS = [
  "Rectoría", "Secretaría General", "Mercadeo", "Dirección Administrativa",
  "Gestión Documental", "Registro Académico", "Talento Humano", "Financiera",
];

const PILDORA_TIPO: Record<Tipo, string> = {
  Entrada: "bg-blue-50 text-blue-700 border-blue-200",
  Salida: "bg-violet-50 text-violet-700 border-violet-200",
  Interno: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Seleccion { dep?: string; anio?: number; asunto?: string }

/* ───────────────────────── Fila del árbol ───────────────────────── */
function Fila({ nivel, etiqueta, cuenta, abierto, expandible, seleccionado, onToggle, onSelect }: {
  nivel: 0 | 1 | 2;
  etiqueta: string;
  cuenta: number;
  abierto: boolean;
  expandible: boolean;
  seleccionado: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const sangria = ["pl-3", "pl-9", "pl-14"][nivel];
  const Icono = abierto ? FolderOpen : Folder;
  return (
    <div
      className={`flex items-center border-t border-[rgba(30,58,95,0.09)] pr-3 ${sangria} ${
        seleccionado ? "bg-[#1e3a5f] text-white" : "text-[#2c3e50] hover:bg-[#f3ede1]/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!expandible}
        aria-expanded={expandible ? abierto : undefined}
        aria-label={`${abierto ? "Contraer" : "Expandir"} ${etiqueta}`}
        className="flex h-10 w-7 shrink-0 items-center justify-center disabled:opacity-0"
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${abierto ? "rotate-90" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-current={seleccionado ? "true" : undefined}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icono className={`h-4 w-4 shrink-0 ${seleccionado ? "text-white" : "text-[#6b7a8d]"}`} />
        <span className={`min-w-0 flex-1 truncate text-sm ${nivel === 0 ? "font-bold" : "font-medium"}`}>{etiqueta}</span>
        <span
          className={`rounded px-1.5 text-[11px] font-bold leading-5 ${
            seleccionado ? "bg-white/20 text-white" : "bg-[#ede6d8] text-[#1e3a5f]"
          }`}
        >
          {cuenta}
        </span>
      </button>
    </div>
  );
}

/* ───────────────────────── Componente ───────────────────────── */
export function Archivo({ onCargarLote }: { onCargarLote?: () => void }) {
  const [sel, setSel] = useState<Seleccion>({ dep: "Secretaría General" });
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  /** Documento abierto (detalle); null = se ve el repositorio. */
  const [abierto, setAbierto] = useState<Documento | null>(null);

  const alternar = (clave: string) =>
    setAbiertos(prev => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave); else n.add(clave);
      return n;
    });

  const delDep = (dep: string) => DOCUMENTOS.filter(x => x.dependencia === dep);
  const anios = (dep: string) => [...new Set(delDep(dep).map(x => x.anio))].sort((a, b) => b - a);
  const asuntos = (dep: string, anio: number) =>
    [...new Set(delDep(dep).filter(x => x.anio === anio).map(x => x.asunto))].sort((a, b) => a.localeCompare(b, "es"));

  const q = busqueda.trim().toLowerCase();
  const visibles = DOCUMENTOS.filter(x => {
    if (sel.dep && x.dependencia !== sel.dep) return false;
    if (sel.anio !== undefined && x.anio !== sel.anio) return false;
    if (sel.asunto && x.asunto !== sel.asunto) return false;
    if (!q) return true;
    return [x.consecutivo, x.titulo, x.asunto, x.trd, x.tipo].some(v => v.toLowerCase().includes(q));
  });

  const ruta: { etiqueta: string; sel: Seleccion }[] = [{ etiqueta: "Archivo", sel: {} }];
  if (sel.dep) ruta.push({ etiqueta: sel.dep, sel: { dep: sel.dep } });
  if (sel.dep && sel.anio !== undefined) ruta.push({ etiqueta: String(sel.anio), sel: { dep: sel.dep, anio: sel.anio } });
  if (sel.dep && sel.anio !== undefined && sel.asunto) ruta.push({ etiqueta: sel.asunto, sel });

  if (abierto) {
    return (
      <DetalleDocumento
        key={abierto.consecutivo}
        documento={detalleDe(abierto)}
        onVolver={() => setAbierto(null)}
        onAbrirCarpeta={() => {
          setSel({ dep: abierto.dependencia, anio: abierto.anio, asunto: abierto.asunto });
          setAbiertos(prev => new Set(prev).add(abierto.dependencia).add(`${abierto.dependencia}|${abierto.anio}`));
          setAbierto(null);
        }}
      />
    );
  }

  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Repositorio histórico</p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
            <ArchiveIcon className="h-6 w-6 text-[#e8740e]" />
            Archivo
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-[#6b7a8d]">
            Carpetas virtuales por Dependencia → Año → Asunto. Cada dependencia ya viene creada; el asunto reemplaza la serie documental.
          </p>
        </div>
        {onCargarLote && (
          <button
            onClick={onCargarLote}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
          >
            <Upload className="h-4 w-4" /> Cargar lote
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* ── Árbol de carpetas ─────────────────────────────────────────── */}
        <section aria-label="Carpetas" className="overflow-hidden rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
          <p className="bg-[#f3ede1]/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">
            Dependencia → Año → Asunto
          </p>
          <div className="max-h-[640px] overflow-y-auto">
            {DEPENDENCIAS.map(dep => {
              const total = delDep(dep).length;
              const abierto = abiertos.has(dep);
              return (
                <div key={dep}>
                  <Fila
                    nivel={0} etiqueta={dep} cuenta={total} abierto={abierto} expandible={total > 0}
                    seleccionado={sel.dep === dep && sel.anio === undefined}
                    onToggle={() => alternar(dep)}
                    onSelect={() => setSel({ dep })}
                  />
                  {abierto && anios(dep).map(anio => {
                    const claveAnio = `${dep}|${anio}`;
                    const abiertoAnio = abiertos.has(claveAnio);
                    return (
                      <div key={claveAnio}>
                        <Fila
                          nivel={1} etiqueta={String(anio)}
                          cuenta={delDep(dep).filter(x => x.anio === anio).length}
                          abierto={abiertoAnio} expandible
                          seleccionado={sel.dep === dep && sel.anio === anio && !sel.asunto}
                          onToggle={() => alternar(claveAnio)}
                          onSelect={() => setSel({ dep, anio })}
                        />
                        {abiertoAnio && asuntos(dep, anio).map(asunto => (
                          <Fila
                            key={`${claveAnio}|${asunto}`}
                            nivel={2} etiqueta={asunto}
                            cuenta={delDep(dep).filter(x => x.anio === anio && x.asunto === asunto).length}
                            abierto={false} expandible={false}
                            seleccionado={sel.dep === dep && sel.anio === anio && sel.asunto === asunto}
                            onToggle={() => {}}
                            onSelect={() => setSel({ dep, anio, asunto })}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Documentos de la carpeta ──────────────────────────────────── */}
        <section aria-label="Documentos de la carpeta" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label="Ruta de la carpeta" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
              <FolderOpen className="h-5 w-5 shrink-0 text-[#e8740e]" />
              {ruta.map((r, i) => (
                <span key={r.etiqueta + i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[#6b7a8d]">/</span>}
                  {i < ruta.length - 1 ? (
                    <button onClick={() => setSel(r.sel)} className="text-[#6b7a8d] hover:text-[#1e3a5f] hover:underline">
                      {r.etiqueta}
                    </button>
                  ) : (
                    <span className="font-bold text-[#1e3a5f]">{r.etiqueta}</span>
                  )}
                </span>
              ))}
            </nav>
            <span className="text-xs text-[#6b7a8d]">{visibles.length} documento(s)</span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar dentro de esta carpeta"
              aria-label="Buscar dentro de esta carpeta"
              className="h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white pl-9 pr-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/80 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30"
            />
          </div>

          {visibles.length === 0 ? (
            <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
              Esta carpeta no tiene documentos{q ? " que coincidan con la búsqueda" : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="bg-[#f3ede1]/60">
                    {["Consecutivo", "Tipo", "Documento", "Estado", ""].map((h, i) => <th key={h || i} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(x => (
                    // Toda la fila abre el documento, igual que el botón Abrir (SGD-088).
                    <tr
                      key={x.consecutivo}
                      tabIndex={0}
                      aria-label={`Abrir ${x.consecutivo}`}
                      onClick={() => setAbierto(x)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                        e.preventDefault();
                        setAbierto(x);
                      }}
                      className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-xs font-bold text-[#2c3e50]">{x.consecutivo}</p>
                        <p className="text-[11px] text-[#6b7a8d]">{x.fecha}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA_TIPO[x.tipo]}`}>{x.tipo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#2c3e50]">{x.titulo}</p>
                        <p className="text-xs text-[#6b7a8d]">{x.asunto} · {x.trd}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Clasificado
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setAbierto(x); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                        >
                          <FileText className="h-3.5 w-3.5" /> Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}