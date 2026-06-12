// ── Dashboard: queue board + walk-in + global search ────────
var { useState, useEffect, useRef, useMemo } = React;
const STATUS_META = {
  wait: {
    label: 'รอตรวจ', dot: '#C9A227', tone: 'tone-butter',
    zoneBg: '#FFFBF0', zoneHeader: '#FFF0C0', zoneBorder: '#E5C97E',
    headerColor: '#7A5E00', icon: 'clock'
  },
  exam: {
    label: 'กำลังตรวจ', dot: '#5E8A93', tone: 'tone-powder',
    zoneBg: '#F0F8FA', zoneHeader: '#C8E4E9', zoneBorder: '#5E8A93',
    headerColor: '#2A5D68', icon: 'stetho'
  },
  cashier: {
    label: 'รอชำระเงิน', dot: '#C0685C', tone: 'tone-blush',
    zoneBg: '#FEF5F4', zoneHeader: '#F5D5D0', zoneBorder: '#D98880',
    headerColor: '#8C3028', icon: 'cash'
  },
  done: {
    label: 'เสร็จแล้ว', dot: '#3E7D5C', tone: 'tone-mint',
    zoneBg: '#F4FAF6', zoneHeader: '#C8E6D4', zoneBorder: '#7AC9A0',
    headerColor: '#1E5C3E', icon: 'check'
  }
};

function GlobalSearch({ pets, onOpenPet }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    const fn = (e) => {if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return pets.filter((p) =>
    p.name.toLowerCase().includes(s) || p.hn.includes(s) ||
    p.owner.name.toLowerCase().includes(s) || p.owner.phone.replace(/-/g, '').includes(s.replace(/-/g, ''))
    ).slice(0, 8);
  }, [q, pets]);
  return (
    <div className="search-wrap" ref={wrapRef}>
      <Icon name="search" size={17} />
      <input
        className="search-input"
        placeholder="ค้นหาเคสเก่า — ชื่อสัตว์ / HN / เจ้าของ / เบอร์โทร"
        value={q}
        onChange={(e) => {setQ(e.target.value);setOpen(true);}}
        onFocus={() => setOpen(true)} style={{ borderStyle: "solid", borderWidth: "2px" }} />
      
      {open && q.trim() ?
      <div className="search-pop">
          {results.length === 0 ? <div className="search-empty">ไม่พบเคสที่ค้นหา — ลองคำอื่น หรือกด "รับเคสใหม่"</div> :
        results.map((p) =>
        <button key={p.hn} className="search-row" onClick={() => {setOpen(false);setQ('');onOpenPet(p.hn);}}>
                <div className="pet-avatar" style={{ width: 40, height: 40, fontSize: 19 }}>{SPECIES_EMOJI[p.species] || '🐾'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.name} <span style={{ color: 'var(--ink-faint)', fontWeight: 500, fontSize: 12.5 }}>HN {p.hn}</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.species} · {p.breed} · {p.owner.name} · {p.owner.phone}</div>
                </div>
                <Icon name="chevR" size={16} style={{ color: 'var(--ink-faint)' }} />
              </button>
        )}
        </div> :
      null}
    </div>);

}

function WalkInModal({ pets, onClose, onSubmit }) {
  const [mode, setMode] = useState('new'); // new | old
  const [oldQuery, setOldQuery] = useState('');
  const [pick, setPick] = useState(null);
  const [f, setF] = useState({ owner: '', phone: '', pet: '', species: 'สุนัข', sex: 'ผู้', ageY: '', ageM: '', weight: '', type: 'ตรวจรักษา', cc: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const oldResults = useMemo(() => {
    const s = oldQuery.trim().toLowerCase();
    if (!s) return [];
    return pets.filter((p) => p.name.toLowerCase().includes(s) || p.hn.includes(s) || p.owner.phone.replace(/-/g, '').includes(s)).slice(0, 6);
  }, [oldQuery, pets]);

  const canSubmit = mode === 'old' ? !!pick : f.pet.trim() && f.owner.trim();

  const submit = () => {
    if (mode === 'old') onSubmit({ existingHn: pick.hn, type: f.type, cc: f.cc });else
    onSubmit({ newPet: f, type: f.type, cc: f.cc });
  };

  return (
    <Modal
      title="รับเคสใหม่ / Walk-in" onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary btn-lg" disabled={!canSubmit} onClick={submit}>
          <Icon name="check" size={17} /> ออกบัตรคิว
        </button>
      </>}>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div className="seg">
          <button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>ลูกค้าใหม่</button>
          <button className={mode === 'old' ? 'on' : ''} onClick={() => setMode('old')}>ลูกค้าเดิม</button>
        </div>
      </div>

      {mode === 'old' ?
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="ค้นหาลูกค้าเดิม (ชื่อสัตว์ / HN / เบอร์โทร)">
            <input className="input" value={oldQuery} onChange={(e) => {setOldQuery(e.target.value);setPick(null);}} placeholder="เช่น เฮงเฮง หรือ 690012" autoFocus />
          </Field>
          {pick ?
        <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', borderColor: 'var(--navy)', borderWidth: 1.5 }}>
              <div className="pet-avatar" style={{ width: 46, height: 46, fontSize: 22 }}>{SPECIES_EMOJI[pick.species]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{pick.name} · HN {pick.hn}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{pick.species} {pick.breed} · {pick.owner.name}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setPick(null)}>เปลี่ยน</button>
            </div> :
        oldResults.length > 0 ?
        <div className="card" style={{ overflow: 'hidden' }}>
              {oldResults.map((p) =>
          <button key={p.hn} className="search-row" onClick={() => setPick(p)}>
                  <div className="pet-avatar" style={{ width: 38, height: 38, fontSize: 18 }}>{SPECIES_EMOJI[p.species]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name} <span style={{ fontWeight: 500, color: 'var(--ink-faint)', fontSize: 12 }}>HN {p.hn}</span></div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.owner.name} · {p.owner.phone}</div>
                  </div>
                </button>
          )}
            </div> :
        oldQuery.trim() ? <div className="search-empty">ไม่พบ — ลองคำอื่น</div> : null}
          <div className="form-grid">
            <Field label="บริการ">
              <select className="select" value={f.type} onChange={set('type')}>
                {['ตรวจรักษา', 'วัคซีน', 'อาบน้ำตัดขน', 'ผ่าตัด', 'ซื้อสินค้า'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="อาการเบื้องต้น (CC)">
              <input className="input" value={f.cc} onChange={set('cc')} placeholder="เช่น ซึม เบื่ออาหาร" />
            </Field>
          </div>
        </div> :

      <div className="form-grid">
          <Field label="ชื่อเจ้าของ *"><input className="input" value={f.owner} onChange={set('owner')} placeholder="ชื่อ-นามสกุล" autoFocus /></Field>
          <Field label="เบอร์โทร"><input className="input" value={f.phone} onChange={set('phone')} placeholder="08x-xxx-xxxx" /></Field>
          <Field label="ชื่อสัตว์เลี้ยง *"><input className="input" value={f.pet} onChange={set('pet')} placeholder="ชื่อน้อง..." /></Field>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 13 }}>
            <Field label="ชนิด">
              <select className="select" value={f.species} onChange={set('species')}>
                {['สุนัข', 'แมว', 'กระต่าย', 'นก', 'อื่นๆ'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="เพศ">
              <select className="select" value={f.sex} onChange={set('sex')}>
                {['ผู้', 'เมีย', 'ไม่ระบุ'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 13 }}>
            <Field label="อายุ (ปี)"><input className="input" type="number" min="0" value={f.ageY} onChange={set('ageY')} placeholder="ปี" /></Field>
            <Field label="(เดือน)"><input className="input" type="number" min="0" max="11" value={f.ageM} onChange={set('ageM')} placeholder="เดือน" /></Field>
            <Field label="น้ำหนัก (kg)"><input className="input" type="number" min="0" step="0.1" value={f.weight} onChange={set('weight')} placeholder="0.0" /></Field>
          </div>
          <Field label="บริการ">
            <select className="select" value={f.type} onChange={set('type')}>
              {['ตรวจรักษา', 'วัคซีน', 'อาบน้ำตัดขน', 'ผ่าตัด', 'ซื้อสินค้า'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="อาการเบื้องต้น (CC)"><input className="input" value={f.cc} onChange={set('cc')} placeholder="อาการที่เจ้าของสังเกตได้..." /></Field>
        </div>
      }
    </Modal>);

}

function QueueCard({ item, pet, onOpen, onOpenCase, onMove, onPay, zoneBorder }) {
  const meta = STATUS_META[item.status];
  const total = (item.charges || []).reduce((s, [, q, p]) => s + q * p, 0);
  return (
    <div className={'q-card ' + meta.tone}
    style={{ borderTop: 'none', borderLeft: `4px solid ${zoneBorder || meta.dot}`, cursor: 'pointer' }}
    onClick={() => onOpen(item)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="q-no">{item.q}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} />{item.time}</span>
      </div>
      <div className="q-pet">{SPECIES_EMOJI[item.species] || '🐾'} {item.petName}
        {item.isNew ? <span className="chip chip-blush" style={{ fontSize: 11 }}>ลูกค้าใหม่</span> : null}
      </div>
      <div className="q-meta">
        <span className={'chip ' + (TYPE_CHIP[item.type] || '')}>{item.type}</span>
        {pet ? <span className="chip">HN {pet.hn}</span> : null}
      </div>
      {item.cc ? <div className="q-cc">{item.cc}</div> : null}
      <div className="q-actions" onClick={(e) => e.stopPropagation()}>
        {item.status === 'wait' ?
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => {onMove(item.q, 'exam');onOpen({ ...item, status: 'exam' });}}>
            <Icon name="stetho" size={15} /> เรียกตรวจ
          </button> :
        null}
        {item.status === 'exam' ?
        <button className="btn btn-soft btn-sm" style={{ flex: 1 }} onClick={() => onOpenCase(item)}>
            <Icon name="edit" size={14} /> เปิดเคส / บันทึก
          </button> :
        null}
        {item.status === 'cashier' ?
        <button className="btn btn-blush btn-sm" style={{ flex: 1 }} onClick={() => onPay(item)}>
            <Icon name="cash" size={15} /> ชำระเงิน {total ? fmtB(total) : ''}
          </button> :
        null}
        {item.status === 'done' ?
        <span style={{ fontSize: 12.5, color: 'var(--mint-deep)', fontWeight: 700, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <Icon name="check" size={14} /> ชำระแล้ว {item.paid ? fmtB(item.paid) : ''}
          </span> :
        null}
      </div>
    </div>);

}

// ── Admitted panel ──
function AdmittedPanel({ admitted, onUpdateAdmitted, onDischargeAdmitted, onOpenCase }) {
  const [expanded, setExpanded] = useState(null);
  const [addingFor, setAddingFor] = useState(null);
  const [newRec, setNewRec] = useState({ note: '', charges: [{ name: '', qty: 1, price: '' }] });
  const [discharging, setDischarging] = useState(null);
  const [payMethod, setPayMethod] = useState('เงินสด');
  const today = new Date().toISOString().slice(0, 10);

  const totalFor = (adm) => (adm.dailyRecords || []).reduce((s, r) =>
    s + (r.charges || []).reduce((ss, c) => ss + (parseFloat(c[2]) || 0) * (parseInt(c[1]) || 1), 0), 0);

  const dayCount = (adm) => Math.max(1, Math.ceil((Date.now() - new Date(adm.admittedDate)) / 86400000));

  const saveRecord = (admId) => {
    const adm = admitted.find((a) => a.id === admId); if (!adm) return;
    const charges = newRec.charges.filter((c) => c.name.trim() && c.price).map((c) => [c.name, parseInt(c.qty) || 1, parseFloat(c.price) || 0]);
    onUpdateAdmitted(admId, { ...adm, dailyRecords: [...(adm.dailyRecords || []), { date: today, note: newRec.note, charges }] });
    setAddingFor(null); setNewRec({ note: '', charges: [{ name: '', qty: 1, price: '' }] });
  };

  const patchCharge = (i, k, v) => { const ch = [...newRec.charges]; ch[i] = { ...ch[i], [k]: v }; setNewRec({ ...newRec, charges: ch }); };

  if (!admitted || admitted.length === 0) return null;

  return (
    <>
      <div className="card">
        <div className="card-head" style={{ background: '#FFF3E0', borderBottom: '2px solid #E6A040', padding: '10px 13px' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#A05A00', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#E6A040', color: '#fff', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="home" size={14} />
            </span>
            แอดมิดอยู่ ({admitted.length})
          </span>
        </div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
          {admitted.map((adm) => {
            const total = totalFor(adm); const days = dayCount(adm); const isExp = expanded === adm.id;
            return (
              <div key={adm.id} style={{ border: '1.5px solid #E6A040', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#FFFAF4' }}>
                <div style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}
                  onClick={() => onOpenCase && onOpenCase(adm)}>
                  <div style={{ fontSize: 24, lineHeight: 1 }}>{SPECIES_EMOJI[adm.species] || '🐾'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{adm.petName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>วันที่ {adm.admittedDate?.slice(5).replace('-', '/')} · {days} วัน</div>
                    {total > 0 && <div style={{ fontSize: 12, color: '#A05A00', fontWeight: 700 }}>รวม {fmtB(total)}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: '1px solid #F0D0A0', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(adm.dailyRecords || []).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, background: '#FFF8EC', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontWeight: 700, color: '#7A5500', marginBottom: 2 }}>{r.date}</div>
                        {r.note && <div style={{ color: 'var(--ink-soft)', marginBottom: 3, fontSize: 12 }}>{r.note}</div>}
                        {(r.charges || []).map((c, j) => (
                          <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                            <span>{c[0]} ×{c[1]}</span><span style={{ fontWeight: 600 }}>{fmtB(c[2] * c[1])}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {addingFor === adm.id ? (
                      <div style={{ background: '#FFF3DC', borderRadius: 6, padding: '8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <textarea className="textarea" rows="2" placeholder="บันทึกการรักษา..."
                          value={newRec.note} onChange={(e) => setNewRec({ ...newRec, note: e.target.value })} style={{ fontSize: 12 }} />
                        {newRec.charges.map((c, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 36px 58px 20px', gap: 3 }}>
                            <input className="input" style={{ fontSize: 11, padding: '3px 5px' }} placeholder="รายการ" value={c.name} onChange={(e) => patchCharge(i, 'name', e.target.value)} />
                            <input className="input" style={{ fontSize: 11, padding: '3px 5px' }} type="number" min="1" value={c.qty} onChange={(e) => patchCharge(i, 'qty', e.target.value)} />
                            <input className="input" style={{ fontSize: 11, padding: '3px 5px' }} type="number" placeholder="฿" value={c.price} onChange={(e) => patchCharge(i, 'price', e.target.value)} />
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 15 }}
                              onClick={() => setNewRec({ ...newRec, charges: newRec.charges.filter((_, j) => j !== i) })}>×</button>
                          </div>
                        ))}
                        <button className="btn btn-sm" style={{ alignSelf: 'flex-start', fontSize: 11 }}
                          onClick={() => setNewRec({ ...newRec, charges: [...newRec.charges, { name: '', qty: 1, price: '' }] })}>+ รายการ</button>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={() => saveRecord(adm.id)}>บันทึก</button>
                          <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => setAddingFor(null)}>ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: 12 }}
                        onClick={() => { setAddingFor(adm.id); setNewRec({ note: '', charges: [{ name: '', qty: 1, price: '' }] }); }}>
                        + เพิ่มรายการวันนี้
                      </button>
                    )}
                    <button className="btn btn-sm" style={{ fontSize: 12, background: '#FDECEA', color: '#8C3028', border: '1px solid #D98880', marginTop: 2 }}
                      onClick={() => setDischarging(adm)}>
                      ฿ คิดค่าใช้จ่าย + จำหน่าย
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {discharging ? (
        <Modal title={`จำหน่าย — ${discharging.petName}`} onClose={() => setDischarging(null)}
          footer={<>
            <button className="btn" onClick={() => setDischarging(null)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={() => { onDischargeAdmitted(discharging.id, payMethod); setDischarging(null); }}>ยืนยันจำหน่าย</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', background: '#FFFAF4', borderRadius: 'var(--radius-sm)', border: '1px solid #F0D0A0' }}>
              <div style={{ fontSize: 36 }}>{SPECIES_EMOJI[discharging.species] || '🐾'}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{discharging.petName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>แอดมิดตั้งแต่ {discharging.admittedDate?.slice(0, 10)} · เจ้าของ: {discharging.owner?.name}</div>
              </div>
            </div>
            {(discharging.dailyRecords || []).length === 0 ? (
              <div style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: 16 }}>ยังไม่มีรายการ</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {(discharging.dailyRecords || []).map((r, i) => (
                  <div key={i} style={{ background: '#FFFAF4', borderRadius: 6, padding: '8px 10px', border: '1px solid #F0D0A0', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#7A5500', marginBottom: 4 }}>{r.date}</div>
                    {r.note && <div style={{ color: 'var(--ink-soft)', marginBottom: 4, fontSize: 12.5 }}>{r.note}</div>}
                    {(r.charges || []).map((c, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c[0]} ×{c[1]}</span><span style={{ fontWeight: 600 }}>{fmtB(c[2] * c[1])}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--navy)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 15 }}>
              <span>ยอดรวมทั้งสิ้น</span><span>{fmtB(totalFor(discharging))}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ชำระโดย</span>
              {['เงินสด', 'โอน', 'บัตร'].map((m) => (
                <button key={m} className={'btn btn-sm' + (payMethod === m ? ' btn-primary' : '')} onClick={() => setPayMethod(m)}>{m}</button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Dashboard({ pets, queue, appointments, admitted, onOpenCase, onOpenPet, onMove, onPay, onWalkIn, onUpdateAppointment, onDischargeAdmitted, onUpdateAdmitted, onOpenAdmittedCase }) {
  const [showWalkIn, setShowWalkIn] = useState(false);
  const byStatus = (st) => {
    const today = new Date().toISOString().slice(0, 10);
    return queue.filter((x) => {
      if (x.status !== st) return false;
      // เสร็จแล้ว: แสดงเฉพาะวันนี้ เมื่อวานหายออก
      if (st === 'done') return !x.doneDate || x.doneDate === today;
      return true;
    });
  };
  const revenue = queue.filter((x) => x.status === 'done').reduce((s, x) => s + (x.paid || 0), 0);
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayAppts = (appointments || []).
  filter((a) => a.date === todayISO && a.status !== 'cancelled').
  sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const stats = [
  { v: byStatus('wait').length, l: 'รอตรวจ', cls: 'tint-butter' },
  { v: byStatus('exam').length, l: 'กำลังตรวจ', cls: 'tint-powder' },
  { v: byStatus('cashier').length, l: 'รอชำระเงิน', cls: 'tint-blush' },
  { v: byStatus('done').length, l: 'เสร็จแล้ววันนี้', cls: 'tint-mint' },
  { v: fmtB(revenue), l: 'รายรับวันนี้ (OPD)', cls: 'tint-navy' }];


  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <GlobalSearch pets={pets} onOpenPet={onOpenPet} />
        <button className="btn btn-primary btn-lg" onClick={() => setShowWalkIn(true)} style={{ backgroundColor: "rgb(211, 109, 31)" }}>
          <Icon name="plus" size={18} /> รับเคสใหม่ / Walk-in
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 14, alignItems: 'start' }}>

        {/* ── นัดวันนี้ panel ── */}
        <div style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card">
          <div className="card-head" style={{ background: '#EEF0FA', borderBottom: '2px solid #B0B8E0', padding: '10px 13px' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#3A3F8F', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#3A3F8F', color: '#fff', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="clock" size={15} />
              </span>
              นัดวันนี้
            </span>
            <span style={{ minWidth: 22, height: 22, borderRadius: 99, background: '#3A3F8F', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
              {todayAppts.length}
            </span>
          </div>
          <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 540, overflowY: 'auto' }}>
            {todayAppts.length === 0 ?
            <div className="queue-empty" style={{ background: 'transparent', border: '1.5px dashed #B0B8E0', fontSize: 12.5 }}>ไม่มีนัดวันนี้</div> :
            todayAppts.map((a) => {
              const arrived = a.status === 'arrived';
              const alreadyQueued = queue.some((q) => q.hn === a.hn && ['wait', 'exam', 'cashier'].includes(q.status));
              return (
                <div key={a.id} style={{
                  background: arrived ? 'var(--mint-soft)' : '#fff',
                  border: `1px solid ${arrived ? 'var(--mint-deep)' : '#C8CCE8'}`,
                  borderRadius: 'var(--radius-sm)', padding: '9px 10px',
                  opacity: arrived ? .75 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{SPECIES_EMOJI[a.species] || '🐾'} {a.petName}</span>
                    {a.time ? <span style={{ fontSize: 12, fontWeight: 700, color: '#3A3F8F', fontVariantNumeric: 'tabular-nums' }}>{a.time}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{a.ownerName}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`chip ${APPT_CHIP && APPT_CHIP[a.type] ? APPT_CHIP[a.type] : ''}`} style={{ fontSize: 11 }}>{a.type}</span>
                    {arrived ? <span className="chip chip-mint" style={{ fontSize: 11 }}>มาแล้ว</span> : null}
                  </div>
                  {!arrived && !alreadyQueued ?
                  <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 7, fontSize: 12 }}
                  onClick={() => {
                    onUpdateAppointment && onUpdateAppointment({ ...a, status: 'arrived' });
                    onWalkIn({ existingHn: a.hn, type: a.type, cc: a.note || a.type });
                  }}>
                      <Icon name="plus" size={13} /> รับเข้าคิว
                    </button> :
                  alreadyQueued ?
                  <div style={{ fontSize: 12, color: 'var(--powder-deep)', marginTop: 5, fontWeight: 600, textAlign: 'center' }}>อยู่ในคิวแล้ว</div> :
                  null}
                </div>);

            })}
          </div>
        </div>
        <AdmittedPanel admitted={admitted} onUpdateAdmitted={onUpdateAdmitted || (() => {})} onDischargeAdmitted={onDischargeAdmitted} onOpenCase={onOpenAdmittedCase} />
        </div>

        {/* ── right: stats + queue board ── */}
        <div>
          <div className="stats-row" style={{ marginBottom: 14 }}>
            {stats.map((s, i) =>
            <div key={i} className={'stat-tile ' + s.cls}>
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            )}
          </div>

          <div className="queue-board">
        {Object.entries(STATUS_META).map(([st, meta]) => {
              const items = byStatus(st);
              return (
                <div key={st} className="queue-zone" style={{
                  background: meta.zoneBg,
                  border: `2px solid ${meta.zoneBorder}`,
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 220
                }}>
              {/* zone header */}
              <div style={{
                    background: meta.zoneHeader,
                    borderBottom: `2px solid ${meta.zoneBorder}`,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                <span style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: meta.zoneBorder,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', flexShrink: 0
                    }}>
                  <Icon name={meta.icon} size={16} stroke={2.2} />
                </span>
                <span style={{ fontWeight: 800, color: meta.headerColor, flex: 1, fontSize: "17px" }}>
                  {meta.label}
                </span>
                <span style={{
                      minWidth: 26, height: 26, borderRadius: 99,
                      background: meta.zoneBorder, color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800
                    }}>
                  {items.length}
                </span>
              </div>

              {/* zone body */}
              <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {items.length === 0 ?
                    <div className="queue-empty" style={{ background: 'transparent', border: `1.5px dashed ${meta.zoneBorder}`, opacity: .7 }}>— ว่าง —</div> :
                    items.map((item) =>
                    <QueueCard key={item.q} item={item} pet={pets.find((p) => p.hn === item.hn)}
                    onOpen={onOpenCase} onOpenCase={onOpenCase} onMove={onMove} onPay={onPay} zoneBorder={meta.zoneBorder} />
                    )}
              </div>
            </div>);

            })}
        </div> {/* end queue-board */}
        </div> {/* end right column */}
      </div> {/* end outer grid */}

      {showWalkIn ?
      <WalkInModal pets={pets} onClose={() => setShowWalkIn(false)}
      onSubmit={(payload) => {setShowWalkIn(false);onWalkIn(payload);}} /> :
      null}
    </div>);

}

Object.assign(window, { Dashboard, STATUS_META });