// Cardo service worker: app works offline after the first visit.
// Pages: network first (so updates arrive right away), cache as fallback.
// Scripts, icons, fonts: cache first, refreshed in the background.
const CACHE = "cardo-v39";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-1024.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.hostname.endsWith("supabase.co")) return; // never cache account or card data requests
  if (req.mode === "navigate") {
    // Netz zuerst, aber höchstens 3 s warten (schlechtes Netz / Flugmodus) – dann die gespeicherte App starten
    const net = fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); return r; });
    const slow = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000));
    e.respondWith(Promise.race([net, slow]).catch(() => caches.match("index.html").then(hit => hit || net)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
