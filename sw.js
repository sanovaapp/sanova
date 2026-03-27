// Sanova Service Worker v1.0
const CACHE = 'sanova-v1';
const SHELL = [
  '/',
  '/index.html'
];

// Instalar — cachear shell
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(SHELL);
    })
  );
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first para shell, network-first para resto
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      var network = fetch(e.request).then(function(res){
        if(res && res.status === 200){
          var clone = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || network;
    })
  );
});