/**
 * @file ArchivoCentralArea.tsx
 * @description Módulo superior Archivo Central (SGD) dentro de NOVA.
 *
 * Usa el navbar principal de NOVA (allí el usuario aparece como "Archivo Central")
 * y un menú lateral basado en los mockups:
 *  · Escritorio: menú fijo al hacer scroll (sticky) que termina donde empieza el footer.
 *  · Celular/tablet: el menú se abre como panel lateral desde el botón "Menú".
 * Por ahora están listas las secciones de Comunicaciones; las demás indican "Próximamente".
 */
import { useState } from "react";
import {
  Home, Upload, Truck, Inbox, FolderCheck, Archive, Search, GraduationCap,
  Mail, MailQuestion, History, BookOpen, FileText, Shield, PanelLeftClose, PanelLeftOpen,
  Menu, ChevronRight, Hammer,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { ComunicacionesArea, type SeccionComunicaciones } from "../comunicaciones/ComunicacionesArea";

type SeccionKey =
  | "inicio" | "centro-cargas" | "transferencias" | "por-clasificar" | "clasificados"
  | "archivo" | "buscar" | "historias" | "bandeja" | "correos-sin-asociar"
  | "registro-historico" | "catalogos" | "plantillas" | "auditoria";

interface MenuItem {
  key: SeccionKey;
  label: string;
  icon: React.ElementType;
  /** true = ya funciona; false = muestra "Próximamente". */
  disponible?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  { title: "General", items: [{ key: "inicio", label: "Inicio", icon: Home }] },
  {
    title: "Ingreso",
    items: [
      { key: "centro-cargas", label: "Centro de cargas", icon: Upload },
      { key: "transferencias", label: "Transferencias", icon: Truck },
    ],
  },
  {
    title: "Bandejas",
    items: [
      { key: "por-clasificar", label: "Por clasificar", icon: Inbox },
      { key: "clasificados", label: "Clasificados", icon: FolderCheck },
    ],
  },
  {
    title: "Consulta",
    items: [
      { key: "archivo", label: "Archivo", icon: Archive },
      { key: "buscar", label: "Buscar", icon: Search },
      { key: "historias", label: "Historias académicas", icon: GraduationCap },
    ],
  },
  {
    title: "Comunicaciones",
    items: [
      { key: "bandeja", label: "Bandeja", icon: Mail, disponible: true },
      { key: "correos-sin-asociar", label: "Correos sin asociar", icon: MailQuestion, disponible: true },
      { key: "registro-historico", label: "Registro histórico", icon: History, disponible: true },
    ],
  },
  {
    title: "Administración",
    items: [
      { key: "catalogos", label: "Catálogos", icon: BookOpen },
      { key: "plantillas", label: "Plantillas de correo", icon: FileText },
      { key: "auditoria", label: "Auditoría", icon: Shield },
    ],
  },
];

const todosLosItems = menuGroups.flatMap(g => g.items.map(i => ({ ...i, grupo: g.title })));

// Las tres secciones de Comunicaciones se muestran en el mismo módulo (pestañas internas).
const aComunicaciones: Partial<Record<SeccionKey, SeccionComunicaciones>> = {
  bandeja: "bandeja",
  "correos-sin-asociar": "sinAsociar",
  "registro-historico": "historico",
};
const desdeComunicaciones: Record<SeccionComunicaciones, SeccionKey> = {
  bandeja: "bandeja",
  sinAsociar: "correos-sin-asociar",
  historico: "registro-historico",
};

function Proximamente({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-6">
      <div className="relative w-24 h-24 rounded-2xl bg-white border border-[rgba(30,58,95,0.12)] shadow-sm flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-[#1e3a5f]" />
        <span className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#e8740e] text-white flex items-center justify-center shadow">
          <Hammer className="w-4 h-4" />
        </span>
      </div>
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">{item.label}</h2>
      <p className="text-[#2c3e50] max-w-md leading-relaxed">
        Esta sección del módulo Archivo Central está en construcción. Mientras tanto puedes usar
        <strong> Comunicaciones</strong> desde el menú.
      </p>
    </div>
  );
}

export function ArchivoCentralArea() {
  const { usuario } = useAuth();
  const [seccion, setSeccion] = useState<SeccionKey>("bandeja");
  const [colapsado, setColapsado] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);

  const areaNombre = usuario?.dependencyName ?? "Archivo Central";
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";
  const actual = todosLosItems.find(i => i.key === seccion)!;

  const elegir = (key: SeccionKey) => {
    setSeccion(key);
    setMenuMovil(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Lista de opciones del menú (se usa en el lateral de escritorio y en el panel de celular). */
  const listaMenu = (compacto: boolean) => (
    <nav className="space-y-5" aria-label="Menú de Archivo Central">
      {menuGroups.map(group => (
        <div key={group.title}>
          {!compacto ? (
            <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{group.title}</p>
          ) : (
            <div className="mx-3 mb-2 border-t border-[rgba(30,58,95,0.12)]" />
          )}
          <ul className="space-y-1">
            {group.items.map(item => {
              const Icon = item.icon;
              const activo = seccion === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => elegir(item.key)}
                    aria-current={activo ? "page" : undefined}
                    title={compacto ? item.label : undefined}
                    className={`relative w-full flex items-center gap-3 rounded-xl text-left transition-colors ${
                      compacto ? "justify-center h-11" : "h-11 px-3"
                    } ${
                      activo
                        ? "bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/25"
                        : "text-[#1e3a5f] hover:bg-[#f3ede1]"
                    }`}
                  >
                    {activo && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#e8740e]" />}
                    <Icon className={`w-5 h-5 shrink-0 ${activo ? "text-white" : "text-[#1e3a5f]"}`} />
                    {!compacto && (
                      <>
                        <span className="flex-1 text-sm font-semibold truncate">{item.label}</span>
                        {!item.disponible && (
                          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${activo ? "bg-white/20 text-white" : "bg-[#ede6d8] text-[#6b7a8d]"}`}>
                            Pronto
                          </span>
                        )}
                        {activo && item.disponible && <ChevronRight className="w-4 h-4 opacity-70" />}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const seccionCom = aComunicaciones[seccion];

  return (
    <div className="bg-[#f3ede1] flex items-stretch min-h-[calc(100vh-80px)]">
      {/* ── Menú lateral (escritorio) ──────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[rgba(30,58,95,0.12)] transition-[width] duration-300 ${colapsado ? "w-20" : "w-72"}`}
      >
        {/* Sticky: el menú acompaña el scroll y se detiene donde empieza el footer */}
        <div className="sticky top-0 flex flex-col max-h-screen">
          <div className={`flex items-center gap-3 border-b border-[rgba(30,58,95,0.12)] ${colapsado ? "justify-center px-2 py-4" : "px-5 py-4"}`}>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#1e3a5f] leading-tight">Archivo Central</p>
                <p className="text-xs text-[#6b7a8d] truncate">Sistema de Gestión Documental</p>
              </div>
            )}
            <button
              onClick={() => setColapsado(v => !v)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1e3a5f] hover:bg-[#f3ede1] border border-[rgba(30,58,95,0.12)]"
              title={colapsado ? "Mostrar menú" : "Contraer menú"}
              aria-label={colapsado ? "Mostrar menú" : "Contraer menú"}
            >
              {colapsado ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto py-4 ${colapsado ? "px-2" : "px-3"}`}>
            {listaMenu(colapsado)}
          </div>

          {!colapsado && (
            <div className="px-5 py-3 border-t border-[rgba(30,58,95,0.12)] bg-[#f3ede1]/50">
              <p className="text-xs font-semibold text-[#1e3a5f] truncate">{usuarioNombre}</p>
              <p className="text-xs text-[#6b7a8d] truncate">{areaNombre}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Menú en celular/tablet ─────────────────────────────────────── */}
      <Sheet open={menuMovil} onOpenChange={setMenuMovil}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-0 gap-0 overflow-y-auto bg-white">
          <SheetHeader className="px-5 py-4 border-b border-[rgba(30,58,95,0.12)] text-left">
            <SheetTitle className="text-[#1e3a5f]">Archivo Central</SheetTitle>
            <SheetDescription className="text-xs">{usuarioNombre} · {areaNombre}</SheetDescription>
          </SheetHeader>
          <div className="px-3 py-4">
            {listaMenu(false)}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 pb-12">
        {/* Ubicación + botón de menú en pantallas pequeñas (sin segundo navbar) */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setMenuMovil(true)}
            className="lg:hidden inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold shadow-sm"
          >
            <Menu className="w-4 h-4" /> Menú
          </button>
          <p className="text-sm text-[#6b7a8d] min-w-0 truncate">
            Archivo Central <span className="mx-1">›</span> {actual.grupo} <span className="mx-1">›</span>
            <span className="font-semibold text-[#1e3a5f]">{actual.label}</span>
          </p>
        </div>

        {seccionCom ? (
          <ComunicacionesArea
            areaNombre={areaNombre}
            usuarioNombre={usuarioNombre}
            seccion={seccionCom}
            onSeccionChange={s => setSeccion(desdeComunicaciones[s])}
          />
        ) : (
          <Proximamente item={actual} />
        )}
      </main>
    </div>
  );
}
