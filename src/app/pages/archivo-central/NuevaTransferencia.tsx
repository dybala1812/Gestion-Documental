/**
 * @file NuevaTransferencia.tsx
 * @description Archivo Central › Ingreso › Transferencias › Nueva transferencia.
 * Asistente de 3 pasos (según mockup): Datos → Inventario FUID → Revisión y acta.
 * Por ahora el paso 1 está completo; los pasos 2 y 3 son estructura base (ver TODO).
 * Regla de los dos años: en 2026 se transfiere hasta 2024; en 2027, hasta 2025.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FuidInventario, resumenFuid, type FilaFuid } from "./FuidInventario";
import { RevisionActa } from "./RevisionActa";
import { useAuth } from "../../context/AuthContext";
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

const TIPOS: { id: TipoEntrega; label: string }[] = [
  { id: "fisica", label: "Física" },
  { id: "digital", label: "Digital" },
  { id: "ambas", label: "Física y digital" },
];

const PASOS = [
  { titulo: "Datos", detalle: "Tipo, dependencia y año" },
  { titulo: "Inventario FUID", detalle: "Excel con validación" },
  { titulo: "Revisión y acta", detalle: "Cajas, carpetas, folios" },
];

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
  const { usuario } = useAuth();
  const recibe = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Archivo Central";
  const [dependencias, setDependencias] = useState<string[]>([]);
  const [registrando, setRegistrando] = useState(false);
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoEntrega>(tipoInicial);
  const [datos, setDatos] = useState<Datos>({
    dependencia: "", contenido: CONTENIDOS[0], anio: String(ANIO_MAXIMO), responsable: "", ubicacion: "",
  });
  const [filas, setFilas] = useState<FilaFuid[]>([]);
  const [fuidNombre, setFuidNombre] = useState("");

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos(d => ({ ...d, [k]: e.target.value }));

  const anioPermitido = Number(datos.anio) <= ANIO_MAXIMO;
  const pideUbicacion = tipo === "fisica" || tipo === "ambas";
  const fuid = resumenFuid(filas, Number(datos.anio));

  const puedeContinuar =
    (paso === 1 && !!datos.dependencia && !!datos.responsable.trim() && anioPermitido && (!pideUbicacion || !!datos.ubicacion.trim())) ||
    (paso === 2 && filas.length > 0 && fuid.errores === 0) ||
    paso === 3;

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
      const r = await transferenciasApi.crear({
        dependencia: datos.dependencia,
        anio: Number(datos.anio),
        tipo,
        contenido: datos.contenido,
        responsable: datos.responsable.trim(),
        ubicacion: pideUbicacion ? datos.ubicacion.trim() : "",
        carpetas: filas.map(f => ({
          caja: f.caja.trim(), carpeta: f.carpeta.trim(), asunto: f.asunto.trim(),
          fechaInicial: f.fechaInicial, fechaFinal: f.fechaFinal,
          folios: Number(f.folios), docs: Number(f.docs), descripcion: f.descripcion.trim(),
        })),
      });
      toast.success(`Transferencia registrada: ${r.codigo}`);
      onVolver(); // la lista se recarga sola y muestra la nueva
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la transferencia");
    } finally {
      setRegistrando(false);
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

            {pideUbicacion && (
              <Campo label="Ubicación física en Archivo Central" requerido>
                <input
                  className={campo}
                  placeholder="Ej. Depósito 2 · Estante 4 (si se conoce)"
                  value={datos.ubicacion}
                  onChange={set("ubicacion")}
                />
              </Campo>
            )}
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

      {paso === 2 && (
        <FuidInventario
          filas={filas}
          nombreArchivo={fuidNombre}
          anio={Number(datos.anio)}
          onFilas={setFilas}
          onNombreArchivo={setFuidNombre}
        />
      )}

      {paso === 3 && (
        <RevisionActa
          datos={datos}
          tipo={tipo}
          filas={filas}
          codigo={`TR-${ANIO_ACTUAL}-___`} // el código definitivo lo asigna el servidor al registrar
          recibe={recibe}
        />
      )}

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
              disabled={registrando}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e8740e] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registrando && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar transferencia
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