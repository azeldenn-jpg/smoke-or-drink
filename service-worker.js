/**
 * ==============================================================================
 * SMOKE OR DRINK — Service Worker (v3)
 * ==============================================================================
 * Stratégies :
 *  - Fichiers de l'app (HTML, CSS, JS, JSON) → NETWORK FIRST avec délai max.
 *    En ligne, tu vois toujours ta dernière version (fini le "j'ai modifié mais
 *    rien ne change"). Hors-ligne ou réseau pourri (> 2,5 s), on sert le cache.
 *  - Polices et icônes (ne changent jamais) → CACHE FIRST, instantané.
 *
 * Quand tu modifies la liste des fichiers ou veux forcer un nettoyage,
 * incrémente simplement VERSION.
 * ==============================================================================
 */
const VERSION = 'sod-v4.8.0';
const NETWORK_TIMEOUT = 2500;
// Cache séparé pour les images de memes : il survit aux mises à jour de l'appli
const IMG_CACHE = 'sod-images-v1';

const CORE = [
  './',
  './index.html',
  './style.css',
  './js/config.js',
  './js/core.js',
  './js/roulette.js',
  './js/seance.js',
  './js/app.js',
  './js/extras.js',
  './js/soiree.js',
  './js/editeur.js',
  './js/main.js',
  './jeux/quiz.js',
  './jeux/cartes.js',
  './jeux/bombe.js',
  './jeux/roulette.js',
  './jeux/oie.js',
  './jeux/memes.js',
  './jeux/course.js',
  './memes.json',
  './data.json',
  './cards.json',
  './manifest.json',
];
const STATIC = [
  './fonts/major-mono-display.woff2',
  './fonts/vt323.woff2',
  './fonts/space-grotesk-400.woff2',
  './fonts/space-grotesk-500.woff2',
  './fonts/space-grotesk-600.woff2',
  './fonts/space-grotesk-700.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Installation : tout doit être en cache, sinon l'install échoue
// (mieux vaut ça qu'une app "installée" à qui il manque un fichier hors-ligne).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll([...CORE, ...STATIC]))
      .then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciennes versions du cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Images de memes (Imgflip) : gardées en cache après le premier affichage → dispo hors-ligne
  if (url.hostname === 'i.imgflip.com') { event.respondWith(cacheFirst(req, IMG_CACHE)); return; }
  if (url.origin !== self.location.origin) return; // on ne touche pas aux autres requêtes externes

  // Images de memes hébergées sur le dépôt : même cache que celles d'Imgflip, chargées à la demande
  if (/\/memes\/[^/]+\.jpg$/.test(url.pathname)) { event.respondWith(cacheFirst(req, IMG_CACHE)); return; }
  const isStatic = /\/(fonts|icons)\//.test(url.pathname);
  event.respondWith(isStatic ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req, cacheName = VERSION) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  // Une image externe chargée par <img> revient "opaque" (statut 0) : on la garde quand même
  if (res.ok || res.type === 'opaque') (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await withTimeout(fetch(req), NETWORK_TIMEOUT);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // ignoreSearch : "index.html?x=1" retrouve "index.html"
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
