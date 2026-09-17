/* Ore planetarie - service worker, cache-first sui file propri */
const CACHE = "ore-planetarie-v3";
const FILE = ["./", "./index.html", "./astronomy.js", "./luoghi.js", "./ore.js",
              "./manifest.json", "./icona-180.png", "./icona-512.png",
              "./logo-lexicon.png", "./firma-michele-leone.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res && res.status === 200 && res.type === "basic") {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copia));
    }
    return res;
  }).catch(() => caches.match("./index.html"))));
});
