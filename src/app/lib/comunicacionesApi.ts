/**
 * @file comunicacionesApi.ts
 * @description Capa de datos del módulo Comunicaciones (Archivo Central · SGD).
 *
 * ⚠️ POR AHORA USA DATOS SIMULADOS EN MEMORIA. Los tipos replican las tablas de
 * la base de datos (backned_sistema_gestion_documental/supabase/migrations/
 * 20261007000400_comunicaciones.sql), así que al conectar el backend solo hay
 * que reemplazar el cuerpo de las funciones `api*` por llamadas HTTP.
 *
 * Reglas que respeta el simulador (las mismas que impone la base):
 *  - Estados: nueva → remitida → respondida_dependencia (↺ devuelta) → cerrada; anulada.
 *  - Solo se cierra al enviar la respuesta al remitente (crea la salida SAL).
 *  - Anular exige motivo. No hay borrado.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoComunicacion = "ENT" | "SAL" | "INT";

export type EstadoComunicacion =
  | "nueva"
  | "remitida"
  | "respondida_dependencia"
  | "devuelta"
  | "cerrada"
  | "anulada";

export type TipoEvento =
  | "recepcion"
  | "acuse_recibo"
  | "remision"
  | "respuesta_dependencia"
  | "devolucion"
  | "respuesta_remitente"
  | "recordatorio"
  | "marcada_escalar"
  | "asociacion_manual"
  | "anulacion"
  | "nota"
  | "error_envio";

export interface DependenciaCom {
  id: number;
  codigo: string;
  nombre: string;
  correo_oficial: string;
}

export interface AdjuntoCom {
  archivo_id: string;
  nombre_original: string;
  tamano_bytes: number;
  mime: string;
  /** Si viene de la respuesta de la dependencia. */
  de_respuesta?: boolean;
}

export interface EventoCom {
  id: number;
  tipo: TipoEvento;
  estado_anterior?: EstadoComunicacion | null;
  estado_nuevo?: EstadoComunicacion | null;
  dependencia?: string | null;
  usuario?: string | null;
  detalle?: string | null;
  creado_en: string;
}

export interface Comunicacion {
  id: number;
  tipo: TipoComunicacion;
  consecutivo: string;
  consecutivo_original?: string | null;
  origen: "correo" | "manual" | "historico";
  estado: EstadoComunicacion;
  remitente_nombre: string | null;
  remitente_correo: string | null;
  destinatario_nombre?: string | null;
  destinatario_correo?: string | null;
  asunto: string;
  cuerpo: string | null;
  fecha_recepcion: string;
  dependencia_id: number | null;
  fecha_limite: string | null;
  comunicacion_entrada_id?: number | null;
  n_recordatorios: number;
  por_escalar: boolean;
  anulado_motivo?: string | null;
  cerrado_en?: string | null;
  adjuntos: AdjuntoCom[];
  eventos: EventoCom[];
}

export interface CorreoSinAsociar {
  id: number;
  message_id: string;
  de_nombre: string | null;
  de_correo: string;
  asunto: string | null;
  cuerpo: string | null;
  recibido_en: string;
  motivo: "sin_etiqueta" | "etiqueta_no_coincide" | "remitente_externo_sin_etiqueta" | "otro";
  posible_comunicacion_id: number | null;
  adjuntos: AdjuntoCom[];
  resuelto: boolean;
  resuelto_como?: "asociado" | "nueva" | null;
  comunicacion_id?: number | null;
}

export interface ResumenMesHistorico {
  mes: number; // 1-12
  cerradas_sistema: number;
  importadas: number;
}

// ── Etiquetas y colores (paleta de NOVA, Tailwind) ──────────────────────────

export const ESTADO_LABEL: Record<EstadoComunicacion, string> = {
  nueva: "Nueva",
  remitida: "Remitida",
  respondida_dependencia: "Respondida",
  devuelta: "Devuelta",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const ESTADO_BADGE: Record<EstadoComunicacion, string> = {
  nueva: "bg-blue-50 text-blue-700 border-blue-200",
  remitida: "bg-amber-50 text-amber-700 border-amber-200",
  respondida_dependencia: "bg-violet-50 text-violet-700 border-violet-200",
  devuelta: "bg-rose-50 text-rose-700 border-rose-200",
  cerrada: "bg-green-50 text-green-700 border-green-200",
  anulada: "bg-gray-100 text-gray-500 border-gray-200",
};

export const TIPO_LABEL: Record<TipoComunicacion, string> = {
  ENT: "Entrada",
  SAL: "Salida",
  INT: "Interno",
};

export const EVENTO_LABEL: Record<TipoEvento, string> = {
  recepcion: "Recibida por correo",
  acuse_recibo: "Acuse de recibo enviado",
  remision: "Remitida a dependencia",
  respuesta_dependencia: "Respuesta de la dependencia",
  devolucion: "Devuelta a la dependencia",
  respuesta_remitente: "Respuesta enviada al remitente",
  recordatorio: "Recordatorio enviado",
  marcada_escalar: "Marcada para escalar",
  asociacion_manual: "Asociada manualmente",
  anulacion: "Anulada",
  nota: "Nota",
  error_envio: "Error de envío",
};

export const MOTIVO_SIN_ASOCIAR_LABEL: Record<CorreoSinAsociar["motivo"], string> = {
  sin_etiqueta: "Sin etiqueta en el asunto",
  etiqueta_no_coincide: "La etiqueta no coincide",
  remitente_externo_sin_etiqueta: "Remitente externo sin etiqueta",
  otro: "Otro",
};

/** Transiciones válidas (RN-AC-09). */
export const TRANSICIONES: Record<EstadoComunicacion, EstadoComunicacion[]> = {
  nueva: ["remitida", "anulada"],
  remitida: ["respondida_dependencia", "anulada"],
  respondida_dependencia: ["devuelta", "cerrada", "anulada"],
  devuelta: ["respondida_dependencia", "anulada"],
  cerrada: [],
  anulada: [],
};

export const PLAZO_DEFECTO_DIAS_HABILES = 5;
export const ALERTA_DIAS_SIN_RESPUESTA = 5;

// ── Utilidades de fecha ─────────────────────────────────────────────────────

function esDiaHabil(d: Date) {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6; // festivos: los aporta el backend (dia_festivo)
}

/** Fecha local en formato AAAA-MM-DD (sin pasar por UTC). */
export function fechaLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Interpreta "AAAA-MM-DD" como fecha local (new Date() la tomaría como UTC). */
function parseFecha(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const f = new Date(desde);
  let n = 0;
  while (n < dias) {
    f.setDate(f.getDate() + 1);
    if (esDiaHabil(f)) n++;
  }
  return f;
}

export function diasDesde(fechaIso: string): number {
  const ms = Date.now() - new Date(fechaIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function estaVencida(c: Comunicacion): boolean {
  return (c.estado === "remitida" || c.estado === "devuelta") && !!c.fecha_limite && parseFecha(c.fecha_limite) < new Date(new Date().toDateString());
}

/** Días desde la última remisión (para la alerta "remitidas sin respuesta"). */
export function diasRemitida(c: Comunicacion): number | null {
  if (c.estado !== "remitida" && c.estado !== "devuelta") return null;
  const ev = [...c.eventos].reverse().find(e => e.tipo === "remision" || e.tipo === "devolucion");
  return ev ? diasDesde(ev.creado_en) : null;
}

export function formatoFecha(iso: string, conHora = false): string {
  const d = parseFecha(iso);
  return d.toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Datos simulados ─────────────────────────────────────────────────────────

const hoy = new Date();
const haceDias = (n: number, h = 9) => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - n);
  d.setHours(h, 15, 0, 0);
  return d.toISOString();
};
const anio = hoy.getFullYear();
const cons = (tipo: TipoComunicacion, n: number) => `${tipo}-${anio}-${String(n).padStart(6, "0")}`;

const DEPENDENCIAS: DependenciaCom[] = [
  { id: 1, codigo: "100", nombre: "Rectoría", correo_oficial: "rectoria@uniautonoma.edu.co" },
  { id: 2, codigo: "110", nombre: "Secretaría General", correo_oficial: "secretaria.general@uniautonoma.edu.co" },
  { id: 3, codigo: "120", nombre: "Mercadeo", correo_oficial: "mercadeo@uniautonoma.edu.co" },
  { id: 4, codigo: "130", nombre: "Dirección Administrativa", correo_oficial: "direccion.administrativa@uniautonoma.edu.co" },
  { id: 5, codigo: "140", nombre: "Gestión Documental", correo_oficial: "gestion.documental@uniautonoma.edu.co" },
  { id: 6, codigo: "150", nombre: "Registro Académico", correo_oficial: "registro.academico@uniautonoma.edu.co" },
  { id: 7, codigo: "160", nombre: "Talento Humano", correo_oficial: "talento.humano@uniautonoma.edu.co" },
  { id: 8, codigo: "170", nombre: "Financiera", correo_oficial: "financiera@uniautonoma.edu.co" },
  { id: 9, codigo: "180", nombre: "Bienestar Universitario", correo_oficial: "bienestar.universitario@uniautonoma.edu.co" },
];

const pdf = (nombre: string, kb = 240, de_respuesta = false): AdjuntoCom => ({
  archivo_id: crypto.randomUUID(),
  nombre_original: nombre,
  tamano_bytes: kb * 1024,
  mime: "application/pdf",
  de_respuesta,
});

let seqEvento = 1;
const ev = (tipo: TipoEvento, creado_en: string, extra: Partial<EventoCom> = {}): EventoCom => ({
  id: seqEvento++, tipo, creado_en, usuario: extra.usuario ?? null, ...extra,
});

function base(
  id: number, n: number, nombre: string, correo: string, asunto: string, dias: number,
  extra: Partial<Comunicacion> = {},
): Comunicacion {
  const recibida = haceDias(dias, 8 + (id % 8));
  return {
    id, tipo: "ENT", consecutivo: cons("ENT", n), origen: "correo", estado: "nueva",
    remitente_nombre: nombre, remitente_correo: correo, asunto,
    cuerpo: `Buenos días.\n\nPor medio del presente me permito solicitar: ${asunto.toLowerCase()}.\n\nQuedo atento(a) a su respuesta.\n\nCordialmente,\n${nombre}`,
    fecha_recepcion: recibida, dependencia_id: null, fecha_limite: null,
    n_recordatorios: 0, por_escalar: false, adjuntos: [],
    eventos: [ev("recepcion", recibida, { estado_nuevo: "nueva", detalle: "Registrada por n8n" }),
              ev("acuse_recibo", recibida, { detalle: "Acuse enviado al remitente" })],
    ...extra,
  };
}

function remitida(c: Comunicacion, depId: number, diasRemision: number, plazo = PLAZO_DEFECTO_DIAS_HABILES): Comunicacion {
  const f = haceDias(diasRemision, 10);
  const dep = DEPENDENCIAS.find(d => d.id === depId)!;
  c.estado = "remitida";
  c.dependencia_id = depId;
  c.fecha_limite = fechaLocalISO(sumarDiasHabiles(new Date(f), plazo));
  c.eventos.push(ev("remision", f, { estado_anterior: "nueva", estado_nuevo: "remitida", dependencia: dep.nombre, usuario: "Diana Paz", detalle: `Plazo: ${plazo} días hábiles` }));
  return c;
}

function respondida(c: Comunicacion, diasResp: number, adjunto: string): Comunicacion {
  const f = haceDias(diasResp, 15);
  const dep = DEPENDENCIAS.find(d => d.id === c.dependencia_id)!;
  c.estado = "respondida_dependencia";
  c.adjuntos.push(pdf(adjunto, 180, true));
  c.eventos.push(ev("respuesta_dependencia", f, { estado_anterior: "remitida", estado_nuevo: "respondida_dependencia", dependencia: dep.nombre, detalle: `Adjunto: ${adjunto}` }));
  return c;
}

function cerrada(c: Comunicacion, diasCierre: number): Comunicacion {
  const f = haceDias(diasCierre, 11);
  c.estado = "cerrada";
  c.cerrado_en = f;
  c.eventos.push(ev("respuesta_remitente", f, { estado_anterior: "respondida_dependencia", estado_nuevo: "cerrada", usuario: "Diana Paz", detalle: "Respuesta enviada al remitente" }));
  return c;
}

const est = (n: string) => `${n}@estudiantes.uniautonoma.edu.co`;

let comunicaciones: Comunicacion[] = [
  // Nuevas
  base(1, 1377, "Manuela Collazos", est("manuela.collazos"), "Financiación de matrícula", 0, { adjuntos: [pdf("Recibo de matrícula.pdf"), pdf("Carta de solicitud.pdf"), pdf("Certificado de ingresos.pdf")] }),
  base(2, 1376, "Sebastián Dorado", est("sebastian.dorado"), "Beca por rendimiento académico", 0, { adjuntos: [pdf("Certificado de notas.pdf")] }),
  base(3, 1375, "Laura Muñoz Paz", est("laura.munoz"), "Solicitud de paz y salvo", 0),
  base(4, 1374, "Daniela Chicangana", est("daniela.chicangana"), "Apoyo psicológico", 1, { adjuntos: [pdf("Formato de remisión.pdf"), pdf("Carta.pdf")] }),
  base(5, 1373, "Juan Camilo Rengifo", est("juan.camilo"), "Homologación de asignaturas", 1, { adjuntos: [pdf("Contenido programático 1.pdf"), pdf("Contenido programático 2.pdf"), pdf("Notas.pdf")] }),
  base(6, 1372, "Óscar Iván Pito", est("oscar.ivan"), "Certificado laboral de exfuncionario", 1, { adjuntos: [pdf("Cédula.pdf")] }),
  base(7, 1370, "Natalia Quilindo", est("natalia.quilindo"), "Aplazamiento de semestre", 2, { adjuntos: [pdf("Solicitud.pdf"), pdf("Soporte médico.pdf"), pdf("Recibo.pdf")] }),
  base(8, 1368, "Luisa Fernanda Ante", est("luisa.fernanda"), "Solicitud de certificado de notas", 3, { adjuntos: [pdf("Solicitud.pdf"), pdf("Comprobante de pago.pdf")] }),
  // Remitidas (algunas vencidas / sin respuesta hace ≥ 5 días)
  remitida(base(9, 1352, "Andrés Chicangana", est("andres.chicangana"), "Devolución de matrícula", 18, { adjuntos: [pdf("Solicitud de devolución.pdf")] }), 8, 14),
  remitida(base(10, 1355, "Camila Daza", est("camila.daza"), "Copia de resolución de grado", 15), 1, 11),
  remitida(base(11, 1357, "Isabella Daza", est("isabella.daza"), "Copia del acta de consejo", 12, { adjuntos: [pdf("Solicitud.pdf")] }), 2, 8),
  remitida(base(12, 1359, "Santiago Astudillo", est("santiago.astudillo"), "Certificado de estudios", 10), 6, 7),
  remitida(base(13, 1360, "María José Cerón", est("maria.ceron"), "Constancia de matrícula", 9), 6, 6),
  remitida(base(14, 1362, "Julián Bolaños", est("julian.bolanos"), "Uso de imagen institucional", 8), 3, 5),
  remitida(base(15, 1366, "Sara Cerón", est("sara.ceron"), "Descuento por hermanos", 4, { adjuntos: [pdf("Registro civil.pdf")] }), 8, 2),
  // Respondidas por la dependencia
  respondida(remitida(base(16, 1369, "Valentina Ordóñez", est("valentina.ordonez"), "Solicitud de certificado de notas", 6, { adjuntos: [pdf("Solicitud.pdf")] }), 6, 2), 0, "Certificado de notas.pdf"),
  respondida(remitida(base(17, 1363, "Esteban Guzmán", est("esteban.guzman"), "Reintegro académico", 9), 6, 7), 3, "Concepto de reintegro.pdf"),
  // Devuelta
  (() => {
    const c = respondida(remitida(base(18, 1358, "Camila Guzmán", est("camila.guzman"), "Reliquidación de matrícula", 13), 8, 10), 6, "Respuesta parcial.pdf");
    c.estado = "devuelta";
    c.eventos.push(ev("devolucion", haceDias(4, 9), { estado_anterior: "respondida_dependencia", estado_nuevo: "devuelta", dependencia: "Financiera", usuario: "Diana Paz", detalle: "Falta el valor reliquidado" }));
    return c;
  })(),
  // Cerradas
  cerrada(respondida(remitida(base(19, 1354, "Luisa Fernanda Ante", est("luisa.fernanda"), "Copia del acta de grado", 13), 2, 12), 9, "Acta de grado.pdf"), 8),
  cerrada(respondida(remitida(base(20, 1350, "Natalia Guzmán", est("natalia.guzman"), "Certificado de egresado", 20), 6, 19), 16, "Certificado.pdf"), 15),
  cerrada(respondida(remitida(base(21, 1345, "Andrés Muñoz", est("andres.munoz"), "Carné estudiantil", 25), 9, 24), 20, "Respuesta Bienestar.pdf"), 19),
  // Anulada
  (() => {
    const c = base(22, 1361, "Feria Educativa del Cauca", "eventos@feriaeducativacauca.org", "Publicidad feria 2026", 9);
    c.estado = "anulada";
    c.anulado_motivo = "Correo publicitario, no es una comunicación oficial";
    c.eventos.push(ev("anulacion", haceDias(9, 12), { estado_anterior: "nueva", estado_nuevo: "anulada", usuario: "Diana Paz", detalle: c.anulado_motivo }));
    return c;
  })(),
];

let siguienteNumero: Record<TipoComunicacion, number> = { ENT: 1378, SAL: 201, INT: 231 };
let siguienteId = 100;

let correosSinAsociar: CorreoSinAsociar[] = [
  {
    id: 1, message_id: "<sa-1@mail>", de_nombre: "Jorge Imbachí · Registro Académico", de_correo: "registro.academico@uniautonoma.edu.co",
    asunto: "RE: Solicitud de certificado de notas", recibido_en: haceDias(0, 8),
    cuerpo: "Buenos días.\n\nAdjuntamos el certificado de notas solicitado por Valentina Ordóñez, firmado digitalmente.\n\nCordialmente,\nRegistro Académico",
    motivo: "sin_etiqueta", posible_comunicacion_id: 16, adjuntos: [pdf("Certificado de notas.pdf", 210)], resuelto: false,
  },
  {
    id: 2, message_id: "<sa-2@mail>", de_nombre: "Hernán Velasco · Financiera", de_correo: "financiera@uniautonoma.edu.co",
    asunto: "Respuesta devolución de matrícula", recibido_en: haceDias(1, 16),
    cuerpo: "Cordial saludo.\n\nSe aprueba la devolución del 80% del valor de la matrícula. Adjuntamos la resolución y el comprobante.\n\nFinanciera",
    motivo: "sin_etiqueta", posible_comunicacion_id: 9, adjuntos: [pdf("Resolución devolución.pdf"), pdf("Comprobante.pdf")], resuelto: false,
  },
  {
    id: 3, message_id: "<sa-3@mail>", de_nombre: "Mónica Erazo · Bienestar Universitario", de_correo: "bienestar.universitario@uniautonoma.edu.co",
    asunto: `RE: [SGD ENT-${anio}-001299] Apoyo psicológico`, recibido_en: haceDias(1, 11),
    cuerpo: "La estudiante fue contactada y tiene cita asignada para el próximo lunes.",
    motivo: "etiqueta_no_coincide", posible_comunicacion_id: 4, adjuntos: [], resuelto: false,
  },
  {
    id: 4, message_id: "<sa-4@mail>", de_nombre: "Feria Educativa del Cauca", de_correo: "eventos@feriaeducativacauca.org",
    asunto: "Invitación a la Feria Universitaria 2026", recibido_en: haceDias(2, 10),
    cuerpo: "Invitamos a la Universidad Autónoma a participar en la Feria Universitaria 2026.",
    motivo: "remitente_externo_sin_etiqueta", posible_comunicacion_id: null, adjuntos: [pdf("Invitación.pdf", 520)], resuelto: false,
  },
];

// Histórico: totales por mes del año actual y de los anteriores (importados de Excel antes de 2026).
function resumenHistorico(year: number): ResumenMesHistorico[] {
  const mesActual = hoy.getMonth() + 1;
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    if (year === anio && mes > mesActual) return { mes, cerradas_sistema: -1, importadas: -1 }; // aún no llega
    const semilla = (year * 13 + mes * 7) % 17;
    if (year === anio) {
      const cerradasMes = comunicaciones.filter(c => c.estado === "cerrada" && c.cerrado_en && new Date(c.cerrado_en).getMonth() + 1 === mes).length;
      return { mes, cerradas_sistema: cerradasMes + (mes < mesActual ? 2 + (semilla % 4) : 0), importadas: mes <= 3 ? 38 + semilla : 0 };
    }
    return { mes, cerradas_sistema: 0, importadas: 30 + semilla * 2 };
  });
}

const delay = (ms = 250) => new Promise(r => setTimeout(r, ms));
const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ── API (simulada) ──────────────────────────────────────────────────────────

export async function apiListDependenciasCom(): Promise<DependenciaCom[]> {
  await delay(100);
  return clonar(DEPENDENCIAS);
}

export async function apiListComunicaciones(): Promise<Comunicacion[]> {
  await delay();
  return clonar([...comunicaciones].sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion)));
}

function actualizar(id: number, fn: (c: Comunicacion) => void): Comunicacion {
  const c = comunicaciones.find(x => x.id === id);
  if (!c) throw new Error("Comunicación no encontrada");
  fn(c);
  return clonar(c);
}

function exigirTransicion(c: Comunicacion, hacia: EstadoComunicacion) {
  if (!TRANSICIONES[c.estado].includes(hacia)) {
    throw new Error(`No se puede pasar de "${ESTADO_LABEL[c.estado]}" a "${ESTADO_LABEL[hacia]}"`);
  }
}

/** F2 · Remitir a una dependencia con plazo en días hábiles. */
export async function apiRemitirComunicacion(
  id: number, payload: { dependencia_id: number; plazo_dias_habiles: number; mensaje: string; adjuntos: string[] },
  usuario: string,
): Promise<Comunicacion> {
  await delay();
  return actualizar(id, c => {
    exigirTransicion(c, "remitida");
    const dep = DEPENDENCIAS.find(d => d.id === payload.dependencia_id);
    if (!dep) throw new Error("Dependencia no válida");
    c.estado = "remitida";
    c.dependencia_id = dep.id;
    c.fecha_limite = fechaLocalISO(sumarDiasHabiles(new Date(), payload.plazo_dias_habiles));
    c.n_recordatorios = 0;
    c.por_escalar = false;
    c.eventos.push(ev("remision", new Date().toISOString(), {
      estado_anterior: "nueva", estado_nuevo: "remitida", dependencia: dep.nombre, usuario,
      detalle: `Plazo: ${payload.plazo_dias_habiles} días hábiles · ${payload.adjuntos.length} adjunto(s)${payload.mensaje ? ` · "${payload.mensaje}"` : ""}`,
    }));
  });
}

/** F2 · Devolver a la dependencia (respuesta incompleta). */
export async function apiDevolverComunicacion(id: number, motivo: string, usuario: string): Promise<Comunicacion> {
  await delay();
  return actualizar(id, c => {
    exigirTransicion(c, "devuelta");
    const dep = DEPENDENCIAS.find(d => d.id === c.dependencia_id);
    c.estado = "devuelta";
    c.fecha_limite = fechaLocalISO(sumarDiasHabiles(new Date(), PLAZO_DEFECTO_DIAS_HABILES));
    c.eventos.push(ev("devolucion", new Date().toISOString(), {
      estado_anterior: "respondida_dependencia", estado_nuevo: "devuelta", dependencia: dep?.nombre, usuario, detalle: motivo,
    }));
  });
}

/** F3 · Enviar respuesta al remitente: crea la salida SAL y cierra la entrada. */
export async function apiResponderRemitente(
  id: number, payload: { asunto: string; cuerpo: string; adjuntos: string[] }, usuario: string,
): Promise<{ entrada: Comunicacion; salida: Comunicacion }> {
  await delay(400);
  const entrada = comunicaciones.find(x => x.id === id);
  if (!entrada) throw new Error("Comunicación no encontrada");
  exigirTransicion(entrada, "cerrada");
  const ahora = new Date().toISOString();
  const salida: Comunicacion = {
    id: siguienteId++, tipo: "SAL", consecutivo: cons("SAL", siguienteNumero.SAL++), origen: "correo", estado: "cerrada",
    remitente_nombre: "Archivo Central", remitente_correo: "correspondencia@uniautonoma.edu.co",
    destinatario_nombre: entrada.remitente_nombre, destinatario_correo: entrada.remitente_correo,
    asunto: payload.asunto, cuerpo: payload.cuerpo, fecha_recepcion: ahora, dependencia_id: entrada.dependencia_id,
    fecha_limite: null, comunicacion_entrada_id: entrada.id, n_recordatorios: 0, por_escalar: false, cerrado_en: ahora,
    adjuntos: entrada.adjuntos.filter(a => payload.adjuntos.includes(a.archivo_id)),
    eventos: [ev("respuesta_remitente", ahora, { estado_nuevo: "cerrada", usuario, detalle: `Respuesta a ${entrada.consecutivo}` })],
  };
  comunicaciones.push(salida);
  entrada.estado = "cerrada";
  entrada.cerrado_en = ahora;
  entrada.eventos.push(ev("respuesta_remitente", ahora, {
    estado_anterior: "respondida_dependencia", estado_nuevo: "cerrada", usuario, detalle: `Salida ${salida.consecutivo}`,
  }));
  return { entrada: clonar(entrada), salida: clonar(salida) };
}

/** Anular con motivo (RF-AC-024). */
export async function apiAnularComunicacion(id: number, motivo: string, usuario: string): Promise<Comunicacion> {
  await delay();
  if (!motivo.trim()) throw new Error("El motivo es obligatorio");
  return actualizar(id, c => {
    exigirTransicion(c, "anulada");
    const anterior = c.estado;
    c.estado = "anulada";
    c.anulado_motivo = motivo;
    c.eventos.push(ev("anulacion", new Date().toISOString(), { estado_anterior: anterior, estado_nuevo: "anulada", usuario, detalle: motivo }));
  });
}

export async function apiListCorreosSinAsociar(): Promise<CorreoSinAsociar[]> {
  await delay();
  return clonar(correosSinAsociar.filter(c => !c.resuelto));
}

/** Asociar un correo sin asociar como respuesta de una comunicación remitida/devuelta. */
export async function apiAsociarCorreo(correoId: number, comunicacionId: number, usuario: string): Promise<Comunicacion> {
  await delay();
  const correo = correosSinAsociar.find(c => c.id === correoId);
  if (!correo) throw new Error("Correo no encontrado");
  const com = actualizar(comunicacionId, c => {
    exigirTransicion(c, "respondida_dependencia");
    const anterior = c.estado;
    c.estado = "respondida_dependencia";
    c.adjuntos.push(...correo.adjuntos.map(a => ({ ...a, de_respuesta: true })));
    c.eventos.push(ev("asociacion_manual", new Date().toISOString(), { usuario, detalle: `Correo de ${correo.de_correo} asociado manualmente` }));
    c.eventos.push(ev("respuesta_dependencia", new Date().toISOString(), { estado_anterior: anterior, estado_nuevo: "respondida_dependencia", detalle: correo.asunto }));
  });
  correo.resuelto = true;
  correo.resuelto_como = "asociado";
  correo.comunicacion_id = comunicacionId;
  return com;
}

/** Crear una comunicación nueva a partir de un correo sin asociar. */
export async function apiCrearDesdeCorreo(correoId: number, usuario: string): Promise<Comunicacion> {
  await delay();
  const correo = correosSinAsociar.find(c => c.id === correoId);
  if (!correo) throw new Error("Correo no encontrado");
  const nueva = base(siguienteId++, siguienteNumero.ENT++, correo.de_nombre ?? correo.de_correo, correo.de_correo, correo.asunto ?? "(sin asunto)", 0, {
    cuerpo: correo.cuerpo, adjuntos: correo.adjuntos, fecha_recepcion: correo.recibido_en,
  });
  nueva.eventos.push(ev("asociacion_manual", new Date().toISOString(), { usuario, detalle: "Creada desde Correos sin asociar" }));
  comunicaciones.push(nueva);
  correo.resuelto = true;
  correo.resuelto_como = "nueva";
  correo.comunicacion_id = nueva.id;
  return clonar(nueva);
}

export async function apiResumenHistorico(year: number): Promise<ResumenMesHistorico[]> {
  await delay();
  return resumenHistorico(year);
}

/** Comunicaciones de un mes del histórico (cerradas en el sistema). Las importadas las devolverá el backend. */
export async function apiComunicacionesDelMes(year: number, mes: number): Promise<Comunicacion[]> {
  await delay();
  return clonar(comunicaciones.filter(c => {
    const f = new Date(c.cerrado_en ?? c.fecha_recepcion);
    return c.estado === "cerrada" && f.getFullYear() === year && f.getMonth() + 1 === mes;
  }));
}

/** Para reiniciar el simulador en pruebas. */
export function __resetComunicacionesMock() {
  siguienteNumero = { ENT: 1378, SAL: 201, INT: 231 };
}
