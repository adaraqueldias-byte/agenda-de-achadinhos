const CACHE='agenda-achadinhos-v12';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

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
  // Fotos de lojas e outros sites passam direto, sem encher a memória do celular
  if(new URL(e.request.url).origin!==self.location.origin)return;
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
