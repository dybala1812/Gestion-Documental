/**
 * @file LoginTemporal.tsx
 * @description ⚠️ TEMPORAL — BORRAR ANTES DEL DESPLIEGUE (ver ia_contexto/login-temporal.md).
 * Ingreso de pruebas en /login-temporal: se elige el perfil del SGD (y la dependencia, si el perfil
 * es Dependencia) y se escribe la clave de pruebas del backend. Sirve para revisar los permisos de
 * cada perfil sin pasar por NOVA. Solo existe con `npm run dev` y VITE_LOGIN_TEMPORAL=true.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  apiLoginTemporal, apiOpcionesLoginTemporal, borrarSesionTemporal, leerSesionTemporal,
  type OpcionesLoginTemporal, type PerfilSGD,
} from "../../lib/loginTemporal";

export default function LoginTemporal() {
  const [opciones, setOpciones] = useState<OpcionesLoginTemporal | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [perfil, setPerfil] = useState<PerfilSGD>("archivo_central");
  const [dependenciaId, setDependenciaId] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const activa = leerSesionTemporal();

  useEffect(() => {
    apiOpcionesLoginTemporal().then(setOpciones).catch((e) => setErrorCarga(e instanceof Error ? e.message : String(e)));
  }, []);

  const entrar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (perfil === "dependencia" && !dependenciaId) { setError({ mensaje: "Elija la dependencia", campo: "dependencia_id" }); return; }
    if (!clave) { setError({ mensaje: "Escriba la clave de pruebas", campo: "clave" }); return; }
    setEnviando(true);
    try {
      await apiLoginTemporal(perfil, clave, perfil === "dependencia" ? Number(dependenciaId) : undefined);
      // Recarga completa: el contexto de autenticación lee la sesión al iniciar.
      window.location.assign("/archivo-central");
    } catch (e) {
      setError({ mensaje: e instanceof Error ? e.message : String(e), campo: (e as { campo?: string }).campo });
      setClave("");
    } finally {
      setEnviando(false);
    }
  };

  const salir = () => { borrarSesionTemporal(); window.location.assign("/login-temporal"); };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Ingreso temporal solo para pruebas en desarrollo. Usa usuarios ficticios y se elimina antes del despliegue.
        </p>
        <h1 className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]">
          <KeyRound className="h-5 w-5 text-orange-500" /> Archivo Central · ingreso de pruebas
        </h1>
        <p className="mt-1 text-sm text-gray-500">Elija el perfil con el que quiere probar los permisos.</p>

        {activa && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-700">Sesión activa: <strong>{activa.usuario.apellido}</strong>{activa.usuario.dependencia ? ` · ${activa.usuario.dependencia}` : ""}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.location.assign("/archivo-central")}>Ir al módulo</Button>
              <Button size="sm" variant="outline" onClick={salir}><LogOut className="h-4 w-4" /> Salir</Button>
            </span>
          </div>
        )}

        {errorCarga ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{errorCarga}</p>
        ) : !opciones ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando perfiles…</p>
        ) : (
          <form onSubmit={entrar} className="mt-5 space-y-4" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-gray-700">Perfil</legend>
              <div className="grid gap-2">
                {opciones.perfiles.map((p) => (
                  <label key={p.perfil}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                      perfil === p.perfil ? "border-[#1e3a5f] bg-[#1e3a5f]/5" : "border-gray-200 hover:bg-gray-50"}`}>
                    <input type="radio" name="perfil" value={p.perfil} checked={perfil === p.perfil}
                      onChange={() => setPerfil(p.perfil)} className="mt-1 accent-[#1e3a5f]" />
                    <span>
                      <span className="block text-sm font-semibold text-[#1e3a5f]">{p.nombre}</span>
                      <span className="block text-xs text-gray-500">{p.descripcion}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {perfil === "dependencia" && (
              <div>
                <label htmlFor="lt-dependencia" className="mb-1 block text-sm font-semibold text-gray-700">Dependencia</label>
                <select id="lt-dependencia" value={dependenciaId} onChange={(e) => setDependenciaId(e.target.value)}
                  aria-invalid={error?.campo === "dependencia_id"}
                  className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${error?.campo === "dependencia_id" ? "border-red-400" : "border-gray-200"}`}>
                  <option value="">Elegir…</option>
                  {opciones.dependencias.map((d) => <option key={d.id} value={d.id}>{d.codigo} · {d.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="lt-clave" className="mb-1 block text-sm font-semibold text-gray-700">Clave de pruebas</label>
              <Input id="lt-clave" type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)}
                aria-invalid={error?.campo === "clave"}
                className={error?.campo === "clave" ? "border-red-400" : "border-gray-200"} />
              <p className="mt-1 text-xs text-gray-500">Está en el .env.local del backend (SGD_LOGIN_TEMPORAL_CLAVE).</p>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error.mensaje}</p>}

            <Button type="submit" disabled={enviando} className="w-full bg-[#1e3a5f] text-white hover:bg-[#152a45]">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Entrar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
