// ── shared UI bits: icons, modal, toast, helpers ────────────
var { useState, useEffect, useRef, useMemo } = React;

const IconPaths = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  x: <path d="M6 6l12 12M18 6L6 18"/>,
  check: <path d="m5 12 5 5 9-10"/>,
  chevL: <path d="m14 6-6 6 6 6"/>,
  chevR: <path d="m10 6 6 6-6 6"/>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5"/></>,
  phone: <path d="M6 4c-1 0-2 1-2 2 0 7.5 6.5 14 14 14 1 0 2-1 2-2v-2.5l-4-1.5-1.6 1.6c-2.5-1.2-4.8-3.5-6-6L10 8 8.5 4H6Z"/>,
  paw: <><circle cx="8" cy="8" r="1.9"/><circle cx="16" cy="8" r="1.9"/><circle cx="4.8" cy="12.5" r="1.7"/><circle cx="19.2" cy="12.5" r="1.7"/><path d="M12 12c-2.6 0-5 2.2-5 4.6 0 1.4 1 2.4 2.4 2.4 1 0 1.8-.4 2.6-.4s1.6.4 2.6.4c1.4 0 2.4-1 2.4-2.4 0-2.4-2.4-4.6-5-4.6Z"/></>,
  pill: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-30 12 12)"/><path d="m9 7.5 5 9"/></>,
  receipt: <><path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3Z"/><path d="M9 8h6M9 12h6"/></>,
  printer: <><path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 13h10v8H7v-8Z"/></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></>,
  cart: <><circle cx="9.5" cy="19.5" r="1.6"/><circle cx="17" cy="19.5" r="1.6"/><path d="M3 4h2.5l2.2 11h10l2.3-8H7"/></>,
  home: <><path d="m4 11 8-7 8 7"/><path d="M6 9.5V20h12V9.5"/></>,
  stetho: <><path d="M5 3v5a5 5 0 0 0 10 0V3"/><path d="M10 13v3.5a4.5 4.5 0 0 0 9 0V13"/><circle cx="19" cy="10.5" r="2.2"/></>,
  arrowL: <path d="M19 12H5m6-6-6 6 6 6"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>,
  edit: <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z"/>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9.5V14m0 2.5v.5"/></>,
  syringe: <><path d="m17 3 4 4M19 5l-9.5 9.5L6 18l-3 3M6 18l3.5-3.5M13 7l4 4"/><path d="m9 11 4 4"/></>,
  bath: <><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z"/><path d="M6 12V6a2 2 0 0 1 4 0"/></>,
  scale: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 8a4 4 0 0 1 4 4h-4V8Z"/><circle cx="12" cy="12" r="4"/></>,
  doc: <><path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></>,
  cash: <><rect x="3" y="7" width="18" height="11" rx="2.5"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6.5 10v.01M17.5 15v.01"/></>,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.2"/></>,
  info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 16v-5m0-2.5V8"/></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 10h16M8 3v4m8-4v4"/></>,
  chart: <><path d="M4 4v16h16"/><path d="M8 16v-5m4 5V8m4 8v-3"/></>,
};

function Icon({ name, size = 18, stroke = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {IconPaths[name] || null}
    </svg>
  );
}

const SPECIES_EMOJI = { 'สุนัข': '🐶', 'แมว': '🐱', 'กระต่าย': '🐰', 'นก': '🐦', 'อื่นๆ': '🐾' };
const TYPE_CHIP = { 'ตรวจรักษา': 'chip-navy', 'วัคซีน': 'chip-mint', 'อาบน้ำตัดขน': 'chip-powder', 'ผ่าตัด': 'chip-blush', 'ซื้อสินค้า': 'chip-butter' };

const fmtB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
// วันที่วันนี้แบบ local (ห้ามใช้ toISOString — UTC+7 ทำให้ช่วง 00:00–07:00 ได้วันก่อนหน้า)
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// ย่อรูปเป็น data URL เพื่อเก็บลง localStorage ได้ (รูปต้นฉบับใหญ่เกินโควต้า)
function imageToDataURL(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
const todayTH = () => new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dateTH = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const timeNow = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

function calcAge(birth) {
  if (!birth) return '';
  const b = new Date(birth), n = new Date();
  let y = n.getFullYear() - b.getFullYear();
  let m = n.getMonth() - b.getMonth();
  if (m < 0) { y--; m += 12; }
  if (y <= 0) return `${m} เดือน`;
  return m > 0 ? `${y} ปี ${m} ด.` : `${y} ปี`;
}

function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={'modal-box' + (wide ? ' wide' : '')}>
        <div className="modal-head no-print">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot no-print">{footer}</div> : null}
      </div>
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  const rack = (
    <div className="toast-rack" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className="toast"><Icon name="check" size={15} /> {t.msg}</div>)}
    </div>
  );
  return [push, rack];
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

// ── CountUp: ตัวเลขไล่นับขึ้น (ลูกเล่นหน้าหลัก/สรุป) — นับตอนโหลด และตอนค่าเปลี่ยน · เคารพ reduced-motion ──
// สำคัญ: requestAnimationFrame หยุดทำงานเมื่อแท็บถูกซ่อน (document.hidden) → ต้องมี setTimeout กันตัวเลขค้างที่ 0
function CountUp({ value, format, dur = 900 }) {
  const num = Number(value) || 0;
  const [disp, setDisp] = useState(num);   // เริ่มที่ค่าจริงไว้ก่อน กันค้าง 0 ถ้า rAF ไม่ทำงาน
  const prev = useRef(0);                   // แต่ครั้งแรกไล่นับจาก 0 → num
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = prev.current, to = num;
    prev.current = to;
    if (reduce || from === to) { setDisp(to); return; }
    let raf = 0, done = false;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);         // ease-out
      setDisp(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else done = true;
    };
    setDisp(from);
    raf = requestAnimationFrame(tick);
    // กันเหนียว: ถ้า rAF ไม่ทำงาน (แท็บซ่อน/ถูก throttle) ให้เด้งไปค่าจริงเมื่อครบเวลา
    const safety = setTimeout(() => { if (!done) setDisp(to); }, dur + 220);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [num]);
  return <>{format ? format(disp) : Math.round(disp).toLocaleString('th-TH')}</>;
}

// ── ฉลอง: confetti + เสียงติ๊ง (ลูกเล่นตอนปิดเคส/ทำยอดถึงเป้า) ──────────
let _actx = null;
function playDing() {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    const t = _actx.currentTime;
    [784, 1175].forEach((f, i) => {           // โน้ตนุ่มๆ 2 ตัว (G5→D6)
      const o = _actx.createOscillator(), g = _actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.10, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.33);
      o.connect(g); g.connect(_actx.destination); o.start(s); o.stop(s + 0.34);
    });
  } catch (e) {}
}
// เรียกฉลอง: celebrate() หรือ celebrate({ big:true, x, y, sound:false })
function celebrate(detail) {
  try { window.dispatchEvent(new CustomEvent('opd-celebrate', { detail: detail || {} })); } catch (e) {}
}
function ConfettiLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = ['#C0685C', '#3E7D5C', '#2D4B72', '#C9A227', '#5E8A93', '#E0A96D', '#D98880'];
    let parts = [], raf = 0, running = false;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    function burst(n, o) {
      o = o || {};
      const cx = o.x != null ? o.x : window.innerWidth / 2;
      const cy = o.y != null ? o.y : window.innerHeight * 0.34;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 8;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5,
          g: 0.16 + Math.random() * 0.12, life: 1, rot: Math.random() * 6, vr: (Math.random() - .5) * 0.5,
          size: 7 + Math.random() * 8, color: colors[i % colors.length], em: Math.random() < 0.22 ? '🐾' : null });
      }
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    }
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.011; });
      parts = parts.filter((p) => p.life > 0 && p.y < canvas.height + 50);
      parts.forEach((p) => {
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.em) { ctx.font = (p.size * 1.7) + 'px serif'; ctx.textAlign = 'center'; ctx.fillText(p.em, 0, 0); }
        else { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62); }
        ctx.restore();
      });
      if (parts.length) raf = requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    const onCel = (e) => { if (reduce) return; const d = (e && e.detail) || {}; burst(d.big ? 80 : 44, d); if (d.sound !== false) playDing(); };
    window.addEventListener('opd-celebrate', onCel);
    return () => { window.removeEventListener('opd-celebrate', onCel); window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }} />;
}

// ── แบนเนอร์ชวนติดตั้งแอป (PWA) — โผล่เฉพาะเครื่องที่ยังไม่ได้ติดตั้ง ──────
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
function InstallPrompt() {
  const [evt, setEvt] = useState(null);      // beforeinstallprompt ที่เก็บไว้ (Android/Chrome/Edge)
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);  // iOS ไม่มี event → ต้องบอกวิธีเอง
  const SNOOZE_KEY = 'wnvet_install_snooze';

  useEffect(() => {
    if (isStandalone()) return;                       // ติดตั้งแล้ว ไม่ต้องกวน
    const snooze = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snooze && Date.now() < snooze) return;        // กด "ไว้ก่อน" ยังไม่ครบกำหนด

    const onBip = (e) => { e.preventDefault(); setEvt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onBip);

    // iOS/Safari ไม่ยิง beforeinstallprompt → ถ้าเป็น iOS และยังไม่ได้ติดตั้ง ให้โชว์วิธีทำ
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    let t = 0;
    if (isIOS && isSafari) t = setTimeout(() => { setIosHelp(true); setShow(true); }, 2500);

    const onInstalled = () => { setShow(false); localStorage.removeItem(SNOOZE_KEY); };
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); clearTimeout(t); };
  }, []);

  if (!show) return null;
  const snoozeDays = (d) => { localStorage.setItem(SNOOZE_KEY, String(Date.now() + d * 86400000)); setShow(false); };
  const doInstall = async () => {
    if (!evt) return;
    evt.prompt();
    try { const r = await evt.userChoice; if (r && r.outcome === 'dismissed') snoozeDays(3); } catch (e) {}
    setEvt(null); setShow(false);
  };

  return (
    <div className="install-bar" role="dialog" aria-label="ติดตั้งแอป">
      <img className="install-icon" src="/icons/icon-192.png" alt="" width="46" height="46" />
      <div className="install-text">
        <div className="install-title">ติดตั้ง OPD วังน้อยสัตวแพทย์</div>
        <div className="install-sub">
          {iosHelp
            ? <>กดปุ่ม <b>แชร์</b> <span aria-hidden="true">⎋</span> ด้านล่าง → เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b></>
            : 'เปิดเร็วขึ้น เต็มจอ ใช้งานเหมือนแอป'}
        </div>
      </div>
      {!iosHelp ? <button className="btn btn-primary btn-sm install-go" onClick={doInstall}>ติดตั้ง</button> : null}
      <button className="install-x" onClick={() => snoozeDays(7)} aria-label="ปิด (ไว้ก่อน)">✕</button>
    </div>
  );
}

// ── โหมดเทศกาล: สลับอีโมจิ/สีตามวันที่โดยอัตโนมัติ ──────────────────────
function getFestival(d) {
  d = d || new Date();
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 12 && day >= 24) || (m === 1 && day <= 3)) return { key: 'newyear', label: 'สวัสดีปีใหม่', emojis: ['🎄', '🎁', '⛄', '✨', '🔔'], accent: '#C0685C' };
  if (m === 2 && day >= 13 && day <= 15) return { key: 'valentine', label: 'วาเลนไทน์', emojis: ['💕', '💖', '🌹', '💝'], accent: '#C0685C' };
  if (m === 4 && day >= 11 && day <= 16) return { key: 'songkran', label: 'สงกรานต์', emojis: ['💦', '🌊', '🐘', '🌸'], accent: '#5E8A93' };
  if (m === 10 && day >= 25) return { key: 'halloween', label: 'ฮาโลวีน', emojis: ['🎃', '👻', '🦇', '🕸️'], accent: '#A87B2F' };
  if (m === 11 && day >= 10 && day <= 20) return { key: 'loykrathong', label: 'ลอยกระทง', emojis: ['🪷', '🌕', '🕯️', '✨'], accent: '#A87B2F' };
  return null;
}
function FestivalFloat({ override }) {
  const fes = override || getFestival();
  if (!fes) return null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [];
  for (let i = 0; i < 7; i++) items.push({ e: fes.emojis[i % fes.emojis.length], left: (8 + i * 13) + '%', dur: (9 + (i % 4) * 3), delay: (i * 1.3), size: 15 + (i % 3) * 6 });
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'hidden' }}>
      {!reduce && items.map((it, i) => (
        <span key={i} className="festival-drift" style={{ left: it.left, fontSize: it.size, animationDuration: it.dur + 's', animationDelay: it.delay + 's' }}>{it.e}</span>
      ))}
    </div>
  );
}

Object.assign(window, { Icon, Modal, useToasts, Field, SPECIES_EMOJI, TYPE_CHIP, fmtB, todayTH, dateTH, timeNow, calcAge, todayISO, imageToDataURL, CountUp, celebrate, playDing, ConfettiLayer, getFestival, FestivalFloat, InstallPrompt, isStandalone });
