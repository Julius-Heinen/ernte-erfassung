// Service Worker der Ernte-Erfassung: hält die Seite auf dem Handy vor, damit sie ohne Netz startet.
// Seite und Symbole: sofort aus dem Vorrat, im Hintergrund erneuern (neue Version gilt beim nächsten Öffnen).
// saetze.json: zuerst aus dem Netz (höchstens 3 Sekunden warten), sonst aus dem Vorrat.
const CACHE = "ernte-v1";                      // gleicher Name wie in index.html
const DATEIEN = ["./", "./saetze.json", "./manifest.webmanifest", "./manifest-ro.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n.startsWith("ernte-") && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

function ausNetz(cache, req) {
  return fetch(req).then((r) => {
    if (r.ok && !r.redirected) cache.put(req, r.clone()).catch(() => {});
    return r;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL("./", self.location).pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const vorrat = await cache.match(req, { ignoreSearch: true });
    if (url.pathname.endsWith("/saetze.json")) {
      const warten = new Promise((ok) => setTimeout(() => ok(null), 3000));
      const netz = ausNetz(cache, req).catch(() => null);
      const erste = await Promise.race([netz, vorrat ? warten : netz]);
      return (erste && erste.ok ? erste : vorrat) || erste || Response.error();
    }
    const netz = ausNetz(cache, req);
    if (vorrat) { e.waitUntil(netz.catch(() => {})); return vorrat; }
    return netz;
  }));
});
