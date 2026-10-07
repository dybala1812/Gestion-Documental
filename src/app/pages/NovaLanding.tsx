/**
 * @file NovaLanding.tsx
 * @description Landing page de NOVA — Núcleo de Operaciones Virtuales Académicas.
 */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence, useScroll, useTransform, type MotionValue } from "motion/react";
import {
  FileText,
  BookOpen as GraduationCap,
  Megaphone,
  Users,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  CheckCircle,
  LogIn,
  Bot,
  HeadphonesIcon,
  FolderOpen,
  BookMarked,
  ChevronDown,
} from "lucide-react";
import logoImage from "../../assets/logo-uniautonoma.webp";
import { API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/* ─── Paleta beige institucional ─────────────────────────── */
const C = {
  beige:    "#f3ede1",
  beigeAlt: "#ede6d8",
  navy:     "#1e3a5f",
  orange:   "#e8740e",
  gold:     "#c89b14",
  text:     "#2c3e50",
  muted:    "#6b7a8d",
  card:     "#ffffff",
  border:   "rgba(30,58,95,0.09)",
};

/** Oculta la barra de scroll del carrusel móvil sin perder la funcionalidad. */
const noScrollbarStyle: React.CSSProperties = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
} as React.CSSProperties;

/* ─── Tipo para imágenes del hero ────────────────────────── */
interface HeroImageItem {
  id: number;
  image: string;
  alt_text: string;
  order: number;
}

/* ─── Hook para cargar las franjas del hero ──────────────── */
function useHeroImages() {
  const [images, setImages] = useState<HeroImageItem[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/pqrs/hero-images/`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        // La vista puede devolver array directo o respuesta paginada {results:[...]}
        const lista: HeroImageItem[] = Array.isArray(data)
          ? data
          : (data as any).results ?? [];
        setImages(lista);
      })
      .catch(() => setImages([]));
  }, []);
  return images;
}

/* ─── Servicios ──────────────────────────────────────────── */
interface ServiceDetail {
  subtitle: string;
  intro: string;
  steps: string[];
  whoFor: string[];
  tip: string;
  norm: string;
  cta: string;
}

interface ServiceCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  accent: string;
  iconBg: string;
  available: boolean;
  detail: ServiceDetail;
}

const SERVICES: ServiceCard[] = [
  {
    icon: <Megaphone className="w-5 h-5" />,
    title: "Convocatorias",
    description:
      "Consulta y accede al módulo integrado de convocatorias, avales y contratación de UniDoc.",
    href: "https://nova.uniautonoma.edu.co/convocatorias-app",
    accent: "#b45309",
    iconBg: "#fef3c7",
    available: true,
    detail: {
      subtitle: "Módulo académico unificado",
      intro: "Desde NOVA_FT se puede entrar al flujo de Convocatorias sin saltar a otra experiencia de navegación.",
      steps: [
        "Mira las convocatorias disponibles en un solo lugar.",
        "Entra con tu cuenta y postúlate de forma fácil.",
        "Consulta el estado de tu proceso cuando quieras.",
        "Recibe novedades y seguimiento desde el mismo portal.",
      ],
      whoFor: ["Aspirantes", "Talento Humano", "Coordinadores", "Vicerrectoría", "Rectoría"],
      tip: "Todo el proceso está centralizado para que puedas acceder, postularte y hacer seguimiento desde un solo lugar.",
      norm: "Flujo documental y de avales gestionado por UniDoc.",
      cta: "Abrir convocatorias",
    },
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "PQRS",
    description:
      "Radica Peticiones, Quejas, Reclamos, Sugerencias y Felicitaciones. Consulta el estado en tiempo real.",
    href: "/pqrs",
    accent: "#1e3a5f",
    iconBg: "#e8f0f7",
    available: true,
    detail: {
      subtitle: "Gestión de solicitudes ciudadanas",
      intro: "El sistema PQRS garantiza que cada voz sea escuchada. Puedes radicar tu solicitud en minutos, sin desplazarte, y hacer seguimiento hasta la respuesta final.",
      steps: [
        "Elige el tipo: Petición, Queja, Reclamo, Sugerencia o Felicitación.",
        "Completa asunto y descripción; adjunta archivos si lo necesitas.",
        "Recibe tu número de radicado al instante.",
        "Consulta el estado en tiempo real y recibe notificaciones por correo.",
      ],
      whoFor: ["Estudiantes", "Docentes", "Personal administrativo", "Público general"],
      tip: "Puedes radicar anónimamente si no deseas revelar tu identidad.",
      norm: "Ley 1755 de 2015 — respuesta máxima de 15 días hábiles.",
      cta: "Radicar una PQRS",
    },
  },
  {
    icon: <GraduationCap className="w-5 h-5" />,
    title: "Certificados",
    description:
      "Solicita y descarga certificados académicos, laborales y de notas. Verifica su autenticidad en línea.",
    href: "/solicitud-certificados",
    accent: "#166534",
    iconBg: "#dcfce7",
    available: false,
    detail: {
      subtitle: "En desarrollo",
      steps: [],
      whoFor: [],
      tip: "",
      norm: "Deshabilitado temporalmente. Próximamente disponible.",
      cta: "",
    },
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Directorio",
    description:
      "Encuentra los datos de contacto de dependencias y funcionarios de la institución.",
    href: "/contactos",
    accent: "#5b21b6",
    iconBg: "#ede9fe",
    available: true,
    detail: {
      subtitle: "Toda la institución al alcance",
      intro: "Encuentra en segundos los datos de cualquier dependencia o funcionario. No más llamadas perdidas ni correos sin respuesta.",
      steps: [
        "Busca por nombre, dependencia o cargo del funcionario.",
        "Consulta correos, extensiones y horarios de atención.",
        "Accede a la información de cada área académica y administrativa.",
        "Contacta directamente desde la plataforma.",
      ],
      whoFor: ["Estudiantes", "Docentes", "Personal interno", "Visitantes externos"],
      tip: "Puedes copiar el correo o el teléfono con un solo clic desde la ficha del contacto.",
      norm: "Información actualizada semanalmente por las dependencias.",
      cta: "Abrir directorio",
    },
  },
];

/* ─── Módulos próximos (solo aparecen en la grilla, no en el abanico) ─── */
const COMING_SOON: ServiceCard[] = [
  {
    icon: <HeadphonesIcon className="w-5 h-5" />,
    title: "Mesa de Ayuda",
    description:
      "Reporta incidencias de sistemas, equipos o aulas y haz seguimiento a tu ticket en tiempo real.",
    href: "#",
    accent: "#0369a1",
    iconBg: "#e0f2fe",
    available: false,
    detail: {
      subtitle: "En desarrollo",
      steps: [],
      whoFor: [],
      tip: "",
      norm: "En desarrollo — previsto para el segundo semestre de 2026.",
      cta: "",
    },
  },
  {
    icon: <FolderOpen className="w-5 h-5" />,
    title: "Gestión Documental",
    description:
      "Radica documentos, consulta expedientes y da seguimiento a radicados institucionales.",
    href: "#",
    accent: "#b45309",
    iconBg: "#fef3c7",
    available: false,
    detail: {
      subtitle: "En desarrollo",
      steps: [],
      whoFor: [],
      tip: "",
      norm: "En desarrollo — previsto para el primer semestre de 2027.",
      cta: "",
    },
  },
  {
    icon: <BookMarked className="w-5 h-5" />,
    title: "Normatividad",
    description:
      "Consulta reglamentos, acuerdos del consejo, resoluciones y actos administrativos vigentes.",
    href: "#",
    accent: "#065f46",
    iconBg: "#d1fae5",
    available: false,
    detail: {
      subtitle: "En desarrollo",
      steps: [],
      whoFor: [],
      tip: "",
      norm: "En desarrollo — previsto para el primer semestre de 2027.",
      cta: "",
    },
  },
];

/* ─── Trust indicators ───────────────────────────────────── */
const TRUST = [
  { icon: <Shield      className="w-4 h-4" />, label: "Datos protegidos",    sub: "Ley 1581 de 2012"              },
  { icon: <Clock       className="w-4 h-4" />, label: "Disponible 24/7",     sub: "Sin filas ni esperas"          },
  { icon: <Zap         className="w-4 h-4" />, label: "Respuesta ágil",      sub: "Notificaciones en tiempo real" },
  { icon: <CheckCircle className="w-4 h-4" />, label: "Trazabilidad total",  sub: "Seguimiento de cada solicitud" },
];

/* ─── Tarjeta de servicio ────────────────────────────────── */
function ServiceCardItem({ card, index, forceColor = false }: { card: ServiceCard; index: number; forceColor?: boolean }) {
  const colored = card.available || forceColor;
  const isExternal = /^https?:\/\//i.test(card.href);
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      whileHover={card.available ? { y: -4 } : {}}
      className="nova-card relative flex flex-col h-full rounded-2xl bg-white transition-all duration-300"
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 4px rgba(30,58,95,0.06)",
      }}
    >
      {/* Franja lateral izquierda */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ background: colored ? card.accent : "#d1d5db" }}
      />

      <div className="flex flex-col gap-3 px-6 py-5 pl-8 flex-1">
        {/* Ícono */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: colored ? card.iconBg : "#f3f4f6",
            color: colored ? card.accent : "#9ca3af",
          }}
        >
          {card.icon}
        </div>

        {/* Título */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="text-base font-bold"
            style={{ color: colored ? C.navy : "#9ca3af" }}
          >
            {card.title}
          </h3>
        </div>

        {/* Descripción */}
        <p
          className="text-sm leading-relaxed flex-1"
          style={{ color: colored ? C.muted : "#d1d5db" }}
        >
          {card.description}
        </p>

        {/* CTA */}
        {card.available && (
          <div
            className="flex items-center gap-1 text-sm font-semibold mt-auto pt-1"
            style={{ color: card.accent }}
          >
            Acceder
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </motion.div>
  );

  if (!card.available) return content;
  if (isExternal) {
    return (
      <a href={card.href} className="flex flex-col h-full no-underline nova-card-link">
        {content}
      </a>
    );
  }
  return (
    <Link to={card.href} className="flex flex-col h-full no-underline nova-card-link">
      {content}
    </Link>
  );
}

/* ─── Tambor de servicios (abanico scrolleable) ──────────────────────────
 * Sección desktop: al hacer scroll dentro del wrapper alto, el tambor gira
 * como el cilindro de un revólver y el conjunto pasa de opaco a visible.
 * El ítem bajo el cursor se resalta independientemente del ángulo de giro.
 * ────────────────────────────────────────────────────────────────────── */
const REVOLVER_SPACING = 430; // separación horizontal fija entre tarjetas (px) — nunca se superponen

function RevolverItem({
  svc,
  index,
  activeIndexMV,
  hovered,
  onHover,
  onSelect,
}: {
  svc: ServiceCard;
  index: number;
  activeIndexMV: MotionValue<number>;
  hovered: number | null;
  onHover: (i: number | null) => void;
  onSelect: (svc: ServiceCard) => void;
}) {
  // Distancia (con signo) al "chamber" activo del tambor — controla desplazamiento, tamaño y opacidad.
  const dist = useTransform(activeIndexMV, (a) => index - a);
  const x = useTransform(dist, (d) => d * REVOLVER_SPACING);
  const y = useTransform(dist, (d) => Math.min(Math.abs(d), 1.4) * 22);
  const distAbs = useTransform(dist, (d) => Math.abs(d));
  const opacityBase = useTransform(distAbs, [0, 1, 2.2], [1, 0.55, 0.12]);
  const scaleBase = useTransform(distAbs, [0, 1, 2.2], [1.08, 0.85, 0.68]);
  const isHovered = hovered === index;

  return (
    <motion.div
      style={{
        // Centrado en el eje del tambor: la posición base queda en el centro
        // del contenedor (left/top 50% + margen negativo) y el x/y de Framer
        // solo aplica el desplazamiento relativo — así nunca queda "corrido".
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -175,
        marginTop: -150,
        x, y,
        opacity: isHovered ? 1 : opacityBase,
        scale: isHovered ? 1.1 : scaleBase,
        zIndex: isHovered ? 20 : undefined,
      }}
      className="select-none"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(svc)}
    >
      <div
        className="flex flex-col gap-3 rounded-2xl transition-shadow duration-200"
        style={{
          width: 350,
          padding: "26px 26px",
          cursor: svc.available ? "pointer" : "default",
          background: svc.available ? "#ffffff" : "rgba(255,255,255,0.6)",
          border: `1.5px solid rgba(30,58,95,${isHovered ? 0.28 : 0.1})`,
          boxShadow: isHovered
            ? `0 20px 48px ${svc.accent}33, 0 4px 12px rgba(30,58,95,0.12)`
            : "0 3px 14px rgba(30,58,95,0.08)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: svc.available ? svc.iconBg : "#f3f4f6",
            color: svc.available ? svc.accent : "#9ca3af",
          }}
        >
          <span className="w-6 h-6">{svc.icon}</span>
        </div>
        <div>
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1"
            style={{ color: svc.available ? svc.accent : "#c7ccd3" }}
          >
            {svc.detail.subtitle}
          </p>
          <p className="text-[20px] font-black leading-tight" style={{ color: svc.available ? C.navy : "#b0b8c4" }}>
            {svc.title}
          </p>
        </div>
        <p
          className="text-[13.5px] leading-relaxed"
          style={{
            color: svc.available ? C.muted : "#cbd5e1",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {svc.description}
        </p>
        {svc.available && svc.detail.whoFor.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {svc.detail.whoFor.slice(0, 3).map((w) => (
              <span
                key={w}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: svc.iconBg, color: svc.accent, border: `1px solid ${svc.accent}28` }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
        {svc.available && (
          <div className="flex items-center gap-1 text-[13px] font-semibold mt-1" style={{ color: svc.accent }}>
            Acceder
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ServicesRevolverSection({ onSelect }: { onSelect: (svc: ServiceCard) => void }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const sectionOpacity = useTransform(scrollYProgress, [0, 0.14, 0.86, 1], [0, 1, 1, 0]);
  const total = SERVICES.length;
  // El "chamber" activo del tambor avanza de 0 a total-1 a lo largo del scroll de la sección.
  const activeIndex = useTransform(scrollYProgress, [0.08, 0.92], [0, total - 1]);

  return (
    <section ref={sectionRef} className="hidden lg:block relative" style={{ height: `${100 * (total + 1.5)}vh` }}>
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <motion.div style={{ opacity: sectionOpacity }} className="relative w-full h-[620px] flex flex-col items-center">
          <div className="text-center px-4 mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.22em] mb-2" style={{ color: C.orange }}>
              Servicios institucionales
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight" style={{ color: C.navy }}>
              Desliza y elige tu servicio
            </h2>
            <p className="text-sm mt-2" style={{ color: C.muted }}>
              Continúa el scroll para girar el tambor. Pasa el cursor para resaltar cada opción.
            </p>
          </div>

          <div className="relative w-full flex-1">
            {SERVICES.map((svc, i) => (
              <RevolverItem
                key={svc.title}
                svc={svc}
                index={i}
                activeIndexMV={activeIndex}
                hovered={hovered}
                onHover={setHovered}
                onSelect={onSelect}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Carrusel de servicios para móvil (swipe horizontal con snap) ──────
 * En pantallas pequeñas el scroll de la página no se usa para animar (mala
 * experiencia táctil); en su lugar se ofrece un carrusel deslizable nativo
 * donde la tarjeta centrada se resalta con IntersectionObserver.
 * ────────────────────────────────────────────────────────────────────── */
function ServicesMobileCarousel({ onSelect }: { onSelect: (svc: ServiceCard) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-svc-index]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute("data-svc-index"));
          if (!Number.isNaN(idx)) setActive(idx);
        }
      },
      { root: track, threshold: [0.6, 0.75, 0.9] },
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="lg:hidden py-12 px-5" style={{ background: C.beige }}>
      <div className="text-center mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] mb-2" style={{ color: C.orange }}>
          Servicios institucionales
        </p>
        <h2 className="text-2xl font-extrabold leading-tight" style={{ color: C.navy }}>
          Desliza y elige tu servicio
        </h2>
        <p className="text-sm mt-1.5" style={{ color: C.muted }}>
          Desliza con el dedo — la tarjeta al centro se resalta.
        </p>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-4 px-[10vw]"
        style={{ scrollSnapType: "x mandatory", ...noScrollbarStyle }}
      >
        {SERVICES.map((svc, i) => {
          const isActive = active === i;
          return (
            <div
              key={svc.title}
              data-svc-index={i}
              onClick={() => onSelect(svc)}
              className="flex-shrink-0 flex flex-col gap-3 rounded-2xl transition-all duration-300"
              style={{
                width: "85vw",
                maxWidth: 340,
                scrollSnapAlign: "center",
                padding: "24px",
                cursor: svc.available ? "pointer" : "default",
                background: svc.available ? "#ffffff" : "rgba(255,255,255,0.6)",
                border: `1.5px solid rgba(30,58,95,${isActive ? 0.28 : 0.1})`,
                boxShadow: isActive
                  ? `0 14px 34px ${svc.accent}33, 0 4px 12px rgba(30,58,95,0.12)`
                  : "0 3px 14px rgba(30,58,95,0.06)",
                opacity: isActive ? 1 : 0.55,
                transform: isActive ? "scale(1.03)" : "scale(0.94)",
              }}
            >
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{
                  width: 52,
                  height: 52,
                  background: svc.available ? svc.iconBg : "#f3f4f6",
                  color: svc.available ? svc.accent : "#9ca3af",
                }}
              >
                <span className="w-6 h-6">{svc.icon}</span>
              </div>
              <div>
                <p
                  className="text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1"
                  style={{ color: svc.available ? svc.accent : "#c7ccd3" }}
                >
                  {svc.detail.subtitle}
                </p>
                <p className="text-[18px] font-black leading-tight" style={{ color: svc.available ? C.navy : "#b0b8c4" }}>
                  {svc.title}
                </p>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: svc.available ? C.muted : "#cbd5e1" }}>
                {svc.description}
              </p>
              {svc.available && svc.detail.whoFor.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {svc.detail.whoFor.slice(0, 3).map((w) => (
                    <span
                      key={w}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: svc.iconBg, color: svc.accent, border: `1px solid ${svc.accent}28` }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}
              {svc.available && (
                <div className="flex items-center gap-1 text-[13px] font-semibold" style={{ color: svc.accent }}>
                  Acceder
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-1.5 mt-1">
        {SERVICES.map((svc, i) => (
          <span
            key={svc.title}
            className="rounded-full transition-all duration-300"
            style={{
              width: active === i ? 18 : 6,
              height: 6,
              background: active === i ? svc.accent : "rgba(30,58,95,0.2)",
            }}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Landing principal ──────────────────────────────────── */
export function NovaLanding() {
  const heroImages = useHeroImages();
  const navigate = useNavigate();
  const { usuario, isAdmin, isArea } = useAuth();
  const [exploring, setExploring] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCard | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const panelPath = isAdmin ? "/admin" : isArea ? "/area" : "/dashboard";

  const handleExplore = () => {
    setExploring(true);
    setSelectedService(null);
  };

  const handleSelectService = (svc: ServiceCard) => {
    if (!svc.available) return;
    setSelectedService(svc);
  };

  const goToService = (href: string) => {
    if (/^https?:\/\//i.test(href)) {
      window.location.href = href;
      return;
    }
    navigate(href);
  };

  return (
    <div className="min-h-screen" style={{ background: C.beige, color: C.text }}>

      {/* Estilos hover para tarjetas */}
      <style>{`
        .nova-card-link:hover .nova-card {
          box-shadow: 0 8px 30px rgba(30,58,95,0.13) !important;
        }
      `}</style>

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: C.beige }}>

        {/* Marca de agua decorativa */}
        <div
          aria-hidden
          className="absolute select-none pointer-events-none hidden lg:block"
          style={{
            right: "-1rem",
            top: "50%",
            transform: "translateY(-52%)",
            fontSize: "clamp(12rem, 32vw, 30rem)",
            fontWeight: 900,
            letterSpacing: "-0.06em",
            color: "rgba(30,58,95,0.045)",
            lineHeight: 1,
            userSelect: "none",
            transition: "right 0.4s ease",
          }}
        >
          N
        </div>

        <div className="relative container mx-auto px-6 md:px-12">
          <div className="flex items-stretch min-h-[560px] md:min-h-[640px] gap-0">

            {/* ── Columna izquierda: contenido / panel detalle ── */}
            <div className="flex-1 flex flex-col justify-center py-16 md:py-24 pr-6 md:pr-12 relative">

              {/* Logo + institución */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={exploring
                  ? { opacity: 0, y: -18, transition: { duration: 0.3 } }
                  : { opacity: 1, y: 0 }
                }
                transition={{ duration: 0.5 }}
                className="flex items-center gap-3 mb-12"
              >
                <div
                  className="rounded-xl p-1.5 flex-shrink-0"
                  style={{ background: "#fff", border: `1px solid ${C.border}` }}
                >
                  <img
                    src={logoImage}
                    alt="Uniautónoma del Cauca"
                    className="h-9 w-auto object-contain"
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: C.orange }}
                  >
                    Uniautónoma del Cauca
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>
                    Institución de Educación Superior
                  </p>
                </div>
              </motion.div>

              {/* Wordmark NOVA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={exploring
                  ? { opacity: 0, scale: 0.78, filter: "blur(14px)", transition: { duration: 0.4, delay: 0.05 } }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                }
                transition={{ duration: 0.55, delay: 0.1 }}
              >
                <h1
                  className="font-black leading-none tracking-tighter"
                  style={{
                    fontSize: "clamp(5rem, 15vw, 11rem)",
                    color: C.navy,
                    letterSpacing: "-0.04em",
                  }}
                >
                  NOVA
                </h1>
                <div
                  className="mt-2 mb-6"
                  style={{
                    height: "4px",
                    width: "clamp(4rem, 9vw, 7rem)",
                    background: `linear-gradient(90deg, ${C.orange}, ${C.gold})`,
                    borderRadius: "2px",
                  }}
                />
              </motion.div>

              {/* Nombre completo */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={exploring
                  ? { opacity: 0, x: -50, filter: "blur(10px)", transition: { duration: 0.38, delay: 0.08 } }
                  : { opacity: 0.7, y: 0, x: 0, filter: "blur(0px)" }
                }
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-xl md:text-2xl font-semibold mb-4 leading-snug"
                style={{ color: C.navy }}
              >
                Núcleo de Operaciones Virtuales Académicas
              </motion.p>

              {/* Descripción */}
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={exploring
                  ? { opacity: 0, x: -80, filter: "blur(12px)", transition: { duration: 0.42, delay: 0.13 } }
                  : { opacity: 1, y: 0, x: 0, filter: "blur(0px)" }
                }
                transition={{ duration: 0.5, delay: 0.28 }}
                className="text-[17px] md:text-lg leading-relaxed mb-10 max-w-lg"
                style={{ color: C.muted }}
              >
                Plataforma digital centralizada para gestionar tus trámites,
                solicitudes y servicios institucionales desde cualquier lugar,
                de forma segura y sin desplazamientos.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={exploring
                  ? { opacity: 0, y: 10, transition: { duration: 0.3, delay: 0.0 } }
                  : { opacity: 1, y: 0 }
                }
                transition={{ duration: 0.5, delay: 0.36 }}
                className="flex flex-wrap gap-3"
              >
                <button
                  onClick={handleExplore}
                  disabled={exploring}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-100 shadow-md disabled:cursor-default"
                  style={{ background: C.navy }}
                >
                  Explorar servicios
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!usuario && (
                  <Link
                    to="/login"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-[rgba(30,58,95,0.06)]"
                    style={{
                      color: C.navy,
                      border: `1.5px solid rgba(30,58,95,0.22)`,
                      background: "transparent",
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    Iniciar sesión
                  </Link>
                )}
                {usuario && (
                  <Link
                    to={panelPath}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-[rgba(30,58,95,0.06)]"
                    style={{
                      color: C.navy,
                      border: `1.5px solid rgba(30,58,95,0.22)`,
                      background: "transparent",
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    Ir a mi panel
                  </Link>
                )}
              </motion.div>

              {/* ── Panel detalle del servicio seleccionado ── */}
              <AnimatePresence mode="wait">
                {exploring && selectedService && (
                  <motion.div
                    key={selectedService.title}
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex flex-col justify-center overflow-hidden py-4 pr-8"
                    style={{ background: C.beige }}
                  >
                    {/* ── Cabecera ── */}
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: selectedService.iconBg, color: selectedService.accent }}
                      >
                        <span className="w-5 h-5">{selectedService.icon}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]"
                          style={{ color: selectedService.accent }}>
                          {selectedService.detail.subtitle}
                        </p>
                        <h2 className="text-2xl font-black leading-none tracking-tight"
                          style={{ color: C.navy }}>
                          {selectedService.title}
                        </h2>
                      </div>
                    </div>

                    {/* Barra de color */}
                    <div className="mb-2.5 h-[2px] w-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${selectedService.accent}, ${selectedService.accent}22)` }} />

                    {/* ── Intro ── */}
                    <p className="text-[12.5px] leading-snug mb-2.5"
                      style={{ color: C.text }}>
                      {selectedService.detail.intro}
                    </p>

                    {/* ── Cómo funciona ── */}
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
                      style={{ color: C.muted }}>
                      ¿Cómo funciona?
                    </p>
                    <div className="flex flex-col gap-1.5 mb-2.5">
                      {selectedService.detail.steps.map((step, si) => (
                        <motion.div
                          key={si}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.28, delay: 0.1 + si * 0.05 }}
                          className="flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: "rgba(255,255,255,0.65)",
                            border: `1px solid ${selectedService.accent}18`,
                          }}
                        >
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                            style={{ background: selectedService.iconBg, color: selectedService.accent }}
                          >
                            {si + 1}
                          </span>
                          <p className="text-[12px] leading-snug" style={{ color: C.text }}>
                            {step}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    {/* ── ¿Para quién? ── */}
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
                      style={{ color: C.muted }}>
                      ¿Para quién?
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {selectedService.detail.whoFor.map((w) => (
                        <span key={w}
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                          style={{
                            background: selectedService.iconBg,
                            color: selectedService.accent,
                            border: `1px solid ${selectedService.accent}28`,
                          }}>
                          {w}
                        </span>
                      ))}
                    </div>

                    {/* ── Tip + Norma ── */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      <div className="px-2.5 py-1.5 rounded-lg"
                        style={{ background: `${selectedService.accent}0d`, border: `1px solid ${selectedService.accent}22` }}>
                        <p className="text-[11.5px] leading-snug" style={{ color: C.text }}>
                          <span className="font-bold">Consejo: </span>
                          {selectedService.detail.tip}
                        </p>
                      </div>
                      <div className="px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.5)", border: `1px solid rgba(30,58,95,0.08)` }}>
                        <p className="text-[11.5px] leading-snug" style={{ color: C.muted }}>
                          {selectedService.detail.norm}
                        </p>
                      </div>
                    </div>

                    {/* ── Acciones ── */}
                    <div className="flex items-center gap-2.5">
                      {selectedService.available && selectedService.detail.cta && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => goToService(selectedService.href)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-bold text-white shadow-md"
                          style={{ background: selectedService.accent }}
                        >
                          {selectedService.detail.cta}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <button
                        onClick={() => { setSelectedService(null); setExploring(false); }}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-medium transition-all hover:bg-black/5"
                        style={{ color: C.muted }}
                      >
                        ← Volver
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Panel izquierdo cuando exploring=true pero nada seleccionado */}
                {exploring && !selectedService && (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex flex-col justify-center pr-8"
                  >
                    
                    {/* ── Texto informativo ── */}
                    <h3 className="text-2xl font-black mb-2 leading-tight" style={{ color: C.navy }}>
                      Bienvenido a NOVA
                    </h3>
                    <div className="mb-1 h-[2px] w-12 rounded-full" style={{ background: C.orange }} />
                    <p className="text-[14px] leading-relaxed mt-3 mb-5" style={{ color: C.text }}>
                      Tu asistente digital institucional. Desde aquí puedes gestionar
                      trámites, solicitar documentos y mantenerte conectado con
                      todos los servicios de la universidad, sin filas ni esperas.
                    </p>

                    <div className="flex flex-col gap-2.5">
                      {[
                        "Selecciona un servicio de la derecha para comenzar",
                        "Disponible 24/7 desde cualquier dispositivo",
                        "Tus solicitudes con trazabilidad en tiempo real",
                      ].map((text) => (
                        <div key={text} className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.55)", border: `1px solid rgba(30,58,95,0.07)` }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: C.orange }} />
                          <p className="text-[13px] leading-snug font-medium" style={{ color: C.text }}>{text}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Columna derecha: abanico de servicios ── */}
            {/*
             * Estrategia: flex-col con gap uniforme → sin solapamiento.
             * El arco se logra variando el translateX de cada item:
             *   los del centro se desplazan más hacia la izquierda,
             *   los extremos quedan más a la derecha → forma de arco/abanico.
             */}
            <div className={`hidden lg:flex flex-1 items-center py-10 overflow-visible ${exploring ? 'justify-center' : 'justify-end pr-4'}`}>

              {/* ── Franjas fotográficas institucionales ── */}
              {/*
               * Tiras verticales de imágenes reales, desalineadas y con
               * ligera rotación para un trazo más humano y menos rígido.
               * Se difuminan hacia el fondo beige con una máscara lateral
               * y un velo navy sutil para mantener la paleta institucional.
               */}
              <AnimatePresence>
                {!exploring && heroImages.length > 0 && (
                  <motion.div
                    key="hero-strips"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, filter: "blur(10px)", transition: { duration: 0.3 } }}
                    transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-4"
                    style={{
                      height: "clamp(320px, 42vw, 460px)",
                      maskImage: "linear-gradient(to right, transparent 0%, black 22%, black 90%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 22%, black 90%, transparent 100%)",
                    }}
                  >
                    {heroImages.slice(0, 4).map((img, i) => {
                      const heights = ["70%", "94%", "60%", "86%"];
                      const lifts = [0, -22, 16, -8];
                      const rotations = [-2.5, 1.4, -1.6, 2.1];
                      return (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, y: 26 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.45 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                          className="relative flex-shrink-0 rounded-[22px] overflow-hidden"
                          style={{
                            width: "108px",
                            height: heights[i % heights.length],
                            transform: `translateY(${lifts[i % lifts.length]}px) rotate(${rotations[i % rotations.length]}deg)`,
                            boxShadow: "0 14px 32px rgba(30,58,95,0.16)",
                            border: "3px solid rgba(255,255,255,0.75)",
                          }}
                        >
                          <img
                            src={img.image.startsWith("http") ? img.image : `${API_BASE}${img.image}`}
                            alt={img.alt_text || "NOVA"}
                            className="w-full h-full object-cover"
                            style={{ filter: "saturate(1.05) contrast(1.03)" }}
                          />
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: `linear-gradient(165deg, ${C.navy}00 45%, ${C.navy}2e 100%)` }}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {exploring && (
                  <motion.div
                    className="flex flex-col gap-2.5"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    {SERVICES.map((svc, i) => {
                      const total = SERVICES.length;
                      // norm: 0 en los extremos, 1 en el centro
                      const normCenter = 1 - Math.abs(i - (total - 1) / 2) / ((total - 1) / 2);
                      // Los del centro sobresalen 48px más hacia la izquierda
                      const arcX = -Math.round(normCenter * 48);

                      return (
                        <motion.div
                          key={svc.title}
                          initial={{ opacity: 0, x: 110 }}
                          animate={{ opacity: 1, x: arcX }}
                          exit={{ opacity: 0, x: 90 }}
                          transition={{
                            duration: 0.48,
                            delay: 0.18 + i * 0.07,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="group select-none"
                          style={{
                            width: "300px",
                            cursor: svc.available ? "pointer" : "default",
                            background: svc.available ? "#ffffff" : "rgba(255,255,255,0.5)",
                            boxShadow: svc.available
                              ? "0 3px 16px rgba(30,58,95,0.10), 0 1px 3px rgba(30,58,95,0.06)"
                              : "0 1px 6px rgba(30,58,95,0.04)",
                            border: `1.5px solid rgba(30,58,95,${svc.available ? 0.11 : 0.04})`,
                            borderRadius: "16px",
                            overflow: "hidden",
                          }}
                          onClick={() => handleSelectService(svc)}
                          whileHover={svc.available ? {
                            x: arcX - 10,
                            boxShadow: "0 8px 28px rgba(30,58,95,0.16), 0 2px 6px rgba(30,58,95,0.09)",
                            transition: { duration: 0.2 },
                          } : {}}
                        >
                          {/* Barra de color izquierda */}
                          <div className="flex">
                            <div
                              className="flex-shrink-0 w-1.5 rounded-l-[14px]"
                              style={{
                                background: svc.available
                                  ? `linear-gradient(180deg, ${svc.accent}, ${svc.accent}66)`
                                  : "#e5e7eb",
                              }}
                            />

                            <div className="flex items-center gap-4 px-4 py-4 flex-1">
                              {/* Ícono grande */}
                              <div
                                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                                style={{
                                  background: svc.available ? svc.iconBg : "#f3f4f6",
                                  color: svc.available ? svc.accent : "#9ca3af",
                                }}
                              >
                                <span className="w-6 h-6">{svc.icon}</span>
                              </div>

                              {/* Texto */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="text-[15px] font-bold leading-tight"
                                    style={{ color: svc.available ? C.navy : "#b0b8c4" }}
                                  >
                                    {svc.title}
                                  </span>
                                  {!svc.available && (
                                    <span
                                      className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wide flex-shrink-0"
                                      style={{ background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" }}
                                    >
                                      PRÓXIMO
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="text-[12.5px] leading-snug"
                                  style={{
                                    color: svc.available ? C.muted : "#cbd5e1",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {svc.description}
                                </p>
                                {svc.available && (
                                  <div
                                    className="flex items-center gap-1 mt-1.5 text-[11.5px] font-semibold"
                                    style={{ color: svc.accent }}
                                  >
                                    Acceder
                                    <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </section>

      {/* ══ MÓVIL: servicios en flujo normal (lg:hidden) ════ */}
      <AnimatePresence>
        {exploring && (
          <motion.section
            key="mobile-services"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden px-5 pb-10"
            style={{ background: C.beige }}
          >
            {!selectedService ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-black" style={{ color: C.navy }}>Servicios disponibles</h3>
                    <p className="text-xs" style={{ color: C.muted }}>Toca un servicio para ver detalles</p>
                  </div>
                  <button
                    onClick={() => setExploring(false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(30,58,95,0.08)", color: C.navy }}
                  >
                    ← Volver
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {SERVICES.map((svc, i) => (
                    <motion.button
                      key={svc.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.07 }}
                      onClick={() => svc.available && setSelectedService(svc)}
                      disabled={!svc.available}
                      className="text-left w-full"
                      style={{
                        background: svc.available ? "#fff" : "rgba(255,255,255,0.5)",
                        border: `1.5px solid rgba(30,58,95,${svc.available ? 0.12 : 0.04})`,
                        borderRadius: "16px",
                        overflow: "hidden",
                        cursor: svc.available ? "pointer" : "default",
                        boxShadow: svc.available ? "0 2px 12px rgba(30,58,95,0.09)" : "none",
                      }}
                    >
                      <div className="flex">
                        <div className="flex-shrink-0 w-1.5" style={{
                          background: svc.available
                            ? `linear-gradient(180deg, ${svc.accent}, ${svc.accent}66)`
                            : "#e5e7eb",
                        }} />
                        <div className="flex items-center gap-3 px-4 py-4 flex-1">
                          <div className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center"
                            style={{ background: svc.available ? svc.iconBg : "#f3f4f6", color: svc.available ? svc.accent : "#9ca3af" }}>
                            <span className="w-5 h-5">{svc.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold leading-tight mb-0.5"
                              style={{ color: svc.available ? C.navy : "#b0b8c4" }}>{svc.title}</p>
                            <p className="text-[12.5px] leading-snug"
                              style={{ color: svc.available ? C.muted : "#cbd5e1" }}>{svc.description}</p>
                          </div>
                          {svc.available && (
                            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: svc.accent }} />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </>
            ) : (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header detalle */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setSelectedService(null)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: "rgba(30,58,95,0.08)", color: C.navy }}
                  >←</button>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: selectedService.iconBg, color: selectedService.accent }}>
                      <span className="w-4 h-4">{selectedService.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em]"
                        style={{ color: selectedService.accent }}>{selectedService.detail.subtitle}</p>
                      <h3 className="text-lg font-black leading-tight"
                        style={{ color: C.navy }}>{selectedService.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="h-[2px] mb-4 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${selectedService.accent}, ${selectedService.accent}22)` }} />

                <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: C.text }}>
                  {selectedService.detail.intro}
                </p>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: C.muted }}>
                  ¿Cómo funciona?
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  {selectedService.detail.steps.map((step, si) => (
                    <div key={si} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${selectedService.accent}18` }}>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                        style={{ background: selectedService.iconBg, color: selectedService.accent }}>{si + 1}</span>
                      <p className="text-[12.5px] leading-snug" style={{ color: C.text }}>{step}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: C.muted }}>
                  ¿Para quién?
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedService.detail.whoFor.map((w) => (
                    <span key={w} className="text-[11.5px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: selectedService.iconBg, color: selectedService.accent, border: `1px solid ${selectedService.accent}28` }}>
                      {w}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: `${selectedService.accent}0d`, border: `1px solid ${selectedService.accent}22` }}>
                    <p className="text-[12.5px] leading-snug" style={{ color: C.text }}>
                      <span className="font-bold">Consejo: </span>{selectedService.detail.tip}
                    </p>
                  </div>
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(30,58,95,0.08)" }}>
                    <p className="text-[12px]" style={{ color: C.muted }}>{selectedService.detail.norm}</p>
                  </div>
                </div>

                {selectedService.available && selectedService.detail.cta && (
                  <button
                    onClick={() => goToService(selectedService.href)}
                    className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl text-[15px] font-bold text-white shadow-md"
                    style={{ background: selectedService.accent }}
                  >
                    {selectedService.detail.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ══ TRUST STRIP ═════════════════════════════════════ */}
      <section
        style={{
          background: C.beigeAlt,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="container mx-auto px-6 md:px-12 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {TRUST.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(30,58,95,0.08)", color: C.navy }}
                >
                  {t.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: C.navy }}>
                    {t.label}
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>{t.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TAMBOR DE SERVICIOS (scroll = giro del abanico, desktop) ══ */}
      <ServicesRevolverSection onSelect={(svc) => svc.available && goToService(svc.href)} />
      {/* ══ Versión móvil: carrusel deslizable con snap ══ */}
      <ServicesMobileCarousel onSelect={(svc) => svc.available && goToService(svc.href)} />

      {/* ══ SERVICIOS ═══════════════════════════════════════ */}
      <section className="container mx-auto px-6 md:px-12 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mb-10"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.22em] mb-2"
            style={{ color: C.orange }}
          >
            Módulos institucionales
          </p>
          <h2
            className="text-3xl md:text-4xl font-extrabold leading-tight"
            style={{ color: C.navy }}
          >
            Todo en un solo lugar
          </h2>
          <p className="text-base mt-2 max-w-md" style={{ color: C.muted }}>
            Servicios que estarán disponibles en las próximas fases del proyecto NOVA.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMING_SOON.map((card, i) => (
            <ServiceCardItem key={card.title} card={card} index={i} forceColor />
          ))}
        </div>
      </section>

      {/* ══ CARRUSEL DE IMÁGENES ════════════════════════════ */}
      {heroImages.length > 0 && (
        <section className="mb-10 flex justify-center">
          <style>{`
            @keyframes nova-scroll {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .nova-carousel-track {
              display: flex;
              align-items: center;
              width: max-content;
              animation: nova-scroll 28s linear infinite;
            }
            .nova-carousel-track:hover {
              animation-play-state: paused;
            }
            .nova-img-card {
              flex-shrink: 0;
              overflow: hidden;
              width: 320px;
              height: 200px;
              margin-right: 4px;
              border-radius: 12px;
              position: relative;
              cursor: pointer;
              transition: width 0.4s cubic-bezier(0.4,0,0.2,1),
                          height 0.4s cubic-bezier(0.4,0,0.2,1),
                          box-shadow 0.4s ease;
            }
            .nova-img-card:hover {
              width: 480px;
              height: 260px;
              box-shadow: 0 12px 40px rgba(10,24,48,0.28);
              z-index: 10;
            }
            .nova-img-card img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              filter: saturate(1.15) brightness(0.97);
              transition: filter 0.4s ease;
            }
            .nova-img-card:hover img {
              filter: saturate(1.3) brightness(1.02);
            }
            .nova-img-card .nova-caption {
              position: absolute;
              bottom: 0; left: 0; right: 0;
              padding: 10px 14px;
              background: linear-gradient(0deg, rgba(10,24,48,0.7) 0%, transparent 100%);
              opacity: 0;
              transition: opacity 0.3s ease;
            }
            .nova-img-card:hover .nova-caption {
              opacity: 1;
            }
          `}</style>
          <div style={{
            width: "100%",
            maxWidth: "1100px",
            overflow: "hidden",
            maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}>
          <div className="nova-carousel-track">
            {[...heroImages, ...heroImages].map((img, i) => (
              <div key={i} className="nova-img-card">
                <img
                  src={img.image.startsWith("http") ? img.image : `${API_BASE}${img.image}`}
                  alt={img.alt_text || "NOVA"}
                />
                {img.alt_text && (
                  <div className="nova-caption">
                    <p style={{ color: "#fff", fontSize: "11px", fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {img.alt_text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        </section>
      )}

      {/* ══ CTA IA / PREGUNTAS FRECUENTES ══════════════════ */}
      <section className="container mx-auto px-6 md:px-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: C.navy }}
        >
          <div className="flex flex-col md:flex-row items-stretch">

            {/* ── Lado izquierdo: texto ── */}
            <div className="flex-1 px-8 py-10 md:px-12 md:py-12">
              <p
                className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
                style={{ color: C.gold }}
              >
                Asistente virtual
              </p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-snug mb-3">
                ¿Tienes alguna pregunta?
              </h3>
              <p className="text-base text-white/60 max-w-sm mb-6">
                Nuestro asistente de IA responde al instante tus dudas sobre
                trámites, plazos, requisitos y servicios institucionales.
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-chatbot'))}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-md"
                style={{ background: C.orange }}
              >
                <Bot className="w-4 h-4" />
                Hablar con el asistente
              </button>
            </div>

            {/* ── Lado derecho: preguntas frecuentes ── */}
            <div
              className="flex-1 px-8 py-10 md:px-10 md:py-12 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p
                className="text-xs font-bold uppercase tracking-[0.18em] mb-1"
                style={{ color: C.gold }}
              >
                Preguntas frecuentes
              </p>
              {[
                {
                  q: "¿Cómo radico una PQRS?",
                  a: "Ingresa al módulo «Radicar PQRS» desde el menú principal, completa el formulario con tus datos y la descripción de tu solicitud, adjunta los documentos de soporte si aplica y envía. Recibirás un número de radicado para hacer seguimiento.",
                },
                {
                  q: "¿Cuánto tiempo tarda la respuesta?",
                  a: "Los tiempos dependen del tipo de solicitud según la Ley 1755 de 2015: peticiones generales 15 días hábiles, quejas y reclamos 15 días hábiles, solicitudes de información 10 días hábiles, y consultas hasta 30 días hábiles.",
                },
                {
                  q: "¿Dónde consulto el estado de mi solicitud?",
                  a: "Usa la opción «Consultar PQRS» con tu número de radicado y documento de identidad. También recibirás notificaciones por correo electrónico cuando tu solicitud cambie de estado.",
                },
                {
                  q: "¿Qué documentos necesito para un certificado?",
                  a: "Generalmente necesitas tu documento de identidad y, según el tipo de certificado, soportes académicos o administrativos. Solicítalo desde el módulo «Certificados» donde verás los requisitos específicos para cada trámite.",
                },
              ].map(({ q, a }, i) => {
                const isOpen = openFaq === i;
                return (
                  <motion.div
                    key={q}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.08 }}
                    className="rounded-lg"
                    style={{ background: isOpen ? "rgba(255,255,255,0.06)" : "transparent" }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex items-center gap-3 w-full text-left text-sm text-white/80 hover:text-white transition-colors group px-2 py-2"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-colors"
                        style={{ background: "rgba(255,255,255,0.1)", color: C.gold }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1">{q}</span>
                      <ChevronDown
                        className="w-4 h-4 flex-shrink-0 transition-transform"
                        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <p className="text-sm text-white/70 leading-relaxed pl-11 pr-3 pb-3">
                            {a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

          </div>
        </motion.div>
      </section>
    </div>
  );
}
