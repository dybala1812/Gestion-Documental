/**
 * @file Manual.tsx
 * @description Página pública del Manual de Usuario: videos instructivos y PDFs
 *   cargados por el administrador. Acceso libre, sin necesidad de autenticación.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PlayCircle, FileText, BookOpen, Loader2, Download } from "lucide-react";
import { apiListManualResources, API_BASE, type ManualResource } from "../lib/api";

const C = {
  beige: "#f3ede1",
  navy:  "#1e3a5f",
  orange: "#e8740e",
  gold:  "#c89b14",
  text:  "#2c3e50",
  muted: "#6b7a8d",
  card:  "#ffffff",
  border: "rgba(30,58,95,0.09)",
};

function resolveFileUrl(path: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

/** Convierte enlaces de YouTube/Vimeo en URLs embebibles para el reproductor. */
function toEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id = u.hostname.includes("youtu.be")
        ? u.pathname.slice(1)
        : u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

function VideoCard({ item }: { item: ManualResource }) {
  const embed = item.external_url ? toEmbedUrl(item.external_url) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl overflow-hidden border shadow-sm bg-white flex flex-col"
      style={{ borderColor: C.border }}
    >
      <div className="aspect-video bg-black/90 flex items-center justify-center">
        {item.file ? (
          <video controls className="w-full h-full" preload="metadata">
            <source src={resolveFileUrl(item.file)} />
            Tu navegador no soporta la reproducción de video.
          </video>
        ) : embed ? (
          <iframe
            src={embed}
            title={item.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <PlayCircle className="w-12 h-12 text-white/60" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold" style={{ color: C.navy }}>{item.title}</h3>
        {item.description && (
          <p className="text-sm mt-1" style={{ color: C.muted }}>{item.description}</p>
        )}
      </div>
    </motion.div>
  );
}

function PdfCard({ item }: { item: ManualResource }) {
  const url = resolveFileUrl(item.file);
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border shadow-sm bg-white p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
      style={{ borderColor: C.border }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${C.orange}1a` }}
      >
        <FileText className="w-6 h-6" style={{ color: C.orange }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ color: C.navy }}>{item.title}</p>
        {item.description && (
          <p className="text-sm truncate" style={{ color: C.muted }}>{item.description}</p>
        )}
      </div>
      <Download className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: C.navy }} />
    </motion.a>
  );
}

export function Manual() {
  const [resources, setResources] = useState<ManualResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiListManualResources()
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  const videos = resources.filter(r => r.resource_type === "VIDEO");
  const pdfs   = resources.filter(r => r.resource_type === "PDF");

  return (
    <div style={{ background: C.beige }} className="min-h-screen">
      {/* Encabezado */}
      <div style={{ background: C.navy }} className="text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: `${C.gold}33` }}>
            <BookOpen className="w-7 h-7" style={{ color: C.gold }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Manual de Usuario</h1>
          <p className="mt-3 text-white/70 max-w-2xl mx-auto">
            Videos instructivos y documentos que explican paso a paso el uso de los servicios de NOVA.
            Contenido público, disponible para toda la comunidad institucional.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-14">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.navy }} />
          </div>
        ) : (
          <>
            {/* Videos */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <PlayCircle className="w-5 h-5" style={{ color: C.orange }} />
                <h2 className="text-xl font-bold" style={{ color: C.navy }}>Videos instructivos</h2>
              </div>
              {videos.length === 0 ? (
                <p className="text-sm" style={{ color: C.muted }}>Aún no hay videos disponibles.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {videos.map(v => <VideoCard key={v.id} item={v} />)}
                </div>
              )}
            </section>

            {/* PDFs */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5" style={{ color: C.orange }} />
                <h2 className="text-xl font-bold" style={{ color: C.navy }}>Documentos PDF</h2>
              </div>
              {pdfs.length === 0 ? (
                <p className="text-sm" style={{ color: C.muted }}>Aún no hay documentos disponibles.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pdfs.map(p => <PdfCard key={p.id} item={p} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
