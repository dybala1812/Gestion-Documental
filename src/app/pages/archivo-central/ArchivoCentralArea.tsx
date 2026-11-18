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
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sileo, Toaster as SileoToaster } from "sileo";
import "sileo/styles.css";
import {
  Home, Upload, Truck, Inbox, FolderCheck, Archive, Search, GraduationCap,
  Mail, MailQuestion, History, BookOpen, FileText, Shield, PanelLeftClose, PanelLeftOpen,
  Menu, ChevronRight, Hammer, LoaderCircle, ShieldAlert, RotateCw,
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
import { BusquedaAvanzada } from "./BusquedaAvanzada";
import { HistoriasAcademicas } from "./HistoriasAcademicas";
import { CatalogosArea } from "./CatalogosArea";
import { PlantillasArea } from "./PlantillasArea";
import { AuditoriaArea } from "./AuditoriaArea";
import { apiListComunicaciones } from "../../lib/comunicacionesApi";
import { apiSincronizarSesionSGD } from "../../lib/sgdApi";

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
  /** Oculto por ahora en el menú (el código sigue; se vuelve a mostrar quitando esta marca). */
  oculto?: boolean;
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
      // Ocultos por ahora (pedido del usuario, 30/10/2026).
      { key: "por-clasificar", label: "Por clasificar", icon: Inbox, disponible: true, oculto: true },
      { key: "clasificados", label: "Clasificados", icon: FolderCheck, disponible: true, oculto: true },
    ],
  },
  {
    title: "Consulta",
    items: [
      { key: "archivo", label: "Archivo", icon: Archive, disponible: true },
      { key: "buscar", label: "Buscar", icon: Search, disponible: true },
      { key: "historias", label: "Historias académicas", icon: GraduationCap, disponible: true },
    ],
  },
  {
    title: "Comunicaciones",
    items: [
      { key: "bandeja", label: "Bandeja", icon: Mail, disponible: true },
      { key: "correos-sin-asociar", label: "Correos sin asociar", icon: MailQuestion, disponible: true, oculto: true },
      { key: "registro-historico", label: "Registro histórico", icon: History, disponible: true, oculto: true },
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
  const [accesoSGD, setAccesoSGD] = useState<boolean | null>(true);
  const [validandoSesion, setValidandoSesion] = useState(false);
  const [errorSesion, setErrorSesion] = useState(false);
  const [seccion, setSeccion] = useState<SeccionKey>("inicio");
  const [colapsado, setColapsado] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  /** Tipo de entrega con el que se abre el asistente de Transferencias (viene de Centro de cargas B/C). */
  const [tipoTransferencia, setTipoTransferencia] = useState<TipoEntrega | undefined>();
  /** Comunicación que se abre en la Bandeja al elegirla en la búsqueda avanzada. */
  const [abrirComunicacionId, setAbrirComunicacionId] = useState<number | null>(null);
  /** Transferencia que se abre al elegirla en la búsqueda o en el Archivo. */
  const [abrirTransferenciaId, setAbrirTransferenciaId] = useState<number | null>(null);
  const limpiarComunicacionAbierta = useCallback(() => setAbrirComunicacionId(null), []);

  const validarSesionSGD = useCallback(async () => {
    setValidandoSesion(true);
    setErrorSesion(false);
    try {
      const resultado = await apiSincronizarSesionSGD();
      setAccesoSGD(resultado.puede_ingresar);
    } catch {
      setErrorSesion(true);
    } finally {
      setValidandoSesion(false);
    }
  }, []);

  // Modo pruebas sin login: se salta la validación contra NOVA/SGD.
  // useEffect(() => { void validarSesionSGD(); }, [validarSesionSGD]);

  const areaNombre = usuario?.dependencyName ?? "Archivo Central";
  const usuarioNombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";
  const actual = todosLosItems.find(i => i.key === seccion)!;

  // ── Polling de nuevas comunicaciones: alerta y recarga de bandeja ─────────
  const [recargarBandeja, setRecargarBandeja] = useState(0);
  const ultimaComunicacionId = useRef<number | null>(null);

  useEffect(() => {
    if (accesoSGD !== true) return;
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
  }, [accesoSGD]);

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
    <nav className="space-y-1.5 [@media(min-height:860px)]:space-y-2.5 [@media(min-height:980px)]:space-y-4" aria-label="Menú de Archivo Central">
      {menuGroups.filter(g => g.items.some(i => !i.oculto)).map(group => (
        <div key={group.title}>
          {!compacto ? (
            <p className="px-3 mb-0.5 text-[10px] [@media(min-height:980px)]:text-[11px] [@media(min-height:980px)]:mb-1 font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{group.title}</p>
          ) : (
            <div className="mx-3 mb-1.5 border-t border-[rgba(30,58,95,0.12)]" />
          )}
          <ul className="space-y-0.5 [@media(min-height:980px)]:space-y-1">
            {group.items.filter(item => !item.oculto).map(item => {
              const Icon = item.icon;
              const activo = seccion === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => elegir(item.key)}
                    aria-current={activo ? "page" : undefined}
                    title={compacto ? item.label : undefined}
                    className={`relative w-full flex items-center gap-3 rounded-xl text-left transition-colors ${
                      compacto ? "justify-center h-8 [@media(min-height:860px)]:h-9 [@media(min-height:980px)]:h-10" : "h-8 [@media(min-height:860px)]:h-9 [@media(min-height:980px)]:h-10 px-3"
                    } ${
                      activo
                        ? "bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/25"
                        : "text-[#1e3a5f] hover:bg-slate-200/60"
                    }`}
                  >
                    {activo && <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-[#e8740e]" />}
                    <Icon className={`w-5 h-5 shrink-0 ${activo ? "text-white" : "text-[#1e3a5f]"}`} />
                    {!compacto && (
                      <>
                        <span className="flex-1 text-sm font-semibold truncate">{item.label}</span>
                        {!item.disponible && (
                          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${activo ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-500"}`}>
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

  if (validandoSesion) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#f3ede1] px-4">
        <div className="flex items-center gap-3 rounded-xl border border-[rgba(30,58,95,0.12)] bg-white px-5 py-4 text-sm text-[#1e3a5f] shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Validando tu sesión de NOVA para Archivo Central…
        </div>
      </main>
    );
  }

  if (errorSesion || accesoSGD !== true) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#f3ede1] px-4 py-8">
        <section className="w-full max-w-lg rounded-2xl border border-[rgba(30,58,95,0.12)] bg-white p-6 shadow-sm" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-[#e8740e]" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-[#1e3a5f]">
                {errorSesion ? "No se pudo validar tu sesión" : "Tu cuenta aún no tiene acceso a Archivo Central"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#6b7a8d]">
                {errorSesion
                  ? "Vuelve a intentarlo. Si el problema continúa, revisa que NOVA y el servicio de Archivo Central estén disponibles."
                  : "Tu cuenta de NOVA quedó sincronizada. Solicita al administrador del SGD que revise tu perfil y dependencia para habilitar el acceso."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void validarSesionSGD()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 text-sm font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 flex items-stretch min-h-[calc(100vh-80px)]">
      {/* En el body: AreaDashboard envuelve el módulo en un div con animate-fade-slide-up (termina en translateY(0)),
          que atrapa a todo lo "fixed" y haría que la alerta se desplace con la página. */}
      {createPortal(<SileoToaster position="top-center" />, document.body)}
      {/* ── Menú lateral (escritorio) ──────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-transparent border-r border-gray-200 transition-[width] duration-300 ${colapsado ? "w-20" : "w-72"}`}
      >
        {/* Sticky: el menú acompaña el scroll y se detiene donde empieza el footer */}
        <div className="sticky top-0 flex flex-col max-h-screen">
          <div className={`flex items-center gap-3 border-b border-gray-200 ${colapsado ? "justify-center px-2 py-3" : "px-5 py-3"}`}>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#1e3a5f] leading-tight">Archivo Central</p>
                <p className="text-xs text-[#6b7a8d] truncate">Sistema de Gestión Documental</p>
              </div>
            )}
            <button
              onClick={() => setColapsado(v => !v)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1e3a5f] hover:bg-slate-200/60 border border-gray-200"
              title={colapsado ? "Mostrar menú" : "Contraer menú"}
              aria-label={colapsado ? "Mostrar menú" : "Contraer menú"}
            >
              {colapsado ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${colapsado ? "px-2" : "px-3"}`}>
            {listaMenu(colapsado)}
          </div>
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
            abrirId={abrirComunicacionId}
            onAbierta={limpiarComunicacionAbierta}
          />
        ) : seccion === "centro-cargas" ? (
          <CentroDeCargas onIrATransferencias={irATransferencias} />
        ) : seccion === "transferencias" ? (
          // La key remonta el componente cuando cambia el tipo, para que abra el asistente o la lista según corresponda.
          <Transferencias
            key={`${tipoTransferencia ?? "lista"}-${abrirTransferenciaId ?? ""}`}
            tipoInicial={tipoTransferencia}
            abrirId={abrirTransferenciaId ?? undefined}
            onAbierta={() => setAbrirTransferenciaId(null)}
          />
        ) : seccion === "inicio" ? (
          <Inicio onIrA={elegir} />
        ) : seccion === "por-clasificar" ? (
          <PorClasificar onCargarLote={() => elegir("centro-cargas")} />
        ) : seccion === "clasificados" ? (
          <Clasificados onCargarLote={() => elegir("centro-cargas")} />
        ) : seccion === "archivo" ? (
          <Archivo
            onCargarLote={() => elegir("centro-cargas")}
            onAbrirTransferencia={(id) => { setAbrirTransferenciaId(id); elegir("transferencias"); }}
          />
        ) : seccion === "buscar" ? (
          <BusquedaAvanzada
            onAbrirComunicacion={(id) => { setAbrirComunicacionId(id); elegir("bandeja"); }}
            onAbrirTransferencia={(id) => { setAbrirTransferenciaId(id); elegir("transferencias"); }}
          />
        ) : seccion === "historias" ? (
          <HistoriasAcademicas onCargar={() => elegir("centro-cargas")} />
        ) : (
          <Proximamente item={actual} />
        )}
      </main>
    </div>
  );
}
