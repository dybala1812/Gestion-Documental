/**
 * @file generateAreaReport.ts
 * @description Generador de reportes Excel elaborados para el Panel de Área.
 *   Produce un workbook multi-hoja con estilos, barras visuales, tablas de
 *   comparativa y tendencia diaria, sin depender del backend para el formato.
 *
 * Hojas generadas:
 *   1. PORTADA          — Cabecera institucional + KPIs destacados
 *   2. RESUMEN EJECUTIVO — Tablas de estado / tipo / prioridad con barras visuales
 *                          + análisis comparativo de períodos
 *   3. TENDENCIA DIARIA  — Serie de tiempo (nuevas vs resueltas) + barra visual
 *   4. DETALLE PQRS      — Listado completo, filas coloreadas por estado/prioridad,
 *                          fila fija (freeze), filtro automático
 *   5. TICKETS INTERNOS  — Tickets recibidos y enviados por el área
 */

import ExcelJS from "exceljs";
import type { PqrsAPI, TicketInternoAPI, ExportFilters } from "./api";
import {
  PQRS_STATUS_LABEL, PQRS_TYPE_LABEL, PQRS_PRIORITY_LABEL,
} from "./api";

// ─── Paleta de colores del reporte ───────────────────────────────────────────
const C = {
  // Marca institucional
  BRAND_DARK:   "FF1E3A5F",
  BRAND_MID:    "FF3730A3",
  BRAND_LIGHT:  "FFE0E7FF",
  WHITE:        "FFFFFFFF",
  // Estado PQRS
  RAD_BG:       "FFDBEAFE",
  RAD_FG:       "FF1D4ED8",
  PRO_BG:       "FFFEF9C3",
  PRO_FG:       "FFB45309",
  RES_BG:       "FFD1FAE5",
  RES_FG:       "FF065F46",
  CER_BG:       "FFF3F4F6",
  CER_FG:       "FF374151",
  // Prioridad
  HIGH_BG:      "FFFEE2E2",
  HIGH_FG:      "FFB91C1C",
  MED_BG:       "FFFFF7ED",
  MED_FG:       "FFC2410C",
  LOW_BG:       "FFF0FDF4",
  LOW_FG:       "FF166534",
  // Neutros
  HEADER_BG:    "FFF8FAFC",
  ROW_ALT:      "FFF9FAFB",
  BORDER:       "FFE5E7EB",
  GRAY_TEXT:    "FF6B7280",
  DARK_TEXT:    "FF111827",
  // Gráficas
  BAR_FILL:     "FF6366F1",
  BAR_EMPTY:    "FFE5E7EB",
} as const;

// ─── Helpers de estilo ────────────────────────────────────────────────────────
type ARGB = string;

function solidFill(argb: ARGB): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function thinBorder(argb: ARGB = C.BORDER): ExcelJS.Borders {
  const side: ExcelJS.BorderStyle = "thin";
  const b = { style: side, color: { argb } };
  return { top: b, bottom: b, left: b, right: b } as ExcelJS.Borders;
}

function boldFont(size = 11, argb: ARGB = C.DARK_TEXT): ExcelJS.Font {
  return { bold: true, size, color: { argb }, name: "Calibri" } as ExcelJS.Font;
}

function normalFont(size = 10, argb: ARGB = C.DARK_TEXT): ExcelJS.Font {
  return { size, color: { argb }, name: "Calibri" } as ExcelJS.Font;
}

function center(wrapText = false): ExcelJS.Alignment {
  return { horizontal: "center", vertical: "middle", wrapText } as ExcelJS.Alignment;
}

function middleLeft(): ExcelJS.Alignment {
  return { horizontal: "left", vertical: "middle" } as ExcelJS.Alignment;
}

/** Genera una barra visual Unicode proporcional a un porcentaje (0-100). */
function visualBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled) + `  ${pct}%`;
}

/** Formatea una fecha ISO a string legible en español (sin hora). */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

/** Formatea fecha+hora ISO. */
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

/** Calcula días entre dos fechas ISO (positivo = en el pasado). */
function daysBetween(from: string, to?: string | null): number {
  const d1 = new Date(from).getTime();
  const d2 = to ? new Date(to).getTime() : Date.now();
  return Math.floor((d2 - d1) / 86_400_000);
}

// ─── Helpers de resolución de datos ────────────────────────────────────────────
/** Resuelve el nombre de dependencia(s) de una PQRS usando dependency_names o fallback. */
function resolveDependencyName(p: PqrsAPI): string {
  if (p.dependency_names?.length) {
    return p.dependency_names.map(d => d.name).join(", ");
  }
  const depObj = p.dependency as any;
  return depObj?.name ?? depObj?.nombre ?? (typeof p.dependency === "string" ? p.dependency : "Sin asignar");
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────
export interface AreaReportInput {
  areaName: string;
  userName: string;
  pqrsList: PqrsAPI[];
  ticketsRecibidos: TicketInternoAPI[];
  ticketsEnviados: TicketInternoAPI[];
  /** Días de período para el análisis (0 = histórico completo). */
  periodDays: number;
  exportFilters: ExportFilters;
}

// ─── Función principal ────────────────────────────────────────────────────────
export async function generateAreaReport(input: AreaReportInput): Promise<void> {
  const { areaName, userName, pqrsList, ticketsRecibidos, ticketsEnviados, periodDays } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator  = "Sistema PQRS Institucional";
  wb.lastModifiedBy = userName;
  wb.created  = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  const now = new Date();
  const periodLabel = periodDays === 0
    ? "Histórico completo"
    : `Últimos ${periodDays} días`;

  // Subset filtrado por período
  const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 86_400_000) : null;
  const filtered = cutoff ? pqrsList.filter(p => new Date(p.created_at) >= cutoff) : pqrsList;

  // ── Precomputar estadísticas ──────────────────────────────────────────────
  const totalF = filtered.length;
  const byStatus = countBy(filtered, p => p.status);
  const byType   = countBy(filtered, p => p.type ?? p.pqrs_type ?? "?");
  const byPrio   = countBy(filtered, p => p.priority ?? "?");

  const resueltas  = (byStatus["RES"] ?? 0) + (byStatus["CER"] ?? 0);
  const enProceso  = byStatus["PRO"] ?? 0;
  const radicadas  = byStatus["RAD"] ?? 0;
  const tasaResol  = totalF > 0 ? Math.round((resueltas / totalF) * 100) : 0;

  // Comparativa: período actual vs período anterior
  const prev = buildPeriodStats(pqrsList, periodDays, 2);
  const curr = buildPeriodStats(pqrsList, periodDays, 1);

  // Tendencia diaria
  const days = periodDays > 0 ? periodDays : 90;
  const tendencia = buildTendencia(pqrsList, days);

  // SLA: vencidas, a tiempo
  const vencidas   = filtered.filter(p => p.due_date && new Date(p.due_date) < now && p.status !== "RES" && p.status !== "CER").length;
  const aTiempo    = filtered.filter(p => p.due_date && (new Date(p.due_date) >= now || p.status === "RES" || p.status === "CER")).length;
  const sinFecha   = filtered.filter(p => !p.due_date).length;
  const tasaSLA    = (aTiempo + vencidas) > 0 ? Math.round((aTiempo / (aTiempo + vencidas)) * 100) : 100;

  // Edad promedio en días
  const ages = filtered.map(p => daysBetween(p.created_at, p.status === "RES" || p.status === "CER" ? p.updated_at : undefined));
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  // ── HOJA 1: PORTADA ───────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Portada", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
    headerFooter: { oddHeader: `&C&B Sistema PQRS — ${areaName}`, oddFooter: "&C&P de &N" },
  });
  ws1.columns = [
    { width: 5 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 5 },
  ];

  // Banda superior de marca
  ws1.addRow([]); // 1
  const brandRow = ws1.addRow(["", "SISTEMA PQRS INSTITUCIONAL", "", "", "", ""]); // 2
  ws1.mergeCells("B2:E2");
  brandRow.getCell("B").font   = { bold: true, size: 18, color: { argb: C.WHITE }, name: "Calibri" };
  brandRow.getCell("B").fill   = solidFill(C.BRAND_MID);
  brandRow.getCell("B").alignment = center();
  brandRow.height = 38;
  ["A2", "F2"].forEach(r => { ws1.getCell(r).fill = solidFill(C.BRAND_MID); });

  const subtitleRow = ws1.addRow(["", "Reporte de Gestión — Panel de Área", "", "", "", ""]); // 3
  ws1.mergeCells("B3:E3");
  subtitleRow.getCell("B").font = boldFont(13, C.WHITE);
  subtitleRow.getCell("B").fill = solidFill(C.BRAND_DARK);
  subtitleRow.getCell("B").alignment = center();
  subtitleRow.height = 26;
  ["A3", "F3"].forEach(r => { ws1.getCell(r).fill = solidFill(C.BRAND_DARK); });

  ws1.addRow([]); // 4

  // Bloque de metadatos
  addMetaRow(ws1, "Área / Dependencia", areaName);         // 5
  addMetaRow(ws1, "Generado por", userName);               // 6
  addMetaRow(ws1, "Fecha de generación", fmtDateTime(now.toISOString())); // 7
  addMetaRow(ws1, "Período analizado", periodLabel);       // 8
  addMetaRow(ws1, "Total PQRS en período", String(totalF)); // 9

  ws1.addRow([]); // 10

  // Subtítulo KPIs
  const kpiTitleRow = ws1.addRow(["", "INDICADORES CLAVE DE DESEMPEÑO", "", "", "", ""]); // 11
  ws1.mergeCells("B11:E11");
  kpiTitleRow.getCell("B").font = boldFont(12, C.BRAND_MID);
  kpiTitleRow.getCell("B").alignment = center();
  kpiTitleRow.height = 22;

  // Tarjetas KPI (2×2)
  const kpiData = [
    ["TOTAL PQRS",       String(totalF),   "Recibidas en el período",   C.BRAND_MID],
    ["RESUELTAS",        String(resueltas), `Tasa: ${tasaResol}%`,       "FF065F46"],
    ["EN PROCESO",       String(enProceso), "Pendientes de resolución",  "FFB45309"],
    [`SLA CUMPLIMIENTO`, `${tasaSLA}%`,     `${vencidas} vencidas`,      tasaSLA >= 80 ? "FF065F46" : "FFB91C1C"],
    ["RADICADAS",        String(radicadas), "Sin procesar aún",          "FF1D4ED8"],
    ["EDAD PROMEDIO",    `${avgAge} días`,  "Desde radicación a cierre", C.GRAY_TEXT],
    ["TICKETS REC.",     String(ticketsRecibidos.length), "Tickets internos recibidos", C.BRAND_MID],
    ["TICKETS ENV.",     String(ticketsEnviados.length),  "Tickets internos enviados",  C.BRAND_MID],
  ] as const;

  for (let i = 0; i < kpiData.length; i += 2) {
    const row = ws1.addRow([]); // 12, 14, 16, 18
    row.height = 50;
    const colB = row.getCell("B");
    const colD = row.getCell("D");

    styleKPICard(ws1, colB, String(row.number), "B", kpiData[i][0], kpiData[i][1], kpiData[i][2], kpiData[i][3]);
    ws1.mergeCells(`B${row.number}:C${row.number}`);

    if (i + 1 < kpiData.length) {
      styleKPICard(ws1, colD, String(row.number), "D", kpiData[i + 1][0], kpiData[i + 1][1], kpiData[i + 1][2], kpiData[i + 1][3]);
      ws1.mergeCells(`D${row.number}:E${row.number}`);
    }

    ws1.addRow([]); // spacer
  }

  // Pie institucional
  const footerRow = ws1.addRow(["", "Documento generado automáticamente por el Sistema PQRS Institucional", "", "", "", ""]); // ~28
  ws1.mergeCells(`B${footerRow.number}:E${footerRow.number}`);
  footerRow.getCell("B").font = normalFont(9, C.GRAY_TEXT);
  footerRow.getCell("B").alignment = center();

  ws1.views = [{ showGridLines: false }];

  // ── HOJA 2: RESUMEN EJECUTIVO ─────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Resumen Ejecutivo");
  ws2.columns = [
    { width: 3 }, { width: 28 }, { width: 14 }, { width: 12 }, { width: 36 }, { width: 3 },
  ];

  addSheetHeader(ws2, "RESUMEN EJECUTIVO", areaName, periodLabel, now);

  // ── Sección: Por Estado ──
  addSectionTitle(ws2, "Distribución por Estado");
  addTableHeaders(ws2, ["Estado", "Cantidad", "Porcentaje", "Distribución visual"]);
  const statusOrder = ["RAD", "PRO", "RES", "CER"];
  for (const key of statusOrder) {
    const cnt = byStatus[key] ?? 0;
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_STATUS_LABEL[key as keyof typeof PQRS_STATUS_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r, getStatusFill(key), getStatusFont(key));
  }
  const totalRowE = ws2.addRow(["", "TOTAL", totalF, "100%", ""]);
  totalRowE.height = 18;
  styleTotalsRow(totalRowE);
  ws2.addRow([]);

  // ── Sección: Por Tipo ──
  addSectionTitle(ws2, "Distribución por Tipo de PQRS");
  addTableHeaders(ws2, ["Tipo", "Cantidad", "Porcentaje", "Distribución visual"]);
  const typeMax = Math.max(...Object.values(byType), 1);
  for (const [key, cnt] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_TYPE_LABEL[key as keyof typeof PQRS_TYPE_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r);
    void typeMax;
  }
  const totalRowT = ws2.addRow(["", "TOTAL", totalF, "100%", ""]);
  totalRowT.height = 18;
  styleTotalsRow(totalRowT);
  ws2.addRow([]);

  // ── Sección: Por Prioridad ──
  addSectionTitle(ws2, "Distribución por Prioridad");
  addTableHeaders(ws2, ["Prioridad", "Cantidad", "Porcentaje", "Distribución visual"]);
  for (const [key, cnt] of Object.entries(byPrio).sort((a, b) => b[1] - a[1])) {
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_PRIORITY_LABEL[key as keyof typeof PQRS_PRIORITY_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r, getPrioFill(key), getPrioFont(key));
  }
  ws2.addRow([]);

  // ── Sección: Cumplimiento SLA ──
  addSectionTitle(ws2, "Cumplimiento de SLA / Tiempos de Respuesta");
  addTableHeaders(ws2, ["Categoría", "Cantidad", "Porcentaje", "Distribución"]);
  const slaRows: [string, number, number][] = [
    ["A tiempo (dentro del SLA)",          aTiempo,  (aTiempo  + vencidas) > 0 ? Math.round((aTiempo / (aTiempo + vencidas)) * 100) : 100],
    ["Vencidas (superaron el SLA)",        vencidas, (aTiempo  + vencidas) > 0 ? Math.round((vencidas / (aTiempo + vencidas)) * 100) : 0],
    ["Sin fecha límite asignada",          sinFecha, totalF > 0 ? Math.round((sinFecha / totalF) * 100) : 0],
  ];
  for (const [label, cnt, pct] of slaRows) {
    const r = ws2.addRow(["", label, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r);
  }
  const avgAgeRow = ws2.addRow(["", "Edad promedio de gestión (días)", avgAge, "", ""]);
  avgAgeRow.height = 18;
  styleDataRow(avgAgeRow);
  ws2.addRow([]);

  // ── Sección: Comparativa de períodos ──
  if (periodDays > 0) {
    addSectionTitle(ws2, `Comparativa: período actual vs período anterior (${periodDays} días c/u)`);
    addTableHeaders(ws2, ["Indicador", "Período actual", "Período anterior", "Variación"]);
    const compareRows: [string, number, number][] = [
      ["Total PQRS",           curr.total,    prev.total],
      ["Resueltas",            curr.resueltas, prev.resueltas],
      ["En proceso",           curr.enProceso, prev.enProceso],
      ["Radicadas (sin proc.)", curr.radicadas, prev.radicadas],
    ];
    for (const [label, c, p] of compareRows) {
      const diff = c - p;
      const diffStr = diff === 0 ? "Sin cambio" : diff > 0 ? `▲ +${diff}` : `▼ ${diff}`;
      const argbDiff = diff === 0 ? C.GRAY_TEXT : diff < 0 ? "FF065F46" : "FFB91C1C";
      const r = ws2.addRow(["", label, c, p, diffStr]);
      r.height = 18;
      styleDataRow(r);
      r.getCell("E").font = boldFont(10, argbDiff);
    }
    const rateC = curr.total > 0 ? `${Math.round((curr.resueltas / curr.total) * 100)}%` : "0%";
    const rateP = prev.total > 0 ? `${Math.round((prev.resueltas / prev.total) * 100)}%` : "0%";
    const rateRow = ws2.addRow(["", "Tasa de resolución (%)", rateC, rateP, ""]);
    rateRow.height = 18;
    styleDataRow(rateRow);
    ws2.addRow([]);
  }

  ws2.views = [{ showGridLines: false }];

  // ── HOJA 3: TENDENCIA DIARIA ──────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Tendencia Diaria");
  ws3.columns = [
    { width: 3 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 30 }, { width: 3 },
  ];

  addSheetHeader(ws3, "TENDENCIA DIARIA", areaName, periodLabel, now);
  addSectionTitle(ws3, `Evolución diaria de PQRS — últimos ${days} días`);

  // Headers
  const tendHdr = ws3.addRow(["", "Fecha", "Nuevas", "Resueltas", "Acumuladas", "Barras (Nuevas)"]);
  tendHdr.height = 22;
  styleHeaderRow(tendHdr);

  // Congelar cabecera
  const tendHdrRowNum = tendHdr.number;
  ws3.views = [{ state: "frozen", ySplit: tendHdrRowNum, showGridLines: false }];

  let acum = 0;
  const maxNuevas = Math.max(...tendencia.map(t => t.total), 1);
  for (const [i, d] of tendencia.entries()) {
    acum += d.total;
    const barWidth = Math.round((d.total / maxNuevas) * 25);
    const bar = "█".repeat(barWidth) + "░".repeat(25 - barWidth);
    const r = ws3.addRow(["", d.fecha, d.total, d.resueltas, acum, bar]);
    r.height = 17;
    // Alternar fila
    if (i % 2 === 0) {
      ["B", "C", "D", "E", "F"].forEach(col => {
        r.getCell(col).fill = solidFill(C.ROW_ALT);
      });
    }
    ["B", "C", "D", "E", "F"].forEach(col => {
      r.getCell(col).border = thinBorder();
      r.getCell(col).font = normalFont();
    });
    r.getCell("C").alignment = center();
    r.getCell("D").alignment = center();
    r.getCell("E").alignment = center();
    r.getCell("F").font = { ...normalFont(9), color: { argb: C.BAR_FILL }, name: "Courier New" };
  }

  // Totales
  const tendTotal = ws3.addRow([
    "", "TOTAL",
    tendencia.reduce((s, d) => s + d.total, 0),
    tendencia.reduce((s, d) => s + d.resueltas, 0),
    acum, "",
  ]);
  tendTotal.height = 18;
  styleTotalsRow(tendTotal);

  // ── HOJA 4: DETALLE COMPLETO ──────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Detalle PQRS");
  ws4.columns = [
    { width: 3  },  // A spacer
    { width: 18 },  // B Radicado
    { width: 10 },  // C Tipo
    { width: 12 },  // D Estado
    { width: 10 },  // E Prioridad
    { width: 35 },  // F Asunto
    { width: 22 },  // G Solicitante
    { width: 15 },  // H Tipo Solicitante
    { width: 14 },  // I Email
    { width: 20 },  // J Dependencia
    { width: 16 },  // K Fecha creación
    { width: 16 },  // L Fecha límite (SLA)
    { width: 10 },  // M Días en gestión
    { width: 14 },  // N SLA
    { width: 16 },  // O Cerrado en
    { width: 3  },  // P spacer
  ];

  addSheetHeader(ws4, "DETALLE COMPLETO DE PQRS", areaName, periodLabel, now);

  const detHdr = ws4.addRow([
    "", "Nº Radicado", "Tipo", "Estado", "Prioridad",
    "Asunto", "Solicitante", "Tipo Solicitante", "Email",
    "Dependencia", "Fecha Radicación", "Fecha Límite",
    "Días Gestión", "SLA", "Cerrado en", "",
  ]);
  detHdr.height = 24;
  styleHeaderRow(detHdr);
  const detHdrNum = detHdr.number;

  // Freeze + auto-filter
  ws4.views = [{ state: "frozen", ySplit: detHdrNum, showGridLines: false }];
  ws4.autoFilter = { from: { row: detHdrNum, column: 2 }, to: { row: detHdrNum, column: 15 } };

  for (const [i, p] of filtered.entries()) {
    const tipo   = p.type_display ?? PQRS_TYPE_LABEL[p.type as keyof typeof PQRS_TYPE_LABEL] ?? p.type ?? "—";
    const estado = p.status_display ?? PQRS_STATUS_LABEL[p.status as keyof typeof PQRS_STATUS_LABEL] ?? p.status;
    const prio   = PQRS_PRIORITY_LABEL[p.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? p.priority ?? "—";
    const nombre = (p.submitter
      ?? (p.user
        ? `${p.user.nombre ?? ""} ${p.user.apellido ?? ""}`.trim() || p.user.email
        : p.anonymous_submitter?.nombre ?? "")) || "Anónimo";
    const tipoSolicitante = nombre && nombre !== "Anónimo" ? "Identificado" : "Anónimo";
    const email  = p.submitter_email ?? p.user?.email ?? p.anonymous_submitter?.email ?? "—";
    const dep    = resolveDependencyName(p);
    const dias   = daysBetween(p.created_at);
    const slaOk  = !p.due_date
      ? "Sin fecha"
      : new Date(p.due_date) >= now || p.status === "RES" || p.status === "CER"
        ? "✓ OK"
        : "✗ Vencida";
    const cerradoEn = (p as any).closed_at ? fmtDateTime((p as any).closed_at) : (p.status === "CER" || p.status === "RES") ? fmtDateTime(p.updated_at) : "—";

    const r = ws4.addRow([
      "", p.numero_radicado ?? p.radicado ?? "—",
      tipo, estado, prio, p.subject,
      nombre, tipoSolicitante, email, dep,
      fmtDate(p.created_at), fmtDate(p.due_date), dias, slaOk,
      cerradoEn, "",
    ]);
    r.height = 17;

    // Color base de fila por estado
    const { fill: sFill, font: sFont } = getStatusStyle(p.status);
    const rowAlt = i % 2 !== 0;
    const bgArgb = rowAlt ? lightenArgb(sFill) : sFill;

    ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"].forEach(col => {
      const cell = r.getCell(col);
      cell.fill   = solidFill(bgArgb);
      cell.border = thinBorder();
      cell.font   = normalFont(10);
      cell.alignment = middleLeft();
    });

    // Celda de estado con color específico
    r.getCell("D").font = boldFont(10, sFont);
    r.getCell("D").fill = solidFill(sFill);
    r.getCell("D").alignment = center();

    // Celda de prioridad
    const { fill: pFill, font: pFont } = getPrioStyle(p.priority);
    r.getCell("E").font = boldFont(10, pFont);
    r.getCell("E").fill = solidFill(pFill);
    r.getCell("E").alignment = center();

    // Celda SLA
    r.getCell("N").font = boldFont(10, slaOk === "✓ OK" ? "FF065F46" : slaOk === "✗ Vencida" ? "FFB91C1C" : C.GRAY_TEXT);
    r.getCell("N").alignment = center();

    // Días con color si es alto
    if (dias > 30) r.getCell("M").font = boldFont(10, "FFB91C1C");
    r.getCell("M").alignment = center();
  }

  // Totales al pie
  const detTotRow = ws4.addRow([
    "", `Total: ${filtered.length} registros`, "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  ]);
  detTotRow.height = 18;
  styleTotalsRow(detTotRow);

  // ── HOJA 5: TICKETS INTERNOS ──────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Tickets Internos");
  ws5.columns = [
    { width: 3  },  // A spacer
    { width: 16 },  // B Nº Ticket
    { width: 12 },  // C Estado
    { width: 10 },  // D Prioridad
    { width: 30 },  // E Asunto
    { width: 22 },  // F Área Origen
    { width: 22 },  // G Área Destino
    { width: 16 },  // H Fecha creación
    { width: 16 },  // I Fecha límite
    { width: 12 },  // J SLA
    { width: 3  },  // K spacer
  ];

  addSheetHeader(ws5, "TICKETS INTERNOS", areaName, periodLabel, now);

  // Tickets recibidos
  addSectionTitle(ws5, `Tickets Recibidos (${ticketsRecibidos.length})`);
  const tktHdr = ws5.addRow(["", "Nº Ticket", "Estado", "Prioridad", "Asunto", "Área Origen", "Área Destino", "Fecha", "Vence", "SLA", ""]);
  tktHdr.height = 22;
  styleHeaderRow(tktHdr);
  const tktHdrNum = tktHdr.number;
  addTicketRows(ws5, ticketsRecibidos, now);

  ws5.addRow([]);

  // Tickets enviados
  addSectionTitle(ws5, `Tickets Enviados (${ticketsEnviados.length})`);
  const tktHdr2 = ws5.addRow(["", "Nº Ticket", "Estado", "Prioridad", "Asunto", "Área Origen", "Área Destino", "Fecha", "Vence", "SLA", ""]);
  tktHdr2.height = 22;
  styleHeaderRow(tktHdr2);
  addTicketRows(ws5, ticketsEnviados, now);

  ws5.views = [{ state: "frozen", ySplit: tktHdrNum, showGridLines: false }];

  // Resumen de tickets
  ws5.addRow([]);
  addSectionTitle(ws5, "Resumen de Tickets");
  addTableHeaders(ws5, ["Categoría", "Cantidad", "", ""]);
  const tktSummary = [
    ["Tickets recibidos totales", ticketsRecibidos.length],
    ["Tickets recibidos abiertos", ticketsRecibidos.filter(t => t.status === "ABR").length],
    ["Tickets recibidos en proceso", ticketsRecibidos.filter(t => t.status === "PRO").length],
    ["Tickets recibidos cerrados", ticketsRecibidos.filter(t => t.status === "CER" || t.status === "RES").length],
    ["Tickets enviados totales", ticketsEnviados.length],
    ["Tickets vencidos (SLA)", [...ticketsRecibidos, ...ticketsEnviados].filter(t => t.is_overdue).length],
  ] as const;
  for (const [label, cnt] of tktSummary) {
    const r = ws5.addRow(["", label, cnt, "", ""]);
    r.height = 17;
    styleDataRow(r);
  }

  // ── Generar y descargar ───────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeArea = areaName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "").slice(0, 30).trim().replace(/\s+/g, "_");
  const ts = now.toISOString().slice(0, 10);
  const filename = `Reporte_Area_${safeArea}_${ts}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = fn(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function buildPeriodStats(
  pqrsList: PqrsAPI[],
  periodDays: number,
  multiplier: 1 | 2,
): { total: number; resueltas: number; enProceso: number; radicadas: number } {
  if (periodDays === 0) {
    const total     = pqrsList.length;
    const resueltas = pqrsList.filter(p => p.status === "RES" || p.status === "CER").length;
    return { total, resueltas, enProceso: pqrsList.filter(p => p.status === "PRO").length, radicadas: pqrsList.filter(p => p.status === "RAD").length };
  }
  const end   = new Date(Date.now() - (multiplier - 1) * periodDays * 86_400_000);
  const start = new Date(Date.now() - multiplier * periodDays * 86_400_000);
  const sub   = pqrsList.filter(p => { const d = new Date(p.created_at); return d >= start && d < end; });
  return {
    total:     sub.length,
    resueltas: sub.filter(p => p.status === "RES" || p.status === "CER").length,
    enProceso: sub.filter(p => p.status === "PRO").length,
    radicadas: sub.filter(p => p.status === "RAD").length,
  };
}

function buildTendencia(pqrsList: PqrsAPI[], days: number): { fecha: string; total: number; resueltas: number }[] {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const map: Record<string, { fecha: string; total: number; resueltas: number }> = {};
  for (const p of pqrsList) {
    const d = new Date(p.created_at);
    if (d < cutoff) continue;
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { fecha: key, total: 0, resueltas: 0 };
    map[key].total++;
    if (p.status === "RES" || p.status === "CER") map[key].resueltas++;
  }
  return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Aclara ligeramente un color ARGB mezclando con blanco (para filas alternas). */
function lightenArgb(argb: ARGB): ARGB {
  const hex = argb.slice(2); // skip alpha
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 18);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 18);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 18);
  return "FF" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

// ─── Helpers de estilo de celda ───────────────────────────────────────────────

function addSheetHeader(ws: ExcelJS.Worksheet, title: string, area: string, period: string, now: Date) {
  const r1 = ws.addRow(["", title, "", "", "", ""]);
  ws.mergeCells(`B${r1.number}:E${r1.number}`);
  r1.getCell("B").font   = boldFont(14, C.WHITE);
  r1.getCell("B").fill   = solidFill(C.BRAND_MID);
  r1.getCell("B").alignment = center();
  r1.height = 30;

  const r2 = ws.addRow(["", `${area}  ·  ${period}  ·  ${fmtDate(now.toISOString())}`, "", "", "", ""]);
  ws.mergeCells(`B${r2.number}:E${r2.number}`);
  r2.getCell("B").font   = normalFont(10, C.WHITE);
  r2.getCell("B").fill   = solidFill(C.BRAND_DARK);
  r2.getCell("B").alignment = center();
  r2.height = 18;

  ws.addRow([]);
}

function addSectionTitle(ws: ExcelJS.Worksheet, text: string) {
  const r = ws.addRow(["", text, "", "", "", ""]);
  ws.mergeCells(`B${r.number}:E${r.number}`);
  r.getCell("B").font   = boldFont(11, C.BRAND_MID);
  r.getCell("B").fill   = solidFill(C.BRAND_LIGHT);
  r.getCell("B").alignment = { horizontal: "left", vertical: "middle" };
  r.height = 20;
}

function addTableHeaders(ws: ExcelJS.Worksheet, labels: string[]) {
  const r = ws.addRow(["", ...labels]);
  r.height = 20;
  styleHeaderRow(r);
}

function styleHeaderRow(r: ExcelJS.Row) {
  r.eachCell((cell, col) => {
    if (col === 1) return;
    cell.font      = boldFont(10, C.WHITE);
    cell.fill      = solidFill(C.BRAND_MID);
    cell.alignment = center(true);
    cell.border    = thinBorder();
  });
}

function styleDataRow(
  r: ExcelJS.Row,
  bgArgb: ARGB = C.WHITE,
  fontArgb: ARGB = C.DARK_TEXT,
) {
  r.eachCell((cell, col) => {
    if (col === 1) return;
    cell.fill      = solidFill(bgArgb);
    cell.font      = normalFont(10, fontArgb);
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border    = thinBorder();
  });
}

function styleTotalsRow(r: ExcelJS.Row) {
  r.eachCell((cell, col) => {
    if (col === 1) return;
    cell.fill      = solidFill(C.BRAND_DARK);
    cell.font      = boldFont(10, C.WHITE);
    cell.alignment = center();
    cell.border    = thinBorder(C.BRAND_MID);
  });
  r.height = 18;
}

function addMetaRow(ws: ExcelJS.Worksheet, label: string, value: string) {
  const r = ws.addRow(["", label, "", value, "", ""]);
  ws.mergeCells(`D${r.number}:E${r.number}`);
  r.getCell("B").font      = boldFont(11, C.GRAY_TEXT);
  r.getCell("B").alignment = { horizontal: "right", vertical: "middle" };
  r.getCell("D").font      = boldFont(11, C.BRAND_DARK);
  r.getCell("D").alignment = middleLeft();
  r.height = 22;
}

function styleKPICard(
  ws: ExcelJS.Worksheet,
  _cell: ExcelJS.Cell,
  rowNum: string,
  startCol: string,
  title: string,
  value: string,
  sub: string,
  fg: ARGB,
) {
  const c = ws.getCell(`${startCol}${rowNum}`);
  c.value     = `${title}\n${value}\n${sub}`;
  c.font      = { name: "Calibri", size: 11, bold: true, color: { argb: fg } };
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  c.fill      = solidFill(C.HEADER_BG);
  c.border    = {
    top:    { style: "medium", color: { argb: fg } },
    left:   { style: "medium", color: { argb: fg } },
    bottom: { style: "medium", color: { argb: fg } },
    right:  { style: "medium", color: { argb: fg } },
  };
}

function addTicketRows(ws: ExcelJS.Worksheet, tickets: TicketInternoAPI[], now: Date) {
  const TICKET_STATUS: Record<string, string> = {
    ABR: "Abierto", PRO: "En proceso", RES: "Resuelto", CER: "Cerrado",
  };
  for (const [i, t] of tickets.entries()) {
    const sla = t.is_overdue ? "✗ Vencido" : t.due_date ? "✓ OK" : "Sin fecha";
    const r = ws.addRow([
      "",
      t.numero_ticket ?? "—",
      TICKET_STATUS[t.status] ?? t.status,
      PQRS_PRIORITY_LABEL[t.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? t.priority ?? "—",
      t.subject,
      (t as any).origin_dependency_name ?? "—",
      (t as any).target_dependency_name ?? "—",
      fmtDate(t.created_at),
      fmtDate(t.due_date),
      sla,
      "",
    ]);
    r.height = 17;
    const bg = i % 2 === 0 ? C.WHITE : C.ROW_ALT;
    styleDataRow(r, bg);
    r.getCell("J").font = boldFont(10, sla === "✓ OK" ? "FF065F46" : sla === "✗ Vencido" ? "FFB91C1C" : C.GRAY_TEXT);
    r.getCell("J").alignment = center();
    r.getCell("C").alignment = center();
    r.getCell("D").alignment = center();

    // Color estado ticket
    const tsFill = getTicketStatusFill(t.status);
    r.getCell("C").fill = solidFill(tsFill);
    r.getCell("C").font = boldFont(10, getTicketStatusFont(t.status));
  }
}

// ─── Paletas de estado ────────────────────────────────────────────────────────

function getStatusFill(key: string): ARGB {
  const map: Record<string, ARGB> = {
    RAD: C.RAD_BG, PRO: C.PRO_BG, RES: C.RES_BG, CER: C.CER_BG,
  };
  return map[key] ?? C.WHITE;
}

function getStatusFont(key: string): ARGB {
  const map: Record<string, ARGB> = {
    RAD: C.RAD_FG, PRO: C.PRO_FG, RES: C.RES_FG, CER: C.CER_FG,
  };
  return map[key] ?? C.DARK_TEXT;
}

function getStatusStyle(key: string): { fill: ARGB; font: ARGB } {
  return { fill: getStatusFill(key), font: getStatusFont(key) };
}

function getPrioFill(key: string): ARGB {
  const map: Record<string, ARGB> = {
    HIGH: C.HIGH_BG, MED: C.MED_BG, LOW: C.LOW_BG,
  };
  return map[key] ?? C.WHITE;
}

function getPrioFont(key: string): ARGB {
  const map: Record<string, ARGB> = {
    HIGH: C.HIGH_FG, MED: C.MED_FG, LOW: C.LOW_FG,
  };
  return map[key] ?? C.DARK_TEXT;
}

function getPrioStyle(key: string): { fill: ARGB; font: ARGB } {
  return { fill: getPrioFill(key), font: getPrioFont(key) };
}

function getTicketStatusFill(key: string): ARGB {
  const map: Record<string, ARGB> = {
    ABR: C.RAD_BG, PRO: C.PRO_BG, RES: C.RES_BG, CER: C.CER_BG,
  };
  return map[key] ?? C.WHITE;
}

function getTicketStatusFont(key: string): ARGB {
  const map: Record<string, ARGB> = {
    ABR: C.RAD_FG, PRO: C.PRO_FG, RES: C.RES_FG, CER: C.CER_FG,
  };
  return map[key] ?? C.DARK_TEXT;
}
