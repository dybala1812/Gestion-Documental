/**
 * @file BusquedaAvanzada.tsx
 * @description Archivo Central › Consulta › Buscar (RF-AC-014, SGD-032).
 * Busca en documentos clasificados y comunicaciones por año, mes, dependencia, tipo, asunto,
 * consecutivo ("385" o "385 del 29 de febrero"), persona, código TRD y texto. 20 resultados por
 * página; un documento se abre en el visor y una comunicación en su detalle. El backend aplica los
 * permisos: un usuario de Dependencia solo encuentra lo de su dependencia.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, Mail, RotateCcw, Search } from "lucide-react";
import { formatApiError } from "../../lib/api";
import {
  apiArbolArchivo, apiBuscarArchivo, TIPO_LEGIBLE,
  type FiltrosBusqueda, type NodoDependencia, type PaginaBusqueda, type ResultadoBusqueda,
} from "../../lib/archivoApi";
import { DetalleDocumento } from "./DetalleDocumento";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const POR_PAGINA = 20;
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 2009 }, (_, i) => ANIO_ACTUAL - i);

const PILDORA_TIPO: Record<string, string> = {
  Entrada: "bg-blue-50 text-blue-700 border-blue-200",
  Salida: "bg-violet-50 text-violet-700 border-violet-200",
  Interno: "bg-slate-100 text-slate-600 border-slate-200",
};

const campo = "h-9 w-full rounded-md border border-[rgba(30,58,95,0.15)] bg-white px-2.5 text-sm text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const etiqueta = "mb-1 block text-xs font-semibold text-[#1e3a5f]";

function fechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

const consecutivoDe = (x: ResultadoBusqueda) =>
  x.origen === "comunicacion"
    ? x.consecutivo ?? "—"
    : x.consecutivo ? (x.consecutivo.includes("/") ? x.consecutivo : `${x.consecutivo}/${x.anio}`) : `— / ${x.anio}`;

type Borrador = Record<keyof FiltrosBusqueda, string>;
const VACIO: Borrador = {
  anio: "", mes: "", dependencia_id: "", tipo: "", asunto_id: "", asunto: "", consecutivo: "", persona: "", trd: "", texto: "", alcance: "todo",
};

export function BusquedaAvanzada({ onAbrirComunicacion }: { onAbrirComunicacion: (id: number) => void }) {
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [filtros, setFiltros] = useState<FiltrosBusqueda | null>(null);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<PaginaBusqueda | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [dependencias, setDependencias] = useState<NodoDependencia[]>([]);
  const [abierto, setAbierto] = useState<ResultadoBusqueda | null>(null);

  // Las dependencias del filtro son las que el usuario puede ver.
  useEffect(() => { apiArbolArchivo().then(setDependencias).catch(() => setDependencias([])); }, []);

  useEffect(() => {
    if (!filtros) return;
    let vigente = true;
    setCargando(true);
    setError("");
    apiBuscarArchivo(filtros, pagina, POR_PAGINA)
      .then((r) => { if (vigente) setResultado(r); })
      .catch((e) => { if (vigente) { setResultado(null); setError(formatApiError(e)); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [filtros, pagina]);

  const cambiar = (k: keyof Borrador, v: string) => setBorrador((b) => ({ ...b, [k]: v }));

  const buscar = (e?: React.FormEvent) => {
    e?.preventDefault();
    const f: FiltrosBusqueda = {
      anio: borrador.anio ? Number(borrador.anio) : undefined,
      mes: borrador.mes ? Number(borrador.mes) : undefined,
      dependencia_id: borrador.dependencia_id ? Number(borrador.dependencia_id) : undefined,
      tipo: (borrador.tipo || undefined) as FiltrosBusqueda["tipo"],
      asunto: borrador.asunto || undefined,
      consecutivo: borrador.consecutivo || undefined,
      persona: borrador.persona || undefined,
      trd: borrador.trd || undefined,
      texto: borrador.texto || undefined,
      alcance: (borrador.alcance || "todo") as FiltrosBusqueda["alcance"],
    };
    setPagina(1);
    setFiltros(f);
  };

  const limpiar = () => { setBorrador(VACIO); setFiltros(null); setResultado(null); setError(""); setPagina(1); };

  const abrir = (x: ResultadoBusqueda) => (x.origen === "comunicacion" ? onAbrirComunicacion(x.id) : setAbierto(x));

  if (abierto) {
    return (
      <DetalleDocumento
        key={abierto.id}
        textoVolver="Volver a la búsqueda"
        documento={{
          consecutivo: consecutivoDe(abierto), fecha: fechaCorta(abierto.fecha),
          tipo: abierto.tipo ? TIPO_LEGIBLE[abierto.tipo] : null, titulo: abierto.titulo,
          dependencia: abierto.dependencia ?? "—", anio: abierto.anio, asunto: abierto.asunto ?? "Sin asunto",
          trd: abierto.trd ?? "—", contraparte: abierto.contraparte ?? "—", persona: "—",
          caja: abierto.caja ?? "—", carpeta: abierto.carpeta ?? "—", archivo: abierto.titulo, paginas: 1,
          origen: "—", estado: "Clasificado",
        }}
        documentoId={abierto.id}
        archivoId={abierto.archivo_id ?? undefined}
        onVolver={() => setAbierto(null)}
        onAnulado={() => { setAbierto(null); setFiltros((f) => (f ? { ...f } : f)); }}
      />
    );
  }

  const total = resultado?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const th = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#2c3e50]";

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Consulta</p>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <Search className="h-6 w-6 text-[#e8740e]" /> Búsqueda avanzada
        </h2>
        <p className="mt-0.5 max-w-3xl text-sm text-[#6b7a8d]">
          Documentos clasificados y comunicaciones. Combine los filtros que quiera; por ejemplo, el consecutivo «385 del 29 de febrero».
        </p>
      </div>

      <form onSubmit={buscar} className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="b-texto" className={etiqueta}>Texto</label>
            <input id="b-texto" value={borrador.texto} onChange={(e) => cambiar("texto", e.target.value)} className={campo} placeholder="Título, asunto u observaciones" />
          </div>
          <div>
            <label htmlFor="b-consecutivo" className={etiqueta}>Consecutivo</label>
            <input id="b-consecutivo" value={borrador.consecutivo} onChange={(e) => cambiar("consecutivo", e.target.value)} className={campo} placeholder="385 del 29 de febrero" />
          </div>
          <div>
            <label htmlFor="b-persona" className={etiqueta}>Persona o entidad</label>
            <input id="b-persona" value={borrador.persona} onChange={(e) => cambiar("persona", e.target.value)} className={campo} placeholder="Remitente o destinatario" />
          </div>
          <div>
            <label htmlFor="b-anio" className={etiqueta}>Año</label>
            <select id="b-anio" value={borrador.anio} onChange={(e) => cambiar("anio", e.target.value)} className={campo}>
              <option value="">Todos</option>
              {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-mes" className={etiqueta}>Mes</label>
            <select id="b-mes" value={borrador.mes} onChange={(e) => cambiar("mes", e.target.value)} className={campo}>
              <option value="">Todos</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-dependencia" className={etiqueta}>Dependencia</label>
            <select id="b-dependencia" value={borrador.dependencia_id} onChange={(e) => cambiar("dependencia_id", e.target.value)} className={campo}>
              <option value="">Todas</option>
              {dependencias.map((d) => <option key={d.dependencia_id} value={d.dependencia_id}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-tipo" className={etiqueta}>Tipo</label>
            <select id="b-tipo" value={borrador.tipo} onChange={(e) => cambiar("tipo", e.target.value)} className={campo}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="interno">Interno</option>
            </select>
          </div>
          <div>
            <label htmlFor="b-asunto" className={etiqueta}>Asunto</label>
            <input id="b-asunto" value={borrador.asunto} onChange={(e) => cambiar("asunto", e.target.value)} className={campo} placeholder="Ej. Actas" />
          </div>
          <div>
            <label htmlFor="b-trd" className={etiqueta}>Código TRD</label>
            <input id="b-trd" value={borrador.trd} onChange={(e) => cambiar("trd", e.target.value)} className={campo} placeholder="Ej. 110.04" />
          </div>
          <div>
            <label htmlFor="b-alcance" className={etiqueta}>Buscar en</label>
            <select id="b-alcance" value={borrador.alcance} onChange={(e) => cambiar("alcance", e.target.value)} className={campo}>
              <option value="todo">Documentos y comunicaciones</option>
              <option value="documentos">Solo documentos</option>
              <option value="comunicaciones">Solo comunicaciones</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={cargando}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
            </button>
            <button type="button" onClick={limpiar} aria-label="Limpiar filtros"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(30,58,95,0.15)] bg-white text-[#1e3a5f] hover:bg-[#f3ede1]">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
        {(borrador.trd || borrador.asunto) && borrador.alcance !== "documentos" && (
          <p className="mt-2 text-xs text-[#6b7a8d]">Las comunicaciones no tienen asunto de archivo ni TRD: con esos filtros solo se buscan documentos.</p>
        )}
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">{error}</div>
      ) : !filtros ? (
        <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
          Escriba o elija los filtros y pulse Buscar.
        </div>
      ) : cargando && !resultado ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</p>
      ) : resultado && resultado.filas.length === 0 ? (
        <div className="rounded-xl border border-[rgba(30,58,95,0.09)] bg-white px-6 py-12 text-center text-sm text-[#6b7a8d] shadow-sm">
          <p className="font-semibold text-[#2c3e50]">Sin resultados</p>
          <p className="mt-1">Pruebe ampliando los filtros: quite el mes o el tipo, busque solo por año o use una parte del nombre de la persona.</p>
        </div>
      ) : resultado && (
        <section aria-label="Resultados" className="space-y-3">
          <p className="text-sm text-[#6b7a8d]"><span className="font-semibold text-[#2c3e50]">{total}</span> resultado(s)</p>
          <div className="overflow-x-auto rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-[#f3ede1]/60">
                  {["Consecutivo", "Tipo", "Documento o asunto", "Remitente / destinatario", "Ubicación"].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((x) => {
                  const tipo = x.tipo ? TIPO_LEGIBLE[x.tipo] : null;
                  return (
                    <tr key={`${x.origen}-${x.id}`} tabIndex={0} aria-label={`Abrir ${consecutivoDe(x)}`}
                      onClick={() => abrir(x)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                        e.preventDefault();
                        abrir(x);
                      }}
                      className="cursor-pointer border-t border-[rgba(30,58,95,0.09)] hover:bg-[#f3ede1]/40 focus-visible:bg-[#f3ede1]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e3a5f]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#2c3e50]">
                          {x.origen === "comunicacion" ? <Mail className="h-3.5 w-3.5 text-[#e8740e]" /> : <FileText className="h-3.5 w-3.5 text-[#6b7a8d]" />}
                          {consecutivoDe(x)}
                        </p>
                        <p className="text-[11px] text-[#6b7a8d]">
                          {fechaCorta(x.fecha)}{x.consecutivo_original ? ` · N.º original ${x.consecutivo_original}` : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {tipo ? <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILDORA_TIPO[tipo]}`}>{tipo}</span> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#2c3e50]">{x.titulo}</p>
                        <p className="text-xs text-[#6b7a8d]">{x.origen === "comunicacion" ? "Comunicación" : "Documento"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#2c3e50]">{x.contraparte ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#6b7a8d]">
                        {[x.dependencia, x.origen === "documento" ? x.anio : null, x.asunto, x.trd].filter(Boolean).join(" / ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-[#6b7a8d]">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} aria-label="Página anterior"
                className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              Página {pagina} de {paginas}
              <button onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina === paginas} aria-label="Página siguiente"
                className="rounded-md border border-[rgba(30,58,95,0.15)] bg-white p-1.5 hover:bg-[#f3ede1] disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
