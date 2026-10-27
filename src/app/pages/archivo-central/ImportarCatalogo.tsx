/**
 * @file ImportarCatalogo.tsx
 * @description Importar dependencias, TRD o programas académicos desde Excel (RF-AC-001, 002, 004).
 * 1) Se elige el archivo; se lee en el navegador y se reconocen los encabezados.
 * 2) Vista previa: el backend valida cada fila contra la base sin escribir nada.
 * 3) Confirmar: se insertan las filas válidas; las que tienen error se omiten.
 */
import { useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { formatApiError } from "../../lib/api";
import { importarCatalogo, type ResultadoImportacion, type SlugImportable } from "../../lib/catalogosApi";

interface ColumnaImportacion {
  clave: string;
  titulo: string;
  obligatoria?: boolean;
  /** Encabezados que se aceptan (sin tildes, en minúscula). */
  alias: string[];
  /** Valores del Excel → valor que espera la base (p. ej. "Pregrado" → "pregrado"). */
  valores?: Record<string, string>;
}

const DISPOSICION: Record<string, string> = {
  "conservacion total": "conservacion_total", "conservacion_total": "conservacion_total", ct: "conservacion_total",
  eliminacion: "eliminacion", e: "eliminacion",
  seleccion: "seleccion", s: "seleccion",
  digitalizacion: "digitalizacion", d: "digitalizacion",
};
const NIVEL: Record<string, string> = {
  pregrado: "pregrado", especializacion: "especializacion", maestria: "maestria", doctorado: "doctorado",
};

const COLUMNAS: Record<SlugImportable, ColumnaImportacion[]> = {
  dependencias: [
    { clave: "codigo", titulo: "Código", obligatoria: true, alias: ["codigo", "cod"] },
    { clave: "nombre", titulo: "Nombre", obligatoria: true, alias: ["nombre", "dependencia"] },
    { clave: "dependencia_padre_codigo", titulo: "Código de la dependencia superior", alias: ["codigo superior", "dependencia superior", "superior", "codigo padre", "padre"] },
    { clave: "responsable", titulo: "Responsable", alias: ["responsable", "jefe"] },
    { clave: "correo_oficial", titulo: "Correo oficial", obligatoria: true, alias: ["correo oficial", "correo", "email", "e-mail"] },
  ],
  trd: [
    { clave: "codigo", titulo: "Código", obligatoria: true, alias: ["codigo", "codigo trd", "cod"] },
    { clave: "nombre", titulo: "Nombre", obligatoria: true, alias: ["nombre", "serie", "serie / subserie", "serie/subserie"] },
    { clave: "descripcion", titulo: "Descripción", alias: ["descripcion"] },
    { clave: "serie_padre_codigo", titulo: "Código de la serie padre", alias: ["codigo serie padre", "serie padre", "codigo padre", "padre"] },
    { clave: "anios_gestion", titulo: "Años en gestión", alias: ["anos gestion", "anos en gestion", "archivo de gestion", "gestion"] },
    { clave: "anios_central", titulo: "Años en central", obligatoria: true, alias: ["anos central", "anos en central", "archivo central", "central"] },
    { clave: "disposicion_final", titulo: "Disposición final", obligatoria: true, alias: ["disposicion final", "disposicion"], valores: DISPOSICION },
  ],
  programas: [
    { clave: "codigo", titulo: "Código", alias: ["codigo", "cod", "snies"] },
    { clave: "nombre", titulo: "Nombre", obligatoria: true, alias: ["nombre", "programa"] },
    { clave: "nivel", titulo: "Nivel", obligatoria: true, alias: ["nivel", "nivel academico"], valores: NIVEL },
  ],
};

const ETIQUETA_CAMPO: Record<string, string> = Object.fromEntries(
  Object.values(COLUMNAS).flat().map((c) => [c.clave, c.titulo]).concat([
    ["dependencia_padre_id", "Dependencia superior"], ["serie_padre_id", "Serie padre"],
  ]),
);

const normaliza = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

interface Lectura {
  filas: Record<string, string | number>[];
  reconocidas: string[];
  ignoradas: string[];
  faltan: string[];
}

async function leerExcel(archivo: File, columnas: ColumnaImportacion[]): Promise<Lectura> {
  // Un CSV se lee como texto UTF-8 (si no, "Código" llega como "CÃ³digo"); Excel, como binario.
  const libro = /\.csv$/i.test(archivo.name)
    ? XLSX.read((await archivo.text()).replace(/^﻿/, ""), { type: "string" })
    : XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error("El archivo no tiene hojas");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: false });
  const [cabeceras = [], ...resto] = matriz;
  const mapa = (cabeceras as unknown[]).map((h) => {
    const n = normaliza(h);
    return columnas.find((c) => c.alias.includes(n) || normaliza(c.titulo) === n) ?? null;
  });
  const reconocidas = [...new Set(mapa.filter(Boolean).map((c) => c!.titulo))];
  const ignoradas = (cabeceras as unknown[]).filter((_, i) => !mapa[i] && String(_ ?? "").trim()).map(String);
  const faltan = columnas.filter((c) => c.obligatoria && !mapa.some((m) => m?.clave === c.clave)).map((c) => c.titulo);

  const filas = resto
    .filter((fila) => (fila as unknown[]).some((v) => String(v ?? "").trim() !== ""))
    .map((fila) => {
      const o: Record<string, string | number> = {};
      (fila as unknown[]).forEach((v, i) => {
        const col = mapa[i];
        const s = String(v ?? "").trim();
        if (!col || !s) return;
        o[col.clave] = col.valores ? (col.valores[normaliza(s)] ?? s) : s;
      });
      return o;
    });
  return { filas, reconocidas, ignoradas, faltan };
}

/** Plantilla .xlsx con los encabezados esperados. */
function descargarPlantilla(tabla: SlugImportable) {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([COLUMNAS[tabla].map((c) => c.titulo)]), "Datos");
  XLSX.writeFile(libro, `plantilla-${tabla}.xlsx`);
}

const NOMBRE: Record<SlugImportable, string> = { dependencias: "dependencias", trd: "series y subseries de la TRD", programas: "programas académicos" };

export function ImportarCatalogo({ tabla, abierto, onCerrar, onImportado }: {
  tabla: SlugImportable;
  abierto: boolean;
  onCerrar: () => void;
  onImportado: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [previa, setPrevia] = useState<ResultadoImportacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnas = COLUMNAS[tabla];

  const reiniciar = () => { setArchivo(null); setLectura(null); setPrevia(null); setError(null); };
  const cerrar = () => { if (!trabajando) { reiniciar(); onCerrar(); } };

  const elegir = async (f: File | undefined) => {
    reiniciar();
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setError("Suba un archivo .xlsx, .xls o .csv."); return; }
    setArchivo(f);
    setTrabajando(true);
    try {
      const l = await leerExcel(f, columnas);
      setLectura(l);
      if (l.faltan.length) { setError(`Faltan columnas obligatorias: ${l.faltan.join(", ")}.`); return; }
      if (!l.filas.length) { setError("El archivo no tiene filas con datos."); return; }
      setPrevia(await importarCatalogo(tabla, l.filas, false));
    } catch (e) {
      setError(e instanceof Error && !(e as { status?: number }).status ? `No se pudo leer el archivo: ${e.message}` : formatApiError(e));
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = async () => {
    if (!lectura || !previa) return;
    setTrabajando(true);
    try {
      const r = await importarCatalogo(tabla, lectura.filas, true);
      if (r.con_error > 0) sileo.warning({ title: `Importadas ${r.validas} de ${r.total} filas`, description: `${r.con_error} con error no se importaron.` });
      else sileo.success({ title: `Importadas ${r.validas} filas`, description: `Se agregaron a ${NOMBRE[tabla]}.` });
      reiniciar();
      onImportado();
      onCerrar();
    } catch (e) {
      sileo.error({ title: "No se pudo importar", description: formatApiError(e) });
    } finally {
      setTrabajando(false);
    }
  };

  const resumenFila = (i: number) => {
    const f = lectura?.filas[i] ?? {};
    return [f.codigo, f.nombre].filter(Boolean).join(" · ") || "—";
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="bg-white border border-[rgba(30,58,95,0.12)] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#e8740e]" /> Importar {NOMBRE[tabla]} desde Excel
          </DialogTitle>
          <DialogDescription className="text-[#6b7a8d]">
            Primero verá una vista previa con los errores de cada fila; nada se guarda hasta que confirme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(30,58,95,0.12)] bg-[#f3ede1]/50 p-3 text-sm">
            <p className="font-semibold text-[#1e3a5f]">Columnas del archivo</p>
            <p className="mt-1 text-[#2c3e50]">
              {columnas.map((c, i) => (
                <span key={c.clave}>{i > 0 && " · "}{c.titulo}{c.obligatoria && <span className="text-[#e8740e]">*</span>}</span>
              ))}
            </p>
            <button type="button" onClick={() => descargarPlantilla(tabla)} className="mt-2 text-xs font-semibold text-[#1e3a5f] underline underline-offset-2">
              Descargar plantilla con estos encabezados
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgba(30,58,95,0.2)] bg-white p-6 text-center hover:bg-[#f3ede1]/40">
            <Upload className="h-6 w-6 text-[#1e3a5f]" />
            <span className="text-sm font-semibold text-[#1e3a5f]">{archivo ? archivo.name : "Elegir archivo .xlsx, .xls o .csv"}</span>
            <span className="text-xs text-[#6b7a8d]">La primera fila debe tener los encabezados. Máximo 2.000 filas.</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={trabajando}
              onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
          </label>

          {trabajando && !previa && (
            <p className="flex items-center justify-center gap-2 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Validando las filas…</p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {lectura && lectura.ignoradas.length > 0 && (
            <p className="text-xs text-[#6b7a8d]">Columnas que no se usan: {lectura.ignoradas.join(", ")}.</p>
          )}

          {previa && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-[rgba(30,58,95,0.12)] p-2"><p className="text-xl font-bold text-[#1e3a5f] tabular-nums">{previa.total}</p><p className="text-xs text-[#6b7a8d]">filas</p></div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-2"><p className="text-xl font-bold text-green-700 tabular-nums">{previa.validas}</p><p className="text-xs text-green-700">se importarán</p></div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-2"><p className="text-xl font-bold text-red-700 tabular-nums">{previa.con_error}</p><p className="text-xs text-red-700">con error</p></div>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-[rgba(30,58,95,0.12)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#f3ede1] text-left text-xs font-bold uppercase tracking-wider text-[#1e3a5f]">
                    <tr><th className="px-3 py-2">Fila del Excel</th><th className="px-3 py-2">Registro</th><th className="px-3 py-2">Resultado</th></tr>
                  </thead>
                  <tbody>
                    {previa.filas.map((f) => (
                      <tr key={f.fila} className="border-t border-[rgba(30,58,95,0.06)]">
                        <td className="px-3 py-2 tabular-nums text-[#6b7a8d]">{f.fila + 1}</td>
                        <td className="px-3 py-2 text-[#2c3e50]">{resumenFila(f.fila - 1)}</td>
                        <td className="px-3 py-2">
                          {f.ok ? (
                            <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> Lista</span>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-red-700">
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{f.campo && ETIQUETA_CAMPO[f.campo] ? `${ETIQUETA_CAMPO[f.campo]}: ` : ""}{f.error}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={cerrar} disabled={trabajando} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">Cancelar</Button>
          <Button onClick={confirmar} disabled={trabajando || !previa || previa.validas === 0} className="bg-[#1e3a5f] hover:bg-[#152a45] text-white">
            {trabajando && previa ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {previa ? `Importar ${previa.validas} fila${previa.validas === 1 ? "" : "s"} válida${previa.validas === 1 ? "" : "s"}` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
