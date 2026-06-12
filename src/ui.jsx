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
const todayISO = () => new Date().toISOString().slice(0, 10);
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

Object.assign(window, { Icon, Modal, useToasts, Field, SPECIES_EMOJI, TYPE_CHIP, fmtB, todayTH, dateTH, timeNow, calcAge, todayISO, imageToDataURL });
