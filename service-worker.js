const CACHE='agenda-achadinhos-v4';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./criador-de-videos/','./criador-de-videos/index.html','./criador-de-videos/mp4-muxer.js','./criador-de-videos/manifest.json'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Busca sempre a versão mais nova quando tem internet; só usa a cópia salva se estiver offline.
self.addEventListener('fetch',e=>{
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        const copia=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copia));
        return res;
      })
      .catch(()=>caches.match(e.request))
  );
});
