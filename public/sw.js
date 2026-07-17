// Service worker minimal MITMIT — cache « app-shell » pour un lancement rapide et un mode hors-ligne
// de secours. Stratégie : network-first pour la navigation (toujours la dernière version si en ligne,
// repli sur le cache si hors-ligne), cache-first pour les assets fingerprintés (immuables).
const CACHE = "mitmit-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/logo-mitmit.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ne jamais intercepter les appels API / tiers
  if (url.pathname.startsWith("/api/")) return;      // les relais serveur passent directement au réseau

  // Navigation (documents HTML) : réseau d'abord, repli cache hors-ligne.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/index.html", copy)); return res; }).catch(() => caches.match("/index.html")));
    return;
  }
  // Assets fingerprintés Vite (/assets/…) : cache d'abord (immuables).
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
});
