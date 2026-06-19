// ── Service Worker สำหรับ OPD วังน้อยสัตวแพทย์ (PWA) ──
// ปลอดภัยกับข้อมูล: ไม่แตะ POST และไม่ยุ่งกับโดเมนภายนอก (Supabase / fonts)
// แคชเฉพาะ "เปลือกแอป" (index.html + ไอคอน) ไว้เปิดเร็ว/เปิดออฟไลน์ได้
const CACHE = 'opd-wangnoi-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // อย่าแตะ POST/PUT/DELETE (เช่นการบันทึกข้อมูล Supabase)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // ข้ามทุกโดเมนภายนอก (Supabase, Google Fonts) — ให้โหลดปกติ

  // หน้าเว็บ: network-first เพื่อให้ได้เวอร์ชันใหม่เสมอ, ออฟไลน์ค่อยใช้ตัวที่แคชไว้
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // ไฟล์อื่นในโดเมนเดียวกัน (ไอคอน/manifest): cache-first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
