/**
 * @file ImportarHistorico.tsx
 * @description Importar un Excel histórico de comunicaciones ("Autónoma 2024/2025/2026") (RF-AC-019, SGD-044).
 * 1) Se elige el archivo (y la hoja); se lee en el navegador.
 * 2) Mapeo: el usuario indica qué columna del Excel es cada dato; se proponen según el encabezado.
 * 3) Vista previa: el backend valida cada fila sin guardar (nueva, ya importada, repetida o con error).
 * 4) Confirmar: se crean como comunicaciones cerradas con su número original. Reimportar no duplica.
 */
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { formatApiError } from "../../lib/api";
import {
  apiImportarHistorico, type FilaHistorico, type ResultadoFilaHistorico, type ResultadoImportacionHistorico,
} from "../../lib/comunicacionesApi";

type Campo = keyof FilaHistorico;

const CAMPOS: { clave: Campo; titulo: string; obligatorio?: boolean; alias: string[] }[] = [
  { clave: "tipo", titulo: "Tipo (recibida, enviada o interna)", alias: ["tipo", "clase", "tipo de comunicacion", "entrada/salida"] },
  { clave: "numero_original", titulo: "Número original", obligatorio: true, alias: ["numero", "no", "no.", "n°", "nº", "num", "consecutivo", "radicado", "numero de radicado", "numero original"] },
  { clave: "fecha", titulo: "Fecha", obligatorio: true, alias: ["fecha", "fecha de recibido", "fecha recibido", "fecha de envio", "fecha de radicacion", "fecha radicacion"] },
  { clave: "asunto", titulo: "Asunto", obligatorio: true, alias: ["asunto", "descripcion", "referencia"] },
  { clave: "remitente", titulo: "Remitente", alias: ["remitente", "de", "procedencia", "origen", "entidad remitente"] },
  { clave: "destinatario", titulo: "Destinatario", alias: ["destinatario", "para", "dirigido a", "destino"] },
  { clave: "dependencia", titulo: "Dependencia (código o nombre)", alias: ["dependencia", "oficina", "area", "dependencia responsable"] },
  { clave: "observaciones", titulo: "Observaciones", alias: ["observaciones", "observacion", "notas", "comentarios"] },
];

const TIPOS_TODAS = [
  { valor: "recibidas", label: "Recibidas" },
  { valor: "enviadas", label: "Enviadas" },
  { valor: "internas", label: "Internas" },
];

const RESULTADO_LABEL: Record<ResultadoFilaHistorico["resultado"], string> = {
  nueva: "Se importa",
  ya_importada: "Ya estaba importada",
  revisar: "Revisar",
  error: "Con error",
};

const RESULTADO_CLASE: Record<ResultadoFilaHistorico["resultado"], string> = {
  nueva: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ya_importada: "border-slate-200 bg-slate-50 text-slate-600",
  revisar: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

const normaliza = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha del Excel → AAAA-MM-DD. Acepta fechas de Excel, AAAA-MM-DD y DD/MM/AAAA. */
function aFechaIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS puede entregar la medianoche corrida unas horas por la zona horaria: se toma el mediodía.
    const d = new Date(v.getTime() + 12 * 3600 * 1000);
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  }
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${dos(+m[2])}-${dos(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${dos(+m[2])}-${dos(+m[1])}`;
  return s;
}

function aTexto(v: unknown): string {
  if (v instanceof Date) return aFechaIso(v);
  return String(v ?? "").trim();
}

/** Fila de encabezados: entre las 10 primeras, la que más coincide con los nombres esperados. */
function filaEncabezados(matriz: unknown[][]): number {
  let mejor = 0;
  let puntos = -1;
  matriz.slice(0, 10).forEach((fila, i) => {
    const p = fila.filter((c) => CAMPOS.some((k) => k.alias.includes(normaliza(c)))).length;
    if (p > puntos) { puntos = p; mejor = i; }
  });
  return mejor;
}

type Mapeo = Record<Campo, number>;

function proponerMapeo(encabezados: string[]): Mapeo {
  const usados = new Set<number>();
  const mapeo = {} as Mapeo;
  for (const c of CAMPOS) {
    const i = encabezados.findIndex((h, idx) => !usados.has(idx) && c.alias.includes(normaliza(h)));
    mapeo[c.clave] = i;
    if (i >= 0) usados.add(i);
  }
  return mapeo;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImportado: () => void;
}

export function ImportarHistorico({ open, onClose, onImportado }: Props) {
  const [libro, setLibro] = useState<XLSX.WorkBook | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [hoja, setHoja] = useState("");
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [tipoTodas, setTipoTodas] = useState("");
  const [paso, setPaso] = useState<"archivo" | "mapeo" | "previa" | "resultado">("archivo");
  const [resultado, setResultado] = useState<ResultadoImportacionHistorico | null>(null);
  const [soloProblemas, setSoloProblemas] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  // Hoja elegida: encabezados, filas de datos y número de fila en Excel de cada una.
  const datos = useMemo(() => {
    if (!libro || !hoja || !libro.Sheets[hoja]) return null;
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[hoja], { header: 1, defval: "", raw: true });
    const iCab = filaEncabezados(matriz);
    const encabezados = (matriz[iCab] ?? []).map((h) => String(h ?? "").trim());
    const filas: { excel: number; celdas: unknown[] }[] = [];
    matriz.slice(iCab + 1).forEach((celdas, i) => {
      if (celdas.some((v) => String(v ?? "").trim() !== "")) filas.push({ excel: iCab + i + 2, celdas });
    });
    return { encabezados, filas };
  }, [libro, hoja]);

  const reiniciar = () => {
    setLibro(null); setNombreArchivo(""); setHoja(""); setMapeo(null); setTipoTodas("");
    setPaso("archivo"); setResultado(null); setSoloProblemas(true); setError("");
  };

  const cerrar = () => { if (!trabajando) { reiniciar(); onClose(); } };

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError("");
    try {
      // Un CSV se lee como texto UTF-8 (si no, las tildes llegan dañadas); Excel, como binario.
      const lib = /\.csv$/i.test(archivo.name)
        ? XLSX.read((await archivo.text()).replace(/^﻿/, ""), { type: "string", cellDates: true })
        : XLSX.read(await archivo.arrayBuffer(), { type: "array", cellDates: true });
      if (!lib.SheetNames.length) throw new Error("El archivo no tiene hojas");
      setLibro(lib);
      setNombreArchivo(archivo.name);
      elegirHoja(lib, lib.SheetNames[0]);
      setPaso("mapeo");
    } catch (e) {
      setError(e instanceof Error ? `No se pudo leer el archivo: ${e.message}` : "No se pudo leer el archivo");
    }
  };

  const elegirHoja = (lib: XLSX.WorkBook, nombre: string) => {
    setHoja(nombre);
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(lib.Sheets[nombre], { header: 1, defval: "", raw: true });
    setMapeo(proponerMapeo((matriz[filaEncabezados(matriz)] ?? []).map((h) => String(h ?? "").trim())));
  };

  const faltan = mapeo
    ? CAMPOS.filter((c) => c.obligatorio && mapeo[c.clave] < 0).map((c) => c.titulo)
      .concat(mapeo.tipo < 0 && !tipoTodas ? ["Tipo (una columna o un tipo para todas las filas)"] : [])
    : [];

  const filasMapeadas = (): FilaHistorico[] => {
    if (!datos || !mapeo) return [];
    return datos.filas.map(({ celdas }) => {
      const f: FilaHistorico = {};
      for (const c of CAMPOS) {
        const i = mapeo[c.clave];
        if (i < 0) continue;
        const v = c.clave === "fecha" ? aFechaIso(celdas[i]) : aTexto(celdas[i]);
        if (v) f[c.clave] = v;
      }
      return f;
    });
  };

  const enviar = async (confirmar: boolean) => {
    setTrabajando(true);
    setError("");
    try {
      const r = await apiImportarHistorico(filasMapeadas(), confirmar, mapeo?.tipo === -1 ? tipoTodas : undefined);
      setResultado(r);
      setPaso(confirmar ? "resultado" : "previa");
      if (confirmar) {
        sileo.success({
          title: "Histórico importado",
          description: `${r.nuevas} nuevas · ${r.ya_importadas} ya estaban · ${r.revisar + r.errores} sin importar`,
        });
        onImportado();
      }
    } catch (e) {
      const msg = formatApiError(e);
      setError(msg);
      sileo.error({ title: confirmar ? "No se importó el histórico" : "No se pudo revisar el archivo", description: msg });
    } finally {
      setTrabajando(false);
    }
  };

  const descargarResultado = () => {
    if (!resultado || !datos) return;
    const filas = filasMapeadas();
    const tabla = [["Fila del Excel", "Número original", "Fecha", "Asunto", "Resultado", "Consecutivo", "Detalle"]].concat(
      resultado.filas.map((r) => {
        const f = filas[r.fila - 1] ?? {};
        return [String(datos.filas[r.fila - 1]?.excel ?? r.fila), f.numero_original ?? "", f.fecha ?? "", f.asunto ?? "",
          RESULTADO_LABEL[r.resultado], r.consecutivo ?? "", r.error ?? r.aviso ?? ""];
      }),
    );
    const lib = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(lib, XLSX.utils.aoa_to_sheet(tabla), "Resultado");
    XLSX.writeFile(lib, `resultado-historico-${nombreArchivo.replace(/\.[^.]+$/, "") || "importacion"}.xlsx`);
  };

  const visibles = resultado
    ? resultado.filas.filter((r) => !soloProblemas || r.resultado === "revisar" || r.resultado === "error" || r.aviso)
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <FileSpreadsheet className="h-5 w-5 text-[#e8740e]" /> Importar Excel histórico
          </DialogTitle>
          <DialogDescription>
            Cada fila se registra como comunicación cerrada, con un consecutivo del sistema y su número original.
            Puede importar el mismo archivo varias veces: lo que ya está no se duplica.
          </DialogDescription>
        </DialogHeader>

        {paso === "archivo" && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[rgba(30,58,95,0.2)] bg-[#f3ede1]/40 px-4 py-10 text-center hover:bg-[#f3ede1]/70">
            <Upload className="h-8 w-8 text-[#1e3a5f]" />
            <span className="text-sm font-semibold text-[#1e3a5f]">Elegir archivo Excel o CSV</span>
            <span className="text-xs text-[#6b7a8d]">Por ejemplo, «Autónoma 2024.xlsx». El archivo se lee en su equipo; solo se envían las filas.</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </label>
        )}

        {paso === "mapeo" && libro && datos && mapeo && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#2c3e50]">
              <span className="font-semibold">{nombreArchivo}</span>
              <span className="text-[#6b7a8d]">· {datos.filas.length} filas con datos</span>
              {libro.SheetNames.length > 1 && (
                <label className="flex items-center gap-2">
                  <span className="text-[#6b7a8d]">Hoja</span>
                  <select value={hoja} onChange={(e) => elegirHoja(libro, e.target.value)}
                    className="h-8 rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-2 text-sm">
                    {libro.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
            </div>

            <p className="text-sm text-[#6b7a8d]">Indique qué columna del archivo corresponde a cada dato. Las marcadas con * son obligatorias.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => {
                const id = `historico-campo-${c.clave}`;
                const i = mapeo[c.clave];
                const ejemplo = i >= 0 ? datos.filas.slice(0, 2).map((f) => (c.clave === "fecha" ? aFechaIso(f.celdas[i]) : aTexto(f.celdas[i]))).filter(Boolean).join(" · ") : "";
                return (
                  <div key={c.clave}>
                    <label htmlFor={id} className="block text-xs font-semibold text-[#1e3a5f]">{c.titulo}{c.obligatorio && " *"}</label>
                    <select id={id} value={i} onChange={(e) => setMapeo({ ...mapeo, [c.clave]: Number(e.target.value) })}
                      className="mt-1 h-9 w-full rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-2 text-sm">
                      <option value={-1}>— No está en el archivo —</option>
                      {datos.encabezados.map((h, idx) => <option key={idx} value={idx}>{h || `Columna ${idx + 1}`}</option>)}
                    </select>
                    {ejemplo && <p className="mt-0.5 truncate text-[11px] text-[#6b7a8d]">Ej.: {ejemplo}</p>}
                  </div>
                );
              })}
            </div>

            {mapeo.tipo < 0 && (
              <div>
                <label htmlFor="historico-tipo-todas" className="block text-xs font-semibold text-[#1e3a5f]">Tipo para todas las filas *</label>
                <select id="historico-tipo-todas" value={tipoTodas} onChange={(e) => setTipoTodas(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-2 text-sm sm:w-64">
                  <option value="">Elegir…</option>
                  {TIPOS_TODAS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                </select>
              </div>
            )}

            {faltan.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Falta indicar: {faltan.join(", ")}.
              </p>
            )}
          </div>
        )}

        {(paso === "previa" || paso === "resultado") && resultado && (
          <div className="space-y-3">
            {paso === "resultado" && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Importación terminada.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["nueva", paso === "previa" ? "Se importan" : "Importadas", resultado.nuevas],
                ["ya_importada", "Ya estaban", resultado.ya_importadas],
                ["revisar", "Número repetido", resultado.revisar],
                ["error", "Con error", resultado.errores],
              ] as const).map(([k, label, n]) => (
                <div key={k} className={`rounded-lg border px-3 py-2 ${RESULTADO_CLASE[k]}`}>
                  <p className="text-xl font-bold leading-none">{n}</p>
                  <p className="mt-1 text-xs font-semibold">{label}</p>
                </div>
              ))}
            </div>
            {(resultado.revisar > 0 || resultado.errores > 0) && (
              <p className="text-xs text-[#6b7a8d]">
                Las filas con número repetido o con error no se importan. Corríjalas en el Excel y vuelva a importarlo: lo ya importado no se duplica.
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-[#2c3e50]">
                <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} />
                Ver solo filas con problemas o avisos
              </label>
              <Button variant="outline" size="sm" onClick={descargarResultado}>
                <Download className="h-4 w-4" /> Descargar resultado
              </Button>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-[rgba(30,58,95,0.09)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#f3ede1] text-left text-xs text-[#1e3a5f]">
                  <tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Detalle</th></tr>
                </thead>
                <tbody>
                  {visibles.slice(0, 300).map((r) => (
                    <tr key={r.fila} className="border-t border-[rgba(30,58,95,0.06)] align-top">
                      <td className="px-3 py-2 font-mono text-xs text-[#6b7a8d]">{datos?.filas[r.fila - 1]?.excel ?? r.fila}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESULTADO_CLASE[r.resultado]}`}>
                          {RESULTADO_LABEL[r.resultado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#2c3e50]">
                        {r.consecutivo && <span className="font-mono font-semibold">{r.consecutivo}</span>}
                        {r.consecutivo && (r.error || r.aviso) && " · "}
                        {r.error ?? r.aviso}
                      </td>
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-[#6b7a8d]">Ninguna fila con problemas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibles.length > 300 && <p className="text-xs text-[#6b7a8d]">Se muestran 300 filas; el archivo de resultado las tiene todas.</p>}
          </div>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>
        )}

        <DialogFooter className="gap-2">
          {paso === "mapeo" && (
            <>
              <Button variant="outline" onClick={reiniciar} disabled={trabajando}><ArrowLeft className="h-4 w-4" /> Otro archivo</Button>
              <Button onClick={() => enviar(false)} disabled={trabajando || faltan.length > 0 || !datos?.filas.length}
                className="bg-[#1e3a5f] text-white hover:bg-[#152a45]">
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" />} Revisar filas
              </Button>
            </>
          )}
          {paso === "previa" && resultado && (
            <>
              <Button variant="outline" onClick={() => setPaso("mapeo")} disabled={trabajando}><ArrowLeft className="h-4 w-4" /> Cambiar columnas</Button>
              <Button onClick={() => enviar(true)} disabled={trabajando || resultado.nuevas === 0}
                className="bg-[#1e3a5f] text-white hover:bg-[#152a45]">
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" />} Importar {resultado.nuevas} {resultado.nuevas === 1 ? "comunicación" : "comunicaciones"}
              </Button>
            </>
          )}
          {paso === "resultado" && <Button onClick={cerrar} className="bg-[#1e3a5f] text-white hover:bg-[#152a45]">Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
