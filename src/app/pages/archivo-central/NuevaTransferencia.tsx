/**
 * @file NuevaTransferencia.tsx
 * @description Archivo Central › Ingreso › Transferencias › Nueva transferencia.
 * Asistente de 3 pasos:
 *   1. Datos (tipo, dependencia, año, responsable).
 *   2. El Excel que entregó la dependencia, tal cual: queda como acta de entrega (no se lee ni se valida).
 *   3. Física: formulario con el número de cajas, dónde quedó guardada cada una y observaciones (las cajas no se suben).
 *      Digital: cargue masivo de los documentos (se guardan con la transferencia, no pasan a Por clasificar), sin más datos.
 * Regla de los dos años: en 2026 se transfiere hasta 2024; en 2027, hasta 2025.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ActaExcel, DatosCajas, DocumentosDigitales, UbicacionCajas, problemasCaja, type DetalleCaja,
} from "./TransferenciaPaso3";
import { textoPosicion, useUbicacionesActivas, type UbicacionBodega } from "./UbicacionFisica";
import {
  ArrowLeft, ArrowRight, Check, CalendarCheck, CalendarX, Loader2, Save, X,
} from "lucide-react";
import type { TipoEntrega } from "./Transferencias";
import { transferenciasApi } from "../../services/archivoCentralApi";

/* ───────────────────────── Datos de ejemplo (luego, catálogos de la API) ───────────────────────── */
const CONTENIDOS = ["Documentos de gestión", "Historias académicas", "Contratos", "Actas"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIO_MAXIMO = ANIO_ACTUAL - 2; // regla de los dos años
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1989 }, (_, i) => ANIO_ACTUAL - i);

// La base solo tiene "fisica" y "digital" (tipo_transferencia): "Física y digital" no se podía registrar.
const TIPOS: { id: TipoEntrega; label: string }[] = [
  { id: "fisica", label: "Física" },
  { id: "digital", label: "Digital" },
];

const pasosDe = (tipo: TipoEntrega) => [
  { titulo: "Datos", detalle: "Tipo, dependencia y año" },
  { titulo: "Excel", detalle: "El que entregó la dependencia (acta)" },
  tipo === "digital"
    ? { titulo: "Documentos", detalle: "Cargue masivo de archivos" }
    : { titulo: "Cajas", detalle: "Cuántas y dónde quedaron" },
];
const MAX_CAJAS = 2000;

const REQUISITOS = [
  "Ordenada por serie y subserie (asuntos, actas, comunicaciones, circulares)",
  "En orden cronológico, del más antiguo al más reciente",
  "Foliada",
  "Descrita en el inventario por caja y carpeta",
  "Con acta de entrega y rótulos de caja y carpeta",
];

interface Datos {
  dependencia: string; contenido: string; anio: string; responsable: string; ubicacion: string;
}

const campo =
  "h-10 w-full rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-3 text-sm text-[#2c3e50] placeholder:text-[#6b7a8d]/70 focus:border-[#e8740e] focus:outline-none focus:ring-2 focus:ring-[#e8740e]/30";
const panel = "rounded-xl border border-[rgba(30,58,95,0.09)] bg-white shadow-sm";

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#2c3e50]">
        {label}{requerido && <span className="text-[#e8740e]"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function NuevaTransferencia({
  onVolver,
  tipoInicial = "fisica",
}: { onVolver: () => void; tipoInicial?: TipoEntrega }) {
  const [dependencias, setDependencias] = useState<string[]>([]);
  const [registrando, setRegistrando] = useState(false);
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoEntrega>(tipoInicial);
  const [datos, setDatos] = useState<Datos>({
    dependencia: "", contenido: CONTENIDOS[0], anio: String(ANIO_MAXIMO), responsable: "", ubicacion: "",
  });
  /** Acta de entrega: el Excel que entregó la dependencia, tal cual (se sube al registrar). */
  const [acta, setActa] = useState<File | null>(null);
  /** Física: cuántas cajas llegaron y observaciones de la entrega. */
  const [numeroCajas, setNumeroCajas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  /** Física: caja → lo que va en su rótulo (contenido, carpetas, fechas, folios). */
  const [detalleCaja, setDetalleCaja] = useState<Record<string, DetalleCaja>>({});
  /** Física: caja → id de la ubicación donde quedó guardada. */
  const [ubicacionCaja, setUbicacionCaja] = useState<Record<string, string>>({});
  /** Digital: los documentos que entregó la dependencia. */
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [progreso, setProgreso] = useState("");
  const delCatalogo = useUbicacionesActivas();
  const [creadas, setCreadas] = useState<UbicacionBodega[]>([]);
  const ubicaciones = useMemo(
    () => [...delCatalogo, ...creadas.filter(c => !delCatalogo.some(u => u.id === c.id))],
    [delCatalogo, creadas],
  );

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos(d => ({ ...d, [k]: e.target.value }));

  const PASOS = pasosDe(tipo);
  const anioPermitido = Number(datos.anio) <= ANIO_MAXIMO;
  const esFisica = tipo !== "digital";

  // Cajas 1..N según el número de cajas que llegaron.
  const n = Number(numeroCajas);
  const numeroValido = Number.isInteger(n) && n >= 1 && n <= MAX_CAJAS;
  const cajas = useMemo(
    () => (numeroValido ? Array.from({ length: n }, (_, i) => ({ caja: String(i + 1) })) : []),
    [n, numeroValido],
  );
  const cajasSinUbicacion = cajas.filter(c => !ubicacionCaja[c.caja]).length;

  // "Ubicación (carro · estante · bandeja)" del acta y de la transferencia: cada ubicación con sus cajas.
  const ubicacionTexto = useMemo(() => {
    const porUbic = new Map<string, string[]>();
    for (const c of cajas) {
      const u = ubicaciones.find(x => String(x.id) === ubicacionCaja[c.caja]);
      if (u) porUbic.set(textoPosicion(u), [...(porUbic.get(textoPosicion(u)) ?? []), c.caja]);
    }
    return [...porUbic].map(([u, cs]) => `${u} (caja${cs.length > 1 ? "s" : ""} ${cs.join(", ")})`).join("; ");
  }, [cajas, ubicaciones, ubicacionCaja]);

  const puedeContinuar =
    (paso === 1 && !!datos.dependencia && !!datos.responsable.trim() && anioPermitido) ||
    (paso === 2 && !!acta);
  // Último paso: física → cajas con ubicación; digital → al menos un documento.
  const cajasConProblemas = cajas.filter(c => problemasCaja(detalleCaja[c.caja], Number(datos.anio)).length > 0).length;
  const listoParaRegistrar = !!acta && (esFisica
    ? cajas.length > 0 && cajasSinUbicacion === 0 && cajasConProblemas === 0
    : documentos.length > 0);

  // Las dependencias salen de la base de datos (las mismas del módulo de Comunicaciones).
  useEffect(() => {
    transferenciasApi.resumen()
      .then(r => setDependencias(r.dependencias))
      .catch(() => toast.error("No se pudieron cargar las dependencias. ¿Está encendido el backend?"));
  }, []);

  const guardarBorrador = () => {
    // TODO: guardar borradores en el servidor (requiere permitir `codigo` vacío en la tabla transferencia).
    toast.info("Por ahora los borradores no se guardan en el servidor. Registra la transferencia al terminar.");
  };

  const enviar = async () => {
    setRegistrando(true);
    try {
      setProgreso(acta ? "Subiendo el acta de entrega…" : "Registrando…");
      const actaId = acta ? await transferenciasApi.subirActa(acta, Number(datos.anio)) : undefined;
      setProgreso("Registrando la transferencia…");
      const r = await transferenciasApi.crear({
        acta_archivo_id: actaId,
        dependencia: datos.dependencia,
        anio: Number(datos.anio),
        tipo,
        contenido: datos.contenido,
        responsable: datos.responsable.trim(),
        ubicacion: esFisica ? ubicacionTexto : "",
        cajas: esFisica ? cajas.map(c => ({ caja: c.caja, ubicacion_id: Number(ubicacionCaja[c.caja]) })) : undefined,
        observaciones: esFisica ? observaciones.trim() : undefined,
        total_documentos: esFisica ? undefined : documentos.length,
        // El detalle de los documentos está en el Excel (acta). Física: una fila por caja con lo que va en su rótulo.
        carpetas: esFisica
          ? cajas.map(c => {
              const d = detalleCaja[c.caja];
              return {
                caja: c.caja, carpeta: d?.carpetas.trim() ?? "", asunto: d?.contenido.trim() ?? "",
                fechaInicial: d?.fechaInicial || null, fechaFinal: d?.fechaFinal || null,
                folios: Number(d?.folios) || 0, docs: 0, descripcion: d?.contenido.trim() ?? "",
              };
            })
          : [],
      });

      // Digital: ya registrada, se suben uno a uno los documentos (se guardan con la transferencia).
      let subidos = 0, duplicados = 0;
      const fallos: string[] = [];
      if (!esFisica) {
        for (const [i, f] of documentos.entries()) {
          setProgreso(`Subiendo documentos ${i + 1} de ${documentos.length}…`);
          try {
            await transferenciasApi.subirDocumento(r.id, f);
            subidos++;
          } catch (e) {
            if ((e as { status?: number }).status === 409 && /duplicad|ya fue cargado/i.test(String((e as Error).message))) duplicados++;
            else fallos.push(`${f.name}: ${e instanceof Error ? e.message : "error"}`);
          }
        }
      }

      const detalle = [
        !esFisica && `${subidos} documento(s) guardados con la transferencia`,
        duplicados && `${duplicados} ya estaban cargados`,
        fallos.length && `${fallos.length} con error (${fallos[0]}${fallos.length > 1 ? "…" : ""})`,
        r.aviso,
      ].filter(Boolean).join(" · ");
      if (fallos.length || r.aviso) toast.warning(`Transferencia registrada: ${r.codigo}`, { description: detalle });
      else toast.success(`Transferencia registrada: ${r.codigo}`, { description: detalle || undefined });
      onVolver(); // la lista se recarga sola y muestra la nueva
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la transferencia");
    } finally {
      setRegistrando(false);
      setProgreso("");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={onVolver}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.09)] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7a8d] shadow-sm transition-colors hover:bg-[#f3ede1] hover:text-[#1e3a5f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a transferencias
        </button>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#c89b14]">Ingreso · Nueva transferencia</p>
        <h2 className="text-xl font-bold text-[#1e3a5f] sm:text-2xl">
          Transferencia{datos.dependencia ? ` de ${datos.dependencia}` : ""}
        </h2>
        <p className="mt-0.5 text-sm text-[#6b7a8d]">
          Paso {paso} de {PASOS.length}. Debe llegar ordenada por serie y subserie, en orden cronológico, foliada y descrita.
        </p>
      </div>

      {/* ── Pasos ───────────────────────────────────────────────────────── */}
      <ol className={`${panel} grid grid-cols-1 overflow-hidden sm:grid-cols-3`}>
        {PASOS.map((p, i) => {
          const n = i + 1;
          const activo = paso === n;
          const hecho = paso > n;
          return (
            <li key={p.titulo} className={`border-b-[3px] ${activo ? "border-[#e8740e]" : "border-transparent"}`}>
              <button
                type="button"
                disabled={!hecho}
                onClick={() => setPaso(n)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  activo ? "bg-[#1e3a5f] text-white" : hecho ? "bg-emerald-100 text-emerald-700" : "bg-[#ede6d8] text-[#6b7a8d]"
                }`}>
                  {hecho ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${activo ? "text-[#1e3a5f]" : "text-[#2c3e50]"}`}>{p.titulo}</span>
                  <span className="block truncate text-xs text-[#6b7a8d]">{p.detalle}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ── Contenido del paso ──────────────────────────────────────────── */}
      {paso === 1 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className={`${panel} space-y-5 p-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Dependencia que entrega" requerido>
                <select className={campo} value={datos.dependencia} onChange={set("dependencia")}>
                  <option value="">Selecciona…</option>
                  {dependencias.map(d => <option key={d}>{d}</option>)}
                </select>
              </Campo>
              <Campo label="Contenido" requerido>
                <select className={campo} value={datos.contenido} onChange={set("contenido")}>
                  {CONTENIDOS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label="Año que se transfiere" requerido>
                <select className={campo} value={datos.anio} onChange={set("anio")}>
                  {ANIOS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Campo>
              <Campo label="Responsable de la entrega" requerido>
                <input className={campo} placeholder="Nombre completo" value={datos.responsable} onChange={set("responsable")} />
              </Campo>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Tipo de entrega</p>
              <div role="radiogroup" aria-label="Tipo de entrega" className="inline-flex overflow-hidden rounded-lg border border-[rgba(30,58,95,0.15)]">
                {TIPOS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t.id}
                    onClick={() => setTipo(t.id)}
                    className={`h-10 px-4 text-sm font-semibold transition-colors ${
                      tipo === t.id ? "bg-[#1e3a5f] text-white" : "bg-white text-[#2c3e50] hover:bg-[#f3ede1]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="rounded-lg bg-[#f3ede1]/60 px-3 py-2 text-xs text-[#2c3e50]">
              {esFisica
                ? <>La dependencia entrega el <strong>Excel</strong> con la descripción de los documentos y las <strong>cajas</strong>. Las cajas no se suben: en el paso 3 registras dónde quedó guardada cada una.</>
                : <>La dependencia entrega el <strong>Excel</strong> con la descripción de los documentos y los <strong>documentos</strong> en digital. En el paso 3 los subes.</>}
            </p>
          </section>

          <div className="space-y-5">
            {/* Regla de los dos años */}
            <div
              role="status"
              className={`rounded-xl border-2 px-5 py-4 ${
                anioPermitido ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-bold">
                {anioPermitido ? <CalendarCheck className="h-4 w-4" /> : <CalendarX className="h-4 w-4" />}
                {anioPermitido ? `Año ${datos.anio} permitido` : `Año ${datos.anio} aún no se puede transferir`}
              </p>
              <p className="mt-1 text-xs">
                Regla de los dos años: en {ANIO_ACTUAL} se transfiere hasta {ANIO_MAXIMO}; en {ANIO_ACTUAL + 1}, hasta {ANIO_MAXIMO + 1}.
              </p>
            </div>

            {/* Requisitos */}
            <div className="rounded-xl border-2 border-[#1e3a5f] bg-white p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">La transferencia debe llegar</p>
              <ol className="divide-y divide-[rgba(30,58,95,0.09)]">
                {REQUISITOS.map((r, i) => (
                  <li key={r} className="flex gap-3 py-2 text-sm text-[#2c3e50]">
                    <span className="w-4 shrink-0 font-bold text-[#c89b14]">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {paso === 2 && <ActaExcel archivo={acta} onArchivo={setActa} />}

      {paso === 3 && esFisica && (
        <DatosCajas numero={numeroCajas} onNumero={setNumeroCajas} observaciones={observaciones} onObservaciones={setObservaciones}>
          {numeroValido ? (
            <UbicacionCajas
              cajas={cajas}
              valor={ubicacionCaja}
              onChange={setUbicacionCaja}
              ubicaciones={ubicaciones}
              onNuevaUbicacion={u => setCreadas(c => [...c, u])}
              detalle={detalleCaja}
              onDetalle={setDetalleCaja}
              anio={Number(datos.anio)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-[rgba(30,58,95,0.2)] bg-white px-5 py-6 text-center text-sm text-[#6b7a8d]">
              Escribe el número de cajas (de 1 a {MAX_CAJAS}) para registrar dónde quedó guardada cada una.
            </p>
          )}
        </DatosCajas>
      )}

      {paso === 3 && !esFisica && <DocumentosDigitales archivos={documentos} onChange={setDocumentos} />}

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(30,58,95,0.09)] pt-4">
        <div className="flex gap-2">
          {paso > 1 && (
            <button
              onClick={() => setPaso(p => p - 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
            >
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          )}
          {paso < PASOS.length ? (
            <button
              disabled={!puedeContinuar}
              onClick={() => setPaso(p => p + 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={enviar}
              disabled={registrando || !listoParaRegistrar}
              title={listoParaRegistrar ? undefined : esFisica ? "Falta el número de cajas, la ubicación de alguna o revisar sus fechas y folios" : "Sube al menos un documento"}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registrando && <Loader2 className="h-4 w-4 animate-spin" />}
              {registrando && progreso ? progreso : "Registrar transferencia"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={guardarBorrador}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(30,58,95,0.15)] bg-white px-4 text-sm font-semibold text-[#1e3a5f] hover:bg-[#f3ede1]"
          >
            <Save className="h-4 w-4" /> Guardar borrador y salir
          </button>
          <button
            onClick={onVolver}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <X className="h-4 w-4" /> Cancelar transferencia
          </button>
        </div>
      </div>
    </div>
  );
}