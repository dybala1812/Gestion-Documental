/**
 * @file InventarioActivoPublico.tsx
 * @description Vista pública (sin login) de un activo físico — destino del QR.
 *
 * Cuando un usuario escanea el código QR pegado al equipo, su navegador
 * abre `/inventario/activo/:id`, que renderiza esta página leyendo el
 * endpoint público `GET /api/pqrs/inventory/public/assets/<uuid>/`.
 *
 * Muestra:
 *  - Datos del equipo (nombre, categoría, área, condición, N° de serie).
 *  - Galería de fotos.
 *  - Bitácora cronológica (mantenimientos, reparaciones, traslados, etc.).
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  Loader2, Package, AlertTriangle, Calendar, MapPin, History,
  ImageOff, ArrowLeft, ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  apiGetAssetPublic,
  PhysicalAssetPublicAPI,
  ASSET_LOG_TYPE_LABEL,
  AssetCondicion,
} from "../../lib/api";

const CONDICION_BADGE: Record<AssetCondicion, string> = {
  BUENO:         "bg-green-100 text-green-800 border-green-300",
  REGULAR:       "bg-yellow-100 text-yellow-800 border-yellow-300",
  MALO:          "bg-red-100 text-red-800 border-red-300",
  EN_REPARACION: "bg-orange-100 text-orange-800 border-orange-300",
};

export function InventarioActivoPublico() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset]   = useState<PhysicalAssetPublicAPI | null>(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    setLoad(true);
    apiGetAssetPublic(id)
      .then(data => { if (!cancel) setAsset(data); })
      .catch(() => { if (!cancel) setError("No se pudo cargar el activo. Verifique el código QR."); })
      .finally(() => { if (!cancel) setLoad(false); });
    return () => { cancel = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-800">Activo no encontrado</h2>
            <p className="text-sm text-gray-600">
              {error ?? "El recurso solicitado no existe o fue eliminado."}
            </p>
            <Link to="/" className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Ir al inicio
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Encabezado */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Package className="w-5 h-5 text-slate-500" />
                <span className="truncate">{asset.nombre}</span>
              </CardTitle>
              {asset.categoria && (
                <p className="text-sm text-gray-500 mt-1">{asset.categoria}</p>
              )}
            </div>
            <Badge className={`border ${CONDICION_BADGE[asset.condicion]}`}>
              {asset.condicion_display}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {asset.dependency_nombre && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-[11px] text-gray-500">Área</div>
                  <div className="font-medium text-gray-800">{asset.dependency_nombre}</div>
                </div>
              </div>
            )}
            {asset.numero_serie && (
              <div>
                <div className="text-[11px] text-gray-500">N° de serie</div>
                <div className="font-mono text-gray-800">{asset.numero_serie}</div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-gray-500">Cantidad</div>
              <div className="text-gray-800">{asset.cantidad}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">Registrado</div>
              <div className="text-gray-800">{new Date(asset.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          {asset.descripcion && (
            <p className="text-gray-700 whitespace-pre-wrap pt-2 border-t mt-2">
              {asset.descripcion}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Galería */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageOff className="w-4 h-4 text-gray-400" />
            Fotos del equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asset.images.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Sin imágenes registradas.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {asset.images.map(img => (
                <a
                  key={img.id}
                  href={img.image_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50 hover:opacity-90"
                >
                  {img.image_url ? (
                    <img src={img.image_url} alt={img.caption || asset.nombre}
                         className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageOff className="w-6 h-6" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bitácora */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            Bitácora ({asset.log_entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asset.log_entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Sin eventos registrados.
            </p>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-4">
              {asset.log_entries.map(entry => (
                <li key={entry.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-emerald-500 border border-white" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {entry.entry_type_display ?? ASSET_LOG_TYPE_LABEL[entry.entry_type]}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-800">
                      {entry.titulo}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(entry.occurred_at).toLocaleString()}
                    {entry.created_by_nombre && (
                      <span className="ml-1 truncate">· {entry.created_by_nombre}</span>
                    )}
                  </div>
                  {entry.entry_type === "TRASLADO" && (entry.ubicacion_anterior || entry.ubicacion_nueva) && (
                    <p className="text-xs text-gray-700 mt-1">
                      <span className="font-medium">{entry.ubicacion_anterior || "—"}</span>
                      {" → "}
                      <span className="font-medium">{entry.ubicacion_nueva || "—"}</span>
                    </p>
                  )}
                  {entry.descripcion && (
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                      {entry.descripcion}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
        <History className="w-3 h-3" /> Última actualización: {new Date(asset.updated_at).toLocaleString()}
      </p>
    </div>
  );
}

export default InventarioActivoPublico;
