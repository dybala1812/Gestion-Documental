/**
 * @file GestionSolicitudesRol.tsx
 * @description Panel de administración para revisar solicitudes de perfil
 *              "Administrativo de Área" o "Docente" enviadas por usuarios.
 *
 * El admin puede aprobar (asigna la dependencia/rol al usuario) o rechazar
 * (el usuario no recibe el rol solicitado) cada solicitud pendiente.
 */
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Card, CardContent,
} from "../../components/ui/card";
import {
  CheckCircle2, XCircle, Loader2, Clock, RefreshCw,
  Building2, User2, Mail, Calendar, Search, Presentation,
} from "lucide-react";
import {
  apiListSolicitudesRol, apiRevisarSolicitudRol, formatApiError,
  type SolicitudRolAPI,
} from "../../lib/api";

type FiltroEstado = "PENDIENTE" | "APROBADA" | "RECHAZADA";

const ESTADO_BADGE: Record<SolicitudRolAPI["estado"], { label: string; className: string }> = {
  PENDIENTE:  { label: "Pendiente",  className: "bg-amber-100 text-amber-800 border-amber-200" },
  APROBADA:   { label: "Aprobada",   className: "bg-green-100 text-green-800 border-green-200" },
  RECHAZADA:  { label: "Rechazada",  className: "bg-red-100 text-red-800 border-red-200" },
};

const TIPO_BADGE: Record<SolicitudRolAPI["tipo"], { label: string; className: string }> = {
  ADMIN_AREA: { label: "Administrativo de Área", className: "bg-blue-100 text-blue-800 border-blue-200" },
  DOCENTE:    { label: "Docente",                className: "bg-purple-100 text-purple-800 border-purple-200" },
};

export function GestionSolicitudesRol() {
  const [filtro, setFiltro] = useState<FiltroEstado>("PENDIENTE");
  const [search, setSearch] = useState("");
  /** Solicitudes de los tres estados, para que las tarjetas siempre muestren su conteo real. */
  const [porEstado, setPorEstado] = useState<Record<FiltroEstado, SolicitudRolAPI[]>>({
    PENDIENTE: [], APROBADA: [], RECHAZADA: [],
  });
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  /** ID de la solicitud con el formulario de revisión expandido */
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [notas, setNotas] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [pendientes, aprobadas, rechazadas] = await Promise.all(
        (["PENDIENTE", "APROBADA", "RECHAZADA"] as FiltroEstado[]).map(async (estado) => {
          const data = await apiListSolicitudesRol(estado);
          return (Array.isArray(data) ? data : (data as any).results ?? []) as SolicitudRolAPI[];
        }),
      );
      setPorEstado({ PENDIENTE: pendientes, APROBADA: aprobadas, RECHAZADA: rechazadas });
    } catch (err) {
      toast.error("Error al cargar solicitudes", { description: formatApiError(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleRevisar = async (id: string, accion: "APROBAR" | "RECHAZAR") => {
    setProcesando(id);
    try {
      const res = await apiRevisarSolicitudRol(id, { accion, notas_admin: notas });
      toast.success(res.mensaje);
      setRevisandoId(null);
      setNotas("");
      await cargar();
    } catch (err) {
      toast.error("Error al procesar la solicitud", { description: formatApiError(err) });
    } finally {
      setProcesando(null);
    }
  };

  const abrirRevision = (id: string) => {
    setRevisandoId(prev => (prev === id ? null : id));
    setNotas("");
  };

  const coincideBusqueda = (s: SolicitudRolAPI) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.user_nombre, s.user_email, s.dep_name]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  };

  const visibleSolicitudes = porEstado[filtro].filter(coincideBusqueda);

  // Sin búsqueda, las tarjetas muestran el total real de cada estado; con búsqueda, los coincidentes.
  const totalPendientes = porEstado.PENDIENTE.filter(coincideBusqueda).length;
  const totalAprobadas = porEstado.APROBADA.filter(coincideBusqueda).length;
  const totalRechazadas = porEstado.RECHAZADA.filter(coincideBusqueda).length;

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-5xl">
        <Card className="overflow-hidden border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gestion administrativa</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Solicitudes de Rol</h2>
                <p className="mt-1 text-sm text-slate-600">Revisa, aprueba o rechaza las solicitudes de perfil de Administrativo de Area y Docente.</p>
              </div>
              <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="self-start border-slate-300 bg-white hover:bg-slate-50">
                <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-700">Pendientes</p>
                <p className="text-2xl font-semibold text-amber-800">{totalPendientes}</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-medium text-green-700">Aprobadas</p>
                <p className="text-2xl font-semibold text-green-800">{totalAprobadas}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">Rechazadas</p>
                <p className="text-2xl font-semibold text-red-800">{totalRechazadas}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["PENDIENTE", "APROBADA", "RECHAZADA"] as FiltroEstado[]).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setFiltro(e)}
                    className={[
                      "rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition-all sm:text-sm",
                      filtro === e
                        ? `${ESTADO_BADGE[e].className} shadow-sm`
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {ESTADO_BADGE[e].label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo o area"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Cargando solicitudes...
          </CardContent>
        </Card>
      ) : visibleSolicitudes.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-16 text-center text-slate-500">
            <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium">
              {search.trim()
                ? "No hay resultados para tu busqueda"
                : `No hay solicitudes ${ESTADO_BADGE[filtro].label.toLowerCase()}s`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto w-full max-w-5xl space-y-3">
          {visibleSolicitudes.map((s) => (
            <Card key={s.id} className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`border ${ESTADO_BADGE[s.estado].className}`}>
                          {s.estado === "PENDIENTE" && <Clock className="mr-1 h-3 w-3" />}
                          {s.estado === "APROBADA" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {s.estado === "RECHAZADA" && <XCircle className="mr-1 h-3 w-3" />}
                          {ESTADO_BADGE[s.estado].label}
                        </Badge>
                        <Badge className={`border ${TIPO_BADGE[s.tipo].className}`}>
                          {s.tipo === "DOCENTE" && <Presentation className="mr-1 h-3 w-3" />}
                          {s.tipo === "ADMIN_AREA" && <Building2 className="mr-1 h-3 w-3" />}
                          {TIPO_BADGE[s.tipo].label}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 font-medium text-slate-900">
                        <User2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate text-sm sm:text-base">{s.user_nombre}</span>
                      </div>
                    </div>

                    {s.estado === "PENDIENTE" && (
                      <div className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-green-300 px-3 text-sm text-green-700 hover:bg-green-50"
                          disabled={procesando === s.id}
                          onClick={() => abrirRevision(s.id)}
                        >
                          Revisar
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2 sm:text-sm">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{s.user_email}</span>
                    </div>
                    {s.tipo === "ADMIN_AREA" ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">Area solicitada: <strong className="text-slate-800">{s.dep_name}</strong></span>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Presentation className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">Solicita rol: <strong className="text-slate-800">Docente</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500 sm:col-span-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {new Date(s.creado_en).toLocaleDateString("es-CO", {
                        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {s.notas_admin && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 sm:text-sm">
                      <span className="font-medium">Nota admin:</span> {s.notas_admin}
                    </div>
                  )}

                  {s.revisado_por_email && (
                    <div className="text-xs text-slate-500 sm:text-sm">
                      Revisado por: <span className="font-medium text-slate-700">{s.revisado_por_email}</span>
                    </div>
                  )}
                </div>

                {revisandoId === s.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`notas-${s.id}`} className="text-xs sm:text-sm">
                        Notas / motivo de rechazo (opcional)
                      </Label>
                      <Textarea
                        id={`notas-${s.id}`}
                        placeholder="Escribe una nota visible para el usuario..."
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        disabled={procesando === s.id}
                        onClick={() => handleRevisar(s.id, "APROBAR")}
                      >
                        {procesando === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprobar</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        disabled={procesando === s.id}
                        onClick={() => handleRevisar(s.id, "RECHAZAR")}
                      >
                        {procesando === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><XCircle className="mr-1 h-3.5 w-3.5" /> Rechazar</>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevisandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
