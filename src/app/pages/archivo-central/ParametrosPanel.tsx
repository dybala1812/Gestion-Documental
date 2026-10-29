/**
 * @file ParametrosPanel.tsx
 * @description Parámetros del módulo (RF-AC-006): años antes de transferir, tamaño máximo, formatos,
 * plazos y recordatorios, umbral de la IA. La base valida tipo y rango, revisa el permiso
 * (solo Administrador) y audita cada cambio.
 */
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Save, SlidersHorizontal } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatApiError } from "../../lib/api";
import { guardarParametro, listarParametros, type Parametro } from "../../lib/catalogosApi";

function rango(p: Parametro): string | null {
  if (p.tipo !== "entero" && p.tipo !== "decimal") return null;
  if (p.minimo != null && p.maximo != null) return `Entre ${p.minimo} y ${p.maximo}`;
  if (p.minimo != null) return `Mínimo ${p.minimo}`;
  if (p.maximo != null) return `Máximo ${p.maximo}`;
  return p.tipo === "entero" ? "Número entero" : "Número";
}

export function ParametrosPanel() {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const lista = await listarParametros();
      setParametros(lista);
      setBorradores(Object.fromEntries(lista.map((p) => [p.clave, p.valor])));
    } catch (e) {
      sileo.error({ title: "No se pudieron cargar los parámetros", description: formatApiError(e) });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async (p: Parametro) => {
    const valor = (borradores[p.clave] ?? "").trim();
    setErrores((e) => ({ ...e, [p.clave]: "" }));
    setGuardando(p.clave);
    try {
      const actualizado = await guardarParametro(p.clave, valor);
      setParametros((lista) => lista.map((x) => (x.clave === p.clave ? actualizado : x)));
      sileo.success({ title: "Parámetro guardado", description: p.descripcion });
    } catch (e) {
      const msg = formatApiError(e);
      setErrores((er) => ({ ...er, [p.clave]: msg }));
      sileo.error({ title: "No se guardó el parámetro", description: msg });
    } finally {
      setGuardando(null);
    }
  };

  if (cargando) {
    return <p className="flex items-center justify-center gap-2 py-16 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando parámetros…</p>;
  }

  return (
    <div className="bg-white border border-[rgba(30,58,95,0.12)] rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/50">
        <SlidersHorizontal className="h-4 w-4 text-[#1e3a5f]" />
        <p className="text-sm text-[#2c3e50]">Valores que usa el sistema. Solo el Administrador puede cambiarlos y cada cambio queda en la auditoría.</p>
      </div>
      <ul className="divide-y divide-[rgba(30,58,95,0.06)]">
        {parametros.map((p) => {
          const id = `parametro-${p.clave}`;
          const cambiado = (borradores[p.clave] ?? "") !== p.valor;
          return (
            <li key={p.clave} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
              <div className="min-w-0">
                <label htmlFor={id} className="block text-sm font-semibold text-[#1e3a5f]">{p.descripcion}</label>
                <p className="mt-0.5 font-mono text-xs text-[#6b7a8d]">{p.clave}</p>
              </div>
              <div className="space-y-1">
                <div className="flex gap-2">
                  {p.tipo === "booleano" ? (
                    <select id={id} value={borradores[p.clave] ?? ""} onChange={(e) => setBorradores((b) => ({ ...b, [p.clave]: e.target.value }))}
                      className="h-10 flex-1 rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-3 text-sm">
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <Input id={id} value={borradores[p.clave] ?? ""}
                      inputMode={p.tipo === "entero" || p.tipo === "decimal" ? "decimal" : undefined}
                      onChange={(e) => setBorradores((b) => ({ ...b, [p.clave]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && cambiado) guardar(p); }}
                      className={`flex-1 border-[rgba(30,58,95,0.12)] ${errores[p.clave] ? "border-red-400" : ""}`} />
                  )}
                  <Button size="icon" onClick={() => guardar(p)} disabled={!cambiado || guardando === p.clave} title="Guardar"
                    className="bg-[#1e3a5f] hover:bg-[#152a45] text-white">
                    {guardando === p.clave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
                {rango(p) && !errores[p.clave] && <p className="text-xs text-[#6b7a8d]">{rango(p)}</p>}
                {p.tipo === "lista" && !errores[p.clave] && <p className="text-xs text-[#6b7a8d]">Valores separados por coma</p>}
                {errores[p.clave] && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" /> {errores[p.clave]}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
