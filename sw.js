/* Ore planetarie - Lexicon Symbolorum
   Strategia: quando c'e rete si chiede al server, con due secondi e mezzo di pazienza;
   se il server tarda o manca, si usa la copia locale. Cosi gli aggiornamenti arrivano
   al primo caricamento e il funzionamento offline resta intatto. */
const CACHE = "ore-planetarie-v4";
const ATTESA = 2500;
const FILE = ["./", "./index.html",
              "./astronomy.js?v=3", "./luoghi.js?v=3", "./ore.js?v=3", "./manifest.json?v=3",
              "./icona-180.png", "./icona-512.png",
              "./logo-lexicon.png", "./firma-michele-leone.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(FILE.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
      // le pagine gia' aperte mostrano ancora la versione precedente: le ricarichiamo
      // noi, cosi' chi usa l'applicazione non deve fare nulla.
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((finestre) => finestre.forEach((f) => { try { f.navigate(f.url); } catch (err) {} }))
      .catch(() => {})
  );
});

function dallaCache(req) {
  return caches.match(req).then((hit) => hit || caches.match(req, { ignoreSearch: true }))
    .then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    new Promise((risolvi) => {
      let concluso = false;
      const chiudi = (r) => { if (!concluso && r) { concluso = true; risolvi(r); } };

      const orologio = setTimeout(() => {
        dallaCache(req).then((hit) => chiudi(hit));
      }, ATTESA);

      fetch(req).then((res) => {
        clearTimeout(orologio);
        if (res && res.status === 200 && res.type === "basic") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        chiudi(res);
      }).catch(() => {
        clearTimeout(orologio);
        dallaCache(req).then((hit) => {
          chiudi(hit || new Response("Non raggiungibile e non in memoria.", { status: 504 }));
        });
      });
    })
  );
});
