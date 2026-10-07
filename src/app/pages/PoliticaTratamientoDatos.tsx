/**
 * @file PoliticaTratamientoDatos.tsx
 * @description Página de Política de Tratamiento de Datos Personales
 * conforme a la Ley 1581 de 2012 (Habeas Data) y el Decreto 1377 de 2013.
 */

import { Link } from "react-router";
import {
  Shield,
  FileText,
  User,
  Lock,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  Database,
  Eye,
  Trash2,
  Edit,
  ChevronRight,
  Building2,
  Calendar,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const TOC: Section[] = [
  { id: "responsable", title: "1. Responsable del Tratamiento", icon: <Building2 className="w-4 h-4" /> },
  { id: "datos", title: "2. Datos Personales Recolectados", icon: <Database className="w-4 h-4" /> },
  { id: "finalidades", title: "3. Finalidades del Tratamiento", icon: <FileText className="w-4 h-4" /> },
  { id: "derechos", title: "4. Derechos del Titular (ARCO)", icon: <Shield className="w-4 h-4" /> },
  { id: "procedimiento", title: "5. Cómo Ejercer sus Derechos", icon: <CheckCircle className="w-4 h-4" /> },
  { id: "transferencia", title: "6. Transferencia de Datos", icon: <Lock className="w-4 h-4" /> },
  { id: "seguridad", title: "7. Seguridad de la Información", icon: <Eye className="w-4 h-4" /> },
  { id: "cookies", title: "8. Cookies y Sesión", icon: <AlertCircle className="w-4 h-4" /> },
  { id: "vigencia", title: "9. Vigencia y Contacto", icon: <Calendar className="w-4 h-4" /> },
];

export function PoliticaTratamientoDatos() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a6f] text-white py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <Shield className="w-10 h-10 text-[#ffc107]" />
            </div>
            <div>
              <p className="text-[#ffc107] font-semibold text-sm uppercase tracking-widest mb-1">
                Protección de Datos Personales
              </p>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
                Política de Tratamiento de Datos Personales
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-3xl">
                En cumplimiento de la <strong className="text-white">Ley 1581 de 2012</strong> (Habeas Data),
                el <strong className="text-white">Decreto 1377 de 2013</strong> y el{" "}
                <strong className="text-white">Decreto 1074 de 2015</strong>, la institución establece
                las condiciones bajo las cuales trata los datos personales de sus usuarios.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <span className="bg-[#ff9800]/20 border border-[#ff9800]/50 text-[#ffc107] text-xs font-semibold px-3 py-1 rounded-full">
                  Ley 1581 / 2012
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  Decreto 1377 / 2013
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  Decreto 1074 / 2015
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  Versión 1.0 — Marzo 2026
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Tabla de contenido (sidebar) ── */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Contenido
            </p>
            <nav className="space-y-1">
              {TOC.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-[#1e3a5f]/5 hover:text-[#1e3a5f] transition-colors group"
                >
                  <span className="text-[#ff9800] group-hover:scale-110 transition-transform flex-shrink-0">
                    {s.icon}
                  </span>
                  <span className="leading-tight">{s.title}</span>
                </a>
              ))}
            </nav>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <Link
                to="/politica-pqrs"
                className="flex items-center gap-2 text-sm text-[#1e3a5f] font-medium hover:underline"
              >
                <FileText className="w-4 h-4 text-[#ff9800]" />
                Ver Política PQRS
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Contenido principal ── */}
        <main className="lg:col-span-3 space-y-8">

          {/* 1. Responsable */}
          <section id="responsable" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Building2 className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">1. Responsable del Tratamiento</h2>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-4">
              <p className="text-gray-800 leading-relaxed">
                La <strong>Institución</strong> actúa como <strong>Responsable del Tratamiento</strong> de
                los datos personales recolectados a través del Sistema PQRS Institucional, en los
                términos del artículo 3 de la Ley 1581 de 2012.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <Mail className="w-5 h-5 text-[#ff9800] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Correo de contacto</p>
                  <p className="text-gray-600 text-sm">protecciondatos@institucion.edu.co</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <Phone className="w-5 h-5 text-[#ff9800] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Línea de atención</p>
                  <p className="text-gray-600 text-sm">Canales oficiales de la institución</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Datos recolectados */}
          <section id="datos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Database className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">2. Datos Personales Recolectados</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-5">
              Con base en el artículo 5 de la Ley 1581 de 2012, los datos personales recolectados
              son aquellos necesarios para la correcta gestión de las PQRS y la prestación del servicio
              institucional:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  cat: "Datos de Identificación",
                  items: ["Nombre completo", "Tipo y número de documento", "Ciudad de residencia"],
                  color: "bg-blue-50 border-blue-200",
                  dot: "bg-blue-500",
                },
                {
                  cat: "Datos de Contacto",
                  items: ["Correo electrónico", "Número de teléfono"],
                  color: "bg-green-50 border-green-200",
                  dot: "bg-green-500",
                },
                {
                  cat: "Datos de la Solicitud",
                  items: ["Tipo de PQRS", "Asunto y descripción", "Documentos adjuntos"],
                  color: "bg-orange-50 border-orange-200",
                  dot: "bg-orange-500",
                },
                {
                  cat: "Datos de Navegación",
                  items: ["Token de sesión (JWT)", "Actividad en la plataforma"],
                  color: "bg-purple-50 border-purple-200",
                  dot: "bg-purple-500",
                },
              ].map((g) => (
                <div key={g.cat} className={`rounded-xl border p-4 ${g.color}`}>
                  <p className="font-bold text-gray-800 text-sm mb-2">{g.cat}</p>
                  <ul className="space-y-1">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${g.dot}`} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Datos sensibles:</strong> La institución no recolecta datos sensibles (salud,
                origen étnico, orientación sexual, creencias religiosas, datos biométricos) a través
                del sistema PQRS, en cumplimiento del artículo 6 de la Ley 1581 de 2012. Si una
                descripción de PQRS los incluye voluntariamente, el tratamiento se limita
                estrictamente a la resolución de la solicitud.
              </p>
            </div>
          </section>

          {/* 3. Finalidades */}
          <section id="finalidades" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <FileText className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">3. Finalidades del Tratamiento</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Conforme al principio de <strong>finalidad</strong> (Art. 4, literal b, Ley 1581/2012),
              los datos únicamente serán utilizados para los siguientes propósitos:
            </p>
            <div className="space-y-3">
              {[
                {
                  num: "01",
                  title: "Gestión y tramitación de PQRS",
                  desc: "Recibir, registrar, asignar, tramitar y responder las peticiones, quejas, reclamos y sugerencias presentadas.",
                },
                {
                  num: "02",
                  title: "Comunicación con el peticionario",
                  desc: "Enviar notificaciones sobre el estado de la solicitud, respuestas de fondo y comunicados pertinentes.",
                },
                {
                  num: "03",
                  title: "Estadísticas e informes institucionales",
                  desc: "Generar reportes agregados y anonimizados para la mejora continua del servicio, sin identificar individuos.",
                },
                {
                  num: "04",
                  title: "Cumplimiento de obligaciones legales",
                  desc: "Dar respuesta a requerimientos de autoridades estatales competentes (Defensoría del Pueblo, Procuraduría, etc.).",
                },
                {
                  num: "05",
                  title: "Autenticación y seguridad del sistema",
                  desc: "Verificar la identidad del usuario y proteger la integridad de la plataforma.",
                },
              ].map((f) => (
                <div key={f.num} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-[#ff9800] font-black text-lg leading-none mt-0.5 flex-shrink-0 w-7">
                    {f.num}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                    <p className="text-gray-600 text-sm mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Derechos ARCO */}
          <section id="derechos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Shield className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">4. Derechos del Titular (ARCO)</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-5">
              De conformidad con el artículo 8 de la Ley 1581 de 2012, usted como titular de los
              datos personales tiene los siguientes derechos:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  letra: "A",
                  title: "Acceso",
                  desc: "Conocer, actualizar y rectificar sus datos personales en nuestras bases de datos.",
                  icon: <Eye className="w-5 h-5" />,
                  color: "bg-blue-100 text-blue-700",
                },
                {
                  letra: "R",
                  title: "Rectificación",
                  desc: "Solicitar la corrección de datos inexactos, incompletos o desactualizados.",
                  icon: <Edit className="w-5 h-5" />,
                  color: "bg-green-100 text-green-700",
                },
                {
                  letra: "C",
                  title: "Cancelación / Supresión",
                  desc: "Solicitar la eliminación de sus datos cuando no sean necesarios para las finalidades declaradas, salvo obligación legal.",
                  icon: <Trash2 className="w-5 h-5" />,
                  color: "bg-red-100 text-red-700",
                },
                {
                  letra: "O",
                  title: "Oposición",
                  desc: "Revocar la autorización y/u oponerse al tratamiento cuando no se respeten los principios, derechos y garantías constitucionales.",
                  icon: <AlertCircle className="w-5 h-5" />,
                  color: "bg-orange-100 text-orange-700",
                },
              ].map((d) => (
                <div
                  key={d.letra}
                  className="border border-gray-100 rounded-xl p-5 flex gap-4 hover:shadow-md transition-shadow"
                >
                  <div className={`rounded-xl p-3 flex-shrink-0 ${d.color}`}>
                    {d.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-2xl text-[#1e3a5f] leading-none">{d.letra}</span>
                      <span className="font-bold text-gray-800">{d.title}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Derecho a presentar quejas ante la SIC:</strong> Si considera que la institución
                ha vulnerado sus derechos como titular, puede presentar una queja ante la{" "}
                <strong>Superintendencia de Industria y Comercio (SIC)</strong>, www.sic.gov.co,
                de conformidad con el artículo 16 literal d) de la Ley 1581 de 2012.
              </p>
            </div>
          </section>

          {/* 5. Procedimiento */}
          <section id="procedimiento" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <CheckCircle className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">5. Cómo Ejercer sus Derechos</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-5">
              De acuerdo con los artículos 14, 15 y 16 de la Ley 1581 de 2012, el procedimiento
              para ejercer sus derechos es el siguiente:
            </p>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {[
                  {
                    paso: 1,
                    title: "Presentar la solicitud",
                    desc: "Envíe un correo a protecciondatos@institucion.edu.co indicando: su nombre completo, número de documento, derecho que desea ejercer y los datos sobre los que solicita la actuación.",
                    plazo: "",
                  },
                  {
                    paso: 2,
                    title: "Verificación de identidad",
                    desc: "La institución verificará su identidad antes de proceder. Puede solicitarse copia del documento de identidad.",
                    plazo: "",
                  },
                  {
                    paso: 3,
                    title: "Consultas",
                    desc: "El plazo máximo para atender consultas sobre los datos es de 10 días hábiles (Art. 14 Ley 1581/2012). Si no es posible resolver en ese tiempo, se informará al titular.",
                    plazo: "10 días hábiles",
                  },
                  {
                    paso: 4,
                    title: "Reclamos (rectificación / supresión / oposición)",
                    desc: "El reclamo se tramitará en un plazo máximo de 15 días hábiles (Art. 15 Ley 1581/2012). Si el reclamo resulta incompleto, se solicitará la corrección dentro de los 5 días hábiles siguientes.",
                    plazo: "15 días hábiles",
                  },
                ].map((p) => (
                  <div key={p.paso} className="relative flex gap-5 pl-10">
                    <div className="absolute left-0 w-10 h-10 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 z-10">
                      {p.paso}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 flex-1 border border-gray-100">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-bold text-gray-800">{p.title}</p>
                        {p.plazo && (
                          <span className="text-xs font-semibold bg-[#ff9800]/10 text-[#ff9800] px-2.5 py-1 rounded-full whitespace-nowrap">
                            {p.plazo}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Transferencia */}
          <section id="transferencia" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Lock className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">6. Transferencia y Transmisión de Datos</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Conforme al Título VIII de la Ley 1581 de 2012 y el artículo 26 del Decreto 1377 de 2013:
            </p>
            <div className="space-y-3">
              <div className="flex gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Los datos personales <strong>no serán vendidos</strong> ni cedidos comercialmente a terceros.
                </p>
              </div>
              <div className="flex gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  La transmisión de datos a encargados del tratamiento (ej. proveedores de servicios tecnológicos)
                  se realizará mediante contratos que garanticen el cumplimiento de la ley.
                </p>
              </div>
              <div className="flex gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Los datos podrán compartirse con autoridades públicas (Procuraduría, Defensoría, Policía Nacional)
                  cuando exista obligación legal o requerimiento judicial debidamente expedido.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Seguridad */}
          <section id="seguridad" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Eye className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">7. Seguridad de la Información</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              En cumplimiento del principio de <strong>seguridad</strong> (Art. 4, literal g, Ley 1581/2012),
              la institución implementa las siguientes medidas técnicas y administrativas:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: <Lock className="w-5 h-5" />, title: "Cifrado HTTPS", desc: "Todas las comunicaciones se realizan bajo protocolo TLS/SSL." },
                { icon: <User className="w-5 h-5" />, title: "Autenticación JWT", desc: "Tokens de acceso de corta duración y refresh tokens seguros." },
                { icon: <Shield className="w-5 h-5" />, title: "Control de acceso", desc: "Solo personal autorizado puede acceder a los datos según su rol." },
                { icon: <Database className="w-5 h-5" />, title: "Backups periódicos", desc: "Copias de seguridad regulares para garantizar la disponibilidad." },
                { icon: <Eye className="w-5 h-5" />, title: "Auditoría de accesos", desc: "Registro de operaciones sobre datos sensibles." },
                { icon: <AlertCircle className="w-5 h-5" />, title: "Notificación de brechas", desc: "Ante un incidente, la SIC y los titulares serán notificados conforme a la ley." },
              ].map((m) => (
                <div key={m.title} className="bg-[#1e3a5f]/5 rounded-xl p-4">
                  <div className="text-[#1e3a5f] mb-2">{m.icon}</div>
                  <p className="font-bold text-gray-800 text-sm mb-1">{m.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 8. Cookies */}
          <section id="cookies" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <AlertCircle className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">8. Cookies y Datos de Sesión</h2>
            </div>
            <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
              <p>
                El sistema utiliza <strong>localStorage</strong> del navegador para almacenar el
                token de acceso JWT y el token de actualización (refresh). Estos datos son de carácter
                técnico y son indispensables para el funcionamiento de la sesión autenticada.
              </p>
              <p>
                Adicionalmente, se integra <strong>Google reCAPTCHA Enterprise</strong> para prevenir
                el uso automatizado de los formularios públicos. Este servicio puede recopilar
                información sobre las interacciones del usuario según las{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ff9800] hover:underline"
                >
                  Políticas de Privacidad de Google
                </a>.
              </p>
              <p>
                No se utilizan cookies de rastreo publicitario ni herramientas de analítica de terceros
                que compartan datos de los usuarios fuera de la institución.
              </p>
            </div>
          </section>

          {/* 9. Vigencia */}
          <section id="vigencia" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Calendar className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">9. Vigencia, Actualizaciones y Contacto</h2>
            </div>
            <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
              <p>
                Esta política entra en vigencia el <strong>1 de marzo de 2026</strong> y estará
                disponible permanentemente en la plataforma. Cualquier modificación derivada de
                cambios normativos será publicada con anticipación razonable conforme al principio
                de publicidad (Art. 4, literal i, Ley 1581/2012).
              </p>
              <p>
                Los datos personales se conservarán durante el tiempo necesario para cumplir las
                finalidades descritas y las obligaciones legales aplicables. Las PQRS radicadas
                conservarán sus datos conforme a las tablas de retención documental institucionales.
              </p>
            </div>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <div className="bg-[#1e3a5f] text-white rounded-xl p-5">
                <p className="font-bold mb-1">Delegado de Protección de Datos</p>
                <p className="text-white/80 text-sm">protecciondatos@institucion.edu.co</p>
              </div>
              <div className="bg-[#ff9800] text-white rounded-xl p-5">
                <p className="font-bold mb-1">Superintendencia de Industria y Comercio</p>
                <a
                  href="https://www.sic.gov.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 text-sm hover:text-white underline"
                >
                  www.sic.gov.co
                </a>
              </div>
            </div>
            <div className="mt-4 bg-gray-50 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-gray-500">
                <strong>Última actualización:</strong> Marzo 2026 &nbsp;|&nbsp;
                <strong>Versión:</strong> 1.0
              </div>
              <div className="flex gap-3">
                <Link
                  to="/politica-pqrs"
                  className="text-sm text-[#1e3a5f] font-medium hover:underline flex items-center gap-1"
                >
                  Ver Política PQRS <ChevronRight className="w-3 h-3" />
                </Link>
                <Link
                  to="/"
                  className="text-sm text-gray-500 hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Inicio
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* ── Footer de la página ── */}
      <div className="bg-[#1e3a5f] text-white/70 text-xs text-center py-4 mt-4">
        <p>
          Sistema PQRS Institucional — Política de Tratamiento de Datos conforme a la Ley 1581 de 2012 &nbsp;|&nbsp;
          <Link to="/politica-pqrs" className="text-[#ffc107] hover:underline">
            Política PQRS
          </Link>
          &nbsp;|&nbsp;
          <Link to="/" className="hover:text-white">
            Inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
