// ── Case view: pet profile + today record + charges + history ──
var { useState, useEffect, useRef, useMemo } = React;

// ── Vet selector with inline "add" ──
function VetSelector({ vets, value, onChange, onAddVet }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const doAdd = () => {
    if (!name.trim()) return;
    onAddVet(name.trim()); onChange(name.trim());
    setAdding(false); setName('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {adding ? (
        <>
          <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') { setAdding(false); setName(''); } }} placeholder="ชื่อสัตวแพทย์ใหม่..." style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={doAdd} disabled={!name.trim()}>เพิ่ม</button>
          <button className="btn btn-sm" onClick={() => { setAdding(false); setName(''); }}>ยกเลิก</button>
        </>
      ) : (
        <>
          <select className="select" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
            {vets.map((v) => <option key={v}>{v}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setAdding(true)} title="เพิ่มสัตวแพทย์"><Icon name="plus" size={14} /> เพิ่มหมอ</button>
        </>
      )}
    </div>
  );
}

// ── Media upload ──
function MediaUpload({ media, onChange }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const handleFiles = async (files) => {
    const picked = [...files].slice(0, 10 - media.length);
    const toAdd = [];
    for (const f of picked) {
      if (f.type.startsWith('video')) {
        // วิดีโอใหญ่เกินกว่าจะเก็บใน localStorage — ดูได้เฉพาะเซสชันนี้
        toAdd.push({ type: 'video', url: URL.createObjectURL(f), name: f.name, session: true });
      } else {
        try { toAdd.push({ type: 'image', url: await imageToDataURL(f, 900, 0.72), name: f.name }); }
        catch (e) { toAdd.push({ type: 'image', url: URL.createObjectURL(f), name: f.name, session: true }); }
      }
    }
    onChange([...media, ...toAdd]);
  };
  return (
    <div>
      <div className={'media-drop' + (drag ? ' dragging' : '')} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
        <Icon name="camera" size={26} style={{ opacity: .4 }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>แตะหรือลากไฟล์มาวางตรงนี้</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>รูปภาพ / วิดีโอ · สูงสุด 10 ไฟล์</div>
      </div>
      {media.length > 0 && (
        <div className="media-grid">
          {media.map((m, i) => (
            <div key={i} className="media-thumb">
              {m.type === 'video' ? <video src={m.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <img src={m.url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              <button className="media-del" onClick={(e) => { e.stopPropagation(); onChange(media.filter((_, j) => j !== i)); }}>×</button>
              <div className="media-label">{m.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SVC_CATS = ['บริการ','ยา','เวชภัณฑ์','อาหาร','ของใช้','แล็บ','วัคซีน','ผ่าตัด','ทั่วไป'];

// ── Service Manager Modal ──
function ServiceManagerModal({ services, stock, onAdd, onSaveService, onDeleteService, onUpdateService, onClose }) {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('ทั้งหมด');
  const [newItem, setNewItem] = useState({ name: '', cat: 'บริการ', price: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const all = useMemo(() => [
    ...services.map((s) => ({ ...s, kind: 'svc', emoji: s.emoji || '💼' })),
    ...stock.map((s) => ({ ...s, kind: 'stk', emoji: s.emoji || '📦' })),
  ], [services, stock]);
  const categories = useMemo(() => {
    const cats = new Set(all.map(s => s.cat));
    return ['ทั้งหมด', ...Array.from(cats).sort()];
  }, [all]);
  const filtered = all.filter((s) => {
    const matchCat = catFilter === 'ทั้งหมด' || s.cat === catFilter;
    const matchQ = !q || s.name.toLowerCase().includes(q.toLowerCase());
    return matchCat && matchQ;
  });
  return (
    <Modal title="📋 จัดการรายการ" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารายการ..." autoFocus />
        <div className="seg" style={{ width: '100%', justifyContent: 'flex-start', overflowX: 'auto', gap: 2, padding: '2px' }}>
          {categories.map((c) => (
            <button key={c} className="btn btn-sm" style={{ fontSize: 12, whiteSpace: 'nowrap', background: catFilter === c ? 'var(--navy)' : 'transparent', color: catFilter === c ? '#fff' : 'var(--ink-soft)', border: 'none', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setCatFilter(c)}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
          <table className="tbl">
            <thead><tr><th>รายการ</th><th>หมวด</th><th className="num">ราคา</th><th style={{ width: 90 }}>ข้อมูล</th><th style={{ width: 160 }}></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 20 }}>ไม่พบรายการ</td></tr>
              ) : filtered.map((s) => {
                if (editId === s.id) {
                  return (
                    <tr key={s.id} style={{ background: 'var(--powder-soft, #f0f4ff)' }}>
                      <td><input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ fontSize: 13, padding: '4px 8px' }} /></td>
                      <td>
                        <select className="select" value={editForm.cat} onChange={(e) => setEditForm({ ...editForm, cat: e.target.value })} style={{ fontSize: 12, padding: '4px 6px' }}>
                          {SVC_CATS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="num"><input className="input" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} style={{ width: 72, fontSize: 13, padding: '4px 8px', textAlign: 'right' }} /></td>
                      <td></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 12 }}
                            onClick={() => {
                              if (!editForm.name.trim()) return;
                              onUpdateService && onUpdateService({ ...s, name: editForm.name.trim(), price: parseFloat(editForm.price) || 0, cat: editForm.cat });
                              setEditId(null);
                            }}>บันทึก</button>
                          <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => setEditId(null)}>ยกเลิก</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={s.id} style={{ background: s.kind === 'stk' ? 'var(--paper)' : 'transparent' }}>
                    <td><span style={{ marginRight: 7 }}>{s.emoji || '📦'}</span><b>{s.name}</b></td>
                    <td><span className="chip" style={{ fontSize: 11 }}>{s.cat}</span></td>
                    <td className="num" style={{ fontWeight: 700, color: 'var(--mint-deep)' }}>{fmtB(s.price)}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                      {s.kind === 'stk' ? <>คงเหลือ {s.qty} {s.unit}</> : <>💼 บริการ</>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 12 }} onClick={() => { onAdd(s); }}>+ เพิ่ม</button>
                        {s.kind === 'svc' && (
                          confirmDeleteId === s.id ? (
                            <>
                              <button className="btn btn-sm" style={{ fontSize: 11, background: 'var(--blush-soft)', color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)', fontWeight: 700 }}
                                onClick={() => { onDeleteService && onDeleteService(s.id); setConfirmDeleteId(null); }}>ลบ?</button>
                              <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmDeleteId(null)}>ไม่</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-sm" style={{ fontSize: 13, padding: '3px 7px' }} title="แก้ไข"
                                onClick={() => { setEditId(s.id); setEditForm({ name: s.name, cat: s.cat || 'บริการ', price: String(s.price) }); setConfirmDeleteId(null); }}>✏️</button>
                              <button className="btn btn-sm" style={{ fontSize: 13, padding: '3px 7px', color: 'var(--blush-deep)' }} title="ลบ"
                                onClick={() => { setConfirmDeleteId(s.id); setEditId(null); }}>🗑</button>
                            </>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: '2px solid var(--line)', paddingTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--ink-soft)' }}>+ เพิ่มรายการใหม่</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>ชื่อรายการ</label>
              <input className="input" placeholder="เช่น ตรวจเลือด" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            </div>
            <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>หมวด</label>
              <select className="select" value={newItem.cat} onChange={(e) => setNewItem({ ...newItem, cat: e.target.value })}>
                {SVC_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ width: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>ราคา (฿)</label>
              <input className="input" type="number" placeholder="0" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
            </div>
            <button className="btn btn-primary" disabled={!newItem.name.trim() || !newItem.price}
              onClick={() => {
                const item = { id: 'svc_' + Date.now(), name: newItem.name.trim(), price: parseFloat(newItem.price) || 0, cat: newItem.cat, emoji: '💼', kind: 'svc' };
                onAdd(item);
                onSaveService && onSaveService(item);
                setNewItem({ name: '', cat: 'บริการ', price: '' });
              }}>
              เพิ่ม
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ChargePicker({ services, stock, onAdd }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const svc = services.filter((x) => !s || x.name.toLowerCase().includes(s)).map((x) => ({ ...x, kind: 'svc' }));
    const stk = stock.filter((x) => !s || x.name.toLowerCase().includes(s)).map((x) => ({ ...x, kind: 'stock' }));
    return [...svc, ...stk].slice(0, 9);
  }, [q, services, stock]);
  return (
    <div className="search-wrap" style={{ maxWidth: 'none' }} ref={ref}>
      <Icon name="search" size={16} />
      <input className="search-input" placeholder="ค้นหายา บริการ หรือสินค้า..." value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', marginTop: 6, zIndex: 10, maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
          {results.length === 0 ? <div style={{ padding: 10, fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center' }}>ไม่พบ</div> : results.map((x) => (
            <button key={x.id} className="search-result" onClick={() => { onAdd(x); setQ(''); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line)', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>{x.emoji || (x.kind === 'svc' ? '💼' : '📦')}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{x.name}</div><div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{x.cat}</div></div>
              <div style={{ fontWeight: 700, color: 'var(--mint-deep)', textAlign: 'right' }}>{fmtB(x.price)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseView({ pet, queueItem, vets, services, stock, allPets, onBack, onFinish, onAddVet, onAddAdmitted, onUpdateAdmitted, onDischargeAdmitted, pushToast, onUpdatePet, onAddService, onDeleteService, onUpdateService, onSaveDraft, previewReceiptNo }) {
  const latestWeight = pet.visits.length ? pet.visits[0].weight : pet.weight;
  const draft = queueItem?.draft;
  const [rec, setRec] = useState({
    cc: draft?.cc ?? ((queueItem && queueItem.cc) || ''),
    pe: draft?.pe ?? '',
    dx: draft?.dx ?? '',
    plan: draft?.plan ?? '',
    vet: draft?.vet ?? vets[0],
    weight: draft?.weight ?? (latestWeight || ''),
  });
  const [petAvatar, setPetAvatar] = useState(pet.avatar || null);
  const avatarRef = useRef(null);
  const [media, setMedia] = useState(draft?.media || []);
  const [showOwnerPets, setShowOwnerPets] = useState(false);
  const ownerPets = useMemo(() => (allPets || []).filter((p) => p.owner.phone === pet.owner.phone), [allPets, pet.owner.phone]);
  // charge = [ชื่อ, จำนวน, ราคา/หน่วย, stockId?] — stockId ไว้ตัดสต็อก + ปริ้นฉลากยา
  const [charges, setCharges] = useState(
    (draft?.charges || (queueItem && queueItem.charges) || []).map((c) =>
      Array.isArray(c) ? [c[0] || '', Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null]
        : [String(c.name || ''), Number(c.qty) || 1, Number(c.price) || 0, c.stockId || null]
    )
  );
  const [labelFor, setLabelFor] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [editPetInfo, setEditPetInfo] = useState(null);
  const [editVisit, setEditVisit] = useState(null);
  const [showVaccineHistory, setShowVaccineHistory] = useState(false);
  const [showServiceMgr, setShowServiceMgr] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [expandedVisits, setExpandedVisits] = useState({ 0: true });
  const setR = (k) => (e) => setRec({ ...rec, [k]: e.target.value });
  const isEditMode = queueItem && (queueItem.status === 'cashier' || queueItem.status === 'done');
  const isAdmittedMode = queueItem?.status === 'admitted';
  const saveAdmittedRecord = () => {
    if (!onUpdateAdmitted) return;
    const today = new Date().toISOString().slice(0, 10);
    const dailyRec = { date: today, vet: rec.vet, weight: rec.weight, cc: rec.cc, pe: rec.pe, dx: rec.dx, plan: rec.plan, media: media.filter((m) => !m.session), charges: charges.map((c) => [c[0], c[1], c[2], c[3] || null]) };
    onUpdateAdmitted(queueItem.id, { ...queueItem, dailyRecords: [...(queueItem.dailyRecords || []), dailyRec] });
    pushToast && pushToast(`บันทึกการรักษา ${pet.name} (${today}) เรียบร้อย`);
    onBack();
  };
  // ใบเสร็จตอนจำหน่าย = รายการสะสมทุกวัน + รายการที่คีย์ค้างอยู่วันนี้ (ยังไม่กดบันทึก)
  const pendingCharges = charges.filter((c) => String(c[0] || '').trim());
  const admittedItems = isAdmittedMode ? [
    ...((queueItem.dailyRecords || []).flatMap((r) => (r.charges || []).map((c) => ({ name: `${c[0]} (${r.date})`, qty: Number(c[1]) || 1, price: Number(c[2]) || 0 })))),
    ...pendingCharges.map((c) => ({ name: c[0], qty: Number(c[1]) || 1, price: Number(c[2]) || 0 })),
  ] : null;
  const dischargeAdmitted = (method) => {
    const extraRec = pendingCharges.length > 0
      ? { date: todayISO(), vet: rec.vet, weight: rec.weight, cc: rec.cc, pe: rec.pe, dx: rec.dx, plan: rec.plan, media: media.filter((m) => !m.session), charges: pendingCharges.map((c) => [c[0], c[1], c[2], c[3] || null]) }
      : null;
    onDischargeAdmitted && onDischargeAdmitted(queueItem.id, method, extraRec);
    setShowReceipt(false);
    onBack();
  };
  const patchCharge = (i, k, v) => setCharges((prev) => prev.map((x, ix) => {
    if (ix !== i) return x;
    const a = [x[0], x[1], x[2], x[3]]; a[k] = v; return a;
  }));
  const total = charges.reduce((s, c) => s + c[1] * c[2], 0);
  // ประวัติเรียงล่าสุดบนสุด → บันทึกใหม่ใส่หน้าสุดของ visits
  const buildVisit = () => ({
    date: todayISO(), vet: rec.vet, cc: rec.cc, pe: rec.pe, dx: rec.dx, plan: rec.plan,
    weight: parseFloat(rec.weight) || latestWeight, items: charges,
    media: media.filter((m) => !m.session),
  });
  const save = (status, method) => {
    onFinish && onFinish({ ...pet, visits: [buildVisit(), ...pet.visits] }, queueItem, status, method);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={onBack}><Icon name="arrowL" size={17} /> กลับหน้าคิว</button>
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>🐾 {pet.name} ({pet.species} {pet.breed})</h1>
      </div>

      <div className="case-grid">
        {/* ── left: pet info ── */}
        <div>
          <div className="card">
            <div className="card-head" style={{ background: 'var(--mint-soft)', borderBottom: '2.5px solid var(--mint-deep)' }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--mint-deep)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--mint-deep)', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="info" size={16} /></span>
                ข้อมูลสัตว์เลี้ยง
              </span>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ── Pet name highlight ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--mint-soft)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--mint-deep)' }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>{SPECIES_EMOJI[pet.species] || '🐾'}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.1 }}>{pet.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{pet.species} · {pet.breed}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', width: 100, height: 100, borderRadius: 'var(--radius)', overflow: 'hidden', border: '2px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} onClick={() => avatarRef.current?.click()}>
                  {petAvatar ? (
                    <img src={petAvatar} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 40, textAlign: 'center' }}>{SPECIES_EMOJI[pet.species] || '🐾'}</div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, flex: 1 }}>
                  <div><span style={{ color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>เลขที่</span><div style={{ fontWeight: 700 }}>{pet.hn}</div></div>
                  <div><span style={{ color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>เพศ</span><div style={{ fontWeight: 700 }}>{pet.sex}</div></div>
                  <div><span style={{ color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>อายุ</span><div style={{ fontWeight: 700 }}>{pet.birth ? calcAge(pet.birth) : '—'}</div></div>
                  <div><span style={{ color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>สี/ตำหนิ</span><div style={{ fontWeight: 700 }}>{pet.color || '—'}</div></div>
                </div>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files[0]; if (f) { try { const url = await imageToDataURL(f, 260, 0.78); setPetAvatar(url); onUpdatePet && onUpdatePet({ ...pet, avatar: url }); } catch (err) { pushToast && pushToast('อ่านไฟล์รูปไม่สำเร็จ'); } } }} />
              <button className="btn btn-sm" onClick={() => setEditPetInfo({ kind: 'pet', name: pet.name, breed: pet.breed || '', sex: pet.sex || 'ผู้', sterilized: String(!!pet.sterilized), color: pet.color || '', birth: pet.birth || '' })}><Icon name="edit" size={14} /> แก้ไข</button>
            </div>
          </div>

          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 8 }}>เจ้าของ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="user" size={15} style={{ color: 'var(--ink-faint)' }} /> {pet.owner.name}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="phone" size={15} style={{ color: 'var(--ink-faint)' }} /> {pet.owner.phone}</span>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start', fontSize: 12, color: 'var(--navy)' }} onClick={() => setShowOwnerPets(true)}>
                🐾 สัตว์เลี้ยงทั้งหมด ({ownerPets.length} ตัว)
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button className="btn btn-sm" onClick={() => setEditPetInfo({ kind: 'owner', ownerName: pet.owner.name, phone: pet.owner.phone || '' })}><Icon name="edit" size={14} /> แก้ไข</button>
              <button className="btn btn-sm" style={{ color: 'var(--blush-deep)', fontSize: 12 }} onClick={() => setShowVaccineHistory(!showVaccineHistory)}><Icon name="syringe" size={14} /> ประวัติวัคซีน</button>
            </div>
          </div>
        </div>

        {/* ── center: record + charges ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-head" style={{ background: 'var(--powder-soft)', borderBottom: '2.5px solid var(--powder-deep)', padding: '12px 16px' }}>
              <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--powder-deep)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--powder-deep)', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="stetho" size={17} /></span>
                บันทึกการตรวจวันนี้
              </span>
              <span className="chip chip-powder" style={{ fontWeight: 700 }}>{todayTH()}</span>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div className="form-grid">
                <Field label="สัตวแพทย์ผู้ตรวจ">
                  <VetSelector vets={vets} value={rec.vet} onChange={(v) => setRec({ ...rec, vet: v })} onAddVet={onAddVet || (() => {})} />
                </Field>
                <Field label="น้ำหนักวันนี้ (kg)">
                  <input className="input" type="number" step="0.1" value={rec.weight} onChange={setR('weight')} />
                </Field>
              </div>
              <Field label="อาการสำคัญ (CC)"><textarea className="textarea" rows="2" value={rec.cc} onChange={setR('cc')} placeholder="อาการที่เจ้าของพามา..." /></Field>
              <Field label="ผลการตรวจร่างกาย (PE)"><textarea className="textarea" rows="2" value={rec.pe} onChange={setR('pe')} placeholder="T, P, R, ผลตรวจตามระบบ..." /></Field>
              <div className="form-grid">
                <Field label="การวินิจฉัย (Dx)"><textarea className="textarea" rows="2" value={rec.dx} onChange={setR('dx')} placeholder="โรค / ภาวะที่สงสัย..." /></Field>
                <Field label="แผนการรักษา / นัดครั้งถัดไป"><textarea className="textarea" rows="2" value={rec.plan} onChange={setR('plan')} placeholder="เช่น กินยา 7 วัน นัดดูอาการ..." /></Field>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ background: 'var(--blush-soft)', borderBottom: '2.5px solid var(--blush-deep)' }}>
              <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--blush-deep)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--blush-deep)', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="cash" size={17} /></span>
                บันทึกรายการ / บริการ
              </span>
              <span className="chip chip-blush" style={{ fontWeight: 700 }}>{charges.length} รายการ</span>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <ChargePicker services={services} stock={stock} onAdd={(item) => setCharges((prev) => [...prev, [item.name, 1, item.price, item.kind === 'stock' || item.kind === 'stk' ? item.id : null]])} />
              {/* charges table */}
              {charges.length > 0 && (
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '5px 8px 5px 0', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>รายการ</th>
                        <th style={{ textAlign: 'center', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', width: 90 }}>จำนวน</th>
                        <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', width: 100 }}>ราคา/หน่วย</th>
                        <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', width: 80 }}>รวม</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '6px 8px 6px 0' }}>
                            <input className="input" value={c[0]}
                              onChange={(e) => patchCharge(i, 0, e.target.value)}
                              style={{ fontSize: 13, padding: '4px 8px' }} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <div className="qty-stepper" style={{ width: 76, margin: '0 auto' }}>
                              <button onClick={() => patchCharge(i, 1, Math.max(1, c[1] - 1))} disabled={c[1] <= 1}>−</button>
                              <span className="qv" style={{ minWidth: 26 }}>{c[1]}</span>
                              <button onClick={() => patchCharge(i, 1, c[1] + 1)}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <input className="input" type="number" value={c[2]}
                              onChange={(e) => patchCharge(i, 2, parseFloat(e.target.value) || 0)}
                              style={{ fontSize: 13, padding: '4px 6px', textAlign: 'right', width: 90 }} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--navy)', fontSize: 14.5, whiteSpace: 'nowrap' }}>
                            {fmtB(c[1] * c[2])}
                          </td>
                          <td style={{ padding: '6px 0', whiteSpace: 'nowrap' }}>
                            {(() => {
                              const stk = c[3] ? stock.find((s) => s.id === c[3]) : null;
                              return stk && stk.dose ? (
                                <button className="btn btn-icon" title="พิมพ์ฉลากยา"
                                  onClick={() => setLabelFor({ ...stk, qty: c[1] })}
                                  style={{ color: 'var(--powder-deep)', fontSize: 15, lineHeight: 1 }}>🏷</button>
                              ) : null;
                            })()}
                            <button className="btn btn-icon" onClick={() => setCharges((prev) => prev.filter((_, j) => j !== i))}
                              style={{ color: 'var(--blush-deep)', fontSize: 19, lineHeight: 1 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={() => setCharges((prev) => [...prev, ['', 1, 0, null]])}>
                  + เพิ่มรายการ
                </button>
                <button className="btn btn-sm" onClick={() => setShowServiceMgr(true)}>
                  📋 จัดการรายการ
                </button>
                {charges.length > 0 && (
                  <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 16.5, color: 'var(--navy)' }}>
                    ยอดรวม <b style={{ fontSize: 20 }}>{fmtB(total)}</b>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── media card ── */}
          <div className="card">
            <div className="card-head" style={{ background: '#F6F0FA', borderBottom: '2px solid #C9B8E8' }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: '#6A4FA0', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#6A4FA0', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={16} /></span>
                รูปภาพ / วิดีโอประกอบเคส
              </span>
              <span style={{ fontSize: 12, color: '#9E8ABF' }}>รูปบันทึกลงประวัติ · วิดีโอดูได้เฉพาะวันนี้</span>
            </div>
            <div className="card-pad">
              <MediaUpload media={media} onChange={setMedia} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-lg" onClick={() => {
              if (queueItem?.q && onSaveDraft) {
                onSaveDraft(queueItem.q, { cc: rec.cc, pe: rec.pe, dx: rec.dx, plan: rec.plan, vet: rec.vet, weight: rec.weight, charges, media: media.filter((m) => !m.session) });
              }
              onBack();
            }}>เก็บไว้ก่อน</button>
            {isAdmittedMode ? (
              <>
                <button className="btn btn-primary btn-lg" onClick={saveAdmittedRecord}><Icon name="check" size={17} /> บันทึกการรักษาวันนี้</button>
                <button className="btn btn-lg" style={{ color: '#A05A00', borderColor: '#E6A040', background: '#FFF3E0' }} onClick={() => setShowReceipt(true)}><Icon name="cash" size={17} /> คิดค่าใช้จ่าย + จำหน่าย</button>
              </>
            ) : (
              <>
                {onAddAdmitted ? (
                  <button className="btn btn-lg" style={{ color: '#7A3D35', borderColor: '#C0685C', background: '#FCF0E8' }} onClick={() => onAddAdmitted(pet.hn, 'กำลังรักษา', rec.dx || rec.cc, queueItem?.q)}><Icon name="heart" size={17} /> เข้าแอดมิด</button>
                ) : null}
                {!isEditMode ? (
                  <button className="btn btn-soft btn-lg" style={{ color: 'var(--powder-deep)', borderColor: 'var(--powder-deep)' }} onClick={() => setShowApptForm(true)}><Icon name="clock" size={17} /> นัดครั้งถัดไป</button>
                ) : null}
                {!isEditMode ? (
                  <button className="btn btn-soft btn-lg" onClick={() => save('cashier')}><Icon name="cash" size={17} /> บันทึก + ส่งแคชเชียร์</button>
                ) : null}
                <button className="btn btn-primary btn-lg" onClick={() => { charges.length > 0 ? setShowReceipt(true) : save('paid', ''); }}>
                  <Icon name="printer" size={17} />
                  {isEditMode ? 'ออกใบเสร็จใหม่' : charges.length === 0 ? 'ปิดเคส (ไม่มีค่าใช้จ่าย)' : 'ชำระเงิน + ใบเสร็จ'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── right: history ── */}
        <div className="card case-right">
          <div className="card-head" style={{ background: 'var(--butter-soft)', borderBottom: '2px solid #E5C97E' }}>
            <span style={{ fontWeight: 800, fontSize: 14.5, color: '#7A5E00', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#A87B2F', color: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="doc" size={16} /></span>
              ประวัติการรักษา
            </span>
            <span className="chip chip-butter">{pet.visits.length} ครั้ง</span>
          </div>
          <div className="card-pad" style={{ paddingTop: 8, maxHeight: 620, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pet.visits.length === 0 ? <div className="queue-empty">ยังไม่มีประวัติ</div> :
              [...pet.visits].map((v, i) => {
                const isExpanded = expandedVisits[i] ?? (i === 0);
                const vTotal = v.items.reduce((s, [, q, p]) => s + q * p, 0);
                const isFirst = i === pet.visits.length - 1;
                return (
                  <div key={i} style={{ borderLeft: '3px solid #E5C97E', paddingLeft: 13, position: 'relative' }}>
                    {isFirst && <span className="chip chip-butter" style={{ position: 'absolute', top: -8, left: -12, fontSize: 11 }}>ครั้งแรก</span>}
                    <button onClick={() => setExpandedVisits((prev) => ({ ...prev, [i]: !isExpanded }))}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 6 : 3 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#7A5E00' }}>{dateTH(v.date)}</div>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'inline-block', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                    </button>
                    {!isExpanded && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.cc || v.dx || '—'}
                      </div>
                    )}
                    {isExpanded && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5, marginBottom: 8 }}>
                          <div><span style={{ color: 'var(--ink-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>CC</span><div>{v.cc}</div></div>
                          <div><span style={{ color: 'var(--ink-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Dx</span><div>{v.dx}</div></div>
                        </div>
                        {v.items.length > 0 && (
                          <div>
                            <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', marginBottom: 8 }}>
                              <tbody>
                                {v.items.map((it, j) => (
                                  <tr key={j} style={{ borderBottom: j < v.items.length - 1 ? '1px solid #E8E0F5' : 'none' }}>
                                    <td style={{ padding: '4px 0', fontWeight: 600 }}>{it[0]}</td>
                                    <td style={{ padding: '4px 6px 4px 0', textAlign: 'right', color: 'var(--ink-faint)' }}>x{it[1]}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700 }}>{fmtB(it[1] * it[2])}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #E8E0F5', fontSize: 12.5, fontWeight: 700 }}>
                              <span>รวม</span> <span>{fmtB(vTotal)}</span>
                            </div>
                          </div>
                        )}
                        {v.media && v.media.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                            {v.media.map((m, j) => (
                              <div key={j} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--paper)', aspectRatio: '1', border: '1px solid var(--line)', cursor: m.type !== 'video' ? 'zoom-in' : 'default' }}
                                onClick={() => m.type !== 'video' && setLightbox({ url: m.url, name: m.name })}>
                                {m.type === 'video'
                                  ? <video src={m.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  : <img src={m.url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Icon name="user" size={13} /> {v.vet}
                        </div>
                        <button className="btn btn-sm" onClick={() => setEditVisit({ date: v.date, weight: v.weight, cc: v.cc, pe: v.pe, dx: v.dx, plan: v.plan, media: v.media || [], _orig: v })} style={{ marginTop: 8 }}><Icon name="edit" size={13} /> แก้ไข</button>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {isEditMode ? (
        <div style={{ padding: '10px 14px', background: '#FFF8E0', border: '1.5px solid #E5C97E', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#7A5E00', display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Icon name="alert" size={15} /> กำลังแก้ไขเคสที่{queueItem.status === 'done' ? 'ชำระแล้ว' : 'รอชำระ'} — บันทึกจะอัปเดตรายการและออกใบเสร็จใหม่
        </div>
      ) : null}

      {labelFor ? <LabelModal drug={labelFor} pet={{ ...pet, weight: rec.weight }} onClose={() => setLabelFor(null)} /> : null}
      {editVisit ? (
        <Modal title="แก้ไขประวัติการรักษา" onClose={() => setEditVisit(null)} footer={<>
          <button className="btn" onClick={() => setEditVisit(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => {
            const { _orig, ...patch } = editVisit;
            const visits = pet.visits.map((x) => x === _orig ? { ..._orig, ...patch, weight: parseFloat(patch.weight) || _orig.weight } : x);
            onUpdatePet && onUpdatePet({ ...pet, visits });
            setEditVisit(null); pushToast && pushToast('บันทึกประวัติแล้ว');
          }}>บันทึก</button>
        </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 13 }}>
              <Field label="วันที่"><input className="input" type="date" value={editVisit.date || ''} onChange={(e) => setEditVisit({ ...editVisit, date: e.target.value })} /></Field>
              <Field label="น้ำหนัก (kg)"><input className="input" type="number" value={editVisit.weight ?? ''} step="0.1" onChange={(e) => setEditVisit({ ...editVisit, weight: e.target.value })} /></Field>
              <Field label="อาการสำคัญ (CC)" style={{ gridColumn: '1/-1' }}><textarea className="textarea" rows="2" value={editVisit.cc || ''} onChange={(e) => setEditVisit({ ...editVisit, cc: e.target.value })} placeholder="อาการที่เจ้าของบอก..." /></Field>
              <Field label="ผลการตรวจร่างกาย (PE)" style={{ gridColumn: '1/-1' }}><textarea className="textarea" rows="2" value={editVisit.pe || ''} onChange={(e) => setEditVisit({ ...editVisit, pe: e.target.value })} placeholder="T, P, R, ผลตรวจ..." /></Field>
              <Field label="การวินิจฉัย (Dx)" style={{ gridColumn: '1/-1' }}><textarea className="textarea" rows="2" value={editVisit.dx || ''} onChange={(e) => setEditVisit({ ...editVisit, dx: e.target.value })} placeholder="การวินิจฉัย..." /></Field>
              <Field label="แผนการรักษา (Plan)" style={{ gridColumn: '1/-1' }}><textarea className="textarea" rows="2" value={editVisit.plan || ''} onChange={(e) => setEditVisit({ ...editVisit, plan: e.target.value })} placeholder="ขั้นตอนการรักษา..." /></Field>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>📷 รูปภาพ / วิดีโอ</div>
              <MediaUpload media={editVisit.media || []} onChange={(m) => setEditVisit({ ...editVisit, media: m })} />
            </div>
          </div>
        </Modal>
      ) : null}
      {editPetInfo ? (
        <Modal title={editPetInfo.kind === 'pet' ? 'แก้ไขข้อมูลสัตว์เลี้ยง' : 'แก้ไขข้อมูลเจ้าของ'} onClose={() => setEditPetInfo(null)} footer={<>
          <button className="btn" onClick={() => setEditPetInfo(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => {
            const f = editPetInfo;
            if (f.kind === 'pet') onUpdatePet && onUpdatePet({ ...pet, name: f.name.trim() || pet.name, breed: f.breed, sex: f.sex, sterilized: f.sterilized === 'true', color: f.color, birth: f.birth });
            else onUpdatePet && onUpdatePet({ ...pet, owner: { ...pet.owner, name: f.ownerName.trim() || pet.owner.name, phone: f.phone } });
            setEditPetInfo(null); pushToast && pushToast('บันทึกข้อมูลแล้ว');
          }}>บันทึก</button>
        </>}>
          {editPetInfo.kind === 'pet' ? (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 13 }}>
              <Field label="ชื่อสัตว์เลี้ยง"><input className="input" value={editPetInfo.name} onChange={(e) => setEditPetInfo({ ...editPetInfo, name: e.target.value })} placeholder="ชื่อสัตว์" /></Field>
              <Field label="สายพันธุ์"><input className="input" value={editPetInfo.breed} onChange={(e) => setEditPetInfo({ ...editPetInfo, breed: e.target.value })} placeholder="เช่น ปอมเมอเรเนียน" /></Field>
              <Field label="เพศ"><select className="select" value={editPetInfo.sex} onChange={(e) => setEditPetInfo({ ...editPetInfo, sex: e.target.value })}><option value="ผู้">ผู้</option><option value="เมีย">เมีย</option><option value="ไม่ระบุ">ไม่ระบุ</option></select></Field>
              <Field label="ทำหมันแล้ว?"><select className="select" value={editPetInfo.sterilized} onChange={(e) => setEditPetInfo({ ...editPetInfo, sterilized: e.target.value })}><option value="false">ยังไม่ได้ทำหมัน</option><option value="true">ทำหมันแล้ว</option></select></Field>
              <Field label="สี/ตำหนิ"><input className="input" value={editPetInfo.color} onChange={(e) => setEditPetInfo({ ...editPetInfo, color: e.target.value })} placeholder="เช่น สีขาว มีจุดดำ" /></Field>
              <Field label="วันเกิด (ถ้ามี)"><input className="input" type="date" value={editPetInfo.birth || ''} onChange={(e) => setEditPetInfo({ ...editPetInfo, birth: e.target.value })} /></Field>
            </div>
          ) : (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 13 }}>
              <Field label="ชื่อเจ้าของ *"><input className="input" value={editPetInfo.ownerName} onChange={(e) => setEditPetInfo({ ...editPetInfo, ownerName: e.target.value })} placeholder="ชื่อ-นามสกุล" /></Field>
              <Field label="เบอร์โทรศัพท์ *"><input className="input" value={editPetInfo.phone} onChange={(e) => setEditPetInfo({ ...editPetInfo, phone: e.target.value })} placeholder="เช่น 08X-XXX-XXXX" /></Field>
            </div>
          )}
        </Modal>
      ) : null}
      {showVaccineHistory ? (
        <Modal title="ประวัติวัคซีน" onClose={() => setShowVaccineHistory(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pet.visits.filter((v) => v.items.some((it) => it[0].includes('วัคซีน'))).length === 0 ? (
              <div className="queue-empty">ยังไม่มีประวัติวัคซีน</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[...pet.visits].filter((v) => v.items.some((it) => it[0].includes('วัคซีน'))).map((v, i) => {
                  const vaccines = v.items.filter((it) => it[0].includes('วัคซีน'));
                  return (
                    <div key={i} style={{ border: '1px solid #D4B8E8', borderRadius: 'var(--radius)', padding: '12px 13px', background: '#F9F6FE' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#6A4FA0', marginBottom: 6 }}>{dateTH(v.date)}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                        <span style={{ color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>สัตวแพทย์</span>
                        <span style={{ marginLeft: 6 }}>{v.vet}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
                        {vaccines.map((vac, j) => (
                          <div key={j} style={{ marginBottom: 4, paddingBottom: 4, borderBottom: j < vaccines.length - 1 ? '1px solid #E0D0F0' : 'none' }}>
                            💉 <b>{vac[0]}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      ) : null}
      {showReceipt && typeof ReceiptModal !== 'undefined' ? (
        <ReceiptModal
          defaultVatMode="included"
          items={isAdmittedMode ? admittedItems : charges.filter((c) => c[0]).map((c) => ({ name: String(c[0] || ''), qty: Number(c[1]) || 1, price: Number(c[2]) || 0 }))}
          petName={pet.name} ownerName={pet.owner.name} ownerPhone={pet.owner.phone}
          receiptNo={previewReceiptNo}
          onClose={() => setShowReceipt(false)}
          onConfirm={(method) => { setShowReceipt(false); isAdmittedMode ? dischargeAdmitted(method) : save('paid', method); }}
          confirmLabel={isAdmittedMode ? 'จำหน่าย + ออกใบเสร็จ' : 'รับชำระ + ปิดเคส'}
        />
      ) : null}
      {showServiceMgr ? (
        <ServiceManagerModal
          services={services} stock={stock}
          onAdd={(item) => { setCharges((prev) => [...prev, [item.name, 1, item.price, item.kind === 'stk' || item.kind === 'stock' ? item.id : null]]); }}
          onSaveService={onAddService}
          onDeleteService={onDeleteService}
          onUpdateService={onUpdateService}
          onClose={() => setShowServiceMgr(false)}
        />
      ) : null}
      {showApptForm && typeof ApptFormModal !== 'undefined' ? (
        <ApptFormModal
          pets={allPets || []}
          defaultPet={pet}
          onClose={() => setShowApptForm(false)}
          onSave={(appt) => {
            setShowApptForm(false);
            onAddAppointment && onAddAppointment({ ...appt, status: appt.status || 'scheduled' });
            pushToast && pushToast(`บันทึกนัด ${appt.petName} — ${appt.date} เรียบร้อย`);
          }} />
      ) : null}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,.6)' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', borderRadius: 6, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
        </div>
      )}
      {showOwnerPets ? (
        <Modal title={`🐾 สัตว์เลี้ยงของ ${pet.owner.name}`} onClose={() => setShowOwnerPets(false)}>
          <div style={{ marginBottom: 12, color: 'var(--ink-soft)', fontSize: 13 }}>
            📞 {pet.owner.phone} &nbsp;·&nbsp; สัตว์เลี้ยง {ownerPets.length} ตัว
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ownerPets.map((p) => (
              <div key={p.hn} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: p.hn === pet.hn ? 'var(--navy-soft)' : 'var(--paper)', borderRadius: 'var(--radius-sm)', border: p.hn === pet.hn ? '2px solid var(--navy)' : '1.5px solid var(--line)' }}>
                <div style={{ fontSize: 34, lineHeight: 1 }}>{SPECIES_EMOJI[p.species] || '🐾'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name} {p.hn === pet.hn ? <span style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600 }}>(ตัวนี้)</span> : null}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{p.species} · {p.breed} · {p.sex} · HN {p.hn}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>มา {p.visits.length} ครั้ง · ล่าสุด: {p.visits.length ? p.visits[0].date : '—'}</div>
                </div>
                {p.hn !== pet.hn ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'right' }}>
                    น้ำหนัก {p.weight} kg
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

Object.assign(window, { CaseView });
