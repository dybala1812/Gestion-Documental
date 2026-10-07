/**
 * @file Contactos.tsx
 * @description Página pública de contactos institucionales.
 *
 * Muestra el directorio de funcionarios de enlace de cada dependencia.
 * No requiere autenticación; los datos se obtienen del endpoint público
 * GET /api/pqrs/contacts/.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Briefcase, Building2, Users, Search, Phone } from "lucide-react";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { apiListContacts, formatApiError, type Contact } from "../lib/api";

export function Contactos() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    apiListContacts()
      .then(res => {
        const lista: Contact[] = Array.isArray(res) ? res : (res as any).results ?? [];
        setContacts(lista);
      })
      .catch(e => toast.error("Error al cargar contactos", { description: formatApiError(e) }))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.cargo.toLowerCase().includes(q) ||
      c.correo.toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q) ||
      (c.dependencia_nombre ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero */}
      <div className="bg-[#1e3a5f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-[#ffc107]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Directorio de Contactos</h1>
          <p className="text-white/75 max-w-xl mx-auto text-sm leading-relaxed">
            Encuentre el funcionario de enlace de cada dependencia para orientar
            su Petición, Queja, Reclamo, Sugerencia o Felicitación.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Search */}
        <div className="mb-8 flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, cargo, correo o dependencia…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {busqueda
                ? "No se encontraron contactos con ese criterio"
                : "No hay contactos registrados aún"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c => (
              <Card
                key={c.id}
                className="hover:shadow-md transition-shadow border-0 shadow-sm bg-white"
              >
                <CardContent className="p-5">
                  {/* Avatar + nombre */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-white font-bold text-base">
                        {c.nombre.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{c.nombre}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Cargo */}
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Briefcase className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{c.cargo}</span>
                    </div>

                    {/* Dependencia */}
                    {(c.dependencia_nombre) && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Building2 className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <span>{c.dependencia_nombre}</span>
                      </div>
                    )}

                    {/* Correo */}
                    <div className="flex items-start gap-2 text-sm">
                      <Mail className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <a
                        href={`mailto:${c.correo}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                      >
                        {c.correo}
                      </a>
                    </div>

                    {/* Teléfono */}
                    {c.telefono && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <a href={`tel:${c.telefono}`} className="hover:text-blue-600 hover:underline">
                          {c.telefono}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
