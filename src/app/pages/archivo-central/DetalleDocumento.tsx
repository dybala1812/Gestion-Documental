/**
 * @file DetalleDocumento.tsx
 * @description Archivo Central › Consulta › Archivo › Detalle de un documento.
 * Visor del PDF, ruta en el archivo, ficha de datos y acciones (anular, descargar, editar).
 * Mismo estilo que Comunicaciones › Bandeja. Aún no llama al backend (ver los TODO).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Ban, Download, FileText, FolderOpen, Loader2, Pencil,
} from "lucide-react";
import { apiAnularDocumento } from "../../lib/documentosApi";
import { VisorDocumento, guardarArchivoDescargado, useArchivoDocumento } from "./VisorDocumento";
import { textoBodega, textoUbicacion, useUbicacionesActivas, type UbicacionBodega } from "./UbicacionFisica";

export type TipoDocumento = "Entrada" | "Salida" | "Interno";

export interface DocumentoDetalle {
  consecutivo: string; // "194/2024"
  fecha: string;
  tipo: TipoDocumento | null;
  titulo: string;
  dependencia: string;
  anio: number;
  asunto: string;
  trd: string;
  /** Destinatario (Salida/Interno) o remitente (Entrada). */
  contraparte: string;
  /** Quien envió (Salida/Interno) o quien recibió (Entrada). */
  persona: string;
  caja: string;
  carpeta: string;
  /** Bodega · estante · módulo del catálogo (opcional). */
  ubicacion?: UbicacionBodega | null;
  archivo: string;
  paginas: number;
  origen: string;
  estado: "Clasificado" | "Anulado";
}

const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";
const input =
  "h-8 w-full rounded-md border border-[rgba(30,58,95,0.15)] bg-white px-2 text-sm font-semibold text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

/* ───────────────────── Componente ───────────────────── */
export function DetalleDocumento({ documento, documentoId, archivoId, textoVolver = "Volver al archivo", onVolver, onAbrirCarpeta, onAnulado }: {
  documento: DocumentoDetalle;
  /** Id del documento en la base; sin él (datos de ejemplo) no se puede anular. */
  documentoId?: number;
  /** Id del archivo en el almacenamiento; si viene, se muestra y descarga el PDF real. */
  archivoId?: string;
  textoVolver?: string;
  onVolver: () => void;
  onAbrirCarpeta?: () => void;
  /** Se llama tras anular en el backend (p. ej. para refrescar la lista). */
  onAnulado?: () => void;
}) {
  const archivo = useArchivoDocumento(archivoId);

  const descargar = () => {
    if (!guardarArchivoDescargado(archivo, documento.archivo)) {
      toast.info(archivo.cargando ? "El documento todavía se está cargando" : "Este documento no tiene un archivo disponible");
    }
  };

  const [doc, setDoc] = useState(documento);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({ contraparte: "", persona: "", caja: "", carpeta: "" });
  const [bodegaId, setBodegaId] = useState("");
  const ubicaciones = useUbicacionesActivas();
  const [confirmando, setConfirmando] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);

  const anulado = doc.estado === "Anulado";
  const numero = doc.consecutivo.split("/")[0];
  const entrada = doc.tipo === "Entrada";

  const editar = () => {
    setBorrador({ contraparte: doc.contraparte, persona: doc.persona, caja: doc.caja, carpeta: doc.carpeta });
    setBodegaId(doc.ubicacion ? String(doc.ubicacion.id) : "");
    setEditando(true);
  };
  const guardar = () => {
    // TODO: enviar los cambios al backend (y registrar la auditoría).
    const ubicacion = ubicaciones.find(u => String(u.id) === bodegaId) ?? (bodegaId ? doc.ubicacion : null);
    setDoc(d => ({ ...d, ...borrador, ubicacion }));
    setEditando(false);
    toast.success("Datos actualizados");
  };
  /** Anula en el backend (RF-AC-024): no se elimina, queda marcado como anulado, con motivo y auditado. */
  const anular = async () => {
    const motivo = motivoAnulacion.trim();
    if (!documentoId) {
      toast.info("Este documento es de ejemplo: no se puede anular");
      return;
    }
    if (!motivo) {
      toast.error("Escribe el motivo de la anulación");
      return;
    }
    setAnulando(true);
    try {
      await apiAnularDocumento(documentoId, motivo);
      setDoc(d => ({ ...d, estado: "Anulado" }));
      setConfirmando(false);
      setEditando(false);
      setMotivoAnulacion("");
      toast.success("Documento anulado", { description: "Sigue en el archivo marcado como anulado; la acción quedó en la auditoría." });
      onAnulado?.();
    } catch (e) {
      toast.error("No se pudo anular el documento", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setAnulando(false);
    }
  };

  /** Valor editable cuando se está en modo edición. */
  const editable = (clave: keyof typeof borrador, valor: string) =>
    editando ? (
      <input className={input} value={borrador[clave]} onChange={e => setBorrador(b => ({ ...b, [clave]: e.target.value }))} />
    ) : valor;

  const filas: [string, React.ReactNode][] = [
    ["Consecutivo", `${numero} / ${doc.anio}`],
    ["Tipo", doc.tipo ?? "—"],
    ["Fecha", doc.fecha],
    ["Dependencia", doc.dependencia],
    ["Asunto", doc.asunto],
    [entrada ? "Remitente" : "Destinatario", editable("contraparte", doc.contraparte)],
    [entrada ? "Recibió" : "Envió", editable("persona", doc.persona)],
    ["Código TRD", doc.trd],
    ["Caja", editable("caja", doc.caja)],
    ["Carpeta", editable("carpeta", doc.carpeta)],
    ...(editando && ubicaciones.length > 0
      ? [["Bodega (opcional)", (
          <select className={input} value={bodegaId} onChange={e => setBodegaId(e.target.value)}>
            <option value="">Sin asignar</option>
            {ubicaciones.map(u => <option key={u.id} value={u.id}>{textoBodega(u)}</option>)}
          </select>
        )] as [string, React.ReactNode]]
      : []),
    ["Estado", (
      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        anulado ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}>
        {doc.estado}
      </span>
    )],
    ["Archivo", `${doc.archivo} · ${doc.paginas} pág.`],
    ["Ubicación física", textoUbicacion(doc)],
    ["Origen", doc.origen],
  ];

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm transition-colors hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {textoVolver}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">{doc.tipo ?? "Documento"} · {doc.dependencia}</p>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
              <FileText className="h-6 w-6 text-[#e8740e]" />
              No. {numero} · {doc.fecha}
            </h2>
            <p className="mt-0.5 text-sm text-[#6b7a8d]">{doc.titulo}</p>
          </div>
          <button
            disabled={anulado}
            onClick={() => setConfirmando(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Ban className="h-4 w-4" /> Anular documento
          </button>
        </div>
      </div>

      {confirmando && (
        <div role="alertdialog" aria-label="Confirmar anulación" className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">¿Anular este documento?</p>
          <p className="mt-0.5 text-sm text-red-700">No se elimina: queda marcado como anulado en el archivo, con el motivo y quién lo hizo.</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-bold text-red-800">Motivo de la anulación *</span>
            <textarea
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej.: se cargó en la dependencia equivocada"
              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-[#2c3e50] focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={anular}
              disabled={anulando || !motivoAnulacion.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {anulando && <Loader2 className="h-4 w-4 animate-spin" />} Sí, anular
            </button>
            <button onClick={() => { setConfirmando(false); setMotivoAnulacion(""); }} disabled={anulando} className="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VisorDocumento titulo={doc.archivo} paginas={doc.paginas} archivo={archivo} onDescargar={descargar} sinArchivo={`Vista previa de ${doc.archivo}`} />

        <div className="space-y-4">
          {/* ── Ruta en el archivo ──────────────────────────────────────── */}
          <section className="rounded-xl border border-[#1e3a5f]/20 bg-[#f3ede1]/60 p-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Ruta en el archivo</p>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#1e3a5f]">
              <FolderOpen className="h-4 w-4 shrink-0 text-[#e8740e]" />
              {doc.dependencia} / {doc.anio} / {doc.asunto}
            </p>
            {onAbrirCarpeta && (
              <button
                onClick={onAbrirCarpeta}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
              >
                Abrir carpeta <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </section>

          {/* ── Ficha de datos ──────────────────────────────────────────── */}
          <dl className={`${panel} divide-y divide-[rgba(30,58,95,0.09)] overflow-hidden`}>
            {filas.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] items-center gap-3 px-4 py-2 odd:bg-[#f3ede1]/30">
                <dt className="text-xs text-[#6b7a8d]">{k}</dt>
                <dd className="min-w-0 break-words text-sm font-semibold text-[#2c3e50]">{v}</dd>
              </div>
            ))}
          </dl>

          {/* ── Acciones ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {editando ? (
              <>
                <button onClick={guardar} className="inline-flex h-10 items-center rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90">
                  Guardar cambios
                </button>
                <button onClick={() => setEditando(false)} className="inline-flex h-10 items-center rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={descargar}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                >
                  <Download className="h-4 w-4" /> Descargar archivo
                </button>
                <button
                  disabled={anulado}
                  onClick={editar}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil className="h-4 w-4" /> Editar datos
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}