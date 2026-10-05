// Cardo service worker: app works offline after the first visit.
// Pages: network first (so updates arrive right away), cache as fallback.
// Scripts, icons, fonts: cache first, refreshed in the background.
const CACHE = "cardo-v198", IMG_CACHE = "cardo-img";
const CORE = ["./", "index.html", "manifest.webmanifest", "impressum.html", "datenschutz.html", "fonts/figtree-latin.woff2", "fonts/bricolage-latin.woff2", "icons/icon.svg", "icons/icon-1024.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.js", "https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.css"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
// Nur eigene Speicher löschen: Cardo Notizen liegt auf derselben Adresse und hat eigene (notizen-…)
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("cardo-") && k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/storage/v1/object/public/card-images/")) {
    // Kartenbilder ändern sich nie (zufällige Namen) → einmal laden, danach auch offline aus dem Speicher
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.hostname.endsWith("supabase.co")) return; // never cache account or card data requests
  if (req.mode === "navigate") {
    // Netz zuerst, aber höchstens 3 s warten (schlechtes Netz / Flugmodus) – dann die gespeicherte App starten
    // Nur die App selbst als „index.html“ merken – Impressum/Datenschutz unter ihrem eigenen Namen (sonst startet offline die falsche Seite)
    const page = /\/(impressum|datenschutz)\.html$/.test(url.pathname) ? url.pathname.split("/").pop() : "index.html";
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(page, copy)); } return r; });
    const slow = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000));
    e.respondWith(Promise.race([net, slow]).catch(() => caches.match(page).then(hit => hit || net)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
