// Service worker: приложение работает офлайн (кэш оболочки, данных аналитики и изображений).
const CACHE = "logihub-app-v2";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/main.js", "js/store.js", "js/pricing.js", "js/ui.js", "js/actions.js", "js/map.js", "js/charts.js",
  "js/views/login.js", "js/views/common.js", "js/views/client.js", "js/views/manager.js", "js/views/warehouse.js",
  "js/views/dispatcher.js", "js/views/driver.js", "js/views/analytics.js", "js/views/docs.js",
  "data/analytics.json", "assets/icons/icon.svg", "assets/icons/icon-192.png",
  "assets/img/login_hero.jpg", "assets/img/avatar_client.jpg", "assets/img/avatar_manager.jpg", "assets/img/avatar_driver.jpg",
  "assets/img/avatar_warehouse.jpg", "assets/img/avatar_dispatcher.jpg",
  "assets/img/empty_parcels.jpg", "assets/img/truck_reefer.jpg", "assets/img/warehouse_scan.jpg",
];

self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

// сеть – в приоритете (свежая версия), кэш – если сети нет
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes("fonts.g"))) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
