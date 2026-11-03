/**
 * @file pwa.ts
 * @description Convierte /movil en una aplicación web instalable (PWA) sin tocar el resto de NOVA:
 * agrega el manifiesto y los íconos solo mientras se muestra /movil, y registra el service worker
 * con alcance /movil (public/movil-sw.js).
 * El navegador solo deja instalarla y registrar el service worker en un "contexto seguro"
 * (https o localhost). Por la red local con http se abre igual como página web.
 */
import { useEffect } from "react";

function agregarEnHead(tag: "link" | "meta", atributos: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  el.dataset.movilPwa = "1";
  document.head.appendChild(el);
  return el;
}

export function usePwaMovil(): void {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "Archivo Central · Escanear";
    const agregados = [
      agregarEnHead("link", { rel: "manifest", href: "/movil/manifest.webmanifest" }),
      agregarEnHead("meta", { name: "theme-color", content: "#1e3a5f" }),
      agregarEnHead("link", { rel: "apple-touch-icon", href: "/movil/icono-192.png" }),
      agregarEnHead("meta", { name: "apple-mobile-web-app-capable", content: "yes" }),
      agregarEnHead("meta", { name: "apple-mobile-web-app-title", content: "Archivo Central" }),
    ];
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/movil-sw.js", { scope: "/movil" }).catch(() => {
        // Sin service worker la app funciona igual como página web.
      });
    }
    return () => {
      document.title = tituloAnterior;
      agregados.forEach(el => el.remove());
    };
  }, []);
}
