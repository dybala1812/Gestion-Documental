/**
 * @file SeleccionRol.tsx
 * @description Pagina de seleccion de perfil institucional.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Globe,
  BookOpen as GraduationCap,
  Building2,
  Presentation,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  apiSolicitarRol,
  apiListDependencies,
  formatApiError,
  type Dependency,
} from "../lib/api";

const DOMINIO_INSTITUCIONAL = "uniautonoma.edu.co";

type CardTipo = "externo" | "estudiante" | "admin_area" | "docente";

function esEmailInstitucional(email: string) {
  return email.toLowerCase().endsWith(`@${DOMINIO_INSTITUCIONAL}`);
}

export function SeleccionRol() {
  const { usuario, refreshPerfil } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Destino tras completar el perfil (query param ?redirect=), por defecto /dashboard */
  const destino = searchParams.get("redirect") || "/dashboard";

  const [seleccionado, setSeleccionado] = useState<CardTipo | null>(
    (usuario?.perfil_tipo as CardTipo) ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [exitoso, setExitoso] = useState(false);

  const [carrera, setCarrera] = useState("");
  const [semestre, setSemestre] = useState<string>("");
  const [esEgresado, setEsEgresado] = useState(false);

  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [dependencyId, setDependencyId] = useState("");
  const [loadingDeps, setLoadingDeps] = useState(false);

  const email = usuario?.email ?? "";
  const tieneEmailInstitucional = esEmailInstitucional(email);

  useEffect(() => {
    if (seleccionado === "admin_area" && dependencies.length === 0) {
      setLoadingDeps(true);
      apiListDependencies(false, true)
        .then((res) => {
          const lista = Array.isArray(res) ? res : (res as { results?: Dependency[] }).results ?? [];
          setDependencies(lista);
        })
        .catch(() => toast.error("No se pudieron cargar las areas disponibles"))
        .finally(() => setLoadingDeps(false));
    }
  }, [seleccionado, dependencies.length]);

  const handleSeleccionar = (tipo: CardTipo) => {
    setSeleccionado((prev) => (prev === tipo ? null : tipo));
  };

  const handleSubmit = async () => {
    if (!seleccionado) return;

    if (seleccionado === "estudiante") {
      if (!carrera.trim()) {
        toast.error("Completa la informacion", {
          description: "El campo Carrera es requerido.",
        });
        return;
      }
      if (!esEgresado) {
        const sem = parseInt(semestre, 10);
        if (!semestre || Number.isNaN(sem) || sem < 1 || sem > 12) {
          toast.error("Semestre invalido", {
            description: "Ingresa un semestre entre 1 y 12.",
          });
          return;
        }
      }
    }

    if (seleccionado === "admin_area" && !dependencyId) {
      toast.error("Selecciona un area", {
        description: "Debes elegir el area a la que perteneces.",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (seleccionado === "externo") {
        await apiSolicitarRol({ tipo: "externo" });
        toast.success("Perfil establecido como Externo");
        await refreshPerfil();
        navigate(destino);
        return;
      }

      if (seleccionado === "estudiante") {
        await apiSolicitarRol({
          tipo: "estudiante",
          carrera: carrera.trim(),
          semestre: esEgresado ? undefined : parseInt(semestre, 10),
          es_egresado: esEgresado,
        });
        toast.success("Bienvenido, Estudiante", {
          description: "Tu perfil ha sido actualizado correctamente.",
        });
        await refreshPerfil();
        navigate(destino);
        return;
      }

      if (seleccionado === "docente") {
        await apiSolicitarRol({ tipo: "docente" });
        setExitoso(true);
        return;
      }

      await apiSolicitarRol({ tipo: "admin_area", dependency: dependencyId });
      setExitoso(true);
    } catch (err) {
      toast.error("Error al actualizar el perfil", {
        description: formatApiError(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (exitoso) {
    return (
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-100 blur-3xl" />
        </div>
        <Card className="relative z-10 w-full max-w-lg border-emerald-200 bg-white/95 text-center shadow-xl backdrop-blur">
          <CardContent className="space-y-4 px-6 pb-8 pt-10 sm:px-8">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Solicitud enviada</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Tu solicitud de perfil{" "}
              <strong>{seleccionado === "docente" ? "Docente" : "Administrativo de Area"}</strong>{" "}
              ha sido recibida. Un administrador la revisara y recibiras una notificacion por correo.
            </p>
            <p className="text-xs text-slate-500">
              Mientras tanto, tu cuenta funcionara como <strong>Externo</strong>.
            </p>
            <Button className="mt-2 w-full" onClick={() => navigate("/dashboard")}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#f8fbff] via-[#fdfefe] to-[#f5f7fb] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <Card className="overflow-hidden border border-[#d9e4f2] bg-white/95 shadow-[0_24px_60px_-42px_rgba(20,65,130,0.45)] backdrop-blur">
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-8">
              <div className="text-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#2b5da8]">
                  Configuracion de acceso
                </p>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {usuario?.perfil_tipo && usuario.perfil_tipo !== "externo"
                    ? "Cambiar perfil institucional"
                    : "Elige tu perfil"}
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  {usuario?.perfil_tipo && usuario.perfil_tipo !== "externo"
                    ? "Selecciona un nuevo perfil o solicita un cambio para habilitar funcionalidades segun tu rol."
                    : "Selecciona el perfil que mejor describe tu relacion con la universidad. Podras cambiarlo despues desde tu panel."}
                </p>
                {!tieneEmailInstitucional && (
                  <p className="mx-auto mt-4 inline-flex max-w-2xl items-center rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 sm:text-sm">
                    Tu correo ({email}) no es institucional. La solicitud quedara pendiente de aprobacion del administrador.
                  </p>
                )}
              </div>

              <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 rounded-xl border border-[#d7e2f0] bg-[#f7faff] p-2 text-xs font-medium text-slate-500 sm:text-sm">
                <div className={`rounded-lg px-3 py-2 text-center transition ${!seleccionado ? "bg-white text-slate-700 shadow-sm" : ""}`}>
                  1. Selecciona perfil
                </div>
                <div className={`rounded-lg px-3 py-2 text-center transition ${seleccionado ? "bg-white text-slate-700 shadow-sm" : ""}`}>
                  2. Completa datos
                </div>
                <div className={`rounded-lg px-3 py-2 text-center transition ${submitting ? "bg-white text-slate-700 shadow-sm" : ""}`}>
                  3. Confirmacion
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <RolCard
                  tipo="externo"
                  seleccionado={seleccionado}
                  onSeleccionar={handleSeleccionar}
                  icono={<Globe className="h-7 w-7" />}
                  color="blue"
                  titulo="Externo"
                  descripcion="Ciudadano ajeno a la universidad. Puede radicar PQRS y consultar el estado de sus solicitudes."
                  badge="Predeterminado"
                >
                  {seleccionado === "externo" && (
                    <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      No se requiere informacion adicional. Tu cuenta quedara con acceso basico al sistema.
                    </p>
                  )}
                </RolCard>

                <RolCard
                  tipo="estudiante"
                  seleccionado={seleccionado}
                  onSeleccionar={handleSeleccionar}
                  icono={<GraduationCap className="h-7 w-7" />}
                  color="indigo"
                  titulo="Estudiante"
                  descripcion="Estudiante activo de la universidad. Si no tienes correo institucional, tu solicitud sera revisada por un administrador."
                >
                  {seleccionado === "estudiante" && (
                    <div className="mt-4 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                      <div className="space-y-1">
                        <Label htmlFor="carrera" className="text-xs">Carrera *</Label>
                        <Input
                          id="carrera"
                          placeholder="Ej: Ingenieria de Sistemas"
                          value={carrera}
                          onChange={(e) => setCarrera(e.target.value)}
                          className="h-9 border-indigo-200 bg-white text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-indigo-900">
                        <input
                          type="checkbox"
                          checked={esEgresado}
                          onChange={(e) => setEsEgresado(e.target.checked)}
                          className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Ya soy egresado (culmine mi programa academico)
                      </label>
                      {!esEgresado && (
                        <div className="space-y-1">
                          <Label htmlFor="semestre" className="text-xs">Semestre actual *</Label>
                          <Input
                            id="semestre"
                            type="number"
                            min={1}
                            max={12}
                            placeholder="1 - 12"
                            value={semestre}
                            onChange={(e) => setSemestre(e.target.value)}
                            className="h-9 border-indigo-200 bg-white text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </RolCard>

                <RolCard
                  tipo="admin_area"
                  seleccionado={seleccionado}
                  onSeleccionar={handleSeleccionar}
                  icono={<Building2 className="h-7 w-7" />}
                  color="emerald"
                  titulo="Administrativo de Area"
                  descripcion="Personal administrativo de la universidad. Requiere aprobacion del administrador."
                >
                  {seleccionado === "admin_area" && (
                    <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                        Tu solicitud sera revisada por un administrador. Recibiras un correo con la respuesta.
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="dep" className="text-xs">Area a la que perteneces *</Label>
                        {loadingDeps ? (
                          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> Cargando areas...
                          </div>
                        ) : (
                          <select
                            id="dep"
                            value={dependencyId}
                            onChange={(e) => setDependencyId(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <option value="">Selecciona un area...</option>
                            {dependencies.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </RolCard>

                <RolCard
                  tipo="docente"
                  seleccionado={seleccionado}
                  onSeleccionar={handleSeleccionar}
                  icono={<Presentation className="h-7 w-7" />}
                  color="amber"
                  titulo="Docente"
                  descripcion="Docente de la universidad. Requiere aprobacion del administrador para habilitar Planes de Aula."
                >
                  {seleccionado === "docente" && (
                    <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                      Tu solicitud sera revisada por un administrador. Recibiras un correo con la respuesta.
                    </p>
                  )}
                </RolCard>
              </div>

              <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <Button
                  className="h-11 w-full max-w-sm bg-[#1f4d8f] text-base font-semibold shadow-sm hover:bg-[#163d74]"
                  disabled={!seleccionado || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : seleccionado === "admin_area" ? (
                    "Enviar solicitud"
                  ) : (
                    "Confirmar perfil"
                  )}
                </Button>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 sm:text-sm"
                  onClick={() => navigate("/dashboard")}
                >
                  {usuario?.perfil_tipo && usuario.perfil_tipo !== "externo"
                    ? "Cancelar y volver al panel"
                    : "Omitir por ahora (se asignara perfil Externo)"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface RolCardProps {
  tipo: CardTipo;
  seleccionado: CardTipo | null;
  onSeleccionar: (tipo: CardTipo) => void;
  icono: React.ReactNode;
  color: "blue" | "indigo" | "emerald" | "amber";
  titulo: string;
  descripcion: string;
  badge?: string;
  children?: React.ReactNode;
}

const COLOR_MAP = {
  blue: {
    ring: "ring-blue-500",
    bg: "bg-blue-50",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  indigo: {
    ring: "ring-indigo-500",
    bg: "bg-indigo-50",
    icon: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700",
  },
  emerald: {
    ring: "ring-emerald-500",
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
  },
  amber: {
    ring: "ring-amber-500",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
};

function RolCard({
  tipo,
  seleccionado,
  onSeleccionar,
  icono,
  color,
  titulo,
  descripcion,
  badge,
  children,
}: RolCardProps) {
  const isSelected = seleccionado === tipo;
  const c = COLOR_MAP[color];

  return (
    <div
      className={[
        "w-full rounded-2xl border transition-all duration-200",
        isSelected
          ? `${c.ring} ring-2 shadow-[0_20px_36px_-30px_rgba(34,78,156,0.95)] ${c.bg} border-transparent`
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSeleccionar(tipo)}
        className="w-full rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:p-5"
        aria-pressed={isSelected}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isSelected ? c.bg : "bg-slate-100"}`}>
            <span className={isSelected ? c.icon : "text-slate-500"}>{icono}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 sm:text-base">{titulo}</span>
              {badge && <Badge className={`px-1.5 py-0.5 text-[11px] font-medium ${c.badge}`}>{badge}</Badge>}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{descripcion}</p>
          </div>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isSelected ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {children && isSelected && (
        <div className="border-t border-slate-200/80 px-4 pb-5 pt-3 sm:px-5">{children}</div>
      )}
    </div>
  );
}
