// Service Worker — קאשינג בסיסי לעבודה גם ללא אינטרנט
const CACHE = "masa8-v99";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./content.json",
  "./js/app.js", "./js/data.js", "./js/state.js", "./js/partsMap.js",
  "./js/avatar.js", "./js/ai.js", "./js/reminders.js", "./js/calendar.js", "./js/cloudsync.js",
  "./img/hero.jpg", "./img/question.jpg", "./img/sos.jpg",
  "./img/avatar-1.png", "./img/avatar-2.png", "./img/avatar-3.png",
  "./fonts/rubik-hebrew-400.woff2", "./fonts/rubik-hebrew-500.woff2",
  "./fonts/rubik-hebrew-700.woff2", "./fonts/rubik-hebrew-800.woff2",
  "./fonts/rubik-latin-400.woff2", "./fonts/rubik-latin-500.woff2",
  "./fonts/rubik-latin-700.woff2", "./fonts/rubik-latin-800.woff2",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // בקשות ל-API של Claude — תמיד רשת, לא קאש
  if (url.hostname.includes("anthropic.com")) return;
  // תוכן מרכזי מהמנחה — network-first כדי לקבל עדכונים, עם נפילה למטמון (אופליין)
  if (url.pathname.endsWith("/content.json")) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (e.request.method === "GET" && resp.ok && url.origin === location.origin) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});
