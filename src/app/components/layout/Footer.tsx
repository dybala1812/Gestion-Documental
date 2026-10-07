/**
 * @file Footer.tsx
 * @description Footer institucional del Portal NOVA.
 */
import { Link } from "react-router";
import { Shield, FileText, Scale, ExternalLink, Users, Home, BookOpen } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#1e3a5f] text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Columna 1 — Institución */}
        <div>
          <p className="font-bold text-sm mb-2 text-[#ffc107]">NOVA</p>
          <p className="text-white/70 text-xs leading-relaxed">
            Núcleo de Operaciones Virtuales Académicas — Plataforma digital institucional
            de la Uniautónoma del Cauca para la gestión de trámites y servicios.
          </p>
        </div>

        {/* Columna 2 — Acceso rápido */}
        <div>
          <p className="font-bold text-sm mb-3 text-[#ffc107]">Acceso rápido</p>
          <ul className="space-y-2">
            <li>
              <Link
                to="/"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <Home className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                NOVA
              </Link>
            </li>
            <li>
              <Link
                to="/pqrs"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <FileText className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                Sistema PQRS
              </Link>
            </li>
            <li>
              <Link
                to="/politica-datos"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <Shield className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                Política de Tratamiento de Datos
              </Link>
            </li>
            <li>
              <Link
                to="/politica-pqrs"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <Scale className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                Política PQRS Vigente
              </Link>
            </li>
            <li>
              <Link
                to="/contactos"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <Users className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                Directorio de Contactos
              </Link>
            </li>
            <li>
              <Link
                to="/manual"
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs transition-colors group"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#ff9800] group-hover:scale-110 transition-transform" />
                Manual de Usuario
              </Link>
            </li>
          </ul>
        </div>

        {/* Columna 3 — Normatividad */}
        <div>
          <p className="font-bold text-sm mb-3 text-[#ffc107]">Normatividad</p>
          <ul className="space-y-1.5 text-xs">
            <li>
              <a
                href="https://www.constitucioncolombia.com/titulo-2/capitulo-1/articulo-23"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors group"
              >
                Art. 23 Constitución Política — Derecho de Petición
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
            <li>
              <a
                href="http://www.secretariasenado.gov.co/senado/basedoc/ley_1755_2015.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors group"
              >
                Ley 1755 de 2015 — Derecho de Petición
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
            <li>
              <a
                href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors group"
              >
                Ley 1437 de 2011 — CPACA
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
            <li>
              <a
                href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors group"
              >
                Ley 1581 de 2012 — Habeas Data
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
            <li>
              <a
                href="https://www.sic.gov.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors group"
              >
                SIC — Superintendencia de Industria y Comercio
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Línea inferior */}
      <div className="border-t border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 max-w-6xl mx-auto">
        <p className="text-white/50 text-xs">
          © {year} NOVA — Uniautónoma del Cauca. Todos los derechos reservados.
        </p>
        <div className="flex gap-4 text-xs">
          <Link to="/politica-datos" className="text-white/50 hover:text-[#ffc107] transition-colors">
            Política de Datos
          </Link>
          <Link to="/politica-pqrs" className="text-white/50 hover:text-[#ffc107] transition-colors">
            Política PQRS
          </Link>
        </div>
      </div>
    </footer>
  );
}
