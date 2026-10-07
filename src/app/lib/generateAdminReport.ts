/**
 * @file generateAdminReport.ts
 * @description Generador de reportes Excel elaborados para el Panel de Administración.
 *   Produce un workbook multi-hoja con estilos, barras visuales, tablas de
 *   comparativa, tendencia diaria, desglose por dependencia y tickets internos.
 *
 * Hojas generadas:
 *   1. PORTADA           — Cabecera institucional + KPIs globales
 *   2. RESUMEN EJECUTIVO — Tablas de estado / tipo / prioridad con barras visuales
 *                           + análisis comparativo de períodos + SLA
 *   3. TENDENCIA DIARIA  — Serie de tiempo (nuevas vs resueltas) + barra visual
 *   4. DETALLE PQRS      — Listado completo, filas coloreadas por estado/prioridad,
 *                           fila fija (freeze), filtro automático
 *   5. POR DEPENDENCIA   — Desglose de PQRS por cada dependencia/área
 *   6. TICKETS INTERNOS  — Todos los tickets internos del sistema
 */

import ExcelJS from "exceljs";
import type { PqrsAPI, TicketInternoAPI, ExportFilters, Dependency } from "./api";
import {
  PQRS_STATUS_LABEL, PQRS_TYPE_LABEL, PQRS_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "./api";

// ─── Paleta de colores ───────────────────────────────────────────────────────
const C = {
  BRAND_DARK:   "FF1E3A5F",
  BRAND_MID:    "FF3730A3",
  BRAND_LIGHT:  "FFE0E7FF",
  WHITE:        "FFFFFFFF",
  RAD_BG:       "FFDBEAFE",
  RAD_FG:       "FF1D4ED8",
  PRO_BG:       "FFFEF9C3",
  PRO_FG:       "FFB45309",
  RES_BG:       "FFD1FAE5",
  RES_FG:       "FF065F46",
  CER_BG:       "FFF3F4F6",
  CER_FG:       "FF374151",
  HIGH_BG:      "FFFEE2E2",
  HIGH_FG:      "FFB91C1C",
  MED_BG:       "FFFFF7ED",
  MED_FG:       "FFC2410C",
  LOW_BG:       "FFF0FDF4",
  LOW_FG:       "FF166534",
  HEADER_BG:    "FFF8FAFC",
  ROW_ALT:      "FFF9FAFB",
  BORDER:       "FFE5E7EB",
  GRAY_TEXT:    "FF6B7280",
  DARK_TEXT:    "FF111827",
  BAR_FILL:     "FF6366F1",
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

function visualBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled) + `  ${pct}%`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function daysBetween(from: string, to?: string | null): number {
  const d1 = new Date(from).getTime();
  const d2 = to ? new Date(to).getTime() : Date.now();
  return Math.floor((d2 - d1) / 86_400_000);
}

function lightenArgb(argb: ARGB): ARGB {
  const hex = argb.slice(2);
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 18);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 18);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 18);
  return "FF" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────
export interface AdminReportInput {
  userName: string;
  pqrsList: PqrsAPI[];
  tickets: TicketInternoAPI[];
  dependencies: Dependency[];
  exportFilters: ExportFilters;
}

// ─── Función principal ────────────────────────────────────────────────────────
export async function generateAdminReport(input: AdminReportInput): Promise<void> {
  const { userName, pqrsList, tickets, dependencies, exportFilters } = input;

  // Aplicar filtros del panel de exportación a la lista de PQRS
  let filtered = [...pqrsList];
  if (exportFilters.status) filtered = filtered.filter(p => p.status === exportFilters.status);
  if (exportFilters.type) filtered = filtered.filter(p => (p.type ?? p.pqrs_type) === exportFilters.type);
  if (exportFilters.priority) filtered = filtered.filter(p => p.priority === exportFilters.priority);
  if (exportFilters.date_from) {
    const from = new Date(exportFilters.date_from);
    filtered = filtered.filter(p => new Date(p.created_at) >= from);
  }
  if (exportFilters.date_to) {
    const to = new Date(exportFilters.date_to + "T23:59:59");
    filtered = filtered.filter(p => new Date(p.created_at) <= to);
  }
  if (exportFilters.dependency_id) {
    filtered = filtered.filter(p => {
      // Usar dependency_names (del serializer de lista) o fallback a dependency
      if (p.dependency_names?.length) {
        return p.dependency_names.some(d => d.id === exportFilters.dependency_id);
      }
      const depId = typeof p.dependency === "object" && p.dependency
        ? (p.dependency as any).id
        : p.dependency;
      return depId === exportFilters.dependency_id;
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema PQRS Institucional";
  wb.lastModifiedBy = userName;
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  const now = new Date();

  // Determinar etiqueta de período según filtros de fecha
  let periodLabel = "Histórico completo";
  if (exportFilters.date_from && exportFilters.date_to) {
    periodLabel = `${exportFilters.date_from} a ${exportFilters.date_to}`;
  } else if (exportFilters.date_from) {
    periodLabel = `Desde ${exportFilters.date_from}`;
  } else if (exportFilters.date_to) {
    periodLabel = `Hasta ${exportFilters.date_to}`;
  }

  // ── Precomputar estadísticas ──────────────────────────────────────────────
  const totalF = filtered.length;
  const byStatus = countBy(filtered, p => p.status);
  const byType = countBy(filtered, p => p.type ?? p.pqrs_type ?? "?");
  const byPrio = countBy(filtered, p => p.priority ?? "?");

  const resueltas = (byStatus["RES"] ?? 0) + (byStatus["CER"] ?? 0);
  const enProceso = byStatus["PRO"] ?? 0;
  const radicadas = byStatus["RAD"] ?? 0;
  const tasaResol = totalF > 0 ? Math.round((resueltas / totalF) * 100) : 0;

  // Comparativa último mes
  const prev30 = buildPeriodStats(pqrsList, 30, 2);
  const curr30 = buildPeriodStats(pqrsList, 30, 1);

  // Tendencia diaria (últimos 90 días)
  const tendencia = buildTendencia(pqrsList, 90);

  // SLA
  const vencidas = filtered.filter(p => p.due_date && new Date(p.due_date) < now && p.status !== "RES" && p.status !== "CER").length;
  const aTiempo = filtered.filter(p => p.due_date && (new Date(p.due_date) >= now || p.status === "RES" || p.status === "CER")).length;
  const sinFecha = filtered.filter(p => !p.due_date).length;
  const tasaSLA = (aTiempo + vencidas) > 0 ? Math.round((aTiempo / (aTiempo + vencidas)) * 100) : 100;

  // Edad promedio
  const ages = filtered.map(p => daysBetween(p.created_at, p.status === "RES" || p.status === "CER" ? p.updated_at : undefined));
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  // Sin asignar
  const sinAsignar = filtered.filter(p => {
    const dep = typeof p.dependency === "object" ? p.dependency : null;
    return !dep && !p.dependency;
  }).length;

  // Tickets stats
  const ticketsAbiertos = tickets.filter(t => t.status === "ABR").length;
  const ticketsEnProceso = tickets.filter(t => t.status === "PRO").length;
  const ticketsCerrados = tickets.filter(t => t.status === "RES" || t.status === "CER").length;
  const ticketsVencidos = tickets.filter(t => t.is_overdue).length;

  // ── HOJA 1: PORTADA ───────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Portada", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
    headerFooter: { oddHeader: "&C&B Sistema PQRS — Administración", oddFooter: "&C&P de &N" },
  });
  ws1.columns = [
    { width: 5 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 5 },
  ];

  ws1.addRow([]);
  const brandRow = ws1.addRow(["", "SISTEMA PQRS INSTITUCIONAL", "", "", "", ""]);
  ws1.mergeCells("B2:E2");
  brandRow.getCell("B").font = { bold: true, size: 18, color: { argb: C.WHITE }, name: "Calibri" };
  brandRow.getCell("B").fill = solidFill(C.BRAND_MID);
  brandRow.getCell("B").alignment = center();
  brandRow.height = 38;
  ["A2", "F2"].forEach(r => { ws1.getCell(r).fill = solidFill(C.BRAND_MID); });

  const subtitleRow = ws1.addRow(["", "Reporte Global de Gestión — Panel de Administración", "", "", "", ""]);
  ws1.mergeCells("B3:E3");
  subtitleRow.getCell("B").font = boldFont(13, C.WHITE);
  subtitleRow.getCell("B").fill = solidFill(C.BRAND_DARK);
  subtitleRow.getCell("B").alignment = center();
  subtitleRow.height = 26;
  ["A3", "F3"].forEach(r => { ws1.getCell(r).fill = solidFill(C.BRAND_DARK); });

  ws1.addRow([]);

  addMetaRow(ws1, "Generado por", userName);
  addMetaRow(ws1, "Fecha de generación", fmtDateTime(now.toISOString()));
  addMetaRow(ws1, "Período", periodLabel);
  addMetaRow(ws1, "Total PQRS en reporte", String(totalF));
  addMetaRow(ws1, "Total Dependencias activas", String(dependencies.length));
  addMetaRow(ws1, "Total Tickets internos", String(tickets.length));

  // Filtros aplicados
  const filtersApplied: string[] = [];
  if (exportFilters.status) filtersApplied.push(`Estado: ${PQRS_STATUS_LABEL[exportFilters.status as keyof typeof PQRS_STATUS_LABEL] ?? exportFilters.status}`);
  if (exportFilters.type) filtersApplied.push(`Tipo: ${PQRS_TYPE_LABEL[exportFilters.type as keyof typeof PQRS_TYPE_LABEL] ?? exportFilters.type}`);
  if (exportFilters.priority) filtersApplied.push(`Prioridad: ${PQRS_PRIORITY_LABEL[exportFilters.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? exportFilters.priority}`);
  if (exportFilters.dependency_id) {
    const depName = dependencies.find(d => d.id === exportFilters.dependency_id)?.name ?? exportFilters.dependency_id;
    filtersApplied.push(`Dependencia: ${depName}`);
  }
  addMetaRow(ws1, "Filtros aplicados", filtersApplied.length > 0 ? filtersApplied.join(" | ") : "Ninguno (reporte completo)");

  ws1.addRow([]);

  const kpiTitleRow = ws1.addRow(["", "INDICADORES CLAVE DE DESEMPEÑO", "", "", "", ""]);
  ws1.mergeCells(`B${kpiTitleRow.number}:E${kpiTitleRow.number}`);
  kpiTitleRow.getCell("B").font = boldFont(12, C.BRAND_MID);
  kpiTitleRow.getCell("B").alignment = center();
  kpiTitleRow.height = 22;

  const kpiData = [
    ["TOTAL PQRS", String(totalF), "En el reporte", C.BRAND_MID],
    ["RESUELTAS", String(resueltas), `Tasa: ${tasaResol}%`, "FF065F46"],
    ["EN PROCESO", String(enProceso), "Pendientes de resolución", "FFB45309"],
    ["SLA CUMPLIMIENTO", `${tasaSLA}%`, `${vencidas} vencidas`, tasaSLA >= 80 ? "FF065F46" : "FFB91C1C"],
    ["RADICADAS", String(radicadas), "Sin procesar aún", "FF1D4ED8"],
    ["EDAD PROMEDIO", `${avgAge} días`, "Desde radicación", C.GRAY_TEXT],
    ["TICKETS TOTALES", String(tickets.length), `${ticketsAbiertos} abiertos`, C.BRAND_MID],
    ["TICKETS VENCIDOS", String(ticketsVencidos), `${ticketsCerrados} cerrados`, ticketsVencidos > 0 ? "FFB91C1C" : "FF065F46"],
  ] as const;

  for (let i = 0; i < kpiData.length; i += 2) {
    const row = ws1.addRow([]);
    row.height = 50;

    styleKPICard(ws1, String(row.number), "B", kpiData[i][0], kpiData[i][1], kpiData[i][2], kpiData[i][3]);
    ws1.mergeCells(`B${row.number}:C${row.number}`);

    if (i + 1 < kpiData.length) {
      styleKPICard(ws1, String(row.number), "D", kpiData[i + 1][0], kpiData[i + 1][1], kpiData[i + 1][2], kpiData[i + 1][3]);
      ws1.mergeCells(`D${row.number}:E${row.number}`);
    }

    ws1.addRow([]);
  }

  const footerRow = ws1.addRow(["", "Documento generado automáticamente por el Sistema PQRS Institucional", "", "", "", ""]);
  ws1.mergeCells(`B${footerRow.number}:E${footerRow.number}`);
  footerRow.getCell("B").font = normalFont(9, C.GRAY_TEXT);
  footerRow.getCell("B").alignment = center();

  ws1.views = [{ showGridLines: false }];

  // ── HOJA 2: RESUMEN EJECUTIVO ─────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Resumen Ejecutivo");
  ws2.columns = [
    { width: 3 }, { width: 28 }, { width: 14 }, { width: 12 }, { width: 36 }, { width: 3 },
  ];

  addSheetHeader(ws2, "RESUMEN EJECUTIVO", "Global — Administración", periodLabel, now);

  // Por Estado
  addSectionTitle(ws2, "Distribución por Estado");
  addTableHeaders(ws2, ["Estado", "Cantidad", "Porcentaje", "Distribución visual"]);
  for (const key of ["RAD", "PRO", "RES", "CER"]) {
    const cnt = byStatus[key] ?? 0;
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_STATUS_LABEL[key as keyof typeof PQRS_STATUS_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r, getStatusFill(key), getStatusFont(key));
  }
  styleTotalsRow(ws2.addRow(["", "TOTAL", totalF, "100%", ""]));
  ws2.addRow([]);

  // Por Tipo
  addSectionTitle(ws2, "Distribución por Tipo de PQRS");
  addTableHeaders(ws2, ["Tipo", "Cantidad", "Porcentaje", "Distribución visual"]);
  for (const [key, cnt] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_TYPE_LABEL[key as keyof typeof PQRS_TYPE_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r);
  }
  styleTotalsRow(ws2.addRow(["", "TOTAL", totalF, "100%", ""]));
  ws2.addRow([]);

  // Por Prioridad
  addSectionTitle(ws2, "Distribución por Prioridad");
  addTableHeaders(ws2, ["Prioridad", "Cantidad", "Porcentaje", "Distribución visual"]);
  for (const [key, cnt] of Object.entries(byPrio).sort((a, b) => b[1] - a[1])) {
    const pct = totalF > 0 ? Math.round((cnt / totalF) * 100) : 0;
    const r = ws2.addRow(["", PQRS_PRIORITY_LABEL[key as keyof typeof PQRS_PRIORITY_LABEL] ?? key, cnt, `${pct}%`, visualBar(pct)]);
    r.height = 18;
    styleDataRow(r, getPrioFill(key), getPrioFont(key));
  }
  ws2.addRow([]);

  // SLA
  addSectionTitle(ws2, "Cumplimiento de SLA / Tiempos de Respuesta");
  addTableHeaders(ws2, ["Categoría", "Cantidad", "Porcentaje", "Distribución"]);
  const slaRows: [string, number, number][] = [
    ["A tiempo (dentro del SLA)", aTiempo, (aTiempo + vencidas) > 0 ? Math.round((aTiempo / (aTiempo + vencidas)) * 100) : 100],
    ["Vencidas (superaron el SLA)", vencidas, (aTiempo + vencidas) > 0 ? Math.round((vencidas / (aTiempo + vencidas)) * 100) : 0],
    ["Sin fecha límite asignada", sinFecha, totalF > 0 ? Math.round((sinFecha / totalF) * 100) : 0],
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

  // Comparativa 30 días
  addSectionTitle(ws2, "Comparativa: últimos 30 días vs 30 días anteriores");
  addTableHeaders(ws2, ["Indicador", "Período actual", "Período anterior", "Variación"]);
  const compareRows: [string, number, number][] = [
    ["Total PQRS", curr30.total, prev30.total],
    ["Resueltas", curr30.resueltas, prev30.resueltas],
    ["En proceso", curr30.enProceso, prev30.enProceso],
    ["Radicadas (sin proc.)", curr30.radicadas, prev30.radicadas],
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
  const rateC = curr30.total > 0 ? `${Math.round((curr30.resueltas / curr30.total) * 100)}%` : "0%";
  const rateP = prev30.total > 0 ? `${Math.round((prev30.resueltas / prev30.total) * 100)}%` : "0%";
  const rateRow = ws2.addRow(["", "Tasa de resolución (%)", rateC, rateP, ""]);
  rateRow.height = 18;
  styleDataRow(rateRow);
  ws2.addRow([]);

  // Resumen de tickets internos
  addSectionTitle(ws2, "Resumen de Tickets Internos (Global)");
  addTableHeaders(ws2, ["Categoría", "Cantidad", "Porcentaje", ""]);
  const tktTotal = tickets.length || 1;
  const tktSummaryRows: [string, number][] = [
    ["Tickets totales", tickets.length],
    ["Abiertos", ticketsAbiertos],
    ["En proceso", ticketsEnProceso],
    ["Resueltos / Cerrados", ticketsCerrados],
    ["Vencidos (SLA)", ticketsVencidos],
  ];
  for (const [label, cnt] of tktSummaryRows) {
    const pct = tickets.length > 0 ? Math.round((cnt / tktTotal) * 100) : 0;
    const r = ws2.addRow(["", label, cnt, label === "Tickets totales" ? "" : `${pct}%`, ""]);
    r.height = 18;
    styleDataRow(r);
  }

  ws2.views = [{ showGridLines: false }];

  // ── HOJA 3: TENDENCIA DIARIA ──────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Tendencia Diaria");
  ws3.columns = [
    { width: 3 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 30 }, { width: 3 },
  ];

  addSheetHeader(ws3, "TENDENCIA DIARIA", "Global — Administración", periodLabel, now);
  addSectionTitle(ws3, "Evolución diaria de PQRS — últimos 90 días");

  const tendHdr = ws3.addRow(["", "Fecha", "Nuevas", "Resueltas", "Acumuladas", "Barras (Nuevas)"]);
  tendHdr.height = 22;
  styleHeaderRow(tendHdr);

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

  const tendTotal = ws3.addRow([
    "", "TOTAL",
    tendencia.reduce((s, d) => s + d.total, 0),
    tendencia.reduce((s, d) => s + d.resueltas, 0),
    acum, "",
  ]);
  tendTotal.height = 18;
  styleTotalsRow(tendTotal);

  // ── HOJA 4: DETALLE PQRS ─────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Detalle PQRS");
  ws4.columns = [
    { width: 3 },   // A spacer
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
    { width: 16 },  // L Fecha límite
    { width: 10 },  // M Días gestión
    { width: 14 },  // N SLA
    { width: 16 },  // O Cerrado en
    { width: 3 },   // P spacer
  ];

  addSheetHeader(ws4, "DETALLE COMPLETO DE PQRS", "Global — Administración", periodLabel, now);

  const detHdr = ws4.addRow([
    "", "Nº Radicado", "Tipo", "Estado", "Prioridad",
    "Asunto", "Solicitante", "Tipo Solicitante", "Email",
    "Dependencia", "Fecha Radicación", "Fecha Límite",
    "Días Gestión", "SLA", "Cerrado en", "",
  ]);
  detHdr.height = 24;
  styleHeaderRow(detHdr);
  const detHdrNum = detHdr.number;

  ws4.views = [{ state: "frozen", ySplit: detHdrNum, showGridLines: false }];
  ws4.autoFilter = { from: { row: detHdrNum, column: 2 }, to: { row: detHdrNum, column: 15 } };

  for (const [i, p] of filtered.entries()) {
    const tipo = p.type_display ?? PQRS_TYPE_LABEL[p.type as keyof typeof PQRS_TYPE_LABEL] ?? p.type ?? "—";
    const estado = p.status_display ?? PQRS_STATUS_LABEL[p.status as keyof typeof PQRS_STATUS_LABEL] ?? p.status;
    const prio = PQRS_PRIORITY_LABEL[p.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? p.priority ?? "—";
    const nombre = (p.submitter
      ?? (p.user
        ? `${p.user.nombre ?? ""} ${p.user.apellido ?? ""}`.trim() || p.user.email
        : p.anonymous_submitter?.nombre ?? "")) || "Anónimo";
    const tipoSolicitante = nombre && nombre !== "Anónimo" ? "Identificado" : "Anónimo";
    const email = p.submitter_email ?? p.user?.email ?? p.anonymous_submitter?.email ?? "—";
    const dep = resolveDependencyName(p);
    const dias = daysBetween(p.created_at);
    const slaOk = !p.due_date
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

    const { fill: sFill, font: sFont } = getStatusStyle(p.status);
    const rowAlt = i % 2 !== 0;
    const bgArgb = rowAlt ? lightenArgb(sFill) : sFill;

    ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"].forEach(col => {
      const cell = r.getCell(col);
      cell.fill = solidFill(bgArgb);
      cell.border = thinBorder();
      cell.font = normalFont(10);
      cell.alignment = middleLeft();
    });

    r.getCell("D").font = boldFont(10, sFont);
    r.getCell("D").fill = solidFill(sFill);
    r.getCell("D").alignment = center();

    const { fill: pFill, font: pFont } = getPrioStyle(p.priority);
    r.getCell("E").font = boldFont(10, pFont);
    r.getCell("E").fill = solidFill(pFill);
    r.getCell("E").alignment = center();

    r.getCell("N").font = boldFont(10, slaOk === "✓ OK" ? "FF065F46" : slaOk === "✗ Vencida" ? "FFB91C1C" : C.GRAY_TEXT);
    r.getCell("N").alignment = center();

    if (dias > 30) r.getCell("M").font = boldFont(10, "FFB91C1C");
    r.getCell("M").alignment = center();
  }

  const detTotRow = ws4.addRow([
    "", `Total: ${filtered.length} registros`, "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  ]);
  detTotRow.height = 18;
  styleTotalsRow(detTotRow);

  // ── HOJA 5: POR DEPENDENCIA ───────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Por Dependencia");
  ws5.columns = [
    { width: 3 },   // A
    { width: 30 },  // B Dependencia
    { width: 12 },  // C Total
    { width: 12 },  // D Radicadas
    { width: 12 },  // E En Proceso
    { width: 12 },  // F Resueltas
    { width: 12 },  // G Cerradas
    { width: 12 },  // H Vencidas
    { width: 14 },  // I Tasa Resolución
    { width: 14 },  // J SLA %
    { width: 36 },  // K Barra visual
    { width: 3 },   // L
  ];

  addSheetHeader(ws5, "DESGLOSE POR DEPENDENCIA", "Global — Administración", periodLabel, now);
  addSectionTitle(ws5, "Gestión de PQRS por cada Dependencia / Área");

  const depHdr = ws5.addRow([
    "", "Dependencia", "Total", "Radicadas", "En Proceso",
    "Resueltas", "Cerradas", "Vencidas", "Tasa Resolución", "SLA %", "Distribución", "",
  ]);
  depHdr.height = 24;
  styleHeaderRow(depHdr);
  const depHdrNum = depHdr.number;

  ws5.views = [{ state: "frozen", ySplit: depHdrNum, showGridLines: false }];
  ws5.autoFilter = { from: { row: depHdrNum, column: 2 }, to: { row: depHdrNum, column: 11 } };

  // Agrupar PQRS por dependencia
  const pqrsByDep = new Map<string, { name: string; items: PqrsAPI[] }>();
  for (const p of filtered) {
    const deps = resolveDependencies(p);
    if (deps.length === 0) {
      // Sin dependencia asignada
      if (!pqrsByDep.has("sin_asignar")) {
        pqrsByDep.set("sin_asignar", { name: "Sin asignar", items: [] });
      }
      pqrsByDep.get("sin_asignar")!.items.push(p);
    } else {
      // Una PQRS puede estar asignada a múltiples dependencias
      for (const d of deps) {
        if (!pqrsByDep.has(d.id)) {
          pqrsByDep.set(d.id, { name: d.name, items: [] });
        }
        pqrsByDep.get(d.id)!.items.push(p);
      }
    }
  }

  // Ordenar por total descendente
  const depEntries = [...pqrsByDep.entries()].sort((a, b) => b[1].items.length - a[1].items.length);
  const maxDepTotal = Math.max(...depEntries.map(([, v]) => v.items.length), 1);

  for (const [i, [, { name, items }]] of depEntries.entries()) {
    const depTotal = items.length;
    const depRad = items.filter(p => p.status === "RAD").length;
    const depPro = items.filter(p => p.status === "PRO").length;
    const depRes = items.filter(p => p.status === "RES").length;
    const depCer = items.filter(p => p.status === "CER").length;
    const depVenc = items.filter(p => p.due_date && new Date(p.due_date) < now && p.status !== "RES" && p.status !== "CER").length;
    const depResueltas = depRes + depCer;
    const depTasaResol = depTotal > 0 ? Math.round((depResueltas / depTotal) * 100) : 0;
    const depATiempo = items.filter(p => p.due_date && (new Date(p.due_date) >= now || p.status === "RES" || p.status === "CER")).length;
    const depTasaSLA = (depATiempo + depVenc) > 0 ? Math.round((depATiempo / (depATiempo + depVenc)) * 100) : 100;
    const barPct = Math.round((depTotal / maxDepTotal) * 100);

    const r = ws5.addRow([
      "", name, depTotal, depRad, depPro, depRes, depCer, depVenc,
      `${depTasaResol}%`, `${depTasaSLA}%`, visualBar(barPct), "",
    ]);
    r.height = 18;
    const bg = i % 2 === 0 ? C.WHITE : C.ROW_ALT;
    styleDataRow(r, bg);

    // Color condicional para vencidas
    if (depVenc > 0) r.getCell("H").font = boldFont(10, "FFB91C1C");
    // Color para tasa resolución
    r.getCell("I").font = boldFont(10, depTasaResol >= 80 ? "FF065F46" : depTasaResol >= 50 ? "FFB45309" : "FFB91C1C");
    r.getCell("I").alignment = center();
    // Color para SLA
    r.getCell("J").font = boldFont(10, depTasaSLA >= 80 ? "FF065F46" : depTasaSLA >= 50 ? "FFB45309" : "FFB91C1C");
    r.getCell("J").alignment = center();
    r.getCell("C").alignment = center();
  }

  const depTotRow = ws5.addRow([
    "", `Total: ${depEntries.length} dependencias (${totalF} PQRS)`,
    "", "", "", "", "", "", "", "", "", "",
  ]);
  depTotRow.height = 18;
  styleTotalsRow(depTotRow);

  // ── HOJA 6: TICKETS INTERNOS ──────────────────────────────────────────────
  const ws6 = wb.addWorksheet("Tickets Internos");
  ws6.columns = [
    { width: 3 },   // A
    { width: 16 },  // B Nº Ticket
    { width: 12 },  // C Estado
    { width: 10 },  // D Prioridad
    { width: 30 },  // E Asunto
    { width: 22 },  // F Área Origen
    { width: 22 },  // G Área Destino
    { width: 16 },  // H Fecha creación
    { width: 16 },  // I Fecha límite
    { width: 12 },  // J SLA
    { width: 3 },   // K
  ];

  addSheetHeader(ws6, "TICKETS INTERNOS", "Global — Administración", periodLabel, now);

  addSectionTitle(ws6, `Todos los Tickets Internos (${tickets.length})`);
  const tktHdr = ws6.addRow(["", "Nº Ticket", "Estado", "Prioridad", "Asunto", "Área Origen", "Área Destino", "Fecha", "Vence", "SLA", ""]);
  tktHdr.height = 22;
  styleHeaderRow(tktHdr);
  const tktHdrNum = tktHdr.number;

  ws6.views = [{ state: "frozen", ySplit: tktHdrNum, showGridLines: false }];
  ws6.autoFilter = { from: { row: tktHdrNum, column: 2 }, to: { row: tktHdrNum, column: 10 } };

  for (const [i, t] of tickets.entries()) {
    const sla = t.is_overdue ? "✗ Vencido" : t.due_date ? "✓ OK" : "Sin fecha";
    const r = ws6.addRow([
      "",
      t.numero_ticket ?? "—",
      TICKET_STATUS_LABEL[t.status] ?? t.status,
      PQRS_PRIORITY_LABEL[t.priority as keyof typeof PQRS_PRIORITY_LABEL] ?? t.priority ?? "—",
      t.subject,
      t.origin_dependency_name ?? "—",
      t.target_dependency_name ?? "—",
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

    // Color estado
    const tsFill = getTicketStatusFill(t.status);
    r.getCell("C").fill = solidFill(tsFill);
    r.getCell("C").font = boldFont(10, getTicketStatusFont(t.status));
  }

  ws6.addRow([]);

  // Resumen de tickets
  addSectionTitle(ws6, "Resumen de Tickets por Estado");
  addTableHeaders(ws6, ["Estado", "Cantidad", "Porcentaje", ""]);
  for (const key of ["ABR", "PRO", "RES", "CER"] as const) {
    const cnt = tickets.filter(t => t.status === key).length;
    const pct = tickets.length > 0 ? Math.round((cnt / tickets.length) * 100) : 0;
    const r = ws6.addRow(["", TICKET_STATUS_LABEL[key], cnt, `${pct}%`, ""]);
    r.height = 18;
    styleDataRow(r, getTicketStatusFill(key), getTicketStatusFont(key));
  }
  styleTotalsRow(ws6.addRow(["", "TOTAL", tickets.length, "100%", ""]));

  // ── Generar y descargar ───────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const ts = now.toISOString().slice(0, 10);
  const filename = `Reporte_Admin_Global_${ts}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Resuelve el nombre de dependencia(s) de una PQRS usando dependency_names o fallback. */
function resolveDependencyName(p: PqrsAPI): string {
  if (p.dependency_names?.length) {
    return p.dependency_names.map(d => d.name).join(", ");
  }
  const depObj = p.dependency as any;
  return depObj?.name ?? depObj?.nombre ?? (typeof p.dependency === "string" ? p.dependency : "Sin asignar");
}

/** Resuelve la lista de dependencias {id, name} de una PQRS. */
function resolveDependencies(p: PqrsAPI): { id: string; name: string }[] {
  if (p.dependency_names?.length) {
    return p.dependency_names;
  }
  const depObj = p.dependency as any;
  if (depObj?.id) {
    return [{ id: depObj.id, name: depObj.name ?? depObj.nombre ?? "" }];
  }
  if (typeof p.dependency === "string" && p.dependency) {
    return [{ id: p.dependency, name: p.dependency }];
  }
  return [];
}

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
  const end = new Date(Date.now() - (multiplier - 1) * periodDays * 86_400_000);
  const start = new Date(Date.now() - multiplier * periodDays * 86_400_000);
  const sub = pqrsList.filter(p => { const d = new Date(p.created_at); return d >= start && d < end; });
  return {
    total: sub.length,
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

// ─── Helpers de estilo de hojas ─────────────────────────────────────────────

function addSheetHeader(ws: ExcelJS.Worksheet, title: string, area: string, period: string, now: Date) {
  const r1 = ws.addRow(["", title, "", "", "", ""]);
  ws.mergeCells(`B${r1.number}:E${r1.number}`);
  r1.getCell("B").font = boldFont(14, C.WHITE);
  r1.getCell("B").fill = solidFill(C.BRAND_MID);
  r1.getCell("B").alignment = center();
  r1.height = 30;

  const r2 = ws.addRow(["", `${area}  ·  ${period}  ·  ${fmtDate(now.toISOString())}`, "", "", "", ""]);
  ws.mergeCells(`B${r2.number}:E${r2.number}`);
  r2.getCell("B").font = normalFont(10, C.WHITE);
  r2.getCell("B").fill = solidFill(C.BRAND_DARK);
  r2.getCell("B").alignment = center();
  r2.height = 18;

  ws.addRow([]);
}

function addSectionTitle(ws: ExcelJS.Worksheet, text: string) {
  const r = ws.addRow(["", text, "", "", "", ""]);
  ws.mergeCells(`B${r.number}:E${r.number}`);
  r.getCell("B").font = boldFont(11, C.BRAND_MID);
  r.getCell("B").fill = solidFill(C.BRAND_LIGHT);
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
    cell.font = boldFont(10, C.WHITE);
    cell.fill = solidFill(C.BRAND_MID);
    cell.alignment = center(true);
    cell.border = thinBorder();
  });
}

function styleDataRow(
  r: ExcelJS.Row,
  bgArgb: ARGB = C.WHITE,
  fontArgb: ARGB = C.DARK_TEXT,
) {
  r.eachCell((cell, col) => {
    if (col === 1) return;
    cell.fill = solidFill(bgArgb);
    cell.font = normalFont(10, fontArgb);
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border = thinBorder();
  });
}

function styleTotalsRow(r: ExcelJS.Row) {
  r.eachCell((cell, col) => {
    if (col === 1) return;
    cell.fill = solidFill(C.BRAND_DARK);
    cell.font = boldFont(10, C.WHITE);
    cell.alignment = center();
    cell.border = thinBorder(C.BRAND_MID);
  });
  r.height = 18;
}

function addMetaRow(ws: ExcelJS.Worksheet, label: string, value: string) {
  const r = ws.addRow(["", label, "", value, "", ""]);
  ws.mergeCells(`D${r.number}:E${r.number}`);
  r.getCell("B").font = boldFont(11, C.GRAY_TEXT);
  r.getCell("B").alignment = { horizontal: "right", vertical: "middle" };
  r.getCell("D").font = boldFont(11, C.BRAND_DARK);
  r.getCell("D").alignment = middleLeft();
  r.height = 22;
}

function styleKPICard(
  ws: ExcelJS.Worksheet,
  rowNum: string,
  startCol: string,
  title: string,
  value: string,
  sub: string,
  fg: ARGB,
) {
  const c = ws.getCell(`${startCol}${rowNum}`);
  c.value = `${title}\n${value}\n${sub}`;
  c.font = { name: "Calibri", size: 11, bold: true, color: { argb: fg } };
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  c.fill = solidFill(C.HEADER_BG);
  c.border = {
    top: { style: "medium", color: { argb: fg } },
    left: { style: "medium", color: { argb: fg } },
    bottom: { style: "medium", color: { argb: fg } },
    right: { style: "medium", color: { argb: fg } },
  };
}

// ─── Paletas de estado / prioridad ──────────────────────────────────────────

function getStatusFill(key: string): ARGB {
  const map: Record<string, ARGB> = { RAD: C.RAD_BG, PRO: C.PRO_BG, RES: C.RES_BG, CER: C.CER_BG };
  return map[key] ?? C.WHITE;
}

function getStatusFont(key: string): ARGB {
  const map: Record<string, ARGB> = { RAD: C.RAD_FG, PRO: C.PRO_FG, RES: C.RES_FG, CER: C.CER_FG };
  return map[key] ?? C.DARK_TEXT;
}

function getStatusStyle(key: string): { fill: ARGB; font: ARGB } {
  return { fill: getStatusFill(key), font: getStatusFont(key) };
}

function getPrioFill(key: string): ARGB {
  const map: Record<string, ARGB> = { HIGH: C.HIGH_BG, MED: C.MED_BG, LOW: C.LOW_BG };
  return map[key] ?? C.WHITE;
}

function getPrioFont(key: string): ARGB {
  const map: Record<string, ARGB> = { HIGH: C.HIGH_FG, MED: C.MED_FG, LOW: C.LOW_FG };
  return map[key] ?? C.DARK_TEXT;
}

function getPrioStyle(key: string): { fill: ARGB; font: ARGB } {
  return { fill: getPrioFill(key), font: getPrioFont(key) };
}

function getTicketStatusFill(key: string): ARGB {
  const map: Record<string, ARGB> = { ABR: C.RAD_BG, PRO: C.PRO_BG, RES: C.RES_BG, CER: C.CER_BG };
  return map[key] ?? C.WHITE;
}

function getTicketStatusFont(key: string): ARGB {
  const map: Record<string, ARGB> = { ABR: C.RAD_FG, PRO: C.PRO_FG, RES: C.RES_FG, CER: C.CER_FG };
  return map[key] ?? C.DARK_TEXT;
}
