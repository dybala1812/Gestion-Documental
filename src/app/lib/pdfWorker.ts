/**
 * @file pdfWorker.ts
 * @description Worker de pdf.js para los visores de PDF del módulo Archivo Central.
 *
 * - Producción: "/pdf.worker.min.mjs", la misma URL estable que usa AreaDashboard
 *   (el Dockerfile copia el worker a public/).
 * - Desarrollo: ese archivo no existe en public/, así que se usa el worker del
 *   mismo paquete pdfjs-dist que trae react-pdf (Vite lo sirve).
 * Si otro módulo ya configuró el worker, no se toca.
 */
import { pdfjs } from "react-pdf";
import workerDev from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (import.meta.env.DEV) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerDev;
} else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export { pdfjs };
