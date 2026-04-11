const CACHE = "lif-app-v9";
const ASSETS = ["/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Nunca cachear: Supabase, Mapbox, Nominatim, APIs externas
  if (url.hostname.includes("supabase") ||
      url.hostname.includes("mapbox") ||
      url.hostname.includes("nominatim") ||
      url.hostname.includes("googleapis") ||
      url.hostname.includes("cdn.jsdelivr")) return;

  // index.html → siempre red primero, caché como fallback
  if (url.pathname === "/" || url.pathname === "/index.html") {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Otros assets (manifest, iconos) → caché primero
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});
