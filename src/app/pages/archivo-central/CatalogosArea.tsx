/**
 * @file pages/archivo-central/CatalogosArea.tsx
 * @description Pantalla de catálogos administrables del Archivo Central.
 *
 * Pestañas: Dependencias, TRD, Asuntos, Tipos documentales, Programas académicos,
 * Ubicaciones físicas, Usuarios y Parámetros. Cada catálogo permite listar, buscar, filtrar
 * por estado, crear, editar e inactivar (con motivo) o activar; nunca se borra.
 * Dependencias, TRD y programas se importan desde Excel con vista previa.
 * El permiso lo revisa el backend (y audita los intentos denegados).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Pencil, Power, PowerOff, ChevronLeft, ChevronRight,
  AlertCircle, Building2, FolderTree, Tag, GraduationCap, MapPin, Users, X,
  FileSpreadsheet, SlidersHorizontal, Loader2,
} from "lucide-react";
import { ImportarCatalogo } from "./ImportarCatalogo";
import { ParametrosPanel } from "./ParametrosPanel";
import { campoDelError } from "../../lib/sgdApi";
import { sileo } from "sileo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  SlugCatalogo,
  type SlugImportable,
  listarCatalogo,
  crearCatalogo,
  actualizarCatalogo,
  cambiarEstadoCatalogo,
} from "../../lib/catalogosApi";
import { formatApiError } from "../../lib/api";

type Pestana = SlugCatalogo | "parametros";
const IMPORTABLES: SlugCatalogo[] = ["dependencias", "trd", "programas"];

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Relacion {
  id: number;
  codigo?: string;
  nombre: string;
}

interface Dependencia {
  id: number;
  codigo: string;
  nombre: string;
  responsable?: string | null;
  correo_oficial: string;
  estado: string;
}

interface TRD {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  anios_gestion: number;
  anios_central: number;
  disposicion_final: string;
  estado: string;
  padre?: Relacion | null;
}

interface Asunto {
  id: number;
  nombre: string;
  descripcion?: string | null;
  estado: string;
  dependencia: Relacion;
  trd: Relacion;
}

interface TipoDocumental {
  id: number;
  nombre: string;
  estado: string;
}

interface Programa {
  id: number;
  codigo?: string | null;
  nombre: string;
  nivel: string;
  estado: string;
}

/** Posición en Archivo Central: Carro → Estante → Bandeja (D-23). Bodega y módulo: registros viejos. */
interface Ubicacion {
  id: number;
  carro?: string | null;
  estante?: string | null;
  bandeja?: string | null;
  bodega?: string | null;
  modulo?: string | null;
  descripcion?: string | null;
  estado: string;
}

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  username?: string | null;
  perfil?: string | null;
  estado: string;
  dependencia?: Relacion | null;
}

type FilaCatalogo = Dependencia | TRD | Asunto | TipoDocumental | Programa | Ubicacion | Usuario;

// ── Configuración de cada catálogo ─────────────────────────────────────────

type TipoCampo = "texto" | "entero" | "email" | "select" | "textarea";

interface CampoForm {
  key: string;
  label: string;
  tipo: TipoCampo;
  opciones?: { value: string; label: string }[];
  relacion?: "dependencias" | "trd";
  requerido?: boolean;
  placeholder?: string;
}

interface ConfigCatalogo {
  slug: SlugCatalogo;
  label: string;
  icon: React.ElementType;
  columnas: { key: string; label: string; ancho?: string; render?: (r: FilaCatalogo) => React.ReactNode }[];
  campos: CampoForm[];
}

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const DISPOSICION_LABEL: Record<string, string> = {
  conservacion_total: "Conservación total",
  eliminacion: "Eliminación",
  seleccion: "Selección",
  digitalizacion: "Digitalización",
};

const NIVEL_LABEL: Record<string, string> = {
  pregrado: "Pregrado",
  posgrado: "Posgrado",
  especializacion: "Especialización",
  maestria: "Maestría",
  doctorado: "Doctorado",
};

const PERFIL_LABEL: Record<string, string> = {
  archivo_central: "Archivo Central",
  dependencia: "Dependencia",
  registro_academico: "Registro Académico",
  secretaria_general: "Secretaría General",
  administrador: "Administrador",
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge
      className={
        estado === "activo"
          ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
          : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100"
      }
    >
      {estado === "activo" ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export function CatalogosArea({ usuarioNombre: _usuarioNombre }: { usuarioNombre: string }) {
  const [tab, setTab] = useState<Pestana>("dependencias");
  const [importando, setImportando] = useState(false);
  // Inactivar exige motivo (queda en la auditoría).
  const [inactivando, setInactivando] = useState<FilaCatalogo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | "activo" | "inactivo">("todos");
  /** Programas académicos: filtra por nivel (p. ej. solo las especializaciones de posgrado). */
  const [nivelFiltro, setNivelFiltro] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(20);
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<FilaCatalogo[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);

  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [trdList, setTrdList] = useState<TRD[]>([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<FilaCatalogo | null>(null);

  const configs: ConfigCatalogo[] = useMemo(
    () => [
      {
        slug: "dependencias",
        label: "Dependencias",
        icon: Building2,
        columnas: [
          { key: "codigo", label: "Código", ancho: "w-24" },
          { key: "nombre", label: "Nombre" },
          { key: "responsable", label: "Responsable", render: (r) => (r as Dependencia).responsable ?? "—" },
          { key: "correo", label: "Correo", render: (r) => (r as Dependencia).correo_oficial },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as Dependencia).estado} /> },
        ],
        campos: [
          { key: "codigo", label: "Código", tipo: "texto", requerido: true, placeholder: "Ej. 100" },
          { key: "nombre", label: "Nombre", tipo: "texto", requerido: true, placeholder: "Ej. Rectoría" },
          { key: "responsable", label: "Responsable", tipo: "texto", placeholder: "Nombre del responsable" },
          { key: "correo_oficial", label: "Correo oficial", tipo: "email", requerido: true, placeholder: "correo@uniautonoma.edu.co" },
        ],
      },
      {
        slug: "trd",
        label: "TRD",
        icon: FolderTree,
        columnas: [
          { key: "codigo", label: "Código", ancho: "w-28" },
          { key: "nombre", label: "Nombre" },
          { key: "padre", label: "Serie padre", render: (r) => (r as TRD).padre?.nombre ?? "—" },
          { key: "gestion", label: "Gestión", render: (r) => `${(r as TRD).anios_gestion} años` },
          { key: "central", label: "Central", render: (r) => `${(r as TRD).anios_central} años` },
          { key: "disposicion", label: "Disposición final", render: (r) => DISPOSICION_LABEL[(r as TRD).disposicion_final] ?? (r as TRD).disposicion_final },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as TRD).estado} /> },
        ],
        campos: [
          { key: "codigo", label: "Código", tipo: "texto", requerido: true, placeholder: "Ej. 100.03" },
          { key: "nombre", label: "Nombre", tipo: "texto", requerido: true },
          { key: "serie_padre_id", label: "Serie padre", tipo: "entero", relacion: "trd" },
          { key: "descripcion", label: "Descripción", tipo: "textarea", placeholder: "Uso de la serie/subserie" },
          { key: "anios_gestion", label: "Años gestión", tipo: "entero", requerido: true },
          { key: "anios_central", label: "Años central", tipo: "entero", requerido: true },
          {
            key: "disposicion_final",
            label: "Disposición final",
            tipo: "select",
            requerido: true,
            opciones: [
              { value: "conservacion_total", label: "Conservación total" },
              { value: "eliminacion", label: "Eliminación" },
              { value: "seleccion", label: "Selección" },
              { value: "digitalizacion", label: "Digitalización" },
            ],
          },
        ],
      },
      {
        slug: "asuntos",
        label: "Asuntos por dependencia",
        icon: Tag,
        columnas: [
          { key: "dependencia", label: "Dependencia", render: (r) => (r as Asunto).dependencia?.nombre ?? "—" },
          { key: "nombre", label: "Asunto" },
          { key: "trd", label: "TRD", render: (r) => `${(r as Asunto).trd?.codigo} · ${(r as Asunto).trd?.nombre}` },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as Asunto).estado} /> },
        ],
        campos: [
          { key: "dependencia_id", label: "Dependencia", tipo: "entero", relacion: "dependencias", requerido: true },
          { key: "nombre", label: "Nombre del asunto", tipo: "texto", requerido: true },
          { key: "trd_id", label: "TRD", tipo: "entero", relacion: "trd", requerido: true },
          { key: "descripcion", label: "Descripción", tipo: "textarea" },
        ],
      },
      {
        slug: "tipos-documentales",
        label: "Tipos documentales",
        icon: FileIcon,
        columnas: [
          { key: "nombre", label: "Nombre" },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as TipoDocumental).estado} /> },
        ],
        campos: [{ key: "nombre", label: "Nombre", tipo: "texto", requerido: true }],
      },
      {
        slug: "programas",
        label: "Programas académicos",
        icon: GraduationCap,
        columnas: [
          { key: "codigo", label: "Código", ancho: "w-32" },
          { key: "nombre", label: "Nombre" },
          { key: "nivel", label: "Nivel", render: (r) => NIVEL_LABEL[(r as Programa).nivel] ?? (r as Programa).nivel },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as Programa).estado} /> },
        ],
        campos: [
          { key: "codigo", label: "Código", tipo: "texto", placeholder: "Opcional" },
          { key: "nombre", label: "Nombre", tipo: "texto", requerido: true },
          {
            key: "nivel",
            label: "Nivel",
            tipo: "select",
            requerido: true,
            opciones: [
              { value: "pregrado", label: "Pregrado" },
              { value: "especializacion", label: "Especialización" },
              { value: "maestria", label: "Maestría" },
              { value: "doctorado", label: "Doctorado" },
            ],
          },
        ],
      },
      {
        slug: "ubicaciones",
        label: "Ubicaciones físicas",
        icon: MapPin,
        columnas: [
          { key: "carro", label: "Carro", ancho: "w-28", render: (r) => (r as Ubicacion).carro ?? (r as Ubicacion).bodega ?? "—" },
          { key: "estante", label: "Estante", ancho: "w-28", render: (r) => (r as Ubicacion).estante ?? "—" },
          { key: "bandeja", label: "Bandeja", ancho: "w-28", render: (r) => (r as Ubicacion).bandeja ?? (r as Ubicacion).modulo ?? "—" },
          { key: "descripcion", label: "Descripción", render: (r) => (r as Ubicacion).descripcion ?? "—" },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as Ubicacion).estado} /> },
        ],
        campos: [
          { key: "carro", label: "Carro", tipo: "texto", requerido: true },
          { key: "estante", label: "Estante", tipo: "texto", requerido: true },
          { key: "bandeja", label: "Bandeja", tipo: "texto", requerido: true },
          { key: "descripcion", label: "Descripción", tipo: "textarea" },
        ],
      },
      {
        slug: "usuarios",
        label: "Usuarios",
        icon: Users,
        columnas: [
          { key: "nombre", label: "Nombre", render: (r) => `${(r as Usuario).nombre} ${(r as Usuario).apellido}` },
          { key: "email", label: "Correo" },
          { key: "dependencia", label: "Dependencia", render: (r) => (r as Usuario).dependencia?.nombre ?? "—" },
          { key: "perfil", label: "Perfil", render: (r) => PERFIL_LABEL[(r as Usuario).perfil ?? ""] ?? ((r as Usuario).perfil ?? "—") },
          { key: "estado", label: "Estado", render: (r) => <EstadoBadge estado={(r as Usuario).estado} /> },
        ],
        campos: [
          { key: "dependencia_id", label: "Dependencia", tipo: "entero", relacion: "dependencias" },
          {
            key: "perfil",
            label: "Perfil SGD",
            tipo: "select",
            opciones: [
              { value: "archivo_central", label: "Archivo Central" },
              { value: "dependencia", label: "Dependencia" },
              { value: "registro_academico", label: "Registro Académico" },
              { value: "secretaria_general", label: "Secretaría General" },
              { value: "administrador", label: "Administrador" },
            ],
          },
        ],
      },
    ],
    []
  );

  const esParametros = tab === "parametros";
  const configActual = configs.find((c) => c.slug === tab) ?? configs[0];

  // Cargar relaciones una vez
  useEffect(() => {
    listarCatalogo<Dependencia>("dependencias", { limite: 1000 })
      .then((r) => setDependencias(r.datos))
      .catch(() => setDependencias([]));
    listarCatalogo<TRD>("trd", { limite: 1000 })
      .then((r) => setTrdList(r.datos))
      .catch(() => setTrdList([]));
  }, []);

  const cargar = async () => {
    if (tab === "parametros") return;
    setCargando(true);
    try {
      const params: Record<string, string | number | undefined> = {
        pagina,
        limite,
      };
      if (estadoFiltro !== "todos") params.estado = estadoFiltro;
      if (tab === "programas" && nivelFiltro !== "todos") params.nivel = nivelFiltro;
      if (buscar.trim()) params.buscar = buscar.trim();
      const res = await listarCatalogo<FilaCatalogo>(tab, params);
      setDatos(res.datos);
      setTotalPaginas(res.totalPaginas);
      setTotal(res.total);
    } catch (e) {
      sileo.error({ title: formatApiError(e) });
      setDatos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    setPagina(1);
  }, [tab, buscar, estadoFiltro, nivelFiltro]);

  useEffect(() => {
    cargar();
  }, [tab, pagina, buscar, estadoFiltro, nivelFiltro]);

  const abrirCrear = () => {
    setEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (fila: FilaCatalogo) => {
    setEditando(fila);
    setModalAbierto(true);
  };

  const toggleEstado = async (fila: FilaCatalogo) => {
    if (tab === "parametros") return;
    if ((fila as { estado: string }).estado === "activo") {
      setMotivo("");
      setInactivando(fila);
      return;
    }
    try {
      await cambiarEstadoCatalogo(tab, (fila as { id: number }).id, "activo");
      sileo.success({ title: "Registro activado" });
      cargar();
    } catch (e) {
      sileo.error({ title: "No se pudo activar", description: formatApiError(e) });
    }
  };

  const confirmarInactivar = async () => {
    if (!inactivando || tab === "parametros" || !motivo.trim()) return;
    setCambiandoEstado(true);
    try {
      await cambiarEstadoCatalogo(tab, (inactivando as { id: number }).id, "inactivo", motivo.trim());
      sileo.success({ title: "Registro inactivado", description: "Deja de ofrecerse en los formularios nuevos; su historial se conserva." });
      setInactivando(null);
      cargar();
    } catch (e) {
      sileo.error({ title: "No se pudo inactivar", description: formatApiError(e) });
    } finally {
      setCambiandoEstado(false);
    }
  };

  const nombreFila = (f: FilaCatalogo | null) => {
    if (!f) return "";
    const o = f as unknown as Record<string, unknown>;
    if (typeof o.apellido === "string") return `${o.nombre} ${o.apellido}`;
    if ("carro" in o || "bandeja" in o) return [o.carro && `Carro ${o.carro}`, o.estante && `Estante ${o.estante}`, o.bandeja && `Bandeja ${o.bandeja}`].filter(Boolean).join(" · ") || String(o.bodega ?? "");
    return [o.codigo, o.nombre ?? o.bodega].filter(Boolean).join(" · ");
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c89b14] mb-1">Administración</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">Catálogos</h1>
          <p className="text-sm text-[#6b7a8d] mt-1">
            Dependencias, TRD, asuntos, tipos documentales, programas, ubicaciones, usuarios y parámetros.
          </p>
        </div>
        {!esParametros && (
          <div className="flex flex-wrap gap-2">
            {IMPORTABLES.includes(tab as SlugCatalogo) && (
              <Button variant="outline" onClick={() => setImportando(true)} className="border-[rgba(30,58,95,0.2)] text-[#1e3a5f] h-10 px-4">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar Excel
              </Button>
            )}
            {tab !== "usuarios" && (
              <Button onClick={abrirCrear} className="bg-[#1e3a5f] hover:bg-[#152a45] text-white shadow-sm h-10 px-4">
                <Plus className="w-4 h-4 mr-2" /> Nuevo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pestañas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Pestana)} className="w-full">
        <TabsList className="bg-white border border-[rgba(30,58,95,0.12)] p-1 rounded-xl flex-wrap h-auto gap-1">
          {configs.map((c) => {
            const Icon = c.icon;
            return (
              <TabsTrigger
                key={c.slug}
                value={c.slug}
                className="data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#1e3a5f] text-xs sm:text-sm px-3 py-2 rounded-lg"
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {c.label}
              </TabsTrigger>
            );
          })}
          <TabsTrigger
            value="parametros"
            className="data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#1e3a5f] text-xs sm:text-sm px-3 py-2 rounded-lg"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5" />
            Parámetros
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {esParametros ? <ParametrosPanel /> : (<>
      {tab === "usuarios" && (
        <p className="text-sm text-[#6b7a8d] -mt-1">
          Los usuarios llegan desde NOVA al entrar por primera vez. Aquí se les asigna el perfil del módulo y su dependencia.
        </p>
      )}

      {/* Filtros */}
      <div className="bg-white border border-[rgba(30,58,95,0.12)] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7a8d]" />
            <Input
              placeholder="Buscar..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9 border-[rgba(30,58,95,0.12)] focus-visible:ring-[#1e3a5f]"
            />
          </div>
          <Select
            value={estadoFiltro}
            onValueChange={(v) => setEstadoFiltro(v as "todos" | "activo" | "inactivo")}
          >
            <SelectTrigger className="w-full sm:w-44 border-[rgba(30,58,95,0.12)]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tab === "programas" && (
            <Select value={nivelFiltro} onValueChange={setNivelFiltro}>
              <SelectTrigger aria-label="Nivel" className="w-full sm:w-52 border-[rgba(30,58,95,0.12)]">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los niveles</SelectItem>
                {Object.entries(NIVEL_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{v === "especializacion" ? "Especializaciones (posgrado)" : l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-[rgba(30,58,95,0.12)] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f3ede1]">
              <TableRow className="hover:bg-transparent border-b border-[rgba(30,58,95,0.09)]">
                {configActual.columnas.map((col) => (
                  <TableHead key={col.key} className={`text-[#1e3a5f] text-xs font-bold uppercase tracking-wider ${col.ancho ?? ""}`}>
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[#1e3a5f] text-xs font-bold uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={configActual.columnas.length + 1} className="text-center py-16 text-[#6b7a8d]">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : datos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={configActual.columnas.length + 1} className="text-center py-16 text-[#6b7a8d]">
                    No hay registros.
                  </TableCell>
                </TableRow>
              ) : (
                datos.map((fila) => (
                  <TableRow key={(fila as { id: number }).id} className="border-b border-[rgba(30,58,95,0.06)] hover:bg-[#f3ede1]/40">
                    {configActual.columnas.map((col) => (
                      <TableCell key={col.key} className="text-sm text-[#2c3e50]">
                        {col.render ? col.render(fila) : String((fila as unknown as Record<string, unknown>)[col.key] ?? "—")}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => abrirEditar(fila)}
                          title="Editar"
                          className="text-[#1e3a5f] hover:bg-[#f3ede1]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleEstado(fila)}
                          title={(fila as { estado: string }).estado === "activo" ? "Inactivar" : "Activar"}
                          className={(fila as { estado: string }).estado === "activo" ? "text-gray-500 hover:bg-[#f3ede1]" : "text-green-600 hover:bg-green-50"}
                        >
                          {(fila as { estado: string }).estado === "activo" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[rgba(30,58,95,0.09)] bg-[#f3ede1]/30">
          <p className="text-xs text-[#6b7a8d]">
            {total} registro{total !== 1 ? "s" : ""} · Página {pagina} de {totalPaginas}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]"
            >
              Siguiente <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal CRUD */}
      <CatalogoModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        config={configActual}
        editando={editando}
        dependencias={dependencias}
        trdList={trdList}
        onGuardado={cargar}
      />

      {IMPORTABLES.includes(tab as SlugCatalogo) && (
        <ImportarCatalogo
          tabla={tab as SlugImportable}
          abierto={importando}
          onCerrar={() => setImportando(false)}
          onImportado={cargar}
        />
      )}

      {/* Inactivar con motivo */}
      <Dialog open={!!inactivando} onOpenChange={(o) => { if (!o && !cambiandoEstado) setInactivando(null); }}>
        <DialogContent className="bg-white border border-[rgba(30,58,95,0.12)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Inactivar {nombreFila(inactivando)}</DialogTitle>
            <DialogDescription className="text-[#6b7a8d]">
              No se borra: deja de ofrecerse en formularios nuevos y conserva su historial. El motivo queda en la auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="motivo-inactivar" className="text-sm font-semibold text-[#1e3a5f]">
              Motivo<span className="text-[#e8740e] ml-1">*</span>
            </Label>
            <textarea
              id="motivo-inactivar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              placeholder="Ej.: la dependencia se fusionó con otra"
              className="min-h-[80px] w-full rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-3 py-2 text-sm text-[#2c3e50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInactivando(null)} disabled={cambiandoEstado} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">
              Cancelar
            </Button>
            <Button onClick={confirmarInactivar} disabled={cambiandoEstado || !motivo.trim()} className="bg-[#1e3a5f] hover:bg-[#152a45] text-white">
              {cambiandoEstado && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Inactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>)}
    </div>
  );
}

// ── Icono para Tipos documentales (no queremos importar todo lucide) ───────
function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ── Modal de creación/edición ──────────────────────────────────────────────

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  config: ConfigCatalogo;
  editando: FilaCatalogo | null;
  dependencias: Dependencia[];
  trdList: TRD[];
  onGuardado: () => void;
}

function CatalogoModal({ abierto, onCerrar, config, editando, dependencias, trdList, onGuardado }: ModalProps) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!abierto) return;
    const inicial: Record<string, string> = {};
    if (editando) {
      config.campos.forEach((campo) => {
        const v = (editando as unknown as Record<string, unknown>)[campo.key];
        if (campo.relacion && typeof v === "object" && v && "id" in v) {
          inicial[campo.key] = String(v.id);
        } else {
          inicial[campo.key] = v !== undefined && v !== null ? String(v) : "";
        }
      });
    } else {
      config.campos.forEach((c) => {
        if (c.tipo === "select" && c.opciones) inicial[c.key] = c.opciones[0].value;
        else inicial[c.key] = "";
      });
    }
    setValores(inicial);
    setErrores({});
  }, [abierto, editando, config]);

  const relacionOpciones = (relacion?: "dependencias" | "trd") => {
    if (relacion === "dependencias") return dependencias.map((d) => ({ value: String(d.id), label: `${d.codigo} · ${d.nombre}` }));
    if (relacion === "trd") return trdList.map((t) => ({ value: String(t.id), label: `${t.codigo} · ${t.nombre}` }));
    return [];
  };

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    for (const campo of config.campos) {
      if (campo.requerido && !valores[campo.key]?.trim()) {
        nuevos[campo.key] = "Campo requerido";
      }
      if (campo.tipo === "email" && valores[campo.key] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valores[campo.key])) {
        nuevos[campo.key] = "Correo inválido";
      }
      if (campo.tipo === "entero" && valores[campo.key] && !/^\d+$/.test(valores[campo.key])) {
        nuevos[campo.key] = "Debe ser un número entero";
      }
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {};
      config.campos.forEach((c) => {
        const raw = valores[c.key];
        if (c.tipo === "entero") {
          if (raw) payload[c.key] = Number(raw);
        } else {
          payload[c.key] = raw || null;
        }
      });

      if (editando) {
        await actualizarCatalogo(config.slug, (editando as { id: number }).id, payload);
        sileo.success({ title: "Registro actualizado" });
      } else {
        await crearCatalogo(config.slug, payload);
        sileo.success({ title: "Registro creado" });
      }
      onCerrar();
      onGuardado();
    } catch (e) {
      // El backend señala el campo (p. ej. código o correo repetido) para marcarlo en el formulario.
      const campo = campoDelError(e);
      if (campo) setErrores((prev) => ({ ...prev, [campo]: formatApiError(e) }));
      sileo.error({ title: editando ? "No se guardaron los cambios" : "No se creó el registro", description: formatApiError(e) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="bg-white border border-[rgba(30,58,95,0.12)] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f]">
            {editando ? "Editar" : "Nuevo"} {config.label}
          </DialogTitle>
          <DialogDescription className="text-[#6b7a8d]">
            {editando ? "Modifique los campos necesarios." : "Complete los datos para crear el registro."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {config.campos.map((campo) => {
            const id = `campo-${campo.key}`;
            return (
              <div key={campo.key} className="grid gap-1.5">
                <Label htmlFor={id} className="text-sm font-semibold text-[#1e3a5f]">
                  {campo.label}{campo.requerido && <span className="text-[#e8740e] ml-1">*</span>}
                </Label>

                {campo.tipo === "textarea" ? (
                  <textarea
                    id={id}
                    value={valores[campo.key] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.key]: e.target.value }))}
                    placeholder={campo.placeholder}
                    className="min-h-[80px] w-full rounded-md border border-[rgba(30,58,95,0.12)] bg-white px-3 py-2 text-sm text-[#2c3e50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]"
                  />
                ) : campo.tipo === "select" || campo.relacion ? (
                  <Select
                    value={valores[campo.key] ?? ""}
                    onValueChange={(v) => setValores((prev) => ({ ...prev, [campo.key]: v }))}
                  >
                    <SelectTrigger id={id} className={`border-[rgba(30,58,95,0.12)] ${errores[campo.key] ? "border-red-400" : ""}`}>
                      <SelectValue placeholder={campo.placeholder ?? "Seleccione..."} />
                    </SelectTrigger>
                  <SelectContent>
                    {(campo.opciones ?? relacionOpciones(campo.relacion)).map((op) => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={campo.tipo === "email" ? "email" : "text"}
                    value={valores[campo.key] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.key]: e.target.value }))}
                    placeholder={campo.placeholder}
                    className={`border-[rgba(30,58,95,0.12)] focus-visible:ring-[#1e3a5f] ${errores[campo.key] ? "border-red-400" : ""}`}
                  />
                )}
                {errores[campo.key] && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errores[campo.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando}
            className="bg-[#1e3a5f] hover:bg-[#152a45] text-white"
          >
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
