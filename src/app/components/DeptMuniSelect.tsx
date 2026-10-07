/**
 * @file DeptMuniSelect.tsx
 * @description Selector encadenado Departamento → Municipio para Colombia.
 *
 * Consume los endpoints públicos:
 *   GET /api/pqrs/geo/departamentos/
 *   GET /api/pqrs/geo/municipios/?departamento=<codigo>
 *
 * Uso con react-hook-form (Controller):
 *   <Controller
 *     name="ciudad"
 *     control={control}
 *     render={({ field }) => (
 *       <DeptMuniSelect value={field.value} onChange={field.onChange} />
 *     )}
 *   />
 */
import { useState, useEffect } from "react";
import { apiGetDepartamentos, apiGetMunicipios, type Departamento, type Municipio } from "../lib/api";

interface DeptMuniSelectProps {
  /** Nombre del municipio actualmente seleccionado (valor del campo `ciudad`). */
  value?: string;
  /** Callback invocado cuando el usuario selecciona un municipio. Recibe el nombre del municipio. */
  onChange: (municipioNombre: string) => void;
  /** Si true, deshabilita ambos selectores. */
  disabled?: boolean;
  /** Aplica estilos de error al selector de municipio. */
  hasError?: boolean;
}

const SELECT_CLS =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm " +
  "ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const SELECT_ERROR_CLS =
  "flex h-10 w-full rounded-md border border-red-400 bg-white px-3 py-2 text-sm " +
  "ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function DeptMuniSelect({ value, onChange, disabled, hasError }: DeptMuniSelectProps) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingMunis, setLoadingMunis] = useState(false);

  // Carga la lista de departamentos al montar el componente
  useEffect(() => {
    setLoadingDepts(true);
    apiGetDepartamentos()
      .then(setDepartamentos)
      .catch(console.error)
      .finally(() => setLoadingDepts(false));
  }, []);

  // Recarga municipios cuando cambia el departamento seleccionado
  useEffect(() => {
    if (!selectedDept) {
      setMunicipios([]);
      return;
    }
    setLoadingMunis(true);
    apiGetMunicipios({ departamento: selectedDept })
      .then(setMunicipios)
      .catch(console.error)
      .finally(() => setLoadingMunis(false));
  }, [selectedDept]);

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDept(e.target.value);
    onChange(""); // Limpia el municipio al cambiar departamento
  };

  const muniPlaceholder = !selectedDept
    ? "Primero seleccione un departamento"
    : loadingMunis
      ? "Cargando municipios…"
      : "Seleccione municipio…";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Selector de Departamento */}
      <div className="space-y-1">
        <label className="text-sm font-medium leading-none text-gray-700">Departamento</label>
        <select
          className={SELECT_CLS}
          value={selectedDept}
          onChange={handleDeptChange}
          disabled={disabled || loadingDepts}
          aria-label="Departamento"
        >
          <option value="">{loadingDepts ? "Cargando departamentos…" : "Seleccione departamento…"}</option>
          {departamentos.map((d) => (
            <option key={d.codigo} value={d.codigo}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de Municipio */}
      <div className="space-y-1">
        <label className="text-sm font-medium leading-none text-gray-700">
          Municipio / Ciudad
        </label>
        <select
          className={hasError ? SELECT_ERROR_CLS : SELECT_CLS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || !selectedDept || loadingMunis}
          aria-label="Municipio"
        >
          <option value="">{muniPlaceholder}</option>
          {municipios.map((m) => (
            <option key={m.codigo} value={m.nombre}>
              {m.nombre}
            </option>
          ))}
        </select>
        {/* Muestra el valor guardado anteriormente si aún no se ha elegido dept */}
        {!selectedDept && value && (
          <p className="text-xs text-gray-500">Valor actual: {value}</p>
        )}
      </div>
    </div>
  );
}
