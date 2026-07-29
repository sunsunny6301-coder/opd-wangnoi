// ── Dashboard: queue board + walk-in + global search ────────
var { useState, useEffect, useRef, useMemo } = React;
const SERVICE_TYPES = ['ตรวจรักษา', 'วัคซีน', 'อาบน้ำตัดขน', 'ผ่าตัด', 'ซื้อสินค้า'];
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

function GlobalSearch({ pets, onOpenPet, onWalkIn, onDirectWalkIn }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [svcFor, setSvcFor] = useState(null);   // hn ของแถวที่กำลังเลือกบริการก่อนส่งเข้าคิว
  const wrapRef = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSvcFor(null); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const sendToQueue = (hn, type) => { setOpen(false); setQ(''); setSvcFor(null); onDirectWalkIn({ existingHn: hn, type, cc: '' }); };
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
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} style={{ borderStyle: 'solid', borderWidth: '2px' }} />
      {open && q.trim() ?
        <div className="search-pop">
          {results.length === 0
            ? <div className="search-empty">ไม่พบเคสที่ค้นหา — ลองคำอื่น หรือกด "รับเคสใหม่"</div>
            : results.map((p) => (
              <div key={p.hn} style={{ borderBottom: '1px solid var(--line-soft)', background: svcFor === p.hn ? 'var(--butter-soft)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                  <div className="pet-avatar" style={{ width: 40, height: 40, fontSize: 19 }}>{SPECIES_EMOJI[p.species] || '🐾'}</div>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setOpen(false); setQ(''); onOpenPet(p.hn); }}>
                    <div style={{ fontWeight: 700 }}>{p.name} <span style={{ color: 'var(--ink-faint)', fontWeight: 500, fontSize: 12.5 }}>HN {p.hn}</span></div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.species} · {p.breed} · {p.owner.name} · {p.owner.phone}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setSvcFor(svcFor === p.hn ? null : p.hn); }}>
                    <Icon name="plus" size={13} /> รอตรวจ <span style={{ fontSize: 10, opacity: .8 }}>{svcFor === p.hn ? '▴' : '▾'}</span>
                  </button>
                  <Icon name="chevR" size={16} style={{ color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => { setOpen(false); setQ(''); setSvcFor(null); onOpenPet(p.hn); }} />
                </div>
                {svcFor === p.hn ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, padding: '0 14px 11px 66px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--butter-deep)' }}>เลือกบริการ:</span>
                    {SERVICE_TYPES.map((t) => (
                      <button key={t} className="btn btn-sm" style={{ fontSize: 12.5, padding: '5px 12px', background: 'var(--surface)', borderColor: 'var(--butter)' }}
                        onClick={(e) => { e.stopPropagation(); sendToQueue(p.hn, t); }}>
                        {t}
                      </button>
                    ))}
                    {/* สัตว์ตัวใหม่ของบ้านเดียวกัน — เปิด walk-in โหมดเจ้าของเดิม กรอกประวัติตัวใหม่แล้วส่งคิวได้เลย */}
                    <span style={{ width: '100%', height: 0 }} />
                    <button className="btn btn-sm" style={{ fontSize: 12.5, padding: '5px 12px', background: 'var(--navy-soft)', borderColor: 'var(--navy)', color: 'var(--navy)', fontWeight: 700 }}
                      onClick={(e) => { e.stopPropagation(); setOpen(false); setQ(''); setSvcFor(null); onWalkIn({ newPetForOwner: p.owner }); }}>
                      🐾 + เพิ่มสัตว์ตัวใหม่ของบ้านนี้
                    </button>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>เจ้าของ: {p.owner.name}</span>
                  </div>
                ) : null}
              </div>
            ))}
        </div>
        : null}
    </div>
  );
}

// prefillOwner = เปิดเข้าโหมด "เพิ่มสัตว์ใหม่ให้เจ้าของเดิม" ทันที (กดมาจากผลค้นหาหน้าคิว)
function WalkInModal({ pets, onClose, onSubmit, prefillHn, prefillOwner }) {
  const prefillPet = prefillHn ? pets.find((p) => p.hn === prefillHn) : null;
  const [mode, setMode] = useState((prefillHn || prefillOwner) ? 'old' : 'new');
  const [oldQuery, setOldQuery] = useState('');
  const [pick, setPick] = useState(prefillPet || null);
  // addNewPet = เพิ่มสัตว์ใหม่ให้เจ้าของเดิม (ใช้เมื่อเจอเจ้าของแล้วแต่ไม่ใช่สัตว์เดิม)
  const [addNewPet, setAddNewPet] = useState(!!prefillOwner);
  const [pickedOwner, setPickedOwner] = useState(prefillOwner || null); // เจ้าของที่เลือกไว้ (ยังไม่มีสัตว์ตัวใหม่)
  const [f, setF] = useState({ owner: '', phone: '', pet: '', species: 'สุนัข', sex: 'ผู้', ageY: '', ageM: '', weight: '', type: 'ตรวจรักษา', cc: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const oldResults = useMemo(() => {
    const s = oldQuery.trim().toLowerCase();
    if (!s) return [];
    return pets.filter((p) => p.name.toLowerCase().includes(s) || p.hn.includes(s) || p.owner.phone.replace(/-/g, '').includes(s.replace(/-/g, '')) || p.owner.name.toLowerCase().includes(s)).slice(0, 8);
  }, [oldQuery, pets]);

  // จัดกลุ่มผลค้นหาตามเจ้าของ เพื่อแสดงตัวเลือก "เพิ่มสัตว์ใหม่"
  const ownerGroups = useMemo(() => {
    const map = {};
    oldResults.forEach((p) => {
      const key = p.owner.phone || p.owner.name;
      if (!map[key]) map[key] = { owner: p.owner, pets: [] };
      map[key].pets.push(p);
    });
    return Object.values(map);
  }, [oldResults]);

  const canSubmit = addNewPet
    ? (f.pet.trim() && pickedOwner)
    : (mode === 'old' ? !!pick : f.pet.trim() && f.owner.trim());

  const submit = () => {
    if (addNewPet && pickedOwner) {
      // สัตว์ใหม่ + เจ้าของเดิม
      onSubmit({ newPet: { ...f, owner: pickedOwner.name, phone: pickedOwner.phone }, type: f.type, cc: f.cc, keepOwner: pickedOwner });
    } else if (mode === 'old') {
      onSubmit({ existingHn: pick.hn, type: f.type, cc: f.cc });
    } else {
      onSubmit({ newPet: f, type: f.type, cc: f.cc });
    }
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
          <button className={mode === 'new' && !addNewPet ? 'on' : ''} onClick={() => { setMode('new'); setAddNewPet(false); setPickedOwner(null); setPick(null); }}>ลูกค้าใหม่</button>
          <button className={mode === 'old' ? 'on' : ''} onClick={() => { setMode('old'); setAddNewPet(false); setPickedOwner(null); }}>ลูกค้าเดิม</button>
        </div>
      </div>

      {/* ─── โหมด: เพิ่มสัตว์ใหม่ให้เจ้าของเดิม ─── */}
      {addNewPet && pickedOwner ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--navy-soft)', borderColor: 'var(--navy)' }}>
            <div style={{ fontSize: 28 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{pickedOwner.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{pickedOwner.phone}</div>
            </div>
            <button className="btn btn-sm" onClick={() => { setAddNewPet(false); setPickedOwner(null); }}>เปลี่ยน</button>
          </div>
          <div style={{ background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--butter-deep)', fontWeight: 600 }}>
            🐾 กรอกข้อมูลสัตว์เลี้ยงตัวใหม่ (เจ้าของเดิม)
          </div>
          <div className="form-grid">
            <Field label="ชื่อสัตว์เลี้ยง *"><input className="input" value={f.pet} onChange={set('pet')} placeholder="ชื่อน้อง..." autoFocus /></Field>
            <div />
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
            <Field label="อายุ (ปี)"><input className="input" type="number" min="0" value={f.ageY} onChange={set('ageY')} placeholder="ปี" /></Field>
            <Field label="(เดือน)"><input className="input" type="number" min="0" max="11" value={f.ageM} onChange={set('ageM')} placeholder="เดือน" /></Field>
            <Field label="น้ำหนัก (kg)"><input className="input" type="number" min="0" step="0.1" value={f.weight} onChange={set('weight')} placeholder="0.0" /></Field>
            <Field label="บริการ">
              <select className="select" value={f.type} onChange={set('type')}>
                {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="อาการเบื้องต้น (CC)">
              <input className="input" value={f.cc} onChange={set('cc')} placeholder="เช่น ซึม เบื่ออาหาร" />
            </Field>
          </div>
        </div>

      /* ─── โหมด: ลูกค้าเดิม ─── */
      ) : mode === 'old' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="ค้นหาลูกค้าเดิม (ชื่อสัตว์ / HN / ชื่อเจ้าของ / เบอร์โทร)">
            <input className="input" value={oldQuery} onChange={(e) => { setOldQuery(e.target.value); setPick(null); }} placeholder="เช่น เฮงเฮง หรือ 690012 หรือ 081-xxx" autoFocus={!prefillHn} />
          </Field>

          {pick ? (
            <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', borderColor: 'var(--navy)', borderWidth: 1.5 }}>
              <div className="pet-avatar" style={{ width: 46, height: 46, fontSize: 22 }}>{SPECIES_EMOJI[pick.species]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{pick.name} · HN {pick.hn}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{pick.species} {pick.breed} · {pick.owner.name} · {pick.owner.phone}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setPick(null)}>เปลี่ยน</button>
            </div>
          ) : ownerGroups.length > 0 ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              {ownerGroups.map((grp, gi) => (
                <div key={gi}>
                  {/* สัตว์แต่ละตัวของเจ้าของคนนี้ */}
                  {grp.pets.map((p) => (
                    <button key={p.hn} className="search-row" style={{ width: '100%', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)' }}
                      onClick={() => setPick(p)}>
                      <div className="pet-avatar" style={{ width: 38, height: 38, fontSize: 18 }}>{SPECIES_EMOJI[p.species]}</div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name} <span style={{ fontWeight: 500, color: 'var(--ink-faint)', fontSize: 12 }}>HN {p.hn}</span></div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.owner.name} · {p.owner.phone}</div>
                      </div>
                    </button>
                  ))}
                  {/* ปุ่มเพิ่มสัตว์ใหม่ให้เจ้าของคนนี้ */}
                  <button style={{ width: '100%', border: 'none', background: 'var(--butter-soft)', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', borderBottom: gi < ownerGroups.length - 1 ? '2px solid var(--line)' : 'none' }}
                    onClick={() => { setAddNewPet(true); setPickedOwner(grp.owner); setOldQuery(''); }}>
                    <span style={{ fontSize: 18 }}>🐾</span>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--butter-deep)' }}>+ เพิ่มสัตว์เลี้ยงตัวใหม่</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>เจ้าของ: {grp.owner.name} · {grp.owner.phone}</div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          ) : oldQuery.trim() ? (
            <div className="search-empty">ไม่พบ — ลองคำอื่น</div>
          ) : null}

          <div className="form-grid">
            <Field label="บริการ">
              <select className="select" value={f.type} onChange={set('type')}>
                {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="อาการเบื้องต้น (CC)">
              <input className="input" value={f.cc} onChange={set('cc')} placeholder="เช่น ซึม เบื่ออาหาร" />
            </Field>
          </div>
        </div>

      /* ─── โหมด: ลูกค้าใหม่ ─── */
      ) : (
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
              {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="อาการเบื้องต้น (CC)"><input className="input" value={f.cc} onChange={set('cc')} placeholder="อาการที่เจ้าของสังเกตได้..." /></Field>
        </div>
      )}
    </Modal>
  );
}

function QueueCard({ item, pet, onOpen, onOpenCase, onMove, onPay, onCancel, zoneBorder }) {
  const meta = STATUS_META[item.status];
  const total = (item.charges || []).reduce((s, [, q, p]) => s + q * p, 0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <div className={'q-card anim-pop ' + meta.tone}
    style={{ borderTop: 'none', borderLeft: `4px solid ${zoneBorder || meta.dot}`, cursor: 'pointer' }}
    onClick={() => onOpen(item)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="q-no">{item.q}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} />{item.time}</span>
      </div>
      <div className="q-pet"><span className="anim-wiggle">{SPECIES_EMOJI[item.species] || '🐾'}</span> {item.petName}
        {item.isNew ? <span className="chip chip-blush" style={{ fontSize: 11 }}>ลูกค้าใหม่</span> : null}
      </div>
      <div className="q-meta">
        <span className={'chip ' + (TYPE_CHIP[item.type] || '')}>{item.type}</span>
        {pet ? <span className="chip">HN {pet.hn}</span> : null}
      </div>
      {item.cc ? <div className="q-cc">{item.cc}</div> : null}
      <div className="q-actions" onClick={(e) => e.stopPropagation()}>
        {item.status === 'wait' ? (
          confirmCancel ? (
            <>
              <button className="btn btn-sm" style={{ flex: 1, fontSize: 12, background: 'var(--blush-soft)', color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)', fontWeight: 700 }}
                onClick={(e) => { e.stopPropagation(); onCancel && onCancel(item); }}>
                ✕ ยืนยันยกเลิก
              </button>
              <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setConfirmCancel(false); }}>
                ไม่ใช่
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onMove(item.q, 'exam'); onOpen({ ...item, status: 'exam' }); }}>
                <Icon name="stetho" size={15} /> เรียกตรวจ
              </button>
              <button className="btn btn-sm" title="ยกเลิกคิว" style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '4px 8px', flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); setConfirmCancel(true); }}>✕</button>
            </>
          )
        ) : null}
        {item.status === 'exam' ? (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <button className="btn btn-soft btn-sm" style={{ flex: 1 }} onClick={() => onOpenCase(item)}>
              <Icon name="edit" size={14} /> เปิดเคส / บันทึก
            </button>
            <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--ink-soft)', padding: '4px 7px', flexShrink: 0 }} title="ย้อนกลับรอตรวจ"
              onClick={() => onMove(item.q, 'wait')}>← รอตรวจ</button>
          </div>
        ) : null}
        {item.status === 'cashier' ? (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <button className="btn btn-blush btn-sm" style={{ flex: 1 }} onClick={() => onPay(item)}>
              <Icon name="cash" size={15} /> ชำระเงิน {total ? fmtB(total) : ''}
            </button>
            <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--ink-soft)', padding: '4px 7px', flexShrink: 0 }} title="ย้อนกลับกำลังตรวจ"
              onClick={() => onMove(item.q, 'exam')}>← ตรวจ</button>
          </div>
        ) : null}
        {item.status === 'done' ?
        <span style={{ fontSize: 12.5, color: 'var(--mint-deep)', fontWeight: 700, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <Icon name="check" size={14} /> ชำระแล้ว {item.paid ? fmtB(item.paid) : ''}
          </span> :
        null}
      </div>
    </div>);

}

// ── Admitted panel ──
function AdmittedPanel({ admitted, onUpdateAdmitted, onDischargeAdmitted, onOpenCase, onCancelAdmit }) {
  const [expanded, setExpanded] = useState(null);
  const [addingFor, setAddingFor] = useState(null);
  const [newRec, setNewRec] = useState({ note: '', charges: [{ name: '', qty: 1, price: '' }] });
  const [discharging, setDischarging] = useState(null);
  const [payMethod, setPayMethod] = useState('เงินสด');
  const today = todayISO();

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
                  {onCancelAdmit && (
                    <button title="ยกเลิกแอดมิด — กลับรอตรวจ"
                      style={{ background: 'none', border: '1px solid #D98880', borderRadius: 6, color: '#8C3028', fontSize: 11, padding: '2px 7px', cursor: 'pointer', flexShrink: 0, lineHeight: 1.4 }}
                      onClick={(e) => { e.stopPropagation(); if (confirm(`ยกเลิกแอดมิด "${adm.petName}" ?\nสัตว์จะกลับไปรอตรวจ`)) onCancelAdmit(adm.id); }}>
                      ยกเลิกแอดมิด
                    </button>
                  )}
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

// ── พื้นหลังแมวการ์ตูนเดินช้าๆ (จางมาก อยู่หลังเนื้อหา ไม่รบกวนการใช้งาน) ──
function CatDoodle() {
  return (
    <svg viewBox="0 0 58 42" width="48" height="35" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="currentColor">
        {/* หาง */}
        <path d="M9,28 q-8,-1 -6,-13 q1,-4 4,-3 q-3,3 -1,9 q1,6 5,5 z" />
        {/* ลำตัว */}
        <ellipse cx="26" cy="27" rx="17" ry="9" />
        {/* ขา */}
        <rect x="15" y="33" width="3.6" height="8" rx="1.8" />
        <rect x="23" y="34" width="3.6" height="7" rx="1.8" />
        <rect x="31" y="33" width="3.6" height="8" rx="1.8" />
        <rect x="39" y="34" width="3.6" height="7" rx="1.8" />
        {/* หัว */}
        <circle cx="45" cy="18" r="9.5" />
        {/* หู */}
        <path d="M38,12 l-1.5,-8 l7.5,4.5 z" />
        <path d="M49,11 l5.5,-6 l1,7.5 z" />
      </g>
    </svg>
  );
}
function BgCats() {
  return (
    <div className="bg-cats" aria-hidden="true">
      <div className="bg-cat bg-cat-1"><span className="bg-cat-bob"><CatDoodle /></span></div>
      <div className="bg-cat bg-cat-2"><span className="bg-cat-bob"><CatDoodle /></span></div>
      <div className="bg-cat bg-cat-3"><span className="bg-cat-bob"><CatDoodle /></span></div>
    </div>
  );
}

// ── แมวสีสันตัวเล็ก มีชีวิตชีวา เดิน/กระโดด/กลิ้ง เดินทั่วหน้าจอ ──
function CatColor({ body, belly, stripe, ear, eye, nose, patches, headPatches, earL, earR }) {
  return (
    <svg viewBox="0 0 64 50" width="42" height="33" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* หาง */}
      <path d="M12,33 C2,31 0,15 10,12 C13,11 14,15 12,16 C5,19 7,28 15,28 Z" fill={body} />
      <g stroke={stripe} strokeWidth="1.6" strokeLinecap="round" opacity=".85">
        <path d="M9,26 q-3,-4 -1,-8" fill="none" />
        <path d="M5,19 q0,-4 4,-6" fill="none" />
      </g>
      {/* ขาหลัง */}
      <rect x="15" y="37" width="4.5" height="10" rx="2.2" fill={body} />
      <rect x="22" y="38" width="4.5" height="9" rx="2.2" fill={body} />
      <rect x="15" y="44.5" width="4.5" height="3" rx="1.5" fill={belly} />
      <rect x="22" y="44.5" width="4.5" height="2.5" rx="1.2" fill={belly} />
      {/* ลำตัว */}
      <ellipse cx="29" cy="31" rx="18" ry="10.5" fill={body} />
      {/* แต้มสีบนลำตัว (แมวสามสี) */}
      {(patches || []).map((p, i) => <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />)}
      {/* พุงสีอ่อน */}
      <ellipse cx="31" cy="35" rx="13" ry="6" fill={belly} />
      {/* ขาหน้าหลัง */}
      <rect x="36" y="37" width="4.5" height="10" rx="2.2" fill={body} />
      <rect x="36" y="44.5" width="4.5" height="3" rx="1.5" fill={belly} />
      {/* ขาหน้าสุด — ขยับเขี่ยเล่นได้ (.cat-paw) */}
      <g className="cat-paw">
        <rect x="43" y="38" width="4.5" height="9" rx="2.2" fill={body} />
        <rect x="43" y="44.5" width="4.5" height="2.5" rx="1.2" fill={belly} />
      </g>
      {/* ลายทางบนตัว */}
      <g stroke={stripe} strokeWidth="2" strokeLinecap="round" opacity=".8">
        <path d="M24,23 q-1,3 -2.5,5" fill="none" />
        <path d="M30,22 q-1,3 -2.5,5.5" fill="none" />
        <path d="M36,23 q-1,3 -2.5,5" fill="none" />
      </g>
      {/* หัว */}
      <circle cx="49" cy="18.5" r="11.5" fill={body} />
      {/* แต้มสีบนหัว (แมวสามสี) */}
      {(headPatches || []).map((p, i) => <ellipse key={'h' + i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />)}
      {/* หู (ระบุสีแยกซ้าย/ขวาได้) */}
      <path d="M40,13 L37,2 L47,7 Z" fill={earL || body} />
      <path d="M51,7 L59,1 L60,13 Z" fill={earR || body} />
      <path d="M41,11 L39.5,4.5 L45,7.5 Z" fill={ear} />
      <path d="M52,8 L57,3.5 L57.8,11 Z" fill={ear} />
      {/* แก้ม/ปากสีอ่อน */}
      <ellipse cx="53" cy="23" rx="7" ry="5.2" fill={belly} />
      {/* คิ้ว/ลายเหนือตา */}
      <path d="M46.3,12.4 q3,-1.2 5.6,0.5" stroke={stripe} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".5" />
      {/* ตา (ใหญ่ ชัด ม่านตาแนวตั้งแบบแมว) */}
      <ellipse cx="49.6" cy="17.2" rx="3.5" ry="4.1" fill="#fff" />
      <circle cx="50" cy="17.7" r="2.7" fill={eye} />
      <ellipse cx="50" cy="17.7" rx="0.9" ry="2.3" fill="#222" />
      <circle cx="51.1" cy="16.3" r="0.8" fill="#fff" />
      {/* จมูก */}
      <path d="M56,20.4 L60.4,20.4 L58.2,23.2 Z" fill={nose} />
      {/* ปาก (ยิ้มแบบแมว) */}
      <g stroke="#7a6a5a" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity=".7">
        <path d="M58.2,23.2 L58.2,24.7" />
        <path d="M58.2,24.7 q-2,1.7 -3.8,0.4" />
        <path d="M58.2,24.7 q1.4,1.2 2.8,0.2" />
      </g>
      {/* หนวด */}
      <g stroke="#5b5b5b" strokeWidth="0.8" strokeLinecap="round" opacity=".5">
        <line x1="56" y1="22.3" x2="64" y2="20.5" />
        <line x1="56" y1="24" x2="64" y2="25.2" />
      </g>
    </svg>
  );
}
const CAT_GINGER = { body: '#F2A24E', belly: '#FCE7CE', stripe: '#D2761F', ear: '#F4A9B8', eye: '#5FB389', nose: '#E2738F' };
const CAT_GRAY = { body: '#9AA8BA', belly: '#ECF1F6', stripe: '#5E6C7E', ear: '#F4A9B8', eye: '#E6B24A', nose: '#E2738F' };
// แมวสามสี (calico): ขาว + ส้ม + ดำ พร้อมแต้มสีบนตัว/หัว และหูคนละสี
const CAT_CALICO = {
  body: '#F7F2EA', belly: '#FFFFFF', stripe: '#CD9258', ear: '#F4A9B8', eye: '#E0A53A', nose: '#E2738F',
  earL: '#ED9A4C', earR: '#46414C',
  patches: [
    { fill: '#ED9A4C', cx: 23, cy: 26, rx: 8.5, ry: 6 },
    { fill: '#46414C', cx: 37.5, cy: 29, rx: 6, ry: 4.6 },
  ],
  headPatches: [
    { fill: '#ED9A4C', cx: 44, cy: 11.5, rx: 5, ry: 4 },
  ],
};
// แมวขาวดำ (ทักซิโด้): ตัวดำ + อก/พุง/อุ้งเท้า/ปากขาว + แต้มดำบนหัว + ขีดขาวกลางหน้า
const CAT_TUXEDO = {
  body: '#2E2B33', belly: '#FFFFFF', stripe: '#1B1920', ear: '#F4A9B8', eye: '#7CC368', nose: '#E2738F',
  patches: [
    { fill: '#FFFFFF', cx: 41, cy: 35, rx: 7, ry: 4.5 },
  ],
  headPatches: [
    { fill: '#FFFFFF', cx: 47, cy: 22, rx: 3, ry: 5 },
  ],
};
// ── ลูกบอลให้แมวเล่น: กลิ้งทั่วจอ · แมว (หรือเมาส์) เข้าใกล้ = เขี่ย/เตะออก · สลับชนิดทุกชั่วโมง ──
const PLAY_BALLS = ['⚽', '🏀', '🏈', '🏐', '🧶', '🎾']; // บอล/บาส/รักบี้/วอลเลย์/ไหมพรม/เทนนิส
function PlayBall({ catsRef }) {
  const ballRef = useRef(null);
  const [idx, setIdx] = useState(() => new Date().getHours());
  useEffect(() => { // สลับลูกบอลตามชั่วโมง (เช็คทุกนาที)
    const id = setInterval(() => setIdx(new Date().getHours()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const R = 17; // รัศมีลูกบอล (px)
    const st = { x: window.innerWidth * 0.45, y: window.innerHeight * 0.5, vx: 3, vy: 2, rot: 0, cd: 0 };
    const mouse = { x: -999, y: -999, on: false };
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; };
    window.addEventListener('pointermove', onMove);
    const kickFrom = (px, py, power) => { // เตะบอลออกจากจุด (แมว/เมาส์) + แรงสุ่มนิดหน่อย
      const dx = st.x - px, dy = st.y - py, d = Math.hypot(dx, dy) || 1;
      st.vx = (dx / d) * power + (Math.random() - 0.5) * 2.5;
      st.vy = (dy / d) * power + (Math.random() - 0.5) * 2.5;
      st.cd = 18; // คูลดาวน์ กันเตะรัว
    };
    let raf;
    const step = () => {
      const W = window.innerWidth, H = window.innerHeight;
      st.vx *= 0.99; st.vy *= 0.99;                       // แรงเสียดทาน (กลิ้งไปเรื่อยๆ)
      const sp = Math.hypot(st.vx, st.vy);
      if (sp < 0.8) { const a = Math.random() * Math.PI * 2; st.vx += Math.cos(a) * 0.4; st.vy += Math.sin(a) * 0.4; } // ช้าลง → เดินเล่นเบาๆ
      else if (sp > 13) { st.vx *= 0.88; st.vy *= 0.88; } // จำกัดความเร็ว
      st.x += st.vx; st.y += st.vy;
      if (st.x < R) { st.x = R; st.vx = Math.abs(st.vx) * 0.9; }          // เด้งขอบจอ
      if (st.x > W - R) { st.x = W - R; st.vx = -Math.abs(st.vx) * 0.9; }
      if (st.y < R) { st.y = R; st.vy = Math.abs(st.vy) * 0.9; }
      if (st.y > H - R) { st.y = H - R; st.vy = -Math.abs(st.vy) * 0.9; }
      st.rot += st.vx * 3;                                // หมุนตามการกลิ้ง
      if (st.cd > 0) st.cd--;
      if (st.cd <= 0) {
        const cats = catsRef.current ? catsRef.current.querySelectorAll('.fg-cat') : [];
        cats.forEach((cat) => {
          const r = cat.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (Math.hypot(st.x - cx, st.y - cy) < 52) kickFrom(cx, cy, 8 + Math.random() * 4); // แมวใกล้ = เตะ
        });
        if (st.cd <= 0 && mouse.on && Math.hypot(st.x - mouse.x, st.y - mouse.y) < 42) kickFrom(mouse.x, mouse.y, 9); // เมาส์ใกล้ = เตะ
      }
      const el = ballRef.current;
      if (el) el.style.transform = `translate(${(st.x - R).toFixed(1)}px, ${(st.y - R).toFixed(1)}px) rotate(${st.rot.toFixed(0)}deg)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, []);
  return <div ref={ballRef} className="fg-ball" aria-hidden="true">{PLAY_BALLS[idx % PLAY_BALLS.length]}</div>;
}

function FgCats() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cats = Array.prototype.slice.call(root.querySelectorAll('.fg-cat'));
    const timers = new Map();
    const flee = (cat, px, py) => {
      const fl = cat.querySelector('.fg-flee');
      if (!fl) return;
      const r = cat.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = cx - px, dy = cy - py;
      let len = Math.hypot(dx, dy);
      if (len < 1) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); len = 1; } // กดกลางเป๊ะ → สุ่มทิศหนี
      const dist = 240; // วิ่งหนีไปทางตรงข้ามเมาส์
      dx = (dx / len) * dist; dy = (dy / len) * dist;
      fl.style.transition = 'transform .4s cubic-bezier(.2,.85,.3,1)';
      fl.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
      clearTimeout(timers.get(cat));
      timers.set(cat, setTimeout(() => {
        fl.style.transition = 'transform 1.5s ease';   // ค่อยๆ กลับเข้าเส้นทางเดิม
        fl.style.transform = 'translate(0,0)';
      }, 700));
    };
    const onEnter = (e) => flee(e.currentTarget, e.clientX, e.clientY);
    cats.forEach((c) => { c.addEventListener('pointerenter', onEnter); c.addEventListener('pointerdown', onEnter); });
    return () => {
      cats.forEach((c) => { c.removeEventListener('pointerenter', onEnter); c.removeEventListener('pointerdown', onEnter); });
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);
  return (
    <div className="fg-cats" aria-hidden="true" ref={ref}>
      <span className="fg-cat fg-cat-a"><span className="fg-flee"><span className="fg-act"><span className="fg-bob"><CatColor {...CAT_GINGER} /></span></span></span></span>
      <span className="fg-cat fg-cat-b"><span className="fg-flee"><span className="fg-act"><span className="fg-bob"><CatColor {...CAT_GRAY} /></span></span></span></span>
      <span className="fg-cat fg-cat-c"><span className="fg-flee"><span className="fg-act"><span className="fg-bob"><CatColor {...CAT_CALICO} /></span></span></span></span>
      <span className="fg-cat fg-cat-d"><span className="fg-flee"><span className="fg-act"><span className="fg-bob"><CatColor {...CAT_TUXEDO} /></span></span></span></span>
      <PlayBall catsRef={ref} />
    </div>
  );
}

function Dashboard({ pets, queue, appointments, admitted, receipts = [], loading = false, onOpenCase, onOpenPet, onMove, onPay, onWalkIn, onUpdateAppointment, onDischargeAdmitted, onUpdateAdmitted, onOpenAdmittedCase, onCancelQueue, onCancelAdmit, notePresets, onSavePresets, pushToast }) {
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInPrefillHn, setWalkInPrefillHn] = useState(null);
  const [walkInOwner, setWalkInOwner] = useState(null);   // เจ้าของที่กด "เพิ่มสัตว์ตัวใหม่ของบ้านนี้" จากผลค้นหา
  // วันที่ของแผงนัด (เลื่อนดูวันก่อน/ถัดไปได้ด้วยลูกศร) — เริ่มที่วันนี้
  const [apptDay, setApptDay] = useState(todayISO);
  const [editAppt, setEditAppt] = useState(null);   // นัดที่กำลังแก้ไข (ApptFormModal)
  const [smsAppt, setSmsAppt] = useState(null);     // นัดที่กำลังส่ง SMS (SmsComposerModal)
  const shiftApptDay = (delta) => {
    const [y, m, dd] = apptDay.split('-').map(Number);
    const d = new Date(y, m - 1, dd + delta); // คำนวณแบบ local ไม่ใช้ toISOString (กันวันเพี้ยนเพราะ timezone)
    setApptDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };
  const openWalkIn = (opts) => {
    if (opts && opts.newPetForOwner) {
      // มาจากผลค้นหา: เปิด walk-in เข้าโหมด "สัตว์ตัวใหม่ + เจ้าของเดิม" เลย ไม่ต้องค้นซ้ำ
      setWalkInPrefillHn(null); setWalkInOwner(opts.newPetForOwner);
    } else if (opts && opts.prefill && opts.existingHn) {
      setWalkInPrefillHn(opts.existingHn); setWalkInOwner(null);
    } else {
      setWalkInPrefillHn(null); setWalkInOwner(null);
    }
    setShowWalkIn(true);
  };
  const byStatus = (st) => {
    const today = todayISO();
    return queue.filter((x) => {
      if (x.status !== st) return false;
      // เสร็จแล้ว: แสดงเฉพาะวันนี้ เมื่อวานหายออก
      if (st === 'done') return !x.doneDate || x.doneDate === today;
      return true;
    });
  };
  const todayStr = todayISO();
  // รายรับวันนี้คิดจากใบเสร็จ OPD ของวันนี้ที่ยังไม่ถูกยกเลิก (ยกเลิกใบเสร็จแล้วยอดจะหายตามจริง)
  const revenue = (receipts || []).filter((r) => (r.type || 'opd') === 'opd' && r.date === todayStr).reduce((s, r) => s + (r.total || 0), 0);
  // นัดของวันที่เลือกในแผง (default = วันนี้)
  const dayAppts = (appointments || []).
  filter((a) => a.date === apptDay && a.status !== 'cancelled').
  sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // เป้าวันนี้ = ค่าเฉลี่ยรายรับต่อวันที่ผ่านมา (เฉพาะวันที่เปิดทำการ) — ถึง/เกินเป้าแล้วการ์ดเรืองทอง + ฉลอง
  // prevBest = ยอดวันที่ดีที่สุดที่ผ่านมา (ไม่รวมวันนี้) — วันนี้ทะลุ = สถิติใหม่ 🏆
  const { goalAvg, prevBest } = useMemo(() => {
    const byDay = {};
    (receipts || []).forEach((r) => { if ((r.type || 'opd') === 'opd' && r.date && r.date < todayStr) byDay[r.date] = (byDay[r.date] || 0) + (Number(r.total) || 0); });
    const vals = Object.values(byDay);
    const last30 = Object.keys(byDay).sort().slice(-30).map((d) => byDay[d]);
    return {
      goalAvg: last30.length ? Math.round(last30.reduce((a, b) => a + b, 0) / last30.length) : 0,
      prevBest: vals.length ? Math.max(...vals) : 0,
    };
  }, [receipts, todayStr]);
  const goalHit = goalAvg > 0 && revenue >= goalAvg;
  const isRecord = prevBest > 0 && revenue > prevBest;   // ทำลายสถิติเดิม
  const goalFired = useRef(false);
  const recordFired = useRef(false);
  useEffect(() => {
    // สถิติใหม่ = ฉลองใหญ่กว่า (ยิง 2 ระลอก) · ถึงเป้าเฉยๆ = ฉลองปกติ · ยิงครั้งเดียวจนกว่าจะหลุดแล้วกลับมา
    if (isRecord && !recordFired.current) {
      recordFired.current = true; goalFired.current = true;
      celebrate({ big: true }); setTimeout(() => celebrate({ big: true }), 550);
    } else if (goalHit && revenue > 0 && !goalFired.current) {
      goalFired.current = true; celebrate({ big: true });
    }
    if (!goalHit) goalFired.current = false;
    if (!isRecord) recordFired.current = false;
  }, [goalHit, isRecord, revenue]);

  const activeCount = byStatus('wait').length + byStatus('exam').length + byStatus('cashier').length;
  const nowHM = (typeof timeNow !== 'undefined' ? timeNow() : new Date().toTimeString().slice(0, 5));

  const stats = [
  { num: byStatus('wait').length, l: 'รอตรวจ', cls: 'tint-butter' },
  { num: byStatus('exam').length, l: 'กำลังตรวจ', cls: 'tint-powder' },
  { num: byStatus('cashier').length, l: 'รอชำระเงิน', cls: 'tint-blush' },
  { num: byStatus('done').length, l: 'เสร็จแล้ววันนี้', cls: 'tint-mint' },
  { num: revenue, fmt: fmtB, l: 'รายรับวันนี้ (OPD)', cls: 'tint-navy', goal: goalHit, record: isRecord,
    sub: isRecord ? `🏆 สถิติใหม่! (เดิม ${fmtB(prevBest)})` : goalAvg > 0 ? (goalHit ? '🎉 เกินค่าเฉลี่ย!' : `เป้า ~${fmtB(goalAvg)}`) : null }];


  if (loading) {
    return (
      <div className="dash-root">
        <div className="stats-row" style={{ marginBottom: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: 74 }}><div className="v">000</div><div className="l">loading</div></div>
          ))}
        </div>
        <div className="queue-board">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius)' }} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 18, color: 'var(--ink-faint)', fontSize: 13 }}>🐾 กำลังโหลดข้อมูลจากคลาวด์…</div>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <BgCats />
      <FgCats />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <GlobalSearch pets={pets} onOpenPet={onOpenPet} onWalkIn={openWalkIn} onDirectWalkIn={onWalkIn} />
        <button className="btn btn-primary btn-lg" onClick={() => openWalkIn({})} style={{ backgroundColor: "rgb(211, 109, 31)" }}>
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
              {apptDay === todayStr ? 'นัดวันนี้' : 'นัด'}
            </span>
            <span key={dayAppts.length} className="count-bounce" style={{ minWidth: 22, height: 22, borderRadius: 99, background: '#3A3F8F', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
              {dayAppts.length}
            </span>
          </div>
          {/* day navigator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
            <button className="btn btn-sm" style={{ padding: '2px 9px', fontSize: 15, lineHeight: 1 }} title="วันก่อนหน้า" onClick={() => shiftApptDay(-1)}>‹</button>
            <button onClick={() => setApptDay(todayStr)} title="กลับมาวันนี้" style={{ flex: 1, textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: apptDay === todayStr ? '#3A3F8F' : 'var(--ink-soft)' }}>
              {typeof dateTHShort !== 'undefined' ? dateTHShort(apptDay) : apptDay}{apptDay === todayStr ? ' · วันนี้' : ''}
            </button>
            <button className="btn btn-sm" style={{ padding: '2px 9px', fontSize: 15, lineHeight: 1 }} title="วันถัดไป" onClick={() => shiftApptDay(1)}>›</button>
          </div>
          <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 540, overflowY: 'auto' }}>
            {dayAppts.length === 0 ?
            <div className="queue-empty" style={{ background: 'transparent', border: '1.5px dashed #B0B8E0', fontSize: 12.5 }}>{apptDay === todayStr ? 'ไม่มีนัดวันนี้' : `ไม่มีนัดวันที่ ${typeof dateTHShort !== 'undefined' ? dateTHShort(apptDay) : apptDay}`}</div> :
            dayAppts.map((a) => {
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
                    {!arrived && apptDay === todayStr && a.time && a.time <= nowHM ? <span className="due-badge">⏰ ถึงเวลา</span> : null}
                    {typeof ApptSmsStatus !== 'undefined' ? <ApptSmsStatus a={a} past={apptDay < todayStr} onToggle={() => onUpdateAppointment && onUpdateAppointment({ ...a, smsAuto: a.smsAuto === false })} /> : null}
                  </div>
                  {a.note ? <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{a.note}</div> : null}
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
                  {/* ส่ง SMS + แก้ไขนัด — ลิงก์กับหน้านัดหมาย/OPD */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                    {typeof SmsComposerModal !== 'undefined' ? (
                      <button className="btn btn-sm" style={{ flex: 1, fontSize: 11.5,
                        ...(a.reminderSent ? { color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)', background: 'var(--mint-soft)', fontWeight: 700 } : {}) }}
                        onClick={() => setSmsAppt(a)}>
                        {a.reminderSent ? '✓ ส่งแล้ว' : '📱 ส่ง SMS'}
                      </button>
                    ) : null}
                    {typeof ApptFormModal !== 'undefined' ? (
                      <button className="btn btn-sm" style={{ flexShrink: 0, fontSize: 11.5 }} onClick={() => setEditAppt(a)} title="แก้ไขรายละเอียดนัด">
                        <Icon name="edit" size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>);

            })}
          </div>
        </div>
        <AdmittedPanel admitted={admitted} onUpdateAdmitted={onUpdateAdmitted || (() => {})} onDischargeAdmitted={onDischargeAdmitted} onOpenCase={onOpenAdmittedCase} onCancelAdmit={onCancelAdmit} />
        </div>

        {/* ── right: stats + queue board ── */}
        <div>
          <div className="stats-row" style={{ marginBottom: 14 }}>
            {stats.map((s, i) =>
            <div key={i} className={'stat-tile anim-pop ' + s.cls + (s.goal ? ' goal-hit' : '') + (s.record ? ' record-hit' : '')} style={{ '--i': i }}>
                {s.record ? <span className="goal-badge" title="วันนี้ทำลายสถิติรายรับสูงสุด! 🏆">🏆</span> : s.goal ? <span className="goal-badge" title="วันนี้ทำได้เกินค่าเฉลี่ย 🎉">🎉</span> : null}
                <div className="v"><CountUp value={s.num} format={s.fmt ? (n) => s.fmt(Math.round(n)) : undefined} /></div>
                <div className="l">{s.l}</div>
                {s.sub ? <div style={{ fontSize: 11.5, marginTop: 2, opacity: .8, fontWeight: 600 }}>{s.sub}</div> : null}
              </div>
            )}
          </div>

          {activeCount === 0 ? (
            <>
              <div className="sleep-corner left" aria-hidden="true" title="คิวว่าง — งีบก่อนนะ">
                <span className="cat">😴</span>
                <span className="zzz"><span>z</span><span>Z</span><span>Z</span></span>
              </div>
              <div className="sleep-corner right" aria-hidden="true" title="คิวว่าง — งีบก่อนนะ">
                <span className="zzz"><span>z</span><span>Z</span><span>Z</span></span>
                <span className="cat">😴</span>
              </div>
            </>
          ) : null}

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
                    onOpen={onOpenCase} onOpenCase={onOpenCase} onMove={onMove} onPay={onPay} onCancel={onCancelQueue} zoneBorder={meta.zoneBorder} />
                    )}
              </div>
            </div>);

            })}
        </div> {/* end queue-board */}
        </div> {/* end right column */}
      </div> {/* end outer grid */}

      {showWalkIn ?
      <WalkInModal pets={pets}
        prefillHn={walkInPrefillHn}
        prefillOwner={walkInOwner}
        onClose={() => { setShowWalkIn(false); setWalkInPrefillHn(null); setWalkInOwner(null); }}
        onSubmit={(payload) => { setShowWalkIn(false); setWalkInPrefillHn(null); setWalkInOwner(null); onWalkIn(payload); }} /> :
      null}

      {editAppt && typeof ApptFormModal !== 'undefined' ? (
        <ApptFormModal
          pets={pets}
          editAppt={editAppt}
          notePresets={notePresets} onSavePresets={onSavePresets}
          onClose={() => setEditAppt(null)}
          onSave={(appt) => { setEditAppt(null); onUpdateAppointment && onUpdateAppointment(appt); }} />
      ) : null}

      {smsAppt && typeof SmsComposerModal !== 'undefined' ? (
        <SmsComposerModal
          title={`ส่ง SMS เตือนนัด — ${smsAppt.petName}`}
          appt={smsAppt}
          notePresets={notePresets} onSavePresets={onSavePresets}
          initPhone={smsAppt.phone || ''}
          initMsg={typeof buildReminderMsg !== 'undefined' ? buildReminderMsg(smsAppt) : ''}
          onClose={() => setSmsAppt(null)}
          onSaveAppt={(d) => { onUpdateAppointment && onUpdateAppointment(d); }}
          onSend={(phone, msgList, draft, result) => {
            if (result && result.ok) {
              onUpdateAppointment && onUpdateAppointment({ ...(draft || smsAppt), reminderSent: true, reminderSentAt: todayISO(), reminderVia: 'manual' });
              pushToast && pushToast(`✅ ส่ง SMS สำเร็จ ${result.sent} ข้อความ`);
              setSmsAppt(null);
            } else {
              pushToast && pushToast(`❌ ส่งไม่สำเร็จ: ${(result && result.error) || 'ลองใหม่'}`);
            }
          }} />
      ) : null}
    </div>);

}

Object.assign(window, { Dashboard, STATUS_META });