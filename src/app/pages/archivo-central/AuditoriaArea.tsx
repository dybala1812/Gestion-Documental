/**
 * @file AuditoriaArea.tsx
 * @description Administración › Auditoría (RF-AC-023): quién hizo qué, cuándo y sobre qué registro,
 * incluidos los intentos denegados. Solo lectura: la auditoría no se edita ni se borra.
 * Permiso auditoria.consultar (Administrador); el backend registra los intentos sin permiso.
 */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ApiError, formatApiError } from "../../lib/api";
import { consultarAuditoria, type FiltrosAuditoria, type RegistroAuditoria } from "../../lib/catalogosApi";

const ACCIONES: Record<string, string> = {
  crear: "Crear", actualizar: "Actualizar", inactivar: "Inactivar", activar: "Activar", anular: "Anular",
  importar: "Importar", consultar: "Consultar", descargar: "Descargar", denegado: "Denegado", error_flujo: "Error de flujo",
};
const RECURSOS: Record<string, string> = {
  dependencia: "Dependencia", trd: "TRD", asunto: "Asunto", tipo_documental: "Tipo documental",
  programa_academico: "Programa académico", ubicacion_fisica: "Ubicación física", usuario: "Usuario",
  parametro: "Parámetro", plantilla_correo: "Plantilla de correo", documento: "Documento", lote_carga: "Lote de carga",
  transferencia: "Transferencia", inventario_item: "Inventario", comunicacion: "Comunicación",
  correo_sin_asociar: "Correo sin asociar", historia_academica: "Historia académica", auditoria: "Auditoría",
};
const RESULTADO_ESTILO: Record<string, string> = {
  ok: "bg-green-50 text-green-700 border-green-200",
  denegado: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
};
const CAMPOS_TECNICOS = new Set(["actualizado_en", "creado_en", "ultimo_acceso_en", "sincronizado_en", "datos_nova"]);

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const texto = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Campos que cambiaron entre los valores previos y los nuevos. */
function cambios(r: RegistroAuditoria): { campo: string; antes: unknown; despues: unknown }[] {
  const prev = r.valores_previos ?? {};
  const nuevo = r.valores_nuevos ?? {};
  return Object.keys({ ...prev, ...nuevo })
    .filter((k) => !CAMPOS_TECNICOS.has(k) && JSON.stringify(prev[k]) !== JSON.stringify(nuevo[k]))
    .map((k) => ({ campo: k, antes: prev[k], despues: nuevo[k] }));
}

const select = "h-10 rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-3 text-sm text-[#2c3e50]";

export function AuditoriaArea() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>({});
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<RegistroAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    // «hasta» es exclusivo en el backend: se suma un día para incluir la fecha elegida.
    const hasta = aplicados.hasta ? new Date(new Date(aplicados.hasta).getTime() + 86400000).toISOString().slice(0, 10) : undefined;
    consultarAuditoria({ ...aplicados, hasta, pagina, limite: 25 })
      .then((r) => { if (!cancelado) { setDatos(r.datos); setTotal(r.total); setTotalPaginas(Math.max(1, r.totalPaginas)); setSinPermiso(false); } })
      .catch((e) => {
        if (cancelado) return;
        if (e instanceof ApiError && e.status === 403) setSinPermiso(true);
        else setError(formatApiError(e));
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [aplicados, pagina]);

  const buscar = () => { setPagina(1); setAplicados({ ...filtros }); };
  const set = (k: keyof FiltrosAuditoria) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFiltros((f) => ({ ...f, [k]: e.target.value || undefined }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c89b14] mb-1">Administración</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">Auditoría</h1>
        <p className="text-sm text-[#6b7a8d] mt-1">Quién hizo qué y cuándo, incluidos los intentos sin permiso. No se puede editar ni borrar.</p>
      </div>

      {sinPermiso ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[rgba(30,58,95,0.12)] bg-white px-6 py-16 text-center shadow-sm">
          <ShieldAlert className="h-10 w-10 text-[#6b7a8d]" />
          <p className="font-semibold text-[#1e3a5f]">Solo el Administrador consulta la auditoría</p>
          <p className="max-w-md text-sm text-[#6b7a8d]">Su perfil no tiene ese permiso. El intento quedó registrado.</p>
        </div>
      ) : (<>
        {/* Filtros */}
        <form onSubmit={(e) => { e.preventDefault(); buscar(); }}
          className="grid gap-3 rounded-2xl border border-[rgba(30,58,95,0.12)] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold text-[#6b7a8d]">Desde
            <Input id="auditoria-desde" type="date" value={filtros.desde ?? ""} onChange={set("desde")} className="border-[rgba(30,58,95,0.12)]" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#6b7a8d]">Hasta
            <Input id="auditoria-hasta" type="date" value={filtros.hasta ?? ""} onChange={set("hasta")} className="border-[rgba(30,58,95,0.12)]" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#6b7a8d]">Acción
            <select id="auditoria-accion" value={filtros.accion ?? ""} onChange={set("accion")} className={select}>
              <option value="">Todas</option>
              {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#6b7a8d]">Recurso
            <select id="auditoria-recurso" value={filtros.recurso_tipo ?? ""} onChange={set("recurso_tipo")} className={select}>
              <option value="">Todos</option>
              {Object.entries(RECURSOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#6b7a8d]">Resultado
            <select id="auditoria-resultado" value={filtros.resultado ?? ""} onChange={set("resultado")} className={select}>
              <option value="">Todos</option>
              <option value="ok">Correcto</option>
              <option value="denegado">Denegado</option>
              <option value="error">Error</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" className="h-10 w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white"><Search className="mr-1.5 h-4 w-4" /> Buscar</Button>
          </div>
        </form>

        {/* Resultados */}
        <div className="overflow-hidden rounded-2xl border border-[rgba(30,58,95,0.12)] bg-white shadow-sm">
          {cargando ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-red-700">{error}</p>
          ) : datos.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#6b7a8d]">No hay registros con esos filtros.</p>
          ) : (
            <ul className="divide-y divide-[rgba(30,58,95,0.06)]">
              {datos.map((r) => {
                const lista = cambios(r);
                const motivo = typeof r.detalle?.motivo === "string" ? r.detalle.motivo : null;
                const expandido = abierto === r.id;
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setAbierto(expandido ? null : r.id)} aria-expanded={expandido}
                      className="grid w-full gap-1 px-4 py-3 text-left hover:bg-[#f3ede1]/40 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.2fr)_auto_20px] sm:items-center sm:gap-4">
                      <span className="text-xs tabular-nums text-[#6b7a8d]">{fechaHora(r.fecha)}</span>
                      <span className="truncate text-sm font-semibold text-[#1e3a5f]">{r.usuario ?? "Sistema (n8n)"}</span>
                      <span className="min-w-0 text-sm text-[#2c3e50]">
                        <b className="font-semibold">{ACCIONES[r.accion] ?? r.accion}</b> · {RECURSOS[r.recurso_tipo] ?? r.recurso_tipo}
                        {r.recurso_id ? <span className="text-[#6b7a8d]"> #{r.recurso_id}</span> : null}
                        {motivo && <span className="block truncate text-xs text-[#6b7a8d]">Motivo: {motivo}</span>}
                      </span>
                      <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${RESULTADO_ESTILO[r.resultado] ?? ""}`}>
                        {r.resultado === "ok" ? "Correcto" : r.resultado === "denegado" ? "Denegado" : "Error"}
                      </span>
                      <ChevronDown className={`hidden h-4 w-4 text-[#6b7a8d] transition-transform sm:block ${expandido ? "rotate-180" : ""}`} />
                    </button>
                    {expandido && (
                      <div className="bg-[#f3ede1]/30 px-4 pb-4 pt-1 text-sm">
                        {lista.length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border border-[rgba(30,58,95,0.1)] bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-[#f3ede1] text-left text-xs font-bold uppercase tracking-wider text-[#1e3a5f]">
                                <tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Antes</th><th className="px-3 py-2">Después</th></tr>
                              </thead>
                              <tbody>
                                {lista.map((c) => (
                                  <tr key={c.campo} className="border-t border-[rgba(30,58,95,0.06)] align-top">
                                    <td className="px-3 py-2 font-mono text-xs text-[#6b7a8d]">{c.campo}</td>
                                    <td className="px-3 py-2 break-words text-[#2c3e50]">{texto(c.antes)}</td>
                                    <td className="px-3 py-2 break-words text-[#2c3e50]">{texto(c.despues)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="flex items-center gap-1.5 text-[#6b7a8d]"><ShieldCheck className="h-4 w-4" />
                            {Object.keys(r.detalle ?? {}).length ? `Detalle: ${texto(r.detalle)}` : "Sin cambios de datos (consulta o acción sin valores)."}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/30 px-4 py-3 sm:flex-row">
            <p className="text-xs text-[#6b7a8d]">{total} registro{total !== 1 ? "s" : ""} · Página {pagina} de {totalPaginas}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1 || cargando} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas || cargando} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
