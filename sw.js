const CACHE = "rose-line-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

const OFFLINE_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFF8FA">
<title>Нет соединения — Розовая линия</title>
<style>
  :root{--bg:#FFF8FA;--plum:#3E2A33;--muted:#8A6C77;--rose:#CB5C7D;--line:#F2D8E1}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    font:16px/1.6 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;color:var(--plum);
    background:radial-gradient(120% 55% at 78% -12%,#FFE4EE 0%,rgba(255,248,250,0) 62%),var(--bg)}
  .card{width:min(420px,100%);background:#fff;border:1px solid var(--line);border-radius:24px;padding:26px 24px;text-align:center;
    box-shadow:0 34px 60px -40px rgba(150,60,90,.45)}
  .badge{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#9C4A66;background:#FFEAF1;border:1px solid #F8D7E3;padding:6px 12px;border-radius:99px}
  .badge i{width:7px;height:7px;border-radius:50%;background:#CB5C7D;display:block}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:26px;line-height:1.15;margin:16px 0 8px;letter-spacing:-.02em}
  p{color:#6E515C;font-size:14.5px;margin:0 0 6px}
  .hint{color:var(--muted);font-size:12.5px;margin-top:14px}
  button{margin-top:20px;width:100%;border:0;border-radius:14px;background:var(--rose);color:#fff;
    font:inherit;font-size:15px;font-weight:600;padding:13px 18px;cursor:pointer}
  button:active{background:#B94E6F}
  svg{width:56px;height:56px;margin-top:14px}
</style>
</head>
<body>
  <div class="card">
    <span class="badge"><i></i>офлайн</span>
    <h1>Потеряно соединение с сервером</h1>
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 30a30 30 0 0 1 44 0" fill="none" stroke="#E7A8BE" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 39a19 19 0 0 1 28 0" fill="none" stroke="#E7A8BE" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="49" r="4.5" fill="#CB5C7D"/>
      <line x1="12" y1="12" x2="52" y2="54" stroke="#CB5C7D" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <p>Файлы приложения не сохранились на устройстве. Подключитесь к интернету и обновите страницу — дальше тренировки, таймер и дневник будут работать без сети.</p>
    <button id="retry" type="button">Повторить</button>
    <p class="hint">Если интернет уже включён, страница перезагрузится сама.</p>
  </div>
  <script>
    document.getElementById("retry").addEventListener("click", function () { location.reload(); });
    window.addEventListener("online", function () { location.reload(); });
  </script>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(ASSETS.map((asset) => cache.add(asset).catch(() => null)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function fromCache(key) {
  try {
    const cache = await caches.open(CACHE);
    return (await cache.match(key)) || (await cache.match("./")) || null;
  } catch (e) {
    return null;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put("./index.html", copy)).catch(() => {});
            return res;
          }
        } catch (e) {}
        const hit = await fromCache("./index.html");
        return hit || offlineResponse();
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
      } catch (e) {}
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (e) {
        return new Response("", { status: 503, statusText: "offline" });
      }
    })()
  );
});
