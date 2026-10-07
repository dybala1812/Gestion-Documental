import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Monitor, Tv2, Server, Network, Phone, PhoneCall, Package2,
  Loader2, AlertTriangle, CheckCircle2, HardDrive, Wifi, ServerCrash,
  PhoneOff, ShieldAlert, ChevronDown, ChevronUp, LayoutDashboard, LayoutGrid,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { apiGetTIResumen, TIResumen } from "../../../lib/api_ti";

// ── Tarjeta de categoría (estilo GestionAreas) ────────────────────────────
function CategoryCard({
  iconColor,
  icon,
  title,
  total,
  href,
  children,
}: {
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  total: number;
  href: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-lg ${iconColor} flex items-center justify-center shrink-0`}>
              <span className="text-white">{icon}</span>
            </div>
            <div>
              <CardTitle className="text-base leading-tight">{title}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Total registrados</p>
              <Badge variant="secondary" className="mt-1 text-xs">{total}</Badge>
            </div>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
            aria-label={open ? "Colapsar" : "Expandir"}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="space-y-1 border-t pt-3">
            {children}
          </div>
          <div className="pt-3 mt-2 border-t">
            <Button variant="outline" size="sm" asChild>
              <Link to={href}>Ver listado completo →</Link>
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Fila de stat ──────────────────────────────────────────────────────────
function StatRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${accent ?? "text-gray-700"}`}>{value}</span>
    </div>
  );
}

// ── Fila de alerta ────────────────────────────────────────────────────────
function AlertRow({
  icon,
  label,
  count,
  href,
  severity,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
  severity: "high" | "medium" | "low";
}) {
  if (count === 0) {
    return (
      <div className="flex items-center gap-3 py-2 border-b last:border-0">
        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        <span className="text-sm text-gray-500 flex-1">{label}</span>
        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">OK</Badge>
      </div>
    );
  }

  const badgeColor: Record<string, string> = {
    high:   "bg-red-100 text-red-700 border-red-300",
    medium: "bg-amber-100 text-amber-700 border-amber-300",
    low:    "bg-blue-100 text-blue-700 border-blue-300",
  };
  const iconColor: Record<string, string> = {
    high: "text-red-500",
    medium: "text-amber-500",
    low: "text-blue-500",
  };

  return (
    <Link
      to={href}
      className="flex items-center gap-3 py-2 border-b last:border-0 hover:bg-gray-50 rounded px-1 transition-colors"
    >
      <span className={`shrink-0 ${iconColor[severity]}`}>{icon}</span>
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <Badge variant="outline" className={`${badgeColor[severity]} text-xs`}>{count}</Badge>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────
export function TIDashboard() {
  const [resumen, setResumen] = useState<TIResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    apiGetTIResumen()
      .then(setResumen)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const a = resumen?.alertas;
  const totalAlertas = a
    ? a.backup_pendiente + a.equipos_inactivos + a.av_reparacion +
      a.telefonos_dañados + a.vms_detenidas + a.rack_inactivos
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Cabecera ── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <LayoutDashboard className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Panel TI — Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de activos tecnológicos institucionales</p>
        </div>
        {resumen && (
          <Badge
            variant="outline"
            className={
              totalAlertas > 0
                ? "border-red-400 text-red-600 bg-red-50 text-sm px-3 py-1"
                : "border-green-400 text-green-600 bg-green-50 text-sm px-3 py-1"
            }
          >
            {totalAlertas > 0 ? `${totalAlertas} alertas activas` : "Sin alertas"}
          </Badge>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {resumen && (
        <div className="space-y-8">

          {/* ── 1. Alertas y Pendientes ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base leading-tight">Alertas y Pendientes</CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">Requieren atención inmediata</p>
                  <Badge
                    variant="outline"
                    className={
                      totalAlertas > 0
                        ? "mt-1 text-xs border-red-300 text-red-600 bg-red-50"
                        : "mt-1 text-xs border-green-300 text-green-600 bg-green-50"
                    }
                  >
                    {totalAlertas > 0 ? `${totalAlertas} activas` : "Todo en orden"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="border-t pt-3 space-y-0">
                <AlertRow icon={<HardDrive size={16} />} label="Equipos sin backup / backup pendiente" count={a!.backup_pendiente} href="/inventario/ti/equipos" severity="high" />
                <AlertRow icon={<Monitor size={16} />} label="Equipos de cómputo inactivos" count={a!.equipos_inactivos} href="/inventario/ti/equipos" severity="medium" />
                <AlertRow icon={<Tv2 size={16} />} label="Equipos AV en reparación" count={a!.av_reparacion} href="/inventario/ti/av" severity="medium" />
                <AlertRow icon={<PhoneOff size={16} />} label="Teléfonos dañados / dados de baja" count={a!.telefonos_dañados} href="/inventario/ti/telefonos" severity="medium" />
                <AlertRow icon={<ServerCrash size={16} />} label="Máquinas virtuales detenidas" count={a!.vms_detenidas} href="/inventario/ti/servidores" severity="low" />
                <AlertRow icon={<Wifi size={16} />} label="Puertos de rack inactivos" count={a!.rack_inactivos} href="/inventario/ti/rack" severity="low" />
              </div>
            </CardContent>
          </Card>

          {/* ── 2. Categorías de inventario (grid) ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Categorías de Inventario
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

              <CategoryCard iconColor="bg-blue-500" icon={<Monitor className="h-6 w-6" />} title="Equipos de Cómputo" total={resumen.equipos_computo.total} href="/inventario/ti/equipos">
                <StatRow label="Activos" value={resumen.equipos_computo.activos} accent="text-green-600" />
                <StatRow label="Inactivos" value={resumen.equipos_computo.inactivos} accent={resumen.equipos_computo.inactivos > 0 ? "text-red-600" : "text-gray-400"} />
              </CategoryCard>

              <CategoryCard iconColor="bg-gray-600" icon={<Server className="h-6 w-6" />} title="Servidores y VMs" total={resumen.servidores.total + resumen.vms.total} href="/inventario/ti/servidores">
                <StatRow label="Servidores activos" value={resumen.servidores.activos} accent="text-green-600" />
                <StatRow label="VMs en ejecución" value={resumen.vms.running} accent="text-green-600" />
                <StatRow label="VMs detenidas" value={resumen.vms.stopped} accent={resumen.vms.stopped > 0 ? "text-amber-600" : "text-gray-400"} />
              </CategoryCard>

              <CategoryCard iconColor="bg-purple-500" icon={<Tv2 className="h-6 w-6" />} title="Equipos Audiovisuales" total={resumen.equipos_av.total} href="/inventario/ti/av">
                <StatRow label="En buen estado" value={resumen.equipos_av.buenos} accent="text-green-600" />
                <StatRow label="En reparación" value={resumen.equipos_av.reparacion} accent={resumen.equipos_av.reparacion > 0 ? "text-amber-600" : "text-gray-400"} />
              </CategoryCard>

              <CategoryCard iconColor="bg-teal-500" icon={<Network className="h-6 w-6" />} title="Rack / Red" total={resumen.puertos_rack.total} href="/inventario/ti/rack">
                <StatRow label="Activos (en uso)" value={resumen.puertos_rack.activos} accent="text-green-600" />
                <StatRow label="Libres" value={resumen.puertos_rack.libres} />
                <StatRow label="Inactivos" value={resumen.puertos_rack.inactivos} accent={resumen.puertos_rack.inactivos > 0 ? "text-amber-600" : "text-gray-400"} />
              </CategoryCard>

              <CategoryCard iconColor="bg-amber-500" icon={<PhoneCall className="h-6 w-6" />} title="Extensiones PBX" total={resumen.extensiones_pbx.total} href="/inventario/ti/pbx">
                <StatRow label="Activas" value={resumen.extensiones_pbx.activas} accent="text-green-600" />
                <StatRow
                  label="Inactivas"
                  value={resumen.extensiones_pbx.total - resumen.extensiones_pbx.activas}
                  accent={(resumen.extensiones_pbx.total - resumen.extensiones_pbx.activas) > 0 ? "text-amber-600" : "text-gray-400"}
                />
              </CategoryCard>

              <CategoryCard iconColor="bg-orange-500" icon={<Phone className="h-6 w-6" />} title="Teléfonos Corporativos" total={resumen.telefonos.total} href="/inventario/ti/telefonos">
                <StatRow label="En buen estado" value={resumen.telefonos.buenos} accent="text-green-600" />
                <StatRow
                  label="Con problemas"
                  value={resumen.telefonos.total - resumen.telefonos.buenos}
                  accent={(resumen.telefonos.total - resumen.telefonos.buenos) > 0 ? "text-amber-600" : "text-gray-400"}
                />
              </CategoryCard>

              <CategoryCard iconColor="bg-indigo-500" icon={<Package2 className="h-6 w-6" />} title="Software — Matriz por Área" total={0} href="/inventario/ti/software">
                <p className="text-sm text-gray-500 py-1">
                  Consulta la asignación de software por área y empleado desde la vista de matriz.
                </p>
              </CategoryCard>

            </div>
          </div>

          {/* ── 3. Mapa de inventario de áreas — comentado, no en despliegue ── */}
          {/* <Card className="border-2 border-emerald-200 bg-emerald-50/50">...</Card> */}

          {/* ── 4. Top áreas por equipos ── */}
          {resumen.equipos_por_area.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-gray-400" />
                Top áreas por número de equipos
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <div className="divide-y">
                    {resumen.equipos_por_area.map((item) => (
                      <div key={item.dependency__code} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-gray-700">{item.dependency__name}</span>
                        <Badge variant="secondary">{item.total}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      )}
    </div>
  );
}


