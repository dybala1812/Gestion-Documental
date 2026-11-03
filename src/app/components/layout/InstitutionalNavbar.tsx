import { Link, useNavigate, useLocation } from 'react-router';
import {
  LogOut, LayoutDashboard, Search, Home,
  Settings, ChevronRight, User, Shield,
  UserPlus, FileText, BarChart2, Bell, BookOpen as GraduationCap, Bot, Image, MessageSquare, Megaphone, Mail, PlayCircle, Send, Vote,
  KeyRound,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LOGIN_TEMPORAL } from '../../lib/config'; // ⚠️ TEMPORAL: login de pruebas del SGD
import { motion, AnimatePresence } from 'motion/react';
import logoImage from '../../../assets/logo-uniautonoma.webp';

/* ─── Hamburger animado ────────────────────────────── */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="w-6 h-5 flex flex-col justify-between cursor-pointer">
      <motion.span
        animate={open ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="block h-[2.5px] w-full bg-white rounded-full origin-center"
      />
      <motion.span
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.2 }}
        className="block h-[2.5px] w-4/5 rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
      />
      <motion.span
        animate={open ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="block h-[2.5px] w-full bg-white rounded-full origin-center"
      />
    </div>
  );
}

/* ─── Link desktop con indicador activo (solo icono + tooltip) ── */
interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  active?: boolean;
}

function NavLink({ to, children, icon, highlight, active }: NavLinkProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link
        to={to}
        className={`relative flex items-center justify-center w-11 h-11 rounded-md transition-colors select-none ${
          highlight
            ? 'bg-[#ff9800] hover:bg-[#f57c00] text-white shadow-md'
            : active
            ? 'text-[#ffc107] bg-white/10'
            : 'text-white/75 hover:text-white hover:bg-white/10'
        }`}
      >
        {icon}
        {!highlight && (
          <motion.span
            animate={{ scaleX: active ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#ffc107] rounded-full origin-left"
          />
        )}
      </Link>
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none"
          >
            <div className="whitespace-nowrap rounded-md bg-[#0f2440] border border-white/10 px-2.5 py-1 text-xs font-medium text-white shadow-xl">
              {children}
            </div>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f2440] border-l border-t border-white/10 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Dropdown de navegación desktop (solo icono + tooltip) ── */
interface NavDropdownProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  items: { to: string; label: string; icon: React.ReactNode }[];
}

function NavDropdown({ label, icon, active, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center justify-center w-11 h-11 rounded-md transition-colors select-none ${
          active ? 'text-[#ffc107] bg-white/10' : 'text-white/75 hover:text-white hover:bg-white/10'
        }`}
        style={{ background: open ? 'rgba(255,255,255,0.1)' : undefined }}
      >
        {icon}
        <motion.span
          animate={{ scaleX: active ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#ffc107] rounded-full origin-left"
        />
      </button>

      {/* Tooltip (solo si no hay dropdown abierto) */}
      <AnimatePresence>
        {hovered && !open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none"
          >
            <div className="whitespace-nowrap rounded-md bg-[#0f2440] border border-white/10 px-2.5 py-1 text-xs font-medium text-white shadow-xl">
              {label}
            </div>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f2440] border-l border-t border-white/10 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown de opciones */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            {items.map(item => (
              <button
                key={item.to}
                onClick={() => { setOpen(false); navigate(item.to); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Link del panel lateral mobile ────────────────── */
interface MobileItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  highlight?: boolean;
  badge?: string;
  index: number;
}

function MobileItem({ to, label, icon, onClick, highlight, badge, index }: MobileItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.28, delay: index * 0.06, ease: 'easeOut' }}
    >
      <Link
        to={to}
        onClick={onClick}
        className={`group flex items-center gap-4 px-5 py-3.5 rounded-xl text-sm font-medium transition-all ${
          highlight
            ? 'bg-gradient-to-r from-[#ff9800] to-[#f57c00] text-white shadow-lg shadow-orange-500/20'
            : 'text-white/85 hover:text-white hover:bg-white/10'
        }`}
      >
        <motion.span
          whileHover={{ scale: 1.2, rotate: 8 }}
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ backgroundColor: highlight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
        >
          {icon}
        </motion.span>
        <span className="flex-1">{label}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffc107] text-[#1e3a5f]">
            {badge}
          </span>
        )}
        <motion.span
          initial={{ x: -4, opacity: 0 }}
          whileHover={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="text-white/40"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.span>
      </Link>
    </motion.div>
  );
}

/* ─── Componente principal ─────────────────────────── */
export function InstitutionalNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // 'usuario' es el nombre en AuthContext; alias local 'user' para no tocar el resto del componente
  const { usuario: user, logout } = useAuth();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  // En el módulo Archivo Central (SGD) el usuario se identifica como tal bajo su nombre.
  const enArchivoCentral = location.pathname.startsWith('/archivo-central');
  const etiquetaRol = enArchivoCentral ? 'Archivo Central' : user?.rol;

  const initials = user?.nombre
    ? user.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isAdminUser = !!user && (user.rol === 'admin' || user.is_staff || (user.roles ?? []).includes('ADMIN'));
  const isCoordinator = !!user && ((user.roles ?? []).includes('COORDINATOR') || (user.roles ?? []).includes('COORDINACION') || user.rol === 'coordinator');
  const hasDiplomaAccess = !!user && (
    user.is_staff ||
    user.rol === 'admin' ||
    (user.roles ?? []).includes('ADMIN') ||
    isCoordinator
  );
  const isAreaUser = !!user && user.rol === 'area' && !isAdminUser;
  const isRegularUser = !!user && user.rol === 'usuario' && !isAdminUser;
  const isTeacher = !!user && (user.roles ?? []).some((role) => {
    const code = role.trim().toUpperCase();
    return code === 'DOCENTE' || code === 'TEACHER' || code === 'FACULTY' || code.startsWith('DOCENTE_');
  });

  /* Opciones por rol */
  const panelPath = isAdminUser ? '/admin' : user?.rol === 'area' ? '/area' : '/dashboard';
  const isPanelActive = isActive('/admin') || isActive('/area') || isActive('/dashboard');

  return (
    <header className="relative z-50">
      <div className="h-1 w-full bg-gradient-to-r from-[#ff9800] via-[#ffc107] to-[#ff9800]" />

      <nav className="bg-[#1e3a5f] text-white shadow-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-[76px]">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <div className="bg-white rounded-lg p-1 shadow" style={{ width: 34, height: 34 }}>
                <img src={logoImage} alt="NOVA" className="w-full h-full object-contain" />
              </div>
              <div className="leading-tight">
                <span className="text-base font-extrabold tracking-tight text-white">NOVA</span>
                <span className="block text-[9px] text-[#ffc107] uppercase tracking-[0.18em] font-semibold leading-none">Portal Institucional</span>
              </div>
            </Link>

            {/* ── Desktop nav ── */}
            <div className="hidden lg:flex items-center gap-1">

              {/* Anónimo */}
              {!user && (
                <>
                  <NavLink to="/" icon={<Home className="w-5 h-5" />} active={isActive('/')}>Portal</NavLink>
                  <NavLink to="/pqrs" icon={<FileText className="w-5 h-5" />} active={isActive('/pqrs')}>PQRS</NavLink>
                  <NavLink to="/convocatorias" icon={<Megaphone className="w-5 h-5" />} active={isActive('/convocatorias')}>Convocatorias</NavLink>
                  <NavLink to="/quiz" icon={<GraduationCap className="w-5 h-5" />} active={isActive('/quiz')}>Quiz</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                  {/* ⚠️ TEMPORAL: con el login de pruebas activo solo queda "Ingresar" (y "Login 2"). */}
                  {!LOGIN_TEMPORAL && (
                    <NavLink to="/registro" icon={<UserPlus className="w-5 h-5" />} active={isActive('/registro')}>Registrarse</NavLink>
                  )}
                </>
              )}

              {/* Usuario registrado */}
              {isRegularUser && (
                <>
                  <NavLink to="/" icon={<Home className="w-5 h-5" />} active={isActive('/')}>Portal</NavLink>
                  <NavLink to="/pqrs" icon={<FileText className="w-5 h-5" />} active={isActive('/pqrs')}>PQRS</NavLink>
                  <NavLink to="/convocatorias" icon={<Megaphone className="w-5 h-5" />} active={isActive('/convocatorias')}>Convocatorias</NavLink>
                  {!isTeacher && <NavLink to="/quiz" icon={<GraduationCap className="w-5 h-5" />} active={isActive('/quiz')}>Quiz</NavLink>}
                  <NavLink to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} active={isActive('/dashboard')}>Mi Panel</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                </>
              )}

              {/* Área */}
              {isAreaUser && (
                <>
                  <NavLink to="/area" icon={<LayoutDashboard className="w-5 h-5" />} active={isActive('/area')}>Mi Panel</NavLink>
                  <NavLink to="/convocatorias" icon={<Megaphone className="w-5 h-5" />} active={isActive('/convocatorias')}>Convocatorias</NavLink>
                  <NavLink to="/quiz" icon={<GraduationCap className="w-5 h-5" />} active={isActive('/quiz')}>Quiz</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                  {hasDiplomaAccess && (
                    <NavLink to="/admin-diplomas" icon={<Shield className="w-5 h-5" />} active={isActive('/admin-diplomas')}>Diplomas</NavLink>
                  )}
                  {user.is_staff && (
                    <NavLink to="/admin" icon={<Shield className="w-5 h-5" />} active={isActive('/admin')}>Admin</NavLink>
                  )}
                  <NavLink to="/area" icon={<Bell className="w-5 h-5" />} highlight>Asignadas</NavLink>
                </>
              )}

              {/* Admin */}
              {isAdminUser && (
                <>
                  <NavLink to="/admin" icon={<LayoutDashboard className="w-5 h-5" />} active={isActive('/admin')}>Dashboard</NavLink>
                  <NavLink to="/convocatorias" icon={<Megaphone className="w-5 h-5" />} active={isActive('/convocatorias')}>Convocatorias</NavLink>
                  <NavLink to="/quiz" icon={<GraduationCap className="w-5 h-5" />} active={isActive('/quiz')}>Quiz</NavLink>
                  <NavLink to="/gestion-areas" icon={<Settings className="w-5 h-5" />} active={isActive('/gestion-areas')}>Áreas</NavLink>
                  <NavLink to="/gestion-roles" icon={<Shield className="w-5 h-5" />} active={isActive('/gestion-roles')}>Roles</NavLink>
                  <NavLink to="/gestion-solicitudes-rol" icon={<UserPlus className="w-5 h-5" />} active={isActive('/gestion-solicitudes-rol')}>Solicitudes Rol</NavLink>
                  <NavLink to="/gestion-sla" icon={<BarChart2 className="w-5 h-5" />} active={isActive('/gestion-sla')}>SLA</NavLink>
                  <NavLink to="/gestion-elecciones" icon={<Vote className="w-5 h-5" />} active={isActive('/gestion-elecciones')}>Elecciones</NavLink>
                  <NavDropdown
                    label="Landing"
                    icon={<Image className="w-5 h-5" />}
                    active={isActive('/gestion-contactos') || isActive('/gestion-hero') || isActive('/gestion-manual')}
                    items={[
                      { to: '/gestion-contactos', label: 'Contactos', icon: <UserPlus className="w-4 h-4" /> },
                      { to: '/gestion-hero',      label: 'Imágenes del Hero', icon: <Image className="w-4 h-4" /> },
                      { to: '/gestion-manual',    label: 'Manual de Usuario', icon: <PlayCircle className="w-4 h-4" /> },
                    ]}
                  />
                  <NavLink to="/gestion-chatbot" icon={<Bot className="w-5 h-5" />} active={isActive('/gestion-chatbot')}>Chatbot</NavLink>
                  <NavLink to="/gestion-correo-tickets" icon={<Mail className="w-5 h-5" />} active={isActive('/gestion-correo-tickets')}>Correo Tickets</NavLink>
                  <NavLink to="/gestion-correo-saliente" icon={<Send className="w-5 h-5" />} active={isActive('/gestion-correo-saliente')}>Correo Saliente</NavLink>
                  <NavLink to="/gestion-whatsapp-masivo" icon={<MessageSquare className="w-5 h-5" />} active={isActive('/gestion-whatsapp-masivo')}>WhatsApp</NavLink>
                  <NavLink to="/admin-certificados" icon={<GraduationCap className="w-5 h-5" />} active={isActive('/admin-certificados')}>Certificados</NavLink>
                  <NavLink to="/admin-diplomas" icon={<Shield className="w-5 h-5" />} active={isActive('/admin-diplomas')}>Diplomas</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                </>
              )}

              {/* Coordinador */}
              {isCoordinator && !isAdminUser && !isAreaUser && (
                <>
                  <NavLink to="/admin-diplomas" icon={<Shield className="w-5 h-5" />} active={isActive('/admin-diplomas')}>Diplomas</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                </>
              )}

              {hasDiplomaAccess && !isAdminUser && !isAreaUser && !isCoordinator && (
                <>
                  <NavLink to="/admin-diplomas" icon={<Shield className="w-5 h-5" />} active={isActive('/admin-diplomas')}>Diplomas</NavLink>
                  <NavLink to="/consulta" icon={<Search className="w-5 h-5" />} active={isActive('/consulta')}>Consultar</NavLink>
                </>
              )}
            </div>

            {/* Auth desktop */}
            <div className="hidden lg:flex items-center">
              {user ? (
                <div className="flex items-center gap-3 pl-4 border-l border-white/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff9800] to-[#ffc107] flex items-center justify-center shadow-sm">
                      <span className="text-[#1e3a5f] font-bold text-xs">{initials}</span>
                    </div>
                    <div className="text-right leading-tight">
                      <p className="text-sm font-semibold text-white">{user.nombre}</p>
                      <p className="text-[11px] text-[#ffc107] uppercase tracking-wider font-semibold">{etiquetaRol}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-red-500/80 rounded-md text-sm font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Salir</span>
                  </motion.button>
                </div>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/login')}
                    className="ml-4 flex items-center gap-2 px-5 py-2.5 bg-[#ff9800] hover:bg-[#f57c00] text-white rounded-md text-sm font-bold tracking-wide transition-colors shadow-md"
                  >
                    Ingresar
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                  {/* ⚠️ TEMPORAL: acceso al login de pruebas por perfil del SGD (solo npm run dev). */}
                  {LOGIN_TEMPORAL && (
                    <button
                      onClick={() => navigate('/login-temporal')}
                      title="Login temporal de pruebas del Archivo Central (solo desarrollo)"
                      className="ml-2 flex items-center gap-1 rounded-md border border-white/30 px-2 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <KeyRound className="w-3 h-3" /> Login 2
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Hamburguesa mobile */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMenuOpen(v => !v)}
              className="lg:hidden p-2.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Menú"
            >
              <HamburgerIcon open={menuOpen} />
            </motion.button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </nav>

      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#ffc107] to-transparent opacity-80" />

      {/* ─── Panel lateral mobile ─── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed top-0 right-0 z-50 h-full w-[300px] max-w-[85vw] flex flex-col overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #0f2440 0%, #1e3a5f 50%, #162d4a 100%)' }}
            >
              {/* Decoraciones */}
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #ff9800, transparent 70%)', transform: 'translate(30%, -30%)' }} />
              <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #ffc107, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

              {/* Header drawer */}
              <div className="relative flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="bg-white rounded-md p-1 shadow-md" style={{ width: 38, height: 38 }}>
                    <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                  <p className="text-sm font-bold text-white leading-tight">NOVA</p>
                  <p className="text-[10px] text-[#ffc107] uppercase tracking-widest">Portal Institucional</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Tarjeta de usuario */}
              {user && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mx-4 mt-4 p-4 rounded-xl border border-white/10 flex items-center gap-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#ff9800] to-[#ffc107] flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-[#1e3a5f] font-bold text-sm">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <p className="text-[11px] text-[#ffc107] uppercase tracking-widest font-semibold">{etiquetaRol}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Links */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35"
                >
                  Navegación
                </motion.p>

                {/* Sin sesión */}
                {!user && (
                  <>
                    <MobileItem index={0} to="/" label="NOVA" icon={<Home className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={1} to="/pqrs" label="PQRS" icon={<FileText className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={2} to="/convocatorias" label="Convocatorias" icon={<Megaphone className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={3} to="/quiz" label="ElectroQuiz" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={4} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    {!LOGIN_TEMPORAL && (
                      <MobileItem index={5} to="/registro" label="Crear cuenta" icon={<UserPlus className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight badge="Gratis" />
                    )}
                  </>
                )}

                {/* Usuario registrado */}
                {isRegularUser && (
                  <>
                    <MobileItem index={0} to="/" label="NOVA" icon={<Home className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={1} to="/pqrs" label="PQRS" icon={<FileText className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={2} to="/convocatorias" label="Convocatorias" icon={<Megaphone className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    {!isTeacher && <MobileItem index={3} to="/quiz" label="ElectroQuiz" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />}
                    <MobileItem index={4} to="/dashboard" label="Mi Panel" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={5} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={6} to="/dashboard" label="Mis PQRS" icon={<FileText className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight />
                  </>
                )}

                {/* Área */}
                {isAreaUser && (
                  <>
                    <MobileItem index={0} to="/area" label="Mi Panel" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={1} to="/convocatorias" label="Convocatorias" icon={<Megaphone className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={2} to="/quiz" label="ElectroQuiz" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={3} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={4} to="/area" label="PQRS Asignadas" icon={<Bell className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight />
                    {hasDiplomaAccess && (
                      <MobileItem index={5} to="/admin-diplomas" label="Diplomas" icon={<Shield className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    )}
                    {user.is_staff && (
                      <MobileItem index={6} to="/admin" label="Panel Administración" icon={<Shield className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    )}
                  </>
                )}

                {/* Admin */}
                {isAdminUser && (
                  <>
                    <MobileItem index={0} to="/admin" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={1} to="/convocatorias" label="Convocatorias" icon={<Megaphone className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={2} to="/gestion-areas" label="Gestión de Áreas" icon={<Settings className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={3} to="/gestion-solicitudes-rol" label="Solicitudes de Rol" icon={<UserPlus className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={4} to="/gestion-chatbot" label="Configurar Chatbot" icon={<Bot className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={5} to="/gestion-correo-tickets" label="Correo de Tickets" icon={<Mail className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={6} to="/gestion-correo-saliente" label="Correo Saliente" icon={<Send className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={7} to="/admin-certificados" label="Certificados" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={8} to="/admin-diplomas" label="Diplomas" icon={<Shield className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={9} to="/gestion-elecciones" label="Elecciones" icon={<Vote className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={10} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    {/* Sub-sección Landing */}
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                      className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35"
                    >
                      Landing Page
                    </motion.p>
                    <MobileItem index={11} to="/gestion-contactos" label="Contactos" icon={<UserPlus className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={12} to="/gestion-hero" label="Imágenes del Hero" icon={<Image className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={13} to="/gestion-manual" label="Manual de Usuario" icon={<PlayCircle className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                    <MobileItem index={14} to="/admin" label="Estadísticas" icon={<BarChart2 className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight />
                  </>
                )}

                {/* Coordinador Mobile */}
                {isCoordinator && !isAdminUser && !isAreaUser && (
                  <>
                    <MobileItem index={0} to="/admin-diplomas" label="Diplomas" icon={<Shield className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight />
                    <MobileItem index={1} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                  </>
                )}

                {hasDiplomaAccess && !isAdminUser && !isAreaUser && !isCoordinator && (
                  <>
                    <MobileItem index={0} to="/admin-diplomas" label="Diplomas" icon={<Shield className="w-4 h-4" />} onClick={() => setMenuOpen(false)} highlight />
                    <MobileItem index={1} to="/consulta" label="Consultar Radicado" icon={<Search className="w-4 h-4" />} onClick={() => setMenuOpen(false)} />
                  </>
                )}

                {/* Separador */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="my-3 h-px origin-left"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                />

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35"
                >
                  Cuenta
                </motion.p>

                {!user ? (
                  <>
                    <MobileItem
                      index={5}
                      to="/login"
                      label="Ingresar al sistema"
                      icon={<User className="w-4 h-4" />}
                      onClick={() => setMenuOpen(false)}
                    />
                    {/* ⚠️ TEMPORAL: login de pruebas por perfil del SGD (solo npm run dev). */}
                    {LOGIN_TEMPORAL && (
                      <MobileItem
                        index={6}
                        to="/login-temporal"
                        label="Login 2 (pruebas)"
                        icon={<KeyRound className="w-4 h-4" />}
                        onClick={() => setMenuOpen(false)}
                      />
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ duration: 0.28, delay: 0.3 }}
                  >
                    <button
                      onClick={handleLogout}
                      className="group w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-sm font-medium text-red-300 hover:text-white hover:bg-red-500/30 transition-all"
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/20 group-hover:bg-red-500/40 flex-shrink-0">
                        <LogOut className="w-4 h-4" />
                      </span>
                      <span className="flex-1 text-left">Cerrar sesión</span>
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Footer drawer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="px-5 py-4 border-t border-white/10"
              >
                <div className="flex items-center gap-2 text-white/25">
                  <Shield className="w-3.5 h-3.5" />
                  <p className="text-[11px]">NOVA · Uniautónoma del Cauca</p>
                </div>
              </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}