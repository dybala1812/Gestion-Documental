/**
 * @file PoliticaPQRS.tsx
 * @description Página de Política de PQRS vigente en Colombia.
 *
 * Marco normativo:
 * - Constitución Política de Colombia (1991), Arts. 23 y 74
 * - Ley 1437 de 2011 (CPACA), Arts. 13–33
 * - Ley 1755 de 2015 — Derecho de Petición (sustituyó arts. 13–33 CPACA)
 * - Ley 1712 de 2014 — Transparencia y acceso a información pública
 * - Ley 1581 de 2012 — Protección de datos personales
 * - Ley 734 de 2002 — Código Disciplinario Único (quejas anónimas)
 */

import { Link } from "react-router";
import {
  FileText,
  Scale,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Gavel,
  Timer,
  Shield,
  Phone,
  Mail,
  Globe,
  Building2,
  Info,
} from "lucide-react";

interface TocEntry {
  id: string;
  title: string;
}

const TOC: TocEntry[] = [
  { id: "marco", title: "1. Marco Normativo" },
  { id: "tipos", title: "2. Tipos de PQRSF" },
  { id: "canales", title: "3. Canales de Recepción" },
  { id: "terminos", title: "4. Términos de Respuesta" },
  { id: "derechos", title: "5. Derechos del Peticionario" },
  { id: "obligaciones", title: "6. Obligaciones del Peticionario" },
  { id: "anonimas", title: "7. PQRS Anónimas" },
  { id: "silencio", title: "8. Silencio Administrativo" },
  { id: "recursos", title: "9. Recursos y Acciones Legales" },
  { id: "preguntas", title: "10. Preguntas Frecuentes" },
];

export function PoliticaPQRS() {
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
              <Scale className="w-10 h-10 text-[#ffc107]" />
            </div>
            <div>
              <p className="text-[#ffc107] font-semibold text-sm uppercase tracking-widest mb-1">
                Marco Normativo Colombiano
              </p>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
                Política de PQRS Institucional
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-3xl">
                Sistema de Peticiones, Quejas, Reclamos, Sugerencias y Felicitaciones
                regido por la normatividad colombiana vigente en materia de derecho de petición
                y atención al ciudadano.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <span className="bg-[#ff9800]/20 border border-[#ff9800]/50 text-[#ffc107] text-xs font-semibold px-3 py-1 rounded-full">
                  Ley 1755 / 2015
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  CPACA — Ley 1437 / 2011
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  Ley 1712 / 2014
                </span>
                <span className="bg-white/10 border border-white/30 text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
                  Art. 23 C.P. — Derecho de Petición
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Tabla de contenido ── */}
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
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-[#1e3a5f]/5 hover:text-[#1e3a5f] transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-[#ff9800] flex-shrink-0" />
                  <span className="leading-tight">{s.title}</span>
                </a>
              ))}
            </nav>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <Link
                to="/politica-datos"
                className="flex items-center gap-2 text-sm text-[#1e3a5f] font-medium hover:underline"
              >
                <Shield className="w-4 h-4 text-[#ff9800]" />
                Ver Política de Datos
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Contenido principal ── */}
        <main className="lg:col-span-3 space-y-8">

          {/* 1. Marco Normativo */}
          <section id="marco" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <BookOpen className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">1. Marco Normativo Vigente</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              El sistema PQRS opera bajo el siguiente marco legal colombiano, de obligatorio cumplimiento
              para las entidades públicas:
            </p>
            <div className="space-y-3">
              {[
                {
                  norm: "Constitución Política de Colombia (1991)",
                  arts: "Artículos 23 y 74",
                  desc: "Reconoce el derecho fundamental de petición: toda persona puede presentar peticiones respetuosas a las autoridades y obtener pronta resolución.",
                  color: "border-l-yellow-500 bg-yellow-50",
                  badge: "Fundamental",
                  badgeColor: "bg-yellow-100 text-yellow-700",
                },
                {
                  norm: "Ley 1755 de 2015",
                  arts: "Derecho de Petición",
                  desc: "Regula de manera integral el derecho fundamental de petición, sustituyendo los artículos 13 a 33 del CPACA. Establece modalidades, términos y garantías.",
                  color: "border-l-blue-500 bg-blue-50",
                  badge: "Principal",
                  badgeColor: "bg-blue-100 text-blue-700",
                },
                {
                  norm: "Ley 1437 de 2011 — CPACA",
                  arts: "Código de Procedimiento Administrativo",
                  desc: "Establece los principios del procedimiento administrativo, la función pública y las reglas generales de actuación de las entidades del Estado frente a los ciudadanos.",
                  color: "border-l-green-500 bg-green-50",
                  badge: "Procedimental",
                  badgeColor: "bg-green-100 text-green-700",
                },
                {
                  norm: "Ley 1712 de 2014",
                  arts: "Transparencia y Acceso a Información",
                  desc: "Regula el derecho de acceso a la información pública, la proactividad de las entidades en la publicación de información y los mecanismos de seguimiento.",
                  color: "border-l-purple-500 bg-purple-50",
                  badge: "Transparencia",
                  badgeColor: "bg-purple-100 text-purple-700",
                },
                {
                  norm: "Ley 1581 de 2012",
                  arts: "Protección de Datos — Habeas Data",
                  desc: "Garantiza el derecho a conocer, actualizar y rectificar los datos personales recolectados durante la tramitación de PQRS.",
                  color: "border-l-red-400 bg-red-50",
                  badge: "Datos",
                  badgeColor: "bg-red-100 text-red-600",
                },
                {
                  norm: "Ley 734 de 2002",
                  arts: "Código Disciplinario Único",
                  desc: "Aplicable en la tramitación de quejas disciplinarias anónimas o con reserva de identidad del denunciante.",
                  color: "border-l-gray-400 bg-gray-50",
                  badge: "Disciplinario",
                  badgeColor: "bg-gray-100 text-gray-600",
                },
              ].map((n) => (
                <div key={n.norm} className={`border-l-4 rounded-r-xl p-4 ${n.color}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <p className="font-bold text-gray-900 text-sm">{n.norm}</p>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${n.badgeColor}`}>
                      {n.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mb-1.5 italic">{n.arts}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{n.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Tipos PQRSF */}
          <section id="tipos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <MessageSquare className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">2. Tipos de PQRSF</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              Conforme al artículo 23 de la Constitución y la Ley 1755 de 2015, las modalidades de
              solicitud son:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  letra: "P",
                  tipo: "Petición",
                  sub: "De información · De interés general · De consulta",
                  desc: "Solicitud respetuosa ante la entidad por motivos de interés general o particular, incluyendo petición de información, documentos o consultas.",
                  base: "Art. 23 C.P. / Arts. 13–15, Ley 1755/2015",
                  ico: <FileText className="w-5 h-5" />,
                  color: "bg-blue-500",
                  bg: "bg-blue-50 border-blue-200",
                  plazo: "10–30 días",
                },
                {
                  letra: "Q",
                  tipo: "Queja",
                  sub: "Descontento sobre conductas / omisiones",
                  desc: "Manifestación de inconformidad sobre la conducta o actuar de un servidor público o sobre la prestación deficiente de un servicio.",
                  base: "Art. 16, Ley 1755/2015 / Ley 734/2002",
                  ico: <AlertTriangle className="w-5 h-5" />,
                  color: "bg-orange-500",
                  bg: "bg-orange-50 border-orange-200",
                  plazo: "15 días",
                },
                {
                  letra: "R",
                  tipo: "Reclamo",
                  sub: "Incumplimiento de obligaciones institucionales",
                  desc: "Manifestación de inconformidad por el incumplimiento o cumplimiento deficiente de las funciones y obligaciones a cargo de la entidad.",
                  base: "Art. 16, Ley 1755/2015",
                  ico: <AlertCircle className="w-5 h-5" />,
                  color: "bg-red-500",
                  bg: "bg-red-50 border-red-200",
                  plazo: "15 días",
                },
                {
                  letra: "S",
                  tipo: "Sugerencia",
                  sub: "Propuesta de mejora",
                  desc: "Propuesta del ciudadano orientada a mejorar la gestión, los procesos o los servicios ofrecidos por la institución.",
                  base: "Art. 16, Ley 1755/2015",
                  ico: <HelpCircle className="w-5 h-5" />,
                  color: "bg-purple-500",
                  bg: "bg-purple-50 border-purple-200",
                  plazo: "15 días",
                },
                {
                  letra: "F",
                  tipo: "Felicitación",
                  sub: "Reconocimiento positivo",
                  desc: "Expresión de satisfacción y reconocimiento hacia un servidor público o servicio que supera las expectativas del ciudadano.",
                  base: "Política institucional de calidad",
                  ico: <ThumbsUp className="w-5 h-5" />,
                  color: "bg-green-500",
                  bg: "bg-green-50 border-green-200",
                  plazo: "Acuse",
                },
              ].map((t) => (
                <div key={t.letra} className={`rounded-xl border p-5 ${t.bg}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`text-white rounded-xl p-2.5 flex-shrink-0 ${t.color}`}>
                      {t.ico}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-black text-2xl leading-none ${t.color.replace("bg-", "text-")}`}>
                          {t.letra}
                        </span>
                        <p className="font-bold text-gray-800">{t.tipo}</p>
                        <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                          Máx. {t.plazo} hábiles
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 italic">{t.sub}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">{t.desc}</p>
                  <p className="text-xs text-gray-500 font-medium">{t.base}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Canales */}
          <section id="canales" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Globe className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">3. Canales de Recepción</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              Conforme al artículo 5 de la Ley 1755 de 2015, la institución garantiza la recepción
              de peticiones por múltiples canales:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  canal: "Virtual (Principal)",
                  desc: "A través de la plataforma PQRS en línea, disponible 24/7. Recibirá número de radicado de forma inmediata.",
                  ico: <Globe className="w-6 h-6" />,
                  color: "bg-blue-600",
                  highlight: true,
                },
                {
                  canal: "Presencial",
                  desc: "En las oficinas de atención al ciudadano de la institución, en horarios hábiles establecidos.",
                  ico: <Building2 className="w-6 h-6" />,
                  color: "bg-[#1e3a5f]",
                  highlight: false,
                },
                {
                  canal: "Correo Electrónico",
                  desc: "A través de los correos oficiales publicados en el sitio web institucional.",
                  ico: <Mail className="w-6 h-6" />,
                  color: "bg-[#ff9800]",
                  highlight: false,
                },
                {
                  canal: "Correo Postal",
                  desc: "Mediante carta dirigida a la sede principal de la institución.",
                  ico: <FileText className="w-6 h-6" />,
                  color: "bg-gray-600",
                  highlight: false,
                },
                {
                  canal: "Teléfono",
                  desc: "Líneas de atención al ciudadano en horario hábil. Las solicitudes telefónicas deben ser seguidas de radicación escrita.",
                  ico: <Phone className="w-6 h-6" />,
                  color: "bg-green-600",
                  highlight: false,
                },
                {
                  canal: "Verbal / Oral",
                  desc: "Ante servidores autorizados. El funcionario que atiende debe generar el registro escrito de la petición.",
                  ico: <MessageSquare className="w-6 h-6" />,
                  color: "bg-purple-600",
                  highlight: false,
                },
              ].map((c) => (
                <div
                  key={c.canal}
                  className={`rounded-xl p-5 border ${c.highlight ? "border-blue-300 bg-blue-50 shadow-md" : "border-gray-100 bg-gray-50"}`}
                >
                  <div className={`text-white rounded-xl p-2.5 w-fit mb-3 ${c.color}`}>
                    {c.ico}
                  </div>
                  <p className="font-bold text-gray-800 text-sm mb-1">{c.canal}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{c.desc}</p>
                  {c.highlight && (
                    <span className="mt-2 inline-block text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 4. Términos de respuesta */}
          <section id="terminos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Timer className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">4. Términos Legales de Respuesta</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              Todos los plazos se cuentan en <strong>días hábiles</strong> a partir del día siguiente al
              recibo de la solicitud, conforme a la Ley 1755 de 2015:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Tipo de solicitud</th>
                    <th className="text-center px-4 py-3 font-semibold">Plazo máximo</th>
                    <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Base legal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tipo: "Petición de información o documentos", plazo: "10 días hábiles", base: "Art. 14, Ley 1755/2015", color: "bg-blue-50" },
                    { tipo: "Petición de consulta a entidades públicas", plazo: "30 días hábiles", base: "Art. 14, Ley 1755/2015", color: "bg-white" },
                    { tipo: "Quejas, reclamos y sugerencias", plazo: "15 días hábiles", base: "Art. 16, Ley 1755/2015", color: "bg-orange-50" },
                    { tipo: "Petición entre autoridades", plazo: "10 días hábiles", base: "Art. 19, Ley 1755/2015", color: "bg-white" },
                    { tipo: "Petición relativa a información en poder de privados con función pública", plazo: "10 días hábiles", base: "Art. 32, Ley 1755/2015", color: "bg-blue-50" },
                    { tipo: "Prórroga (máx. una vez, notificando al titular)", plazo: "+plazo igual", base: "Art. 15, Ley 1755/2015", color: "bg-yellow-50" },
                  ].map((r, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${r.color}`}>
                      <td className="px-4 py-3 text-gray-800">{r.tipo}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#1e3a5f] whitespace-nowrap">{r.plazo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs italic">{r.base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Incumplimiento de términos:</strong> El vencimiento del plazo sin respuesta puede
                constituir falta disciplinaria para el servidor responsable (Art. 76 CPACA) y abre la
                vía de la <strong>Acción de Tutela</strong> por vulneración del derecho fundamental de
                petición (Art. 23 y 86 C.P.).
              </p>
            </div>
          </section>

          {/* 5. Derechos del peticionario */}
          <section id="derechos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Users className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">5. Derechos del Peticionario</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              De conformidad con el artículo 5 y siguientes de la Ley 1755 de 2015, usted tiene derecho a:
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                "Presentar peticiones de manera respetuosa, verbal o escrita.",
                "Obtener información sobre el estado de su solicitud en cualquier momento.",
                "Recibir respuesta de fondo, clara, congruente y oportuna.",
                "Que su petición sea resuelta sin dilaciones injustificadas.",
                "Que la entidad custodie en reserva su identidad si así lo solicita.",
                "Desistir de su petición reconociendo o no los hechos.",
                "Interponer recursos contra las decisiones que resuelvan su petición.",
                "Solicitar copias de los documentos relacionados con su trámite.",
                "No ser discriminado/a por ejercer el derecho de petición.",
                "Ser atendido/a con respeto y consideración debida.",
              ].map((d, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Obligaciones */}
          <section id="obligaciones" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Gavel className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">6. Obligaciones del Peticionario</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              El ejercicio del derecho de petición conlleva las siguientes obligaciones,
              conforme al artículo 16 de la Ley 1755 de 2015:
            </p>
            <div className="space-y-2">
              {[
                { obl: "Usar un lenguaje respetuoso y claro en sus comunicaciones.", icon: <MessageSquare className="w-4 h-4" /> },
                { obl: "Suministrar información veraz, completa y actualizada.", icon: <CheckCircle className="w-4 h-4" /> },
                { obl: "Aportar los documentos que soporten su solicitud.", icon: <FileText className="w-4 h-4" /> },
                { obl: "Actualizar datos de contacto si cambian durante el trámite.", icon: <Users className="w-4 h-4" /> },
                { obl: "Abstenerse de presentar peticiones abusivas, temerarias o de mala fe.", icon: <AlertTriangle className="w-4 h-4" /> },
                { obl: "No obstaculizar el procedimiento administrativo.", icon: <Info className="w-4 h-4" /> },
              ].map((o, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10">
                  <span className="text-[#ff9800] flex-shrink-0 mt-0.5">{o.icon}</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{o.obl}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                <strong>Peticiones irrespetuosas o abusivas:</strong> Conforme al artículo 11 de la
                Ley 1755 de 2015, la entidad puede rechazar de plano las peticiones que contengan
                lenguaje soez, ofensivo o que sea manifiestamente improcedente, siempre que se
                informe al peticionario de forma motivada.
              </p>
            </div>
          </section>

          {/* 7. PQRS Anónimas */}
          <section id="anonimas" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Shield className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">7. PQRS Anónimas y Reserva de Identidad</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="font-bold text-[#1e3a5f] mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#ff9800]" /> Peticiones Anónimas
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Se tramitarán conforme al artículo 61 de la Ley 1437 de 2011. El sistema asigna
                  un número de radicado que permite hacer seguimiento sin revelar identidad.
                  No es posible enviar notificaciones por correo; consulte por el número de radicado.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="font-bold text-[#1e3a5f] mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#ff9800]" /> Reserva de Identidad
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Los peticionarios identificados pueden solicitar que su identidad sea reservada
                  (confidencial) frente al sujeto investigado. La entidad está obligada a garantizar
                  esta reserva (Art. 18 Ley 1755/2015).
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Las quejas anónimas que puedan implicar investigaciones disciplinarias se tramitan
                conforme a la <strong>Ley 734 de 2002</strong> (Código Disciplinario Único). La
                institución no puede garantizar notificaciones sin datos de contacto.
              </p>
            </div>
          </section>

          {/* 8. Silencio Administrativo */}
          <section id="silencio" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Clock className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">8. Silencio Administrativo Positivo</h2>
            </div>
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white rounded-xl p-6 mb-4">
              <p className="font-bold text-lg mb-2">¿Qué es el Silencio Administrativo?</p>
              <p className="text-white/85 text-sm leading-relaxed">
                De conformidad con el artículo 83 del CPACA (Ley 1437 de 2011), si la entidad no
                emite una decisión de fondo dentro de los términos legales establecidos, se entiende
                que la decisión es <strong className="text-[#ffc107]">favorable al peticionario</strong>,
                salvo en los casos expresamente exceptuados por la ley.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Puede hacer valer el silencio administrativo positivo ante la misma entidad,
                  mostrando la petición radicada y el vencimiento del término.
                </p>
              </div>
              <div className="flex gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Si aplica el silencio administrativo, puede acudir a la <strong>acción de tutela</strong>{" "}
                  si considera vulnerado su derecho fundamental de petición (Art. 86 C.P.).
                </p>
              </div>
            </div>
          </section>

          {/* 9. Recursos */}
          <section id="recursos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <Gavel className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">9. Recursos y Acciones Legales</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-5">
              Contra las respuestas a su PQRS o ante la omisión de la entidad, proceden los
              siguientes recursos y acciones:
            </p>
            <div className="space-y-4">
              {[
                {
                  nombre: "Recurso de Reposición",
                  desc: "Se interpone dentro de los 10 días siguientes a la notificación de la decisión, ante la misma autoridad que la profirió.",
                  base: "Art. 74-75, Ley 1437/2011",
                  color: "bg-blue-50 border-blue-200",
                  ico: <FileText className="w-5 h-5 text-blue-600" />,
                },
                {
                  nombre: "Recurso de Apelación",
                  desc: "Procede ante el superior jerárquico de quien emitió la decisión, cuando así lo contemple la ley. Se interpone dentro de los 10 días siguientes.",
                  base: "Art. 74 y 76, Ley 1437/2011",
                  color: "bg-green-50 border-green-200",
                  ico: <Scale className="w-5 h-5 text-green-600" />,
                },
                {
                  nombre: "Acción de Tutela",
                  desc: "Cuando se vulnere el derecho fundamental de petición. Debe interponerse ante cualquier juez de la República. Respuesta en 10 días calendario.",
                  base: "Art. 86, C.P. / Decreto 2591 de 1991",
                  color: "bg-orange-50 border-orange-200",
                  ico: <Gavel className="w-5 h-5 text-orange-600" />,
                  highlight: true,
                },
                {
                  nombre: "Queja ante la Procuraduría General",
                  desc: "Por la conducta del funcionario público que incumplió los plazos o vulneró sus derechos como peticionario.",
                  base: "Ley 734 de 2002",
                  color: "bg-purple-50 border-purple-200",
                  ico: <Building2 className="w-5 h-5 text-purple-600" />,
                },
                {
                  nombre: "Acción de Nulidad y Restablecimiento del Derecho",
                  desc: "Cuando el acto administrativo resulte contrario al ordenamiento jurídico, ante la Jurisdicción Contencioso Administrativa.",
                  base: "Art. 138, Ley 1437/2011",
                  color: "bg-gray-50 border-gray-200",
                  ico: <Scale className="w-5 h-5 text-gray-600" />,
                },
              ].map((r) => (
                <div key={r.nombre} className={`border rounded-xl p-5 ${r.color} ${r.highlight ? "shadow-md" : ""}`}>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 mt-0.5">{r.ico}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900">{r.nombre}</p>
                        {r.highlight && (
                          <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                            Más usado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-1">{r.desc}</p>
                      <p className="text-xs text-gray-500 italic font-medium">{r.base}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 10. FAQ */}
          <section id="preguntas" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#1e3a5f]/10 rounded-xl p-2.5">
                <HelpCircle className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f]">10. Preguntas Frecuentes</h2>
            </div>
            <div className="space-y-4">
              {[
                {
                  q: "¿Cuántas PQRS puedo presentar?",
                  a: "No existe límite legal para presentar PQRS. Sin embargo, la presentación abusiva o temeraria puede ser rechazada de plano, con notificación motivada al peticionario (Art. 11, Ley 1755/2015).",
                },
                {
                  q: "¿Qué pasa si no recibo respuesta en el tiempo establecido?",
                  a: "Puede aplicar el silencio administrativo positivo (Art. 83 CPACA) e interponer acción de tutela por vulneración del derecho de petición ante cualquier juez.",
                },
                {
                  q: "¿Puedo adjuntar documentos a mi PQRS?",
                  a: "Sí. El sistema acepta archivos PDF, JPG, PNG, DOC y DOCX, hasta 5 archivos de máximo 5MB cada uno. Los documentos deben ser legibles.",
                },
                {
                  q: "¿Puedo rastrear el estado de mi PQRS?",
                  a: "Sí. Use la función 'Consulta por Radicado' en la plataforma ingresando el número de radicado que recibió al presentar su solicitud.",
                },
                {
                  q: "¿La institución puede negar una petición de información?",
                  a: "Solo en los casos de información clasificada o reservada contemplados en la Ley 1712 de 2014 y otras normas especiales. Toda negativa debe ser motivada y notificada al peticionario.",
                },
                {
                  q: "¿En qué idioma puedo presentar mi petición?",
                  a: "Según el Art. 8 de la Ley 1437/2011, las peticiones de comunidades o personas que no hablen o entiendan el castellano podrán presentarse en su lengua materna. La entidad garantizará la atención con intérprete.",
                },
              ].map((faq, i) => (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-[#1e3a5f]/5 px-5 py-3 flex items-start gap-3">
                    <span className="text-[#ff9800] font-black flex-shrink-0">Q</span>
                    <p className="font-semibold text-gray-800 text-sm">{faq.q}</p>
                  </div>
                  <div className="px-5 py-4 flex items-start gap-3">
                    <span className="text-[#1e3a5f] font-black flex-shrink-0">A</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Nota final */}
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] text-white rounded-2xl p-6 flex flex-wrap gap-6 items-center justify-between">
            <div>
              <p className="font-bold text-lg mb-1">¿Necesita más información?</p>
              <p className="text-white/80 text-sm">Consulte los canales oficiales de atención o revise el marco normativo completo.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/pqrs"
                className="bg-[#ff9800] hover:bg-[#f57c00] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                Radicar PQRS
              </Link>
              <Link
                to="/politica-datos"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors border border-white/30"
              >
                Política de Datos
              </Link>
            </div>
          </div>

        </main>
      </div>

      {/* ── Footer ── */}
      <div className="bg-[#1e3a5f] text-white/70 text-xs text-center py-4 mt-4">
        <p>
          Sistema PQRS Institucional — Política PQRS conforme a la Ley 1755 de 2015 &nbsp;|&nbsp;
          <Link to="/politica-datos" className="text-[#ffc107] hover:underline">
            Política de Datos
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
