/**
 * EquipoComputoDetail.tsx
 * Página de detalle de un equipo de cómputo (ruta: /inventario/ti/equipos/:id).
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  Loader2, Monitor, ChevronLeft, CheckCircle2, XCircle,
  Cpu, HardDrive, MemoryStick, Globe, User, Building2,
  Tag, Hash, Calendar, Package, QrCode, Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { apiGetEquipo, EquipoComputo } from "../../../lib/api_ti";
import { BitacoraModal } from "./BitacoraModal";

const TIPO_LABEL: Record<string, string> = {
  TODO_EN_UNO: "Todo en uno", TORRE: "Torre", PORTATIL: "Portátil",
  LAPTOP: "Laptop", MINI_PC: "Mini PC", OTRO: "Otro",
};
const BACKUP_COLOR: Record<string, string> = {
  OK: "bg-green-100 text-green-700",
  PENDIENTE: "bg-yellow-100 text-yellow-700",
  SIN_BACKUP: "bg-red-100 text-red-700",
  "N/A": "bg-gray-100 text-gray-600",
};
const PERIFERICO_TIPO_LABEL: Record<string, string> = {
  MONITOR: "Monitor", TECLADO: "Teclado", MOUSE: "Mouse",
  DIADEMA: "Diadema", OTRO: "Otro",
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>
      <span><span className="text-muted-foreground">{label}: </span>{value}</span>
    </div>
  );
}

export function EquipoComputoDetail() {
  const { id } = useParams<{ id: string }>();
  const [equipo, setEquipo] = useState<EquipoComputo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGetEquipo(id)
      .then(setEquipo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadQR = () => {
    const svg = document.getElementById("detail-qr-svg") as SVGElement | null;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `QR_${equipo?.hostname || id?.slice(0, 8)}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          to="/inventario/ti/equipos"
          className="p-1.5 rounded-md border hover:bg-muted text-muted-foreground"
        >
          <ChevronLeft size={18} />
        </Link>
        <Monitor size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold">
          {loading ? "Cargando…" : equipo?.hostname || "Detalle del Equipo"}
        </h1>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      )}

      {equipo && (
        <>
          {/* Estado + acciones */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={equipo.activo ? "default" : "secondary"}>
              {equipo.activo
                ? <><CheckCircle2 size={12} className="mr-1" />Activo</>
                : <><XCircle size={12} className="mr-1" />Inactivo</>}
            </Badge>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BACKUP_COLOR[equipo.estado_backup] ?? "bg-gray-100 text-gray-600"}`}>
              Backup: {equipo.estado_backup_display || equipo.estado_backup}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setShowQR(true)}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <QrCode size={14} /> Ver QR
              </button>
              <button
                onClick={() => setBitacoraOpen(true)}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Bitácora
              </button>
            </div>
          </div>

          {/* Datos principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Identificación */}
            <section className="rounded-lg border p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identificación</h3>
              <InfoRow icon={<Monitor size={14} />} label="Tipo" value={TIPO_LABEL[equipo.tipo] ?? equipo.tipo} />
              <InfoRow icon={<Tag size={14} />} label="Nivel" value={equipo.nivel_display} />
              <InfoRow icon={<Hash size={14} />} label="Serial" value={equipo.serial} />
              <InfoRow icon={<Hash size={14} />} label="N° Activo (placa)" value={equipo.no_activo} />
              <InfoRow icon={<Tag size={14} />} label="Marca" value={equipo.marca} />
              {equipo.fecha_compra && (
                <InfoRow icon={<Calendar size={14} />} label="Fecha compra" value={equipo.fecha_compra} />
              )}
            </section>

            {/* Asignación */}
            <section className="rounded-lg border p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Asignación</h3>
              <InfoRow icon={<User size={14} />} label="Empleado" value={equipo.empleado_nombre} />
              <InfoRow icon={<Tag size={14} />} label="Perfil / Cargo" value={equipo.perfil_laboral} />
              <InfoRow icon={<Building2 size={14} />} label="Área" value={equipo.dependency_nombre} />
              <InfoRow icon={<Globe size={14} />} label="Dirección IP" value={equipo.direccion_ip} />
            </section>

            {/* Especificaciones */}
            <section className="rounded-lg border p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Especificaciones técnicas</h3>
              <InfoRow icon={<Cpu size={14} />} label="Procesador" value={equipo.procesador} />
              <InfoRow icon={<MemoryStick size={14} />} label="RAM" value={equipo.memoria_ram} />
              <InfoRow icon={<HardDrive size={14} />} label="Disco duro" value={equipo.disco_duro} />
              <InfoRow icon={<Monitor size={14} />} label="Sistema operativo" value={equipo.sistema_operativo} />
            </section>

            {/* Meta */}
            <section className="rounded-lg border p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Registro</h3>
              <InfoRow icon={<User size={14} />} label="Creado por" value={equipo.created_by_nombre} />
              <InfoRow icon={<Calendar size={14} />} label="Creado" value={equipo.created_at ? new Date(equipo.created_at).toLocaleString("es-CO") : undefined} />
              <InfoRow icon={<Calendar size={14} />} label="Actualizado" value={equipo.updated_at ? new Date(equipo.updated_at).toLocaleString("es-CO") : undefined} />
              {equipo.observaciones && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Observaciones: </span>
                  {equipo.observaciones}
                </div>
              )}
            </section>
          </div>

          {/* Periféricos */}
          {equipo.perifericos.length > 0 && (
            <section className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b">
                <Package size={16} className="text-gray-500" />
                <h3 className="text-sm font-semibold">Periféricos ({equipo.perifericos.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-4 py-2">Tipo</th>
                    <th className="text-left px-4 py-2">Marca</th>
                    <th className="text-left px-4 py-2">Modelo</th>
                    <th className="text-left px-4 py-2">Serial</th>
                    <th className="text-left px-4 py-2">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipo.perifericos.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-4 py-2">{PERIFERICO_TIPO_LABEL[p.tipo] ?? p.tipo_display}</td>
                      <td className="px-4 py-2">{p.marca || "—"}</td>
                      <td className="px-4 py-2">{p.modelo || "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.serial || "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{p.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {/* ── Modal QR ── */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode size={18} /> QR del Equipo
            </DialogTitle>
          </DialogHeader>
          {equipo && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QRCodeSVG
                id="detail-qr-svg"
                value={[
                  `Hostname: ${equipo.hostname || "—"}`,
                  `Serial: ${equipo.serial || "—"}`,
                  `N° Activo: ${equipo.no_activo || "—"}`,
                  `Empleado: ${equipo.empleado_nombre || "—"}`,
                  `Área: ${equipo.dependency_nombre || "—"}`,
                  `Tipo: ${TIPO_LABEL[equipo.tipo] ?? equipo.tipo}`,
                  `IP: ${equipo.direccion_ip || "—"}`,
                  `ID: ${equipo.id}`,
                ].join("\n")}
                size={220}
                level="M"
                includeMargin
              />
              <div className="text-center text-sm text-muted-foreground">
                <p className="font-semibold text-gray-800">{equipo.hostname || "Sin hostname"}</p>
                <p className="text-xs">{equipo.serial || "—"} · {equipo.no_activo || "—"}</p>
              </div>
              <button
                onClick={downloadQR}
                className="flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                <Download size={14} /> Descargar PNG
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bitácora ── */}
      <BitacoraModal
        open={bitacoraOpen}
        onClose={() => setBitacoraOpen(false)}
        modelo="EquipoComputo"
        objetoId={equipo?.id ?? ""}
        titulo={equipo?.hostname || equipo?.id?.slice(0, 8)}
      />
    </div>
  );
}
