/**
 * @file PlantillasArea.tsx
 * @description Administración › Plantillas de correo (RF-AC-006).
 * Editar asunto y cuerpo de cada plantilla con vista previa antes de guardar, y restablecer el
 * texto original. F5 lee la plantilla en cada envío, así que el siguiente correo usa el texto nuevo.
 * Permiso plantillas.gestionar (Archivo Central y Administrador); cada cambio queda auditado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Eye, FileText, Loader2, RotateCcw, Save } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { formatApiError } from "../../lib/api";
import { campoDelError } from "../../lib/sgdApi";
import { guardarPlantilla, listarPlantillas, restablecerPlantilla, type Plantilla } from "../../lib/catalogosApi";

/** Variables que reemplaza F5, con un valor de ejemplo para la vista previa. */
const VARIABLES: { clave: string; descripcion: string; ejemplo: string }[] = [
  { clave: "consecutivo", descripcion: "Consecutivo de la comunicación", ejemplo: "ENT-2026-000123" },
  { clave: "nombre", descripcion: "Nombre del destinatario", ejemplo: "María Fernanda Ruiz" },
  { clave: "asunto", descripcion: "Asunto de la comunicación", ejemplo: "Solicitud de certificado de notas" },
  { clave: "dependencia", descripcion: "Dependencia que atiende", ejemplo: "Registro Académico" },
  { clave: "plazo", descripcion: "Plazo de respuesta", ejemplo: "5 días hábiles (hasta el 4 de noviembre)" },
  { clave: "fecha", descripcion: "Fecha del envío", ejemplo: new Date().toLocaleDateString("es-CO") },
  { clave: "mensaje", descripcion: "Mensaje escrito por Archivo Central", ejemplo: "Favor responder dentro del plazo." },
  { clave: "respuesta", descripcion: "Texto de la respuesta", ejemplo: "Adjuntamos el certificado solicitado." },
  { clave: "pendientes", descripcion: "Comunicaciones pendientes (recordatorio)", ejemplo: "ENT-2026-000101 · vence hoy\nENT-2026-000118 · vencida hace 2 días" },
  { clave: "cuerpo", descripcion: "Cuerpo de un correo adicional", ejemplo: "Le compartimos la información adicional solicitada." },
];
const EJEMPLOS = Object.fromEntries(VARIABLES.map((v) => [v.clave, v.ejemplo]));

const renderizar = (texto: string) => texto.replace(/\{(\w+)\}/g, (m, k) => (k in EJEMPLOS ? EJEMPLOS[k] : m));
const desconocidas = (texto: string) => [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !(k in EJEMPLOS)))];

export function PlantillasArea() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState<"guardar" | "restablecer" | null>(null);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);

  const actual = plantillas.find((p) => p.codigo === codigo) ?? null;
  const cambiado = !!actual && (asunto !== actual.asunto || cuerpo !== actual.cuerpo);
  const raras = useMemo(() => desconocidas(`${asunto}\n${cuerpo}`), [asunto, cuerpo]);

  const seleccionar = (p: Plantilla) => {
    setCodigo(p.codigo);
    setAsunto(p.asunto);
    setCuerpo(p.cuerpo);
    setErrores({});
  };

  useEffect(() => {
    listarPlantillas()
      .then((lista) => { setPlantillas(lista); if (lista[0]) seleccionar(lista[0]); })
      .catch((e) => sileo.error({ title: "No se pudieron cargar las plantillas", description: formatApiError(e) }))
      .finally(() => setCargando(false));
  }, []);

  const insertarVariable = (clave: string) => {
    const el = cuerpoRef.current;
    const token = `{${clave}}`;
    if (!el) { setCuerpo((c) => c + token); return; }
    const ini = el.selectionStart ?? cuerpo.length;
    const fin = el.selectionEnd ?? cuerpo.length;
    const nuevo = cuerpo.slice(0, ini) + token + cuerpo.slice(fin);
    setCuerpo(nuevo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + token.length, ini + token.length); });
  };

  const actualizarLista = (p: Plantilla) => {
    setPlantillas((lista) => lista.map((x) => (x.codigo === p.codigo ? p : x)));
    seleccionar(p);
  };

  const guardar = async () => {
    if (!actual) return;
    setGuardando(true);
    try {
      actualizarLista(await guardarPlantilla(actual.codigo, asunto, cuerpo));
      setConfirmar(null);
      sileo.success({ title: "Plantilla guardada", description: "El próximo correo de este tipo usará el texto nuevo." });
    } catch (e) {
      const campo = campoDelError(e);
      if (campo) setErrores({ [campo]: formatApiError(e) });
      setConfirmar(null);
      sileo.error({ title: "No se guardó la plantilla", description: formatApiError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const restablecer = async () => {
    if (!actual) return;
    setGuardando(true);
    try {
      actualizarLista(await restablecerPlantilla(actual.codigo));
      setConfirmar(null);
      sileo.success({ title: "Texto original restablecido" });
    } catch (e) {
      setConfirmar(null);
      sileo.error({ title: "No se pudo restablecer", description: formatApiError(e) });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <p className="flex items-center justify-center gap-2 py-16 text-sm text-[#6b7a8d]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…</p>;
  }

  const vistaPrevia = (
    <div className="rounded-xl border border-[rgba(30,58,95,0.12)] bg-white">
      <div className="border-b border-[rgba(30,58,95,0.09)] px-4 py-2.5 text-sm">
        <span className="text-[#6b7a8d]">Asunto: </span>
        <span className="font-semibold text-[#1e3a5f]">{renderizar(asunto) || "—"}</span>
      </div>
      <div className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-[#2c3e50]">{renderizar(cuerpo) || "—"}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c89b14] mb-1">Administración</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">Plantillas de correo</h1>
        <p className="text-sm text-[#6b7a8d] mt-1">
          Textos de los correos que envía el sistema. El asunto siempre lleva además la etiqueta [SGD consecutivo].
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Lista de plantillas */}
        <nav aria-label="Plantillas" className="bg-white border border-[rgba(30,58,95,0.12)] rounded-2xl p-2 shadow-sm h-fit">
          {plantillas.map((p) => (
            <button key={p.codigo} type="button" onClick={() => seleccionar(p)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                p.codigo === codigo ? "bg-[#1e3a5f] text-white" : "text-[#1e3a5f] hover:bg-[#f3ede1]"}`}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
              {p.cuerpo !== p.cuerpo_original && <span className={`text-[10px] font-semibold ${p.codigo === codigo ? "text-white/80" : "text-[#c89b14]"}`}>editada</span>}
            </button>
          ))}
        </nav>

        {actual && (
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Editor */}
            <section className="bg-white border border-[rgba(30,58,95,0.12)] rounded-2xl p-4 shadow-sm space-y-4 min-w-0">
              <div className="grid gap-1.5">
                <label htmlFor="plantilla-asunto" className="text-sm font-semibold text-[#1e3a5f]">Asunto</label>
                <Input id="plantilla-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)}
                  className={`border-[rgba(30,58,95,0.12)] ${errores.asunto ? "border-red-400" : ""}`} />
                {errores.asunto && <p className="text-xs text-red-600">{errores.asunto}</p>}
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="plantilla-cuerpo" className="text-sm font-semibold text-[#1e3a5f]">Cuerpo</label>
                <textarea id="plantilla-cuerpo" ref={cuerpoRef} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={12}
                  className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-[#2c3e50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] ${errores.cuerpo ? "border-red-400" : "border-[rgba(30,58,95,0.12)]"}`} />
                {errores.cuerpo && <p className="text-xs text-red-600">{errores.cuerpo}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6b7a8d] mb-1.5">Insertar variable en el cuerpo</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button key={v.clave} type="button" onClick={() => insertarVariable(v.clave)} title={v.descripcion}
                      className="rounded-md border border-[rgba(30,58,95,0.15)] bg-[#f3ede1]/60 px-2 py-1 font-mono text-xs text-[#1e3a5f] hover:bg-[#f3ede1]">
                      {`{${v.clave}}`}
                    </button>
                  ))}
                </div>
              </div>
              {raras.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Estas variables no las reemplaza el sistema y saldrán tal cual en el correo: {raras.map((r) => `{${r}}`).join(", ")}.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => setConfirmar("guardar")} disabled={!cambiado || guardando} className="bg-[#1e3a5f] hover:bg-[#152a45] text-white">
                  <Save className="mr-1.5 h-4 w-4" /> Guardar
                </Button>
                <Button variant="outline" onClick={() => seleccionar(actual)} disabled={!cambiado || guardando} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">
                  Descartar cambios
                </Button>
                <Button variant="outline" onClick={() => setConfirmar("restablecer")} disabled={guardando || actual.cuerpo === actual.cuerpo_original}
                  className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f] sm:ml-auto">
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Restablecer texto original
                </Button>
              </div>
            </section>

            {/* Vista previa */}
            <section className="space-y-2 min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6b7a8d]"><Eye className="h-4 w-4" /> Vista previa con datos de ejemplo</p>
              {vistaPrevia}
            </section>
          </div>
        )}
      </div>

      <Dialog open={confirmar !== null} onOpenChange={(o) => { if (!o && !guardando) setConfirmar(null); }}>
        <DialogContent className="bg-white border border-[rgba(30,58,95,0.12)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">
              {confirmar === "guardar" ? `Guardar «${actual?.nombre}»` : `Restablecer «${actual?.nombre}»`}
            </DialogTitle>
            <DialogDescription className="text-[#6b7a8d]">
              {confirmar === "guardar"
                ? "Así se verá el correo. Desde que guarde, los próximos envíos de este tipo usarán este texto."
                : "El cuerpo vuelve al texto original del sistema. El asunto no cambia."}
            </DialogDescription>
          </DialogHeader>
          {confirmar === "guardar" ? vistaPrevia : (
            <div className="whitespace-pre-line rounded-xl border border-[rgba(30,58,95,0.12)] px-4 py-3 text-sm text-[#2c3e50]">
              {renderizar(actual?.cuerpo_original ?? "")}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmar(null)} disabled={guardando} className="border-[rgba(30,58,95,0.12)] text-[#1e3a5f]">Cancelar</Button>
            <Button onClick={confirmar === "guardar" ? guardar : restablecer} disabled={guardando} className="bg-[#1e3a5f] hover:bg-[#152a45] text-white">
              {guardando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {confirmar === "guardar" ? "Confirmar y guardar" : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
