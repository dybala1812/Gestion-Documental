/**
 * @file ArchivoCentralArea.tsx
 * @description Módulo superior Archivo Central (SGD) dentro de NOVA.
 *
 * Por ahora el módulo solo contiene la sección de Comunicaciones. A medida que
 * avance el proyecto se agregarán aquí las demás funcionalidades (documentos,
 * transferencias, historias académicas, histórico, etc.).
 */
import { useAuth } from "../../context/AuthContext";
import { ComunicacionesArea } from "../comunicaciones/ComunicacionesArea";

export function ArchivoCentralArea() {
  const { usuario } = useAuth();

  const areaNombre = usuario?.dependencyName ?? "Área";
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* El módulo completo se monta aquí. Por el momento solo Comunicaciones. */}
      <ComunicacionesArea areaNombre={areaNombre} usuarioNombre={usuarioNombre} />
    </div>
  );
}
