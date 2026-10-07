import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Database, Download, FileSpreadsheet, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  apiCampusStudentPhones,
  formatApiError,
  type CampusStudentPhonesResponse,
} from "../../lib/api";

function parseInputs(raw: string): { governmentIds: string[]; emails: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const uniqueIds: string[] = [];
  const uniqueEmails: string[] = [];
  for (const line of lines) {
    if (line.includes("@")) {
      const email = line.toLowerCase();
      if (!uniqueEmails.includes(email)) uniqueEmails.push(email);
      continue;
    }
    const cedula = line.replace(/\D/g, "");
    if (!cedula) continue;
    if (!uniqueIds.includes(cedula)) uniqueIds.push(cedula);
  }
  return { governmentIds: uniqueIds, emails: uniqueEmails };
}

export function CampusStudentLookup() {
  const navigate = useNavigate();
  const [rawIds, setRawIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<CampusStudentPhonesResponse | null>(null);
  const [academicYear, setAcademicYear] = useState("");
  const [academicTerm, setAcademicTerm] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [minAverage, setMinAverage] = useState("3.0");

  const parsedInputs = useMemo(() => parseInputs(rawIds), [rawIds]);

  const handleQuery = async () => {
    if (parsedInputs.governmentIds.length === 0 && parsedInputs.emails.length === 0) {
      toast.error("Debes ingresar al menos una cédula o correo");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await apiCampusStudentPhones({
        government_ids: parsedInputs.governmentIds,
        emails: parsedInputs.emails,
        academic_year: academicYear.trim() || undefined,
        academic_term: academicTerm.trim() || undefined,
        academic_session: academicSession.trim() || undefined,
        min_average: Number(minAverage || "3.0"),
      });
      setResult(response);
      toast.success(`Consulta completada: ${response.summary.found} encontrados`);
    } catch (error) {
      toast.error("No se pudo consultar Campus", {
        description: formatApiError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!result) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      setDownloading(true);

      const wb = new ExcelJS.Workbook();
      wb.creator = "PQRS - Campus ICETEX";
      wb.created = new Date();

      const summary = wb.addWorksheet("Resumen");
      summary.columns = [
        { header: "Métrica", key: "metric", width: 30 },
        { header: "Valor", key: "value", width: 20 },
      ];
      summary.addRows([
        { metric: "Cédulas solicitadas", value: result.summary.requested },
        { metric: "Estudiantes encontrados", value: result.summary.found },
        { metric: "No encontrados", value: result.summary.missing },
        { metric: "Renovación viable", value: result.summary.renewal_ready ?? 0 },
      ]);

      const ws = wb.addWorksheet("Estudiantes Campus");
      ws.columns = [
        { header: "Código", key: "codigo", width: 18 },
        { header: "Cédula", key: "cedula", width: 18 },
        { header: "Nombre completo", key: "nombre_completo", width: 42 },
        { header: "Email institucional", key: "email_institucional", width: 34 },
        { header: "Teléfono", key: "telefono", width: 20 },
        { header: "Promedio anterior", key: "promedio_periodo_anterior", width: 18 },
        { header: "Promedio general carrera", key: "promedio_general_carrera", width: 22 },
        { header: "Cumple promedio", key: "cumple_promedio", width: 16 },
        { header: "Cumple permanencia", key: "cumple_permanencia", width: 18 },
        { header: "Detalle permanencia", key: "detalle_permanencia", width: 28 },
        { header: "Recibo generado", key: "recibo_generado", width: 16 },
        { header: "Créditos matriculados", key: "creditos_matriculados", width: 20 },
        { header: "Créditos plan", key: "creditos_plan", width: 16 },
        { header: "Cumple créditos", key: "cumple_creditos", width: 16 },
        { header: "Valor matrícula", key: "valor_matricula", width: 18 },
        { header: "Valor renovar", key: "valor_renovar", width: 18 },
        { header: "Valor asume estudiante", key: "valor_asume_estudiante", width: 22 },
        { header: "Renovación exitosa", key: "renovacion_exitosa", width: 18 },
      ];
      ws.addRows(
        result.results.map((r) => ({
          ...r,
          cumple_promedio: r.cumple_promedio == null ? "N/A" : r.cumple_promedio ? "SI" : "NO",
          cumple_permanencia: r.cumple_permanencia == null ? "N/A" : r.cumple_permanencia ? "SI" : "NO",
          recibo_generado: r.recibo_generado ? "SI" : "NO",
          cumple_creditos: r.cumple_creditos == null ? "N/A" : r.cumple_creditos ? "SI" : "NO",
          renovacion_exitosa: r.renovacion_exitosa ? "SI" : "NO",
        })),
      );

      const header = ws.getRow(1);
      header.font = { bold: true };
      header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `campus_icetex_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      toast.success("Excel descargado correctamente");
    } catch (error) {
      toast.error("No se pudo generar el Excel", {
        description: formatApiError(error),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Compact header */}
      <div className="mb-5 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/area")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Volver
        </Button>
        <Database className="h-6 w-6 text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Consulta Estudiantes Campus</h1>
      </div>

      {/* Query panel */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Textarea de IDs */}
            <div className="space-y-1.5">
              <Label htmlFor="govIds">Cédulas / correos (uno por línea)</Label>
              <Textarea
                id="govIds"
                rows={6}
                value={rawIds}
                onChange={(e) => setRawIds(e.target.value)}
                placeholder={"1002776945\ndiana.melenge.h@uniautonoma.edu.co\n1002791714"}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-400">
                Pega cédulas o correos institucionales desde Excel. Los duplicados se eliminan automáticamente.
              </p>
            </div>

            {/* Filtros + resumen + botón */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="academicYear" className="text-xs">Año (opc.)</Label>
                  <Input
                    id="academicYear"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="academicTerm" className="text-xs">Período (opc.)</Label>
                  <Input
                    id="academicTerm"
                    value={academicTerm}
                    onChange={(e) => setAcademicTerm(e.target.value)}
                    placeholder="P003"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="academicSession" className="text-xs">Sesión (opc.)</Label>
                  <Input
                    id="academicSession"
                    value={academicSession}
                    onChange={(e) => setAcademicSession(e.target.value)}
                    placeholder="S001"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="minAverage" className="text-xs">Promedio mín.</Label>
                  <Input
                    id="minAverage"
                    type="number"
                    step="0.1"
                    value={minAverage}
                    onChange={(e) => setMinAverage(e.target.value)}
                    placeholder="3.0"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-700">Resumen de carga</p>
                <p>Identificadores únicos: <span className="font-semibold">{parsedInputs.governmentIds.length + parsedInputs.emails.length}</span></p>
                <p>Cédulas: <span className="font-semibold">{parsedInputs.governmentIds.length}</span> · Correos: <span className="font-semibold">{parsedInputs.emails.length}</span></p>
              </div>

              <Button onClick={handleQuery} disabled={loading} className="mt-auto bg-indigo-600 hover:bg-indigo-700">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consultando Campus...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Consultar estudiantes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-indigo-600" />
                Resultados
              </CardTitle>
              <Button
                onClick={handleDownloadExcel}
                disabled={downloading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Solicitados</p>
                <p className="text-lg font-semibold">{result.summary.requested}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Encontrados</p>
                <p className="text-lg font-semibold text-emerald-600">{result.summary.found}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">No encontrados</p>
                <p className="text-lg font-semibold text-amber-600">{result.summary.missing}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Renovación viable</p>
                <p className="text-lg font-semibold text-indigo-600">{result.summary.renewal_ready ?? 0}</p>
              </div>
            </div>

            {/* Tabla de resultados */}
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Código</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Cédula</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Teléfono</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Promedio</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Prom. carrera</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Permanencia</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Recibo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Créditos</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Val. matrícula</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Asume est.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Renovación</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row, idx) => (
                    <tr key={`${row.cedula}-${idx}`} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.codigo || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.cedula || "-"}</td>
                      <td className="px-3 py-2 min-w-[180px]">{row.nombre_completo || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.email_institucional || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.telefono || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.promedio_periodo_anterior ?? "-"}
                        {row.cumple_promedio == null ? "" : (
                          <span className={row.cumple_promedio ? " text-emerald-600" : " text-red-500"}>
                            {row.cumple_promedio ? " ✓" : " ✗"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.promedio_general_carrera ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.cumple_permanencia == null
                          ? <span className="text-gray-400">N/A</span>
                          : row.cumple_permanencia
                            ? <span className="text-emerald-600">SI</span>
                            : <span className="text-red-500">NO</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.recibo_generado
                          ? <span className="text-emerald-600">SI</span>
                          : <span className="text-red-500">NO</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.creditos_matriculados ?? "-"}/{row.creditos_plan ?? "-"}
                        {row.cumple_creditos == null ? "" : (
                          <span className={row.cumple_creditos ? " text-emerald-600" : " text-red-500"}>
                            {row.cumple_creditos ? " ✓" : " ✗"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.valor_matricula ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.valor_asume_estudiante ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.renovacion_exitosa
                          ? <span className="font-medium text-emerald-600">SI</span>
                          : <span className="text-gray-500">NO</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <p className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                El Excel incluye hoja de resumen y detalle completo de estudiantes.
              </p>
              {(result.unresolved_emails?.length ?? 0) > 0 && (
                <p className="text-amber-600">
                  {result.unresolved_emails?.length} correo(s) sin cruce en Campus
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
