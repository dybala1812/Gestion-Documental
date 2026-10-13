/**
 * @file DetalleDocumento.tsx
 * @description Archivo Central › Consulta › Archivo › Detalle de un documento.
 * Visor del PDF, ruta en el archivo, ficha de datos y acciones (anular, descargar, editar).
 * Mismo estilo que Comunicaciones › Bandeja. Aún no llama al backend (ver los TODO).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Ban, ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Pencil,
} from "lucide-react";

export type TipoDocumento = "Entrada" | "Salida" | "Interno";

export interface DocumentoDetalle {
  consecutivo: string; // "194/2024"
  fecha: string;
  tipo: TipoDocumento;
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
  archivo: string;
  paginas: number;
  origen: string;
  estado: "Clasificado" | "Anulado";
}

const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";
const input =
  "h-8 w-full rounded-md border border-[rgba(30,58,95,0.15)] bg-white px-2 text-sm font-semibold text-[#2c3e50] focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";

/* ───────────────────── Visor (marcador de posición) ───────────────────── */
function Visor({ archivo, paginas }: { archivo: string; paginas: number }) {
  const [pagina, setPagina] = useState(1);
  return (
    <section className={`${panel} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-4 py-3 text-white">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{archivo}</span>
        <button aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums">{pagina} / {paginas}</span>
        <button aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          aria-label="Descargar PDF"
          onClick={() => toast.info("La descarga estará disponible cuando esté conectado al almacenamiento")}
          className="rounded p-1 hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col bg-[#ede6d8] p-6">
        {/* TODO: reemplazar por el visor del PDF real (por ejemplo un <iframe> con la URL del archivo). */}
        <div className="flex min-h-[460px] flex-1 flex-col items-center justify-center gap-2 rounded bg-white p-6 text-center shadow-sm">
          <FileText className="h-10 w-10 text-[#6b7a8d]" />
          <p className="text-sm font-semibold text-[#2c3e50]">Vista previa de la página {pagina}</p>
          <p className="text-xs text-[#6b7a8d]">Aquí se mostrará el documento cuando esté conectado al almacenamiento.</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Componente ───────────────────── */
export function DetalleDocumento({ documento, onVolver, onAbrirCarpeta }: {
  documento: DocumentoDetalle;
  onVolver: () => void;
  onAbrirCarpeta?: () => void;
}) {
  const [doc, setDoc] = useState(documento);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({ contraparte: "", persona: "", caja: "", carpeta: "" });
  const [confirmando, setConfirmando] = useState(false);

  const anulado = doc.estado === "Anulado";
  const numero = doc.consecutivo.split("/")[0];
  const entrada = doc.tipo === "Entrada";

  const editar = () => {
    setBorrador({ contraparte: doc.contraparte, persona: doc.persona, caja: doc.caja, carpeta: doc.carpeta });
    setEditando(true);
  };
  const guardar = () => {
    // TODO: enviar los cambios al backend (y registrar la auditoría).
    setDoc(d => ({ ...d, ...borrador }));
    setEditando(false);
    toast.success("Datos actualizados");
  };
  const anular = () => {
    // TODO: anular el documento en el backend (no se elimina: queda marcado como anulado y auditado).
    setDoc(d => ({ ...d, estado: "Anulado" }));
    setConfirmando(false);
    setEditando(false);
    toast.success("Documento anulado");
  };

  /** Valor editable cuando se está en modo edición. */
  const editable = (clave: keyof typeof borrador, valor: string) =>
    editando ? (
      <input className={input} value={borrador[clave]} onChange={e => setBorrador(b => ({ ...b, [clave]: e.target.value }))} />
    ) : valor;

  const filas: [string, React.ReactNode][] = [
    ["Consecutivo", `${numero} / ${doc.anio}`],
    ["Tipo", doc.tipo],
    ["Fecha", doc.fecha],
    ["Dependencia", doc.dependencia],
    ["Asunto", doc.asunto],
    [entrada ? "Remitente" : "Destinatario", editable("contraparte", doc.contraparte)],
    [entrada ? "Recibió" : "Envió", editable("persona", doc.persona)],
    ["Código TRD", doc.trd],
    ["Caja", editable("caja", doc.caja)],
    ["Carpeta", editable("carpeta", doc.carpeta)],
    ["Estado", (
      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        anulado ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}>
        {doc.estado}
      </span>
    )],
    ["Archivo", `${doc.archivo} · ${doc.paginas} pág.`],
    ["Ubicación física", `Caja ${doc.caja} · Carpeta ${doc.carpeta}`],
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
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al archivo
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">{doc.tipo} · {doc.dependencia}</p>
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
          <p className="mt-0.5 text-sm text-red-700">No se elimina: queda marcado como anulado en el archivo.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={anular} className="h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:opacity-90">Sí, anular</button>
            <button onClick={() => setConfirmando(false)} className="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-100">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Visor archivo={doc.archivo} paginas={doc.paginas} />

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
                  onClick={() => toast.info("La descarga estará disponible cuando esté conectado al almacenamiento")}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
                >
                  <Download className="h-4 w-4" /> Descargar PDF
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