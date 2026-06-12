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

function dateTHShort(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
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
  const today = new Date().toISOString().slice(0, 10);

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

// ── Appointment Card ─────────────────────────────────────────
function ApptCard({ appt, onUpdate, onEdit }) {
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
      </div>
      {appt.status !== 'cancelled' ? (
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {appt.status === 'scheduled' ? (
            <button className="btn btn-primary btn-sm" onClick={() => onUpdate({ ...appt, status: 'arrived' })}>
              <Icon name="check" size={14} /> มาแล้ว
            </button>
          ) : null}
          <button className="btn btn-sm" onClick={onEdit}><Icon name="edit" size={14} /> แก้ไข</button>
          <button className="btn btn-sm" style={{ color: 'var(--blush-deep)' }} onClick={() => onUpdate({ ...appt, status: 'cancelled' })}>ยกเลิกนัด</button>
        </div>
      ) : null}
    </div>
  );
}

// ── Appointment Form Modal ───────────────────────────────────
function ApptFormModal({ pets, defaultDate, defaultPet, editAppt, onClose, onSave }) {
  const initPet = defaultPet || (editAppt ? { hn: editAppt.hn, name: editAppt.petName, species: editAppt.species, owner: { name: editAppt.ownerName, phone: editAppt.phone } } : null);
  const [f, setF] = useState(editAppt ? { ...editAppt } : {
    hn: initPet?.hn || '', petName: initPet?.name || '',
    species: initPet?.species || 'สุนัข',
    ownerName: initPet?.owner?.name || '', phone: initPet?.owner?.phone || '',
    date: defaultDate || new Date().toISOString().slice(0, 10),
    time: '09:00', type: 'ติดตามอาการ', note: '', status: 'scheduled',
  });
  const [petQ, setPetQ] = useState(initPet ? `${initPet.name} — ${initPet.owner.name}` : '');
  const [petResults, setPetResults] = useState([]);
  const [ptOpen, setPtOpen] = useState(false);
  const pRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (pRef.current && !pRef.current.contains(e.target)) setPtOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

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

        <Field label="หมายเหตุ (ถ้ามี)">
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="เช่น ฉีดยา 3 เข็ม, เตรียมตัวผ่าตัด งดน้ำงดอาหาร..." />
        </Field>
      </div>
    </Modal>
  );
}

// ── Appointments Page ────────────────────────────────────────
function AppointmentsView({ appointments, pets, onAdd, onUpdate }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState(null);

  const dayAppts = useMemo(() =>
    appointments.filter((a) => a.date === selectedDay).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, selectedDay]);

  const upcoming = useMemo(() =>
    appointments
      .filter((a) => a.date >= todayISO && a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 20),
    [appointments, todayISO]);

  const thisWeek = useMemo(() => {
    const end = new Date(); end.setDate(end.getDate() + 7);
    const endISO = end.toISOString().slice(0, 10);
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
            <div className="v">{appointments.filter((a) => a.date === todayISO && a.status !== 'cancelled').length}</div>
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
                <ApptCard key={a.id} appt={a} onUpdate={onUpdate} onEdit={() => openEdit(a)} />
              ))}
            </div>
          </div>
        </div>

        {/* right: upcoming list */}
        <div className="card case-right">
          <div className="card-head">
            <span><Icon name="doc" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />นัดที่กำลังมาถึง</span>
            <span className="chip chip-navy">{upcoming.length}</span>
          </div>
          <div className="card-pad" style={{ maxHeight: 580, overflowY: 'auto' }}>
            {upcoming.length === 0 ? (
              <div className="queue-empty">ยังไม่มีนัด</div>
            ) : upcoming.map((a) => (
              <div key={a.id} className="hist-item" style={{ cursor: 'pointer' }} onClick={() => setSelectedDay(a.date)}>
                <div className="hist-date">
                  <span className="chip chip-powder" style={{ fontSize: 11.5 }}>{dateTHShort(a.date)}</span>
                  {a.time ? <span style={{ color: 'var(--ink-faint)', fontWeight: 600, fontSize: 12 }}>{a.time}</span> : null}
                  {a.date === todayISO ? <span className="chip chip-blush" style={{ fontSize: 11 }}>วันนี้!</span> : null}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{SPECIES_EMOJI[a.species] || '🐾'} {a.petName}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  <span className={`chip ${APPT_CHIP[a.type] || ''}`} style={{ fontSize: 12 }}>{a.type}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{a.ownerName}</span>
                </div>
                {a.note ? <div className="hist-items" style={{ marginTop: 3 }}>{a.note}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm ? (
        <ApptFormModal
          pets={pets} defaultDate={selectedDay} editAppt={editAppt}
          onClose={() => { setShowForm(false); setEditAppt(null); }}
          onSave={(appt) => {
            if (editAppt) onUpdate(appt); else onAdd(appt);
            setShowForm(false); setEditAppt(null);
          }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { AppointmentsView, ApptFormModal, APPT_TYPES, APPT_COLORS, APPT_CHIP });
