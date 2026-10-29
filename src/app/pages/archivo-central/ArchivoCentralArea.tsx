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
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sileo, Toaster as SileoToaster } from "sileo";
import "sileo/styles.css";
import {
  Home, Upload, Truck, Inbox, FolderCheck, Archive, Search, GraduationCap,
  Mail, MailQuestion, History, BookOpen, FileText, Shield, PanelLeftClose, PanelLeftOpen,
  Menu, ChevronRight, Hammer,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { ComunicacionesArea, type SeccionComunicaciones } from "../comunicaciones/ComunicacionesArea";
import { CentroDeCargas } from "./CentroDeCargas";
import { Transferencias, type TipoEntrega } from "./Transferencias";
import { Inicio } from "./Inicio";
import { PorClasificar } from "./PorClasificar";
import { Clasificados } from "./Clasificados";
import { Archivo } from "./Archivo";
import { CatalogosArea } from "./CatalogosArea";
import { PlantillasArea } from "./PlantillasArea";
import { AuditoriaArea } from "./AuditoriaArea";
import { apiListComunicaciones } from "../../lib/comunicacionesApi";

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
  { title: "General", items: [{ key: "inicio", label: "Inicio", icon: Home, disponible: true }] },
  {
    title: "Ingreso",
    items: [
      { key: "centro-cargas", label: "Centro de cargas", icon: Upload, disponible: true },
      { key: "transferencias", label: "Transferencias", icon: Truck, disponible: true },
    ],
  },
  {
    title: "Bandejas",
    items: [
      { key: "por-clasificar", label: "Por clasificar", icon: Inbox, disponible: true },
      { key: "clasificados", label: "Clasificados", icon: FolderCheck, disponible: true },
    ],
  },
  {
    title: "Consulta",
    items: [
      { key: "archivo", label: "Archivo", icon: Archive, disponible: true },
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
      { key: "catalogos", label: "Catálogos", icon: BookOpen, disponible: true },
      { key: "plantillas", label: "Plantillas de correo", icon: FileText, disponible: true },
      { key: "auditoria", label: "Auditoría", icon: Shield, disponible: true },
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
  const [seccion, setSeccion] = useState<SeccionKey>("inicio");
  const [colapsado, setColapsado] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  /** Tipo de entrega con el que se abre el asistente de Transferencias (viene de Centro de cargas B/C). */
  const [tipoTransferencia, setTipoTransferencia] = useState<TipoEntrega | undefined>();

  const areaNombre = usuario?.dependencyName ?? "Archivo Central";
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";
  const actual = todosLosItems.find(i => i.key === seccion)!;

  // ── Polling de nuevas comunicaciones: alerta y recarga de bandeja ─────────
  const [recargarBandeja, setRecargarBandeja] = useState(0);
  const ultimaComunicacionId = useRef<number | null>(null);

  useEffect(() => {
    const consultar = async () => {
      try {
        const lista = await apiListComunicaciones({ estado: "nueva", limite: 1 });
        const ultima = lista[0];
        if (!ultima) return;
        if (ultimaComunicacionId.current && ultima.id !== ultimaComunicacionId.current) {
          sileo.info({
            title: `Nueva comunicación: ${ultima.consecutivo}`,
            description: ultima.asunto || "Ha llegado un correo nuevo a la bandeja",
          });
          setRecargarBandeja(v => v + 1);
        }
        ultimaComunicacionId.current = ultima.id;
      } catch {
        // Silencioso: no saturar con errores de red.
      }
    };

    consultar();
    const intervalo = setInterval(consultar, 15000);
    return () => clearInterval(intervalo);
  }, []);

  const actualizarUltimaComunicacionId = (id: number | undefined) => {
    if (id) ultimaComunicacionId.current = id;
  };

  /** Navega a una sección. Siempre limpia el tipo de transferencia: así el menú lleva a la lista. */
  const elegir = (key: SeccionKey) => {
    setTipoTransferencia(undefined);
    setSeccion(key);
    setMenuMovil(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Desde Centro de cargas (B o C): abre Transferencias con el asistente ya iniciado. */
  const irATransferencias = (tipo: TipoEntrega) => {
    elegir("transferencias");
    setTipoTransferencia(tipo); // va después de elegir(): gana este valor
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
      {/* En el body: AreaDashboard envuelve el módulo en un div con animate-fade-slide-up (termina en translateY(0)),
          que atrapa a todo lo "fixed" y haría que la alerta se desplace con la página. */}
      {createPortal(<SileoToaster position="top-center" />, document.body)}
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

        {seccion === "catalogos" ? (
          <CatalogosArea usuarioNombre={usuarioNombre} />
        ) : seccion === "plantillas" ? (
          <PlantillasArea />
        ) : seccion === "auditoria" ? (
          <AuditoriaArea />
        ) : seccionCom ? (
          <ComunicacionesArea
            areaNombre={areaNombre}
            usuarioNombre={usuarioNombre}
            seccion={seccionCom}
            onSeccionChange={s => setSeccion(desdeComunicaciones[s])}
            recargarTrigger={recargarBandeja}
            onUltimaComunicacionId={actualizarUltimaComunicacionId}
          />
        ) : seccion === "centro-cargas" ? (
          <CentroDeCargas onIrATransferencias={irATransferencias} />
        ) : seccion === "transferencias" ? (
          // La key remonta el componente cuando cambia el tipo, para que abra el asistente o la lista según corresponda.
          <Transferencias key={tipoTransferencia ?? "lista"} tipoInicial={tipoTransferencia} />
        ) : seccion === "inicio" ? (
          <Inicio onIrA={elegir} />
        ) : seccion === "por-clasificar" ? (
          <PorClasificar onCargarLote={() => elegir("centro-cargas")} />
        ) : seccion === "clasificados" ? (
          <Clasificados onCargarLote={() => elegir("centro-cargas")} />
        ) : seccion === "archivo" ? (
          <Archivo onCargarLote={() => elegir("centro-cargas")} />
        ) : (
          <Proximamente item={actual} />
        )}
      </main>
    </div>
  );
}