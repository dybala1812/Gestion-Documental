/**
 * SoftwareMatriz.tsx
 * ──────────────────────────────────────────────────────
 * Tabla de asignación de software por área: empleado × software.
 * Requiere seleccionar una dependencia.
 */
import { useEffect, useState } from "react";
import { Loader2, Package2, CheckCircle2, XCircle } from "lucide-react";
import { apiGetSoftwareMatriz, SoftwareMatriz } from "../../../lib/api_ti";
import { apiListDependencies, Dependency } from "../../../lib/api";

export function SoftwareMatrizPage() {
  const [deps, setDeps]         = useState<Dependency[]>([]);
  const [depId, setDepId]       = useState<string>("");
  const [matriz, setMatriz]     = useState<SoftwareMatriz | null>(null);
  const [loading, setLoading]   = useState(false);
  const [loadingDeps, setLD]    = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    apiListDependencies(true)
      .then((res) => setDeps(res.results))
      .catch(() => {/* silencio */})
      .finally(() => setLD(false));
  }, []);

  useEffect(() => {
    if (!depId) { setMatriz(null); return; }
    setLoading(true);
    setError(null);
    apiGetSoftwareMatriz(depId)
      .then(setMatriz)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [depId]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Package2 size={22} className="text-green-600" />
        <h1 className="text-xl font-bold">Matriz de Software</h1>
      </div>

      {/* Selector de área */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Área:</label>
        <select
          value={depId}
          onChange={(e) => setDepId(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loadingDeps}
        >
          <option value="">— Selecciona un área —</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {loadingDeps && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-green-500" />
        </div>
      )}

      {matriz && !loading && (
        <>
          <p className="text-sm text-muted-foreground">
            {matriz.empleados.length} empleado(s) · {matriz.softwares.length} software(s)
          </p>
          {matriz.empleados.length === 0 ? (
            <div className="rounded-md bg-muted p-8 text-center text-muted-foreground text-sm">
              No hay asignaciones activas para esta área.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="text-xs min-w-full">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 sticky left-0 bg-muted z-10">Empleado</th>
                    <th className="text-left px-4 py-2 sticky left-0 bg-muted">Perfil</th>
                    {matriz.softwares.map((sw) => (
                      <th key={sw} className="px-3 py-2 text-center whitespace-nowrap">{sw}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriz.empleados.map((emp, i) => (
                    <tr key={emp.nombre} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-4 py-2 font-medium sticky left-0 bg-inherit">{emp.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground">{emp.perfil_laboral}</td>
                      {matriz.softwares.map((sw) => (
                        <td key={sw} className="px-3 py-2 text-center">
                          {emp[sw] ? (
                            <CheckCircle2 size={16} className="text-green-500 inline-block" />
                          ) : (
                            <XCircle size={16} className="text-gray-200 inline-block" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
