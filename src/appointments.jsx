// ── Appointment System — Calendar + List + Forms ────────────
var { useState, useEffect, useRef, useMemo, useCallback } = React;

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const APPT_TYPES = ['ติดตามอาการ','วัคซีน','ตรวจเลือด','ผ่าตัด','อาบน้ำตัดขน','ทำฟัน','ยาถ่ายพยาธิ','อื่นๆ'];
const APPT_COLORS = {
  'ติดตามอาการ': '#E5C97E', 'วัคซีน': '#5E8A93', 'ตรวจเลือด': '#C0685C',
  'ผ่าตัด': '#9B2335', 'อาบน้ำตัดขน': '#3E7D5C', 'ทำฟัน': '#6A4FA0',
  'ยาถ่ายพยาธิ': '#A87B2F', 'อื่นๆ': '#93A0AC',
};
const APPT_CHIP = {
  'ติดตามอาการ': 'chip-butter', 'วัคซีน': 'chip-powder',
  'ตรวจเลือด': 'chip-blush', 'ผ่าตัด': 'chip-alert',
  'อาบน้ำตัดขน': 'chip-mint',
};
// ── ตัวเลือกหมายเหตุด่วน (ตามประเภทนัด) — แตะแล้วเติมลงช่องหมายเหตุ ทำให้ข้อความ SMS เป็นมาตรฐาน ──
// แก้ไข/เพิ่ม/เปลี่ยนสี/เลื่อนตำแหน่งได้จากปุ่ม ⚙️ ในฟอร์มนัด → เก็บใน state.notePresets (sync ทุกเครื่อง)
// ค่าด้านล่างเป็นค่าเริ่มต้น ใช้เมื่อประเภทนั้นยังไม่เคยถูกแก้
const PRESET_COLORS = {
  yellow: { on: '#E0A400', offBg: '#FFF3CC', border: '#E6C25A', text: '#8A6500' },
  blue:   { on: '#3E7CB1', offBg: '#E3EEF7', border: '#9DC1DE', text: '#2C5A82' },
  red:    { on: '#C0392B', offBg: '#FBDED9', border: '#D98B82', text: '#A01F12' },
  green:  { on: '#2E7D5B', offBg: '#DFF2E9', border: '#93CDB2', text: '#1F5C41' },
  purple: { on: '#6A4FA0', offBg: '#ECE6F6', border: '#B8A6DD', text: '#4E3A78' },
  navy:   { on: '#2D4B72', offBg: '#E4EBF4', border: '#9FB4CE', text: '#2D4B72' },
};
const DEFAULT_NOTE_PRESETS = {
  'วัคซีน': [
    // แมว: ชุดลูกแมว (เข็มแรก/2/3) → กระตุ้น/ประจำปี (สัตว์โต)
    { text: 'วัคซีนรวมไข้หัดหวัดแมว เข็มแรก', color: 'yellow' },
    { text: 'วัคซีนรวมไข้หัดหวัดแมว เข็ม 2/3', color: 'yellow' },
    { text: 'วัคซีนรวมไข้หัดหวัดแมว เข็ม 3/3', color: 'yellow' },
    { text: 'วัคซีนรวมไข้หัดหวัดแมว เข็มกระตุ้น', color: 'yellow' },
    { text: 'วัคซีนรวมไข้หัดหวัดแมวประจำปี', color: 'yellow' },
    // สุนัข: ชุดลูกสุนัข → กระตุ้น/ประจำปี
    { text: 'วัคซีนรวม 5 โรคสุนัข เข็มแรก', color: 'blue' },
    { text: 'วัคซีนรวม 5 โรคสุนัข เข็ม 2/3', color: 'blue' },
    { text: 'วัคซีนรวม 5 โรคสุนัข เข็ม 3/3', color: 'blue' },
    { text: 'วัคซีนรวม 5 โรคสุนัข เข็มกระตุ้น', color: 'blue' },
    { text: 'วัคซีนรวม 5 โรคสุนัขประจำปี', color: 'blue' },
    // พิษสุนัขบ้า
    { text: 'วัคซีนพิษสุนัขบ้า เข็มกระตุ้น', color: 'red' },
    { text: 'วัคซีนพิษสุนัขบ้า ประจำปี', color: 'red' },
  ],
};
// แปลง entry เก่า (string) → {text, color} เผื่อข้อมูลเก่าค้างใน state
const normPreset = (p) => typeof p === 'string' ? { text: p, color: 'navy' } : { text: p.text || '', color: p.color || 'navy' };

function dateTHShort(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// ── เตรียมหมายเหตุสำหรับ SMS — ใช้ข้อความ "ตามที่กดเลือก/พิมพ์" ตรงๆ (ไม่ย่ออัตโนมัติ) ──
// นัดวัคซีน (vaxOnly): เอาเฉพาะส่วนที่เป็นวัคซีน (ขึ้นต้น "วัคซีน") · ตัดหมายเหตุอื่นทิ้ง (เช่น "+ หยดยา", "ตัดขน")
function noteForSms(note, vaxOnly) {
  if (!note) return '';
  const segs = String(note).split(' และ ').map((s) => s.trim()).filter(Boolean);
  if (!vaxOnly) return segs.join(' และ ');
  const kept = [];
  for (let seg of segs) {
    const plus = seg.indexOf(' + ');        // ตัดข้อความที่พิมพ์ต่อท้ายด้วย " + ..." ออก
    if (plus >= 0) seg = seg.slice(0, plus).trim();
    if (seg.indexOf('วัคซีน') === 0) kept.push(seg);   // เก็บเฉพาะที่เป็นวัคซีน
  }
  return kept.join(' และ ');
}
// วันที่แบบ SMS: "1 กค 70" (ปกติ) หรือ "1/7/70" (สั้นกว่า) — ปี พ.ศ. 2 หลัก
function smsDate(iso, numeric) {
  const p = String(iso || '').split('-').map(Number);
  if (!p[1] || !p[2]) return iso || '';
  const be2 = String((p[0] + 543) % 100).padStart(2, '0');
  return numeric ? `${p[2]}/${p[1]}/${be2}` : `${p[2]} ${THAI_MONTHS_SHORT[p[1] - 1].replace(/\./g, '')} ${be2}`;
}

// ข้อความ SMS เตือนนัด — สไตล์อบอุ่น: "น้อง{ชื่อ} ถึงนัด{รายละเอียด} {วันที่} นี้นะครับ"
// ใช้ข้อความ "ตามที่เลือก" ตรงๆ (ไม่ย่อชื่อวัคซีนอัตโนมัติ) · ชื่อร้านอยู่ที่ Sender name
// auto-fit ถ้าเกิน 70: วันไทย → วันตัวเลข (1/7/70) → ตัด "นี้นะครับ" · ถ้ายังเกิน = ยอม 2 เครดิต
function buildReminderMsg(a) {
  const name = a.petName || '';
  const isVax = a.type === 'วัคซีน';
  const detail = noteForSms(a.note, isVax);
  // วัคซีน: "ฉีด{รายละเอียด}" · "อื่นๆ": ใช้หมายเหตุแทน label · ประเภทอื่น: "{ประเภท} {หมายเหตุ}"
  const body = isVax
    ? 'ฉีด' + (detail || a.type || '')
    : (a.type && a.type !== 'อื่นๆ')
      ? a.type + (detail ? ' ' + detail : '')
      : (detail || '');
  const mk = (numericDate, withTail) => {
    let s = `น้อง${name} ถึงนัด${body} ${smsDate(a.date, numericDate)}`;
    if (withTail) s += ' นี้นะครับ';
    return s.replace(/\s+/g, ' ').trim();
  };
  let msg = mk(false, true);                    // วันไทย + ปิดท้าย
  if (msg.length > 70) msg = mk(true, true);    // เปลี่ยนวันเป็นตัวเลข
  if (msg.length > 70) msg = mk(true, false);   // ตัด "นี้นะครับ"
  return msg;
}

// เปิดแอปส่งข้อความในเครื่อง (มือถือ) + คัดลอกข้อความสำรอง (เดสก์ท็อป)
function openSmsApp(phone, msg) {
  try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (e) {}
  const clean = String(phone || '').replace(/[^0-9+]/g, '');
  if (clean) {
    const link = `sms:${clean}?body=${encodeURIComponent(msg)}`;
    const el = document.createElement('a'); el.href = link; document.body.appendChild(el); el.click(); el.remove();
  }
}

// ── Modal ส่ง SMS: แก้เบอร์/ข้อความได้ก่อนส่ง (ใช้ทั้งเตือนนัด และส่งเอง) ──
function SmsComposerModal({ title, initPhone, initMsg, onClose, onSend }) {
  const [phone, setPhone] = useState(initPhone || '');
  const [msg, setMsg] = useState(initMsg || '');
  const clean = phone.replace(/[^0-9+]/g, '');
  // ไทย: 1 ข้อความ = 70 ตัว · ถ้าต่อหลายท่อนคิด 67 ตัว/ท่อน (คิดเครดิตตามจำนวนท่อน)
  const len = msg.length;
  const over = len > 70;
  const segments = over ? Math.ceil(len / 67) : 1;
  const pct = Math.min(100, Math.round((len / 70) * 100));
  const copyMsg = () => { try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (e) {} };
  return (
    <Modal title={title || 'ส่ง SMS'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>ปิด</button>
      <button className="btn" onClick={copyMsg}>📋 คัดลอกข้อความ</button>
      <button className="btn btn-primary" disabled={!msg.trim()} onClick={() => onSend(clean, msg)}>📱 ส่ง SMS</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Field label="เบอร์โทร">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
        </Field>
        <Field label="ข้อความ (แก้ไขได้)">
          <textarea className="textarea" rows="5" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="พิมพ์ข้อความที่จะส่ง..." />
        </Field>
        <div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: over ? 'var(--blush-deep)' : 'var(--mint-deep)', transition: 'width .15s' }} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 5, color: over ? 'var(--blush-deep)' : 'var(--mint-deep)' }}>
            {len}/70 ตัวอักษร · {over ? `${segments} ข้อความ = ${segments} เครดิต (เกิน 70)` : '1 ข้อความ = 1 เครดิต ✓'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'var(--paper)', borderRadius: 'var(--radius-sm)', padding: '8px 11px' }}>
          💡 บนมือถือจะเปิดแอปข้อความให้พร้อมเบอร์+ข้อความ · บนคอมจะคัดลอกข้อความไว้ให้วาง
        </div>
      </div>
    </Modal>
  );
}

// ── Mini Calendar ────────────────────────────────────────────
function MiniCalendar({ appointments, selectedDay, onSelectDay }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDay + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  // Build appointment map for this month
  const apptMap = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const m = {};
    appointments.filter((a) => a.date.startsWith(prefix) && a.status !== 'cancelled').forEach((a) => {
      const d = parseInt(a.date.slice(8));
      if (!m[d]) m[d] = [];
      m[d].push(a);
    });
    return m;
  }, [appointments, year, month]);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button className="btn btn-sm" onClick={() => setViewDate(new Date(year, month - 1))}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 15.5 }}>{THAI_MONTHS[month]} {year + 543}</span>
        <button className="btn btn-sm" onClick={() => setViewDate(new Date(year, month + 1))}>›</button>
      </div>
      <div className="cal-grid">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-dayname">{d}</div>)}
        {cells.map((d, i) =>
          d === null ? <div key={`e${i}`} /> : (
            <div key={d}
              className={`cal-day${iso(d) === today ? ' today' : ''}${iso(d) === selectedDay ? ' selected' : ''}${apptMap[d] ? ' has-appt' : ''}`}
              onClick={() => onSelectDay(iso(d))}>
              <span className="cal-num">{d}</span>
              {apptMap[d] ? (
                <div className="cal-dots">
                  {apptMap[d].slice(0, 4).map((a, j) => (
                    <span key={j} className="cal-dot" style={{ background: APPT_COLORS[a.type] || '#93A0AC' }} />
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── ป้ายสถานะ SMS ของนัด (ใช้ร่วมกันทุกหน้า: นัดหมาย / OPD / หน้าหลัก) ──
// ส่งแล้ว → ✓ เขียว · ปิดส่ง → 🔕 เทา · รอส่งอัตโนมัติ → ⏳ เหลือง · ผ่านมาแล้วยังไม่ส่ง → ซ่อน
// onToggle (ถ้ามี) = กดป้ายเพื่อสลับเปิด/ปิดส่ง SMS อัตโนมัติของนัดนี้ (ลิงก์ทุกหน้าผ่าน updateAppointment)
function ApptSmsStatus({ a, past, style, onToggle }) {
  if (!a) return null;
  const clickable = !!onToggle && !a.reminderSent;
  const base = { fontSize: 11, fontWeight: 700, ...(clickable ? { cursor: 'pointer' } : {}), ...(style || {}) };
  const onClk = clickable ? (e) => { e.stopPropagation(); onToggle(); } : undefined;
  const title = clickable ? 'แตะเพื่อเปิด/ปิดส่ง SMS อัตโนมัติของนัดนี้' : undefined;
  if (a.reminderSent) return <span className="chip chip-mint" style={base}>✓ ส่ง SMS แล้ว</span>;
  if (a.smsAuto === false) return <span className="chip" style={{ ...base, color: 'var(--ink-faint)', border: clickable ? '1px dashed var(--ink-faint)' : undefined }} onClick={onClk} title={title}>🔕 ไม่ส่ง SMS{clickable ? ' · แตะเปิด' : ''}</span>;
  if (past) return null;
  return <span className="chip chip-butter" style={base} onClick={onClk} title={title}>⏳ ส่ง SMS อัตโนมัติ{clickable ? ' · แตะปิด' : ''}</span>;
}

// ── Appointment Card ─────────────────────────────────────────
function ApptCard({ appt, onUpdate, onEdit, onOpenPet, onSendSms }) {
  const statusCls = { scheduled: 'chip-butter', arrived: 'chip-mint', cancelled: '' };
  const statusLabel = { scheduled: 'นัด', arrived: 'มาแล้ว', cancelled: 'ยกเลิก' };
  return (
    <div className="appt-card" style={{ borderLeft: `4px solid ${APPT_COLORS[appt.type] || 'var(--line)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {SPECIES_EMOJI[appt.species] || '🐾'} {appt.petName}
            {appt.hn ? <span className="chip" style={{ fontSize: 11 }}>HN {appt.hn}</span> : null}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{appt.ownerName} · {appt.phone}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {appt.time ? <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{appt.time}</span> : null}
          <span className={`chip ${statusCls[appt.status] || ''}`} style={{ fontSize: 11 }}>{statusLabel[appt.status] || 'นัด'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`chip ${APPT_CHIP[appt.type] || ''}`}>{appt.type}</span>
        {appt.note ? <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{appt.note}</span> : null}
        {appt.status !== 'cancelled' ? <ApptSmsStatus a={appt} onToggle={() => onUpdate({ ...appt, smsAuto: appt.smsAuto === false })} /> : null}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
        {appt.status !== 'cancelled' && appt.status === 'scheduled' ? (
          <button className="btn btn-primary btn-sm" onClick={() => onUpdate({ ...appt, status: 'arrived' })}>
            <Icon name="check" size={14} /> มาแล้ว
          </button>
        ) : null}
        {/* เข้าหน้า OPD ของสัตว์ตัวนี้เพื่ออ่าน/แก้ประวัติ (เฉพาะที่มี HN) */}
        {appt.hn && onOpenPet ? (
          <button className="btn btn-sm btn-soft" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)' }} onClick={() => onOpenPet(appt.hn)}>
            <Icon name="doc" size={14} /> ดูประวัติ (OPD)
          </button>
        ) : null}
        {/* ส่ง SMS เตือน (เฉพาะที่มีเบอร์ + ยังไม่ยกเลิก) */}
        {appt.status !== 'cancelled' && onSendSms ? (
          appt.reminderSent ? (
            <button className="btn btn-sm" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)', background: 'var(--mint-soft)', fontWeight: 700 }} onClick={() => onSendSms(appt)}>
              ✓ ส่ง SMS แล้ว · ส่งอีกครั้ง
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => onSendSms(appt)}>
              📱 ส่ง SMS เตือน
            </button>
          )
        ) : null}
        {appt.status !== 'cancelled' ? <button className="btn btn-sm" onClick={onEdit}><Icon name="edit" size={14} /> แก้ไข</button> : null}
        {appt.status !== 'cancelled' ? <button className="btn btn-sm" style={{ color: 'var(--blush-deep)' }} onClick={() => onUpdate({ ...appt, status: 'cancelled' })}>ยกเลิกนัด</button> : null}
      </div>
    </div>
  );
}

// ── Appointment Form Modal ───────────────────────────────────
function ApptFormModal({ pets, defaultDate, defaultPet, editAppt, onClose, onSave, notePresets, onSavePresets }) {
  const initPet = defaultPet || (editAppt ? { hn: editAppt.hn, name: editAppt.petName, species: editAppt.species, owner: { name: editAppt.ownerName, phone: editAppt.phone } } : null);
  const [f, setF] = useState(editAppt ? { ...editAppt } : {
    hn: initPet?.hn || '', petName: initPet?.name || '',
    species: initPet?.species || 'สุนัข',
    ownerName: initPet?.owner?.name || '', phone: initPet?.owner?.phone || '',
    date: defaultDate || todayISO(),
    time: '09:00', type: 'ติดตามอาการ', note: '', status: 'scheduled', smsAuto: true,
  });
  const smsOn = f.smsAuto !== false; // ค่าเริ่มต้น = เปิด
  const [petQ, setPetQ] = useState(initPet ? `${initPet.name} — ${initPet.owner.name}` : '');
  const [petResults, setPetResults] = useState([]);
  const [ptOpen, setPtOpen] = useState(false);
  const pRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (pRef.current && !pRef.current.contains(e.target)) setPtOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ตัวเลือกหมายเหตุของประเภทที่เลือก: ใช้ที่แก้ไว้ใน state ก่อน ถ้ายังไม่เคยแก้ใช้ค่าเริ่มต้น
  const presetList = ((notePresets && notePresets[f.type] !== undefined)
    ? notePresets[f.type] : (DEFAULT_NOTE_PRESETS[f.type] || [])).map(normPreset);
  // โหมดแก้ไขตัวเลือก: null = ปิด | array = รายการที่กำลังแก้ (ยังไม่บันทึก)
  const [editingPresets, setEditingPresets] = useState(null);
  useEffect(() => { setEditingPresets(null); }, [f.type]);

  const searchPet = (q) => {
    setPetQ(q); setPtOpen(true);
    const s = q.toLowerCase().trim();
    setPetResults(s ? pets.filter((p) =>
      p.name.toLowerCase().includes(s) || p.hn.includes(s) || p.owner.name.toLowerCase().includes(s)
    ).slice(0, 6) : []);
  };

  const selectPet = (p) => {
    setF({ ...f, hn: p.hn, petName: p.name, species: p.species, ownerName: p.owner.name, phone: p.owner.phone });
    setPetQ(`${p.name} — ${p.owner.name}`);
    setPetResults([]); setPtOpen(false);
  };

  const times = [];
  for (let h = 8; h <= 18; h++) { times.push(`${String(h).padStart(2,'0')}:00`); if (h < 18) times.push(`${String(h).padStart(2,'0')}:30`); }

  // ปุ่มนัดเร็ว — นับจากวันนี้ (local ไม่ใช้ toISOString กันวันเพี้ยน): +4 สัปดาห์ = วันเดิมของสัปดาห์, +1 ปี = วันเดิม
  const setDateFromToday = (addDays, addYears) => {
    const t = new Date();
    const d = new Date(t.getFullYear() + (addYears || 0), t.getMonth(), t.getDate() + (addDays || 0));
    setF((prev) => ({ ...prev, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }));
  };
  const quickDateBtn = {
    padding: '5px 11px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid #F0B97D', background: '#FFF1DF',
    color: '#B5651D', fontWeight: 700, fontSize: 12, cursor: 'pointer',
  };
  const miniBtn = {
    padding: '0 6px', height: 16, lineHeight: '14px', fontSize: 9,
    border: '1px solid var(--line)', borderRadius: 4, background: '#fff',
    cursor: 'pointer', color: 'var(--ink-soft)',
  };

  const canSave = f.petName.trim() && f.date;

  return (
    <Modal title={editAppt ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมายใหม่'} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={!canSave}
          onClick={() => onSave({ ...f, id: f.id || 'apt' + Date.now() })}>
          <Icon name="check" size={16} /> บันทึกนัด
        </button>
      </>}
    >
      <div className="form-grid">
        <Field label="ค้นหาสัตว์เลี้ยง *">
          <div ref={pRef} style={{ position: 'relative' }}>
            <input className="input" value={petQ}
              onChange={(e) => searchPet(e.target.value)}
              onFocus={() => setPtOpen(true)}
              placeholder="ชื่อสัตว์ / HN / ชื่อเจ้าของ..."
              autoFocus={!initPet} />
            {ptOpen && petResults.length > 0 ? (
              <div className="search-pop">
                {petResults.map((p) => (
                  <button key={p.hn} className="search-row" onClick={() => selectPet(p)}>
                    <div className="pet-avatar" style={{ width: 36, height: 36, fontSize: 18 }}>{SPECIES_EMOJI[p.species]}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name} <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 12 }}>HN {p.hn}</span></div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.owner.name} · {p.owner.phone}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Field>

        {f.hn ? (
          <div style={{ padding: '9px 13px', background: 'var(--mint-soft)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--mint-deep)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={15} /> {SPECIES_EMOJI[f.species]} {f.petName} · HN {f.hn} · {f.ownerName} · {f.phone}
          </div>
        ) : null}

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          <Field label="วันที่นัด *">
            <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDateFromToday(28, 0)} style={quickDateBtn}>+ นัด 4 สัปดาห์</button>
              <button type="button" onClick={() => setDateFromToday(0, 1)} style={quickDateBtn}>+ นัด 1 ปี</button>
            </div>
          </Field>
          <Field label="เวลา">
            <select className="select" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
              {times.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <Field label="ประเภทการนัด">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {APPT_TYPES.map((tp) => (
              <button key={tp} onClick={() => setF({ ...f, type: tp })} style={{
                padding: '7px 13px', borderRadius: 'var(--radius-sm)',
                border: f.type === tp ? '2px solid var(--navy)' : '1.5px solid var(--line)',
                background: f.type === tp ? 'var(--navy-soft)' : '#fff',
                fontWeight: f.type === tp ? 700 : 500, fontSize: 13.5,
                color: f.type === tp ? 'var(--navy)' : 'var(--ink-soft)', cursor: 'pointer',
              }}>{tp}</button>
            ))}
          </div>
        </Field>

        <div className="span2">
        <Field label="หมายเหตุ (ถ้ามี)">
          <textarea className="textarea" rows="2" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="เช่น ฉีดยา 3 เข็ม, เตรียมตัวผ่าตัด งดน้ำงดอาหาร..." style={{ resize: 'vertical', minHeight: 58 }} />
          {(() => {
            const SEP = ' และ ';
            const segs = (f.note || '').split(SEP).map((s) => s.trim()).filter(Boolean);
            const texts = presetList.map((p) => p.text);
            // เลือกได้หลายอัน — เรียงตามลำดับ preset, เก็บข้อความที่พิมพ์เองไว้ท้าย, คั่นด้วย "และ"
            const toggle = (opt) => {
              let next;
              if (segs.includes(opt)) {
                next = segs.filter((s) => s !== opt);
              } else {
                const customs = segs.filter((s) => !texts.includes(s));
                const chosen = texts.filter((t) => segs.includes(t) || t === opt);
                next = [...chosen, ...customs];
              }
              setF({ ...f, note: next.join(SEP) });
            };

            // ── โหมดแก้ไขตัวเลือก: แก้ข้อความ / เปลี่ยนสี / เลื่อนตำแหน่ง / เพิ่ม / ลบ ──
            if (editingPresets) {
              const rows = editingPresets;
              const setRow = (i, patch) => setEditingPresets(rows.map((r, j) => j === i ? { ...r, ...patch } : r));
              const move = (i, d) => {
                const j = i + d; if (j < 0 || j >= rows.length) return;
                const next = [...rows]; const t = next[i]; next[i] = next[j]; next[j] = t;
                setEditingPresets(next);
              };
              return (
                <div style={{ marginTop: 9, border: '1.5px dashed var(--navy)', borderRadius: 'var(--radius-sm)', padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--paper)' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>⚙️ แก้ไขตัวเลือกของ “{f.type}” — ▲▼ เลื่อนตำแหน่ง · แตะจุดสีเพื่อเปลี่ยนสี</div>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} style={{ ...miniBtn, opacity: i === 0 ? .35 : 1 }}>▲</button>
                        <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} style={{ ...miniBtn, opacity: i === rows.length - 1 ? .35 : 1 }}>▼</button>
                      </div>
                      <input className="input" style={{ flex: 1, padding: '7px 11px', fontSize: 13 }} value={r.text}
                        onChange={(e) => setRow(i, { text: e.target.value })} placeholder="ข้อความตัวเลือก..." />
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {Object.keys(PRESET_COLORS).map((c) => (
                          <button key={c} type="button" onClick={() => setRow(i, { color: c })} style={{
                            width: 20, height: 20, borderRadius: 99, cursor: 'pointer', padding: 0,
                            background: PRESET_COLORS[c].on,
                            border: r.color === c ? '2.5px solid var(--ink)' : '2px solid #fff',
                            boxShadow: '0 0 0 1px var(--line)',
                          }} />
                        ))}
                      </div>
                      <button type="button" onClick={() => setEditingPresets(rows.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--blush-deep)', fontSize: 15, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }} title="ลบตัวเลือกนี้">✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setEditingPresets([...rows, { text: '', color: 'navy' }])}>+ เพิ่มตัวเลือก</button>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingPresets(null)}>ยกเลิก</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                      const clean = rows.map((r) => ({ text: String(r.text || '').trim(), color: r.color || 'navy' })).filter((r) => r.text);
                      onSavePresets && onSavePresets(f.type, clean);
                      setEditingPresets(null);
                    }}>💾 บันทึกตัวเลือก</button>
                  </div>
                </div>
              );
            }

            // ── โหมดปกติ: ปุ่ม chips + ปุ่ม ⚙️ แก้ไข ──
            return (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    {presetList.length
                      ? 'แตะเพื่อใส่ในหมายเหตุ — เลือกได้หลายอัน (คั่นด้วย “และ”) · ข้อความ SMS จะตรงกันทุกครั้ง'
                      : `ประเภท “${f.type}” ยังไม่มีตัวเลือกด่วน — กด ⚙️ เพื่อเพิ่ม`}
                  </div>
                  {onSavePresets ? (
                    <button type="button" className="btn btn-sm" style={{ flexShrink: 0, fontSize: 11.5, padding: '3px 9px', color: 'var(--ink-soft)' }}
                      onClick={() => setEditingPresets(presetList.map((p) => ({ ...p })))}>
                      ⚙️ {presetList.length ? 'แก้ไขตัวเลือก' : 'เพิ่มตัวเลือก'}
                    </button>
                  ) : null}
                </div>
                {presetList.length ? (
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {presetList.map((p, i) => {
                      const active = segs.includes(p.text);
                      const c = PRESET_COLORS[p.color] || PRESET_COLORS.navy;
                      return (
                        <button key={i} type="button" onClick={() => toggle(p.text)} style={{
                          padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                          border: active ? `2px solid ${c.on}` : `1.5px solid ${c.border}`,
                          background: active ? c.on : c.offBg,
                          color: active ? '#fff' : c.text,
                          fontWeight: active ? 700 : 600, fontSize: 12.5, cursor: 'pointer',
                        }}>{active ? '✓ ' : ''}{p.text}</button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })()}
        </Field>
        </div>

        {/* ปุ่มเปิด/ปิดส่ง SMS เตือนอัตโนมัติ — เปิดไว้เป็นหลัก กดแล้วปิด (สีจาง) */}
        <div className="span2">
        <Field label="การแจ้งเตือน SMS">
          <button type="button" onClick={() => setF({ ...f, smsAuto: !smsOn })} style={{
            width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
            border: '2px solid var(--navy)',
            background: smsOn ? 'var(--navy)' : '#fff',
            color: smsOn ? '#fff' : 'var(--ink-faint)',
            fontWeight: 800, fontSize: 14.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: smsOn ? 1 : 0.6, transition: 'all .15s',
          }}>
            📱 {smsOn ? 'ส่ง SMS เตือนอัตโนมัติ — เปิดอยู่' : 'ปิดส่ง SMS อัตโนมัติ (แตะเพื่อเปิด)'}
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>
            ระบบจะเตือนลูกค้าก่อนวันนัด 1 วัน · ตอนนี้ส่งจากเมนู “นัดที่กำลังมาถึง” เองก่อน (ระบบส่งอัตโนมัติเต็มรูปแบบจะเปิดในเฟสถัดไป)
          </div>
        </Field>
        </div>
      </div>
    </Modal>
  );
}

// ── Appointments Page ────────────────────────────────────────
function AppointmentsView({ appointments, pets, onAdd, onUpdate, onOpenPet, pushToast, notePresets, onSavePresets }) {
  const todayStr = todayISO();
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  // วันพรุ่งนี้ (local — ไม่ใช้ toISOString กัน UTC+7 เพี้ยน)
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
  // smsModal = { appt } (เตือนนัด) หรือ {} (ส่งเอง) | null
  const [smsModal, setSmsModal] = useState(null);
  const sendSms = (a) => setSmsModal({ appt: a });            // เปิด modal เตือนนัด (แก้ข้อความได้)
  const openFreeSms = () => setSmsModal({ appt: null });      // เปิด modal ส่งเอง (กรอกเบอร์+ข้อความ)

  const dayAppts = useMemo(() =>
    appointments.filter((a) => a.date === selectedDay).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, selectedDay]);

  const upcoming = useMemo(() =>
    appointments
      .filter((a) => a.date >= todayStr && a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 20),
    [appointments, todayStr]);

  const thisWeek = useMemo(() => {
    const end = new Date(); end.setDate(end.getDate() + 7);
    // format แบบ local (toISOString ทำให้วันเพี้ยนใน UTC+7)
    const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return upcoming.filter((a) => a.date <= endISO).length;
  }, [upcoming]);

  const openAdd = () => { setEditAppt(null); setShowForm(true); };
  const openEdit = (a) => { setEditAppt(a); setShowForm(true); };

  return (
    <div>
      {/* summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="stat-tile tint-powder" style={{ minWidth: 0, flex: 1 }}>
            <div className="v">{appointments.filter((a) => a.date === todayStr && a.status !== 'cancelled').length}</div>
            <div className="l">นัดวันนี้</div>
          </div>
          <div className="stat-tile tint-butter" style={{ minWidth: 0, flex: 1 }}>
            <div className="v">{thisWeek}</div>
            <div className="l">สัปดาห์นี้</div>
          </div>
          <div className="stat-tile tint-mint" style={{ minWidth: 0, flex: 1 }}>
            <div className="v">{appointments.filter((a) => a.status === 'arrived').length}</div>
            <div className="l">มาแล้ว</div>
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-lg btn-soft" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={openFreeSms}>
          📱 ส่ง SMS เอง
        </button>
        <button className="btn btn-primary btn-lg" onClick={openAdd}>
          <Icon name="plus" size={18} /> เพิ่มนัดใหม่
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        {/* left: calendar + day detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <MiniCalendar appointments={appointments} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </div>

          <div className="card">
            <div className="card-head"
              style={{ background: 'var(--powder-soft)', borderBottom: '2.5px solid var(--powder-deep)', padding: '11px 16px' }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--powder-deep)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--powder-deep)', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clock" size={16} />
                </span>
                นัด — {dateTHShort(selectedDay)}
              </span>
              <span className="chip chip-powder">{dayAppts.length} รายการ</span>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayAppts.length === 0 ? (
                <div className="queue-empty" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                  ไม่มีนัดวันนี้
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary btn-sm" onClick={openAdd}><Icon name="plus" size={14} /> เพิ่มนัด</button>
                  </div>
                </div>
              ) : dayAppts.map((a) => (
                <ApptCard key={a.id} appt={a} onUpdate={onUpdate} onEdit={() => openEdit(a)} onOpenPet={onOpenPet} onSendSms={sendSms} />
              ))}
            </div>
          </div>
        </div>

        {/* right: upcoming list + ปุ่มส่ง SMS เตือน */}
        <div className="card case-right">
          <div className="card-head">
            <span>📱 ส่ง SMS เตือนนัด</span>
            <span className="chip chip-navy">{upcoming.length}</span>
          </div>
          <div className="card-pad" style={{ maxHeight: 620, overflowY: 'auto' }}>
            {upcoming.length === 0 ? (
              <div className="queue-empty">ยังไม่มีนัด</div>
            ) : upcoming.map((a) => {
              const isTomorrow = a.date === tomorrowStr;
              const phone = String(a.phone || '').replace(/[^0-9+]/g, '');
              return (
                <div key={a.id} className="hist-item" style={{ borderLeft: isTomorrow ? '3px solid var(--blush-deep)' : undefined, paddingLeft: isTomorrow ? 9 : undefined }}>
                  <div className="hist-date" style={{ cursor: 'pointer' }} onClick={() => setSelectedDay(a.date)}>
                    <span className="chip chip-powder" style={{ fontSize: 11.5 }}>{dateTHShort(a.date)}</span>
                    {a.time ? <span style={{ color: 'var(--ink-faint)', fontWeight: 600, fontSize: 12 }}>{a.time}</span> : null}
                    {a.date === todayStr ? <span className="chip chip-blush" style={{ fontSize: 11 }}>วันนี้!</span>
                      : isTomorrow ? <span className="chip chip-blush" style={{ fontSize: 11 }}>พรุ่งนี้</span> : null}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }} onClick={() => setSelectedDay(a.date)}>{SPECIES_EMOJI[a.species] || '🐾'} {a.petName}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`chip ${APPT_CHIP[a.type] || ''}`} style={{ fontSize: 12 }}>{a.type}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{a.ownerName}</span>
                    <ApptSmsStatus a={a} onToggle={() => onUpdate({ ...a, smsAuto: a.smsAuto === false })} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="phone" size={12} style={{ color: 'var(--ink-faint)' }} /> {phone || '— ไม่มีเบอร์ —'}
                  </div>
                  {a.note ? <div className="hist-items" style={{ marginTop: 3 }}>{a.note}</div> : null}
                  {/* ปุ่มส่ง SMS + แก้ไขนัด */}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {a.reminderSent ? (
                      <button className="btn btn-sm" style={{ flex: 1, color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)', background: 'var(--mint-soft)', fontWeight: 700 }} onClick={() => sendSms(a)}>
                        ✓ ส่งแล้ว · ส่งอีกครั้ง
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => sendSms(a)}>
                        📱 ส่ง SMS เตือน
                      </button>
                    )}
                    <button className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => openEdit(a)} title="แก้ไขรายละเอียดนัด">
                      <Icon name="edit" size={14} /> แก้ไข
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showForm ? (
        <ApptFormModal
          pets={pets} defaultDate={selectedDay} editAppt={editAppt}
          notePresets={notePresets} onSavePresets={onSavePresets}
          onClose={() => { setShowForm(false); setEditAppt(null); }}
          onSave={(appt) => {
            if (editAppt) onUpdate(appt); else onAdd(appt);
            setShowForm(false); setEditAppt(null);
          }}
        />
      ) : null}

      {smsModal ? (
        <SmsComposerModal
          title={smsModal.appt ? `ส่ง SMS เตือนนัด — ${smsModal.appt.petName}` : 'ส่ง SMS'}
          initPhone={smsModal.appt ? smsModal.appt.phone : ''}
          initMsg={smsModal.appt ? buildReminderMsg(smsModal.appt) : ''}
          onClose={() => setSmsModal(null)}
          onSend={(phone, msg) => {
            openSmsApp(phone, msg);
            if (smsModal.appt) onUpdate({ ...smsModal.appt, reminderSent: true, reminderSentAt: todayISO() });
            pushToast && pushToast(phone ? `เปิดส่ง SMS ถึง ${phone} · คัดลอกข้อความแล้ว` : 'คัดลอกข้อความแล้ว');
            setSmsModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { AppointmentsView, ApptFormModal, ApptSmsStatus, APPT_TYPES, APPT_COLORS, APPT_CHIP });
