/**
 * Service worker de la app móvil de Archivo Central (/movil, PWA, RF-AC-022).
 * Alcance: /movil. Hace la app instalable; no guarda documentos ni datos en caché:
 * todo va directo al servidor (los documentos son datos personales: Ley 1581).
 * Si no hay conexión, la propia pantalla avisa y deja reintentar la subida.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Sin caché: cada petición va a la red (el manejador de fetch es necesario para que sea instalable).
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
