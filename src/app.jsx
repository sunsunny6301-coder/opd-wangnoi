// ── App root: state, nav, routing ───────────────────────────
var { useState, useEffect, useRef, useMemo } = React;
const LS_KEY = 'wnvet_opd_v1';
const SB_URL = 'https://lvybmnzuzsefsizgszaf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eWJtbnp1enNlZnNpemdzemFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTk1NjAsImV4cCI6MjA5Njc5NTU2MH0.h2lu10nj9z8aZwREVUsU8b5cnooQSScZ_QhbfC2kuTQ';
const supa = (typeof supabase !== 'undefined') ? supabase.createClient(SB_URL, SB_KEY) : null;
let sbSaveTimer = null;

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.pets && s.queue && s.stock) return s;
    }
  } catch (e) {/* ignore */}
  return {
    pets: JSON.parse(JSON.stringify(VetData.pets)),
    queue: JSON.parse(JSON.stringify(VetData.queue)),
    stock: JSON.parse(JSON.stringify(VetData.stock)),
    vets: [...VetData.vets],
    receipts: [],
    receiptSeq: {},
    appointments: [],
    admitted: [],
  };
}

function App() {
  const [state, setState] = useState(loadState);
  const [navOpen, setNavOpen] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [caseCtx, setCaseCtx] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [pushToast, toastRack] = useToasts();

  const { pets, queue, stock } = state;
  const appointments = state.appointments || [];
  const admitted = state.admitted || [];
  const vets = state.vets || VetData.vets;
  const receipts = state.receipts || [];
  const receiptSeq = state.receiptSeq || {};

  const addAppointment = (appt) => {
    setState((s) => ({ ...s, appointments: [...(s.appointments || []), appt] }));
    pushToast(`บันทึกนัด ${appt.petName} — ${appt.date} ${appt.time} (ประเภท: ${appt.type})`);
  };
  const updateAppointment = (appt) => {
    setState((s) => ({ ...s, appointments: (s.appointments || []).map((a) => a.id === appt.id ? appt : a) }));
  };
  const addAdmitted = (petHn, type, note, qNo) => {
    const p = pets.find((x) => x.hn === petHn);
    setState((s) => ({
      ...s,
      admitted: [...(s.admitted || []), { id: 'adm' + Date.now(), hn: petHn, q: qNo || null, petName: p?.name, species: p?.species, owner: p?.owner, admittedDate: new Date().toISOString().slice(0, 10), type, note, dailyRecords: [] }],
      queue: qNo ? (s.queue || []).map((x) => x.q === qNo ? { ...x, status: 'admitted' } : x) : (s.queue || []),
    }));
    pushToast(`แอดมิด ${p?.name} — ${type}`);
  };
  const updateAdmitted = (admId, data) => {
    setState((s) => ({ ...s, admitted: (s.admitted || []).map((a) => a.id === admId ? { ...a, ...data } : a) }));
  };
  // จำหน่าย: บันทึกทุกวันที่แอดมิดลงประวัติสัตว์ + ออกใบเสร็จรวม + ปิดคิว
  const dischargeAdmitted = (admId, method, extraRec) => {
    const adm = admitted.find((a) => a.id === admId);
    if (!adm) return;
    const records = [...(adm.dailyRecords || []), ...(extraRec ? [extraRec] : [])];
    const newVisits = records.map((r) => ({
      date: r.date, vet: r.vet || vets[0], cc: r.cc || r.note || `แอดมิด (${adm.type})`,
      pe: r.pe, dx: r.dx, plan: r.plan, weight: parseFloat(r.weight) || undefined,
      media: r.media || [], items: (r.charges || []).map((c) => [c[0], Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null]),
    })).reverse(); // ล่าสุดอยู่หน้าสุด
    const allItems = records.flatMap((r) => (r.charges || []).map((c) => [`${c[0]} (${r.date})`, Number(c[1]) || 1, Number(c[2]) || 0]));
    const total = allItems.reduce((s, c) => s + c[1] * c[2], 0);
    const receipt = total > 0 ? nextReceiptNo() : null;
    setState((s) => ({
      ...s,
      pets: s.pets.map((p) => p.hn === adm.hn ? { ...p, visits: [...newVisits, ...p.visits] } : p),
      admitted: (s.admitted || []).filter((a) => a.id !== admId),
      queue: adm.q ? (s.queue || []).map((x) => x.q === adm.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x) : (s.queue || []),
      receipts: receipt ? [...(s.receipts || []), { no: receipt.no, date: todayISO(), type: 'opd', petName: adm.petName, ownerName: adm.owner?.name || '-', hn: adm.hn, q: adm.q || '', items: allItems, method: method || 'เงินสด', total }] : (s.receipts || []),
      receiptSeq: receipt ? { ...(s.receiptSeq || {}), [receipt.year]: receipt.seq } : (s.receiptSeq || {}),
    }));
    pushToast(total > 0 ? `จำหน่าย ${adm.petName} — รับชำระ ${fmtB(total)}` : `จำหน่าย ${adm.petName} แล้ว`);
  };
  const updatePet = (updated) => {
    setState((s) => ({ ...s, pets: s.pets.map((p) => p.hn === updated.hn ? updated : p) }));
  };

  const services = state.services || VetData.services;
  const addService = (item) => {
    const svc = { ...item, id: item.id || ('svc_' + Date.now()), emoji: item.emoji || '💼', kind: 'svc' };
    setState((s) => ({ ...s, services: [...(s.services || VetData.services), svc] }));
    pushToast(`บันทึกรายการ "${svc.name}" แล้ว`);
  };
  const deleteService = (id) => {
    setState((s) => ({ ...s, services: (s.services || VetData.services).filter((x) => x.id !== id) }));
    pushToast('ลบรายการแล้ว');
  };
  const updateService = (updated) => {
    setState((s) => ({ ...s, services: (s.services || VetData.services).map((x) => x.id === updated.id ? { ...x, ...updated } : x) }));
    pushToast(`อัปเดต "${updated.name}" แล้ว`);
  };
  const saveDraft = (qNo, draft) => {
    setState((s) => ({ ...s, queue: s.queue.map((x) => x.q === qNo ? { ...x, draft } : x) }));
  };

  const cancelQueue = (item) => {
    setState((s) => ({
      ...s,
      queue: s.queue.filter((x) => x.q !== item.q),
      // ลูกค้าใหม่ที่เพิ่งลงทะเบียน ยังไม่มีประวัติ → ลบออกด้วย
      pets: item.isNew ? s.pets.filter((p) => p.hn !== item.hn) : s.pets,
    }));
    pushToast(`ยกเลิกคิว ${item.q} — ${item.petName} เรียบร้อย`);
  };

  // sync Supabase → local on first load
  useEffect(() => {
    if (!supa) { console.warn('[SB] supabase client not available'); return; }
    console.log('[SB] loading from Supabase...');
    supa.from('app_state').select('data').eq('id', 'main').single().then(({ data, error }) => {
      if (error) { console.warn('[SB] load error:', error.message); return; }
      if (data?.data?.pets && data?.data?.queue) {
        console.log('[SB] loaded state from Supabase ✓');
        setState(data.data);
        try { localStorage.setItem(LS_KEY, JSON.stringify(data.data)); } catch (e) {}
      } else {
        console.log('[SB] no data in Supabase yet, using localStorage');
      }
    });
  }, []);

  // save to localStorage + Supabase on every state change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    if (supa) {
      clearTimeout(sbSaveTimer);
      sbSaveTimer = setTimeout(() => {
        supa.from('app_state').upsert({ id: 'main', data: state, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.error('[SB] save error:', error.message); else console.log('[SB] saved to Supabase ✓'); });
      }, 2000);
    }
  }, [state]);

  // Close nav on ESC
  useEffect(() => {
    const fn = (e) => {if (e.key === 'Escape') setNavOpen(false);};
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const nextQ = () => 'Q' + String(queue.length + 1).padStart(3, '0');

  // HN: [last 2 digits of Thai year] + [5-digit seq] → e.g. 6900001
  const nextHN = () => {
    const prefix = String(new Date().getFullYear() + 543).slice(-2);
    const seqs = pets.
    map((p) => p.hn).
    filter((hn) => hn.startsWith(prefix) && hn.length === prefix.length + 5).
    map((hn) => parseInt(hn.slice(prefix.length)) || 0);
    return prefix + String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(5, '0');
  };

  // Receipt no: RCP-{CE year}-{5-digit seq per year}
  const nextReceiptNo = () => {
    const year = new Date().getFullYear();
    const next = (receiptSeq[year] || 0) + 1;
    return { no: `RCP-${year}-${String(next).padStart(5, '0')}`, year, seq: next };
  };

  /* ── actions ── */
  const walkIn = (payload) => {
    let hn = payload.existingHn, isNew = false, petName, species;
    let newPets = pets;
    if (!hn) {
      const f = payload.newPet;
      hn = nextHN(); isNew = true; petName = f.pet; species = f.species;
      const d = new Date();
      d.setFullYear(d.getFullYear() - (parseInt(f.ageY) || 0));
      d.setMonth(d.getMonth() - (parseInt(f.ageM) || 0));
      // keepOwner = สัตว์ใหม่ให้เจ้าของเดิม → ใช้ข้อมูลเจ้าของที่ส่งมา
      const ownerObj = payload.keepOwner
        ? { name: payload.keepOwner.name, phone: payload.keepOwner.phone || '-' }
        : { name: f.owner, phone: f.phone || '-' };
      newPets = [...pets, {
        hn, name: f.pet, species: f.species, breed: '-', sex: f.sex,
        birth: d.toISOString().slice(0, 10), color: '-',
        weight: parseFloat(f.weight) || null, sterilized: false,
        owner: ownerObj, allergies: [], visits: []
      }];
    } else {
      const p = pets.find((x) => x.hn === hn);
      petName = p.name; species = p.species;
    }
    const entry = { q: nextQ(), hn, petName, species, type: payload.type, status: 'wait', time: timeNow(), cc: payload.cc, isNew };
    setState((s) => ({ ...s, pets: newPets, queue: [...s.queue, entry] }));
    pushToast(`ออกบัตรคิว ${entry.q} — ${petName} เรียบร้อย`);
  };

  const moveQ = (qNo, status) =>
  setState((s) => ({ ...s, queue: s.queue.map((x) => x.q === qNo ? { ...x, status } : x) }));

  const openCase = (item) => {
    if (item.status === 'wait') moveQ(item.q, 'exam');
    setCaseCtx({ hn: item.hn, q: item.q });
    setPage('case');
  };
  const openAdmittedCase = (adm) => {
    setCaseCtx({ hn: adm.hn, admItem: adm });
    setPage('case');
  };
  const openPet = (hn) => {setCaseCtx({ hn, q: null });setPage('case');};

  const addVet = (name) => {
    if (!name.trim() || vets.includes(name.trim())) return;
    setState((s) => ({ ...s, vets: [...(s.vets || VetData.vets), name.trim()] }));
    pushToast(`เพิ่มสัตวแพทย์ "${name.trim()}" แล้ว`);
  };

  const deductStock = (stockArr, charges) => {
    let n = 0;
    const next = stockArr.map((s) => {
      const line = charges.find((c) => c.stockId === s.id);
      if (line) {n++;return { ...s, qty: Math.max(0, s.qty - line.qty) };}
      return s;
    });
    return [next, n];
  };

  const finishCase = (updatedPet, queueItem, status, payMethod) => {
    // บันทึกใหม่ถูกใส่ไว้หน้าสุดของ visits (ล่าสุดบนสุด)
    const visit = updatedPet.visits[0];
    if (!visit) return;

    // charge = [ชื่อ, จำนวน, ราคา, stockId?] — stockId ไว้ตัดสต็อกตอนรับชำระ
    const charges = (visit.items || []).map((c) =>
      Array.isArray(c) ? [c[0] || '', Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null]
        : [String(c.name || ''), Number(c.qty) || 1, Number(c.price) || 0, c.stockId || null]
    );
    const receiptItems = charges.map((c) => [c[0], c[1], c[2]]);
    const total = charges.reduce((s, c) => s + (Number(c[1]) || 1) * (Number(c[2]) || 0), 0);
    let newPets = pets.map((p) => p.hn === updatedPet.hn ? updatedPet : p);
    let newQueue = queue;
    let newReceipts = receipts;
    let newSeq = receiptSeq;
    let newStock = stock;
    let deducted = 0;

    if (status === 'paid') {
      const receipt = nextReceiptNo();
      newSeq = { ...receiptSeq, [receipt.year]: receipt.seq };
      newReceipts = [...receipts, { no: receipt.no, date: todayISO(), type: 'opd', petName: updatedPet.name, ownerName: updatedPet.owner.name, hn: updatedPet.hn, q: queueItem?.q || '', items: receiptItems, method: payMethod || 'เงินสด', total }];
      newQueue = queueItem?.q ? queue.map((x) => x.q === queueItem.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x) : queue;
      [newStock, deducted] = deductStock(stock, charges.filter((c) => c[3]).map((c) => ({ stockId: c[3], qty: c[1] })));
    } else if (status === 'cashier') {
      newQueue = queueItem?.q ? queue.map((x) => x.q === queueItem.q ? { ...x, status: 'cashier', charges } : x) : queue;
    }

    setState((s) => ({ ...s, pets: newPets, queue: newQueue, receipts: newReceipts, receiptSeq: newSeq, stock: newStock }));
    setPage('dashboard');
    setCaseCtx(null);
    pushToast(status === 'paid'
      ? `รับชำระ ${fmtB(total)} แล้ว` + (deducted > 0 ? ` · ตัดสต็อก ${deducted} รายการ` : '')
      : `บันทึกเรียบร้อย`);
  };

  const payFromBoard = (method, total) => {
    const { no, year, seq } = nextReceiptNo();
    const petObj = pets.find((p) => p.hn === payFor.hn) || { owner: {} };
    const charges = (payFor.charges || []).map((c) =>
      Array.isArray(c) ? [c[0] || '', Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null]
        : [String(c.name || ''), Number(c.qty) || 1, Number(c.price) || 0, c.stockId || null]
    );
    const [newStock, deducted] = deductStock(stock, charges.filter((c) => c[3]).map((c) => ({ stockId: c[3], qty: c[1] })));
    setState((s) => ({
      ...s,
      stock: newStock,
      queue: s.queue.map((x) => x.q === payFor.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x),
      receipts: [...(s.receipts || []), {
        no, date: todayISO(), type: 'opd',
        petName: payFor.petName, ownerName: petObj.owner?.name || '-',
        hn: payFor.hn, q: payFor.q,
        items: charges.map((c) => [c[0], c[1], c[2]]),
        method, total
      }],
      receiptSeq: { ...(s.receiptSeq || {}), [year]: seq }
    }));
    pushToast(`รับชำระ ${fmtB(total)} (${method}) — ${payFor.petName}` + (deducted > 0 ? ` · ตัดสต็อก ${deducted} รายการ` : ''));
    setPayFor(null);
  };

  const shopCheckout = (cart, method, total) => {
    const charges = cart.map((c) => ({ stockId: c.id, qty: c.qty }));
    const [newStock, deducted] = deductStock(stock, charges);
    const { no, year, seq } = nextReceiptNo();
    setState((s) => ({
      ...s, stock: newStock,
      receipts: [...(s.receipts || []), {
        no, date: new Date().toISOString().slice(0, 10), type: 'shop',
        petName: '-', ownerName: '-', items: cart.map((c) => [c.name, c.qty, c.price]),
        method, total
      }],
      receiptSeq: { ...(s.receiptSeq || {}), [year]: seq }
    }));
    pushToast(`ขายสินค้า ${fmtB(total)} (${method}) · ตัดสต็อก ${deducted} รายการ`);
  };

  const adjustStock = (id, d) =>
  setState((s) => ({ ...s, stock: s.stock.map((x) => x.id === id ? { ...x, qty: Math.max(0, x.qty + d) } : x) }));
  const deleteStockItem = (id) => {
    const name = stock.find((x) => x.id === id)?.name || '';
    setState((s) => ({ ...s, stock: s.stock.filter((x) => x.id !== id) }));
    pushToast(`ลบ "${name}" ออกจากสต็อกแล้ว`);
  };
  const clearStock = () => {
    setState((s) => ({ ...s, stock: [] }));
    pushToast('ล้างสต็อกทั้งหมดแล้ว');
  };
  const addStockItem = (item) => {
    setState((s) => ({ ...s, stock: [...s.stock, { ...item, id: 'st' + Date.now(), emoji: { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' }[item.cat] || '📦' }] }));
    pushToast(`เพิ่ม "${item.name}" เข้าสต็อกแล้ว`);
  };
  const updateStockItem = (id, patch) => {
    const CAT_EMOJIS = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
    setState((s) => ({ ...s, stock: s.stock.map((x) => x.id === id ? { ...x, ...patch, emoji: CAT_EMOJIS[patch.cat] || x.emoji || '📦' } : x) }));
    pushToast(`อัปเดต "${patch.name}" แล้ว`);
  };
  const importStockItems = (items) => {
    const CAT_EMOJIS = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
    const newItems = items.map((item) => ({ ...item, id: 'st' + Date.now() + Math.random().toString(36).slice(2), emoji: item.emoji || CAT_EMOJIS[item.cat] || '📦' }));
    setState((s) => ({ ...s, stock: [...s.stock, ...newItems] }));
    pushToast(`นำเข้าสต็อก ${newItems.length} รายการแล้ว`);
  };

  /* ── nav ── */
  const NAV = [
  { id: 'dashboard', label: 'หน้า OPD / คิวตรวจ', icon: 'home' },
  { id: 'history', label: 'ประวัติรายวัน', icon: 'calendar' },
  { id: 'appointments', label: 'นัดหมาย', icon: 'clock' },
  { id: 'shop', label: 'เพ็ทช้อป', icon: 'cart' },
  { id: 'stock', label: 'สต็อกสินค้า', icon: 'box' },
  { id: 'reports', label: 'สรุปรายรับ', icon: 'chart' },
  { id: 'tax', label: 'เอกสารภาษี', icon: 'doc' }];

  const titles = { dashboard: 'หน้า OPD — คิววันนี้', case: 'บันทึกตรวจรักษา', shop: 'เพ็ทช้อป (POS)', stock: 'สต็อกสินค้า', reports: 'สรุปรายรับ & วิเคราะห์', appointments: 'นัดหมาย', history: 'ประวัติรายวัน', tax: 'เอกสารภาษี' };
  const casePet = caseCtx ? pets.find((p) => p.hn === caseCtx.hn) : null;
  const caseQItem = caseCtx
    ? (caseCtx.admItem
        ? { ...(admitted.find((a) => a.id === caseCtx.admItem.id) || caseCtx.admItem), status: 'admitted' }
        : (caseCtx.q ? queue.find((x) => x.q === caseCtx.q) : null))
    : null;
  const lowCount = stock.filter((s) => s.qty <= s.min).length;

  return (
    <div className="app-shell">
      {/* backdrop */}
      <div className={'nav-backdrop' + (navOpen ? ' nav-open' : '')} onClick={() => setNavOpen(false)} />

      <nav className={'side-nav no-print' + (navOpen ? ' nav-open' : '')}>
        <div className="side-brand">
          <img src={window.LOGO_SRC} alt="โลโก้วังน้อยสัตวแพทย์" />
          <div className="nav-label">
            <div className="brand-name">วังน้อยสัตวแพทย์</div>
            <div className="brand-sub">OPD SYSTEM</div>
          </div>
        </div>
        {NAV.map((n) =>
        <button key={n.id}
        className={'nav-item' + (page === n.id || n.id === 'dashboard' && page === 'case' ? ' active' : '')}
        onClick={() => {setPage(n.id);setCaseCtx(null);setNavOpen(false);}}>
            <Icon name={n.icon} size={19} />
            <span className="nav-label">{n.label}</span>
            {n.id === 'stock' && lowCount > 0 ? <span className="chip chip-butter nav-label" style={{ marginLeft: 'auto', fontSize: 11 }}>{lowCount}</span> : null}
            {n.id === 'appointments' ? (() => {const cnt = appointments.filter((a) => a.date === new Date().toISOString().slice(0, 10) && a.status === 'scheduled').length;return cnt > 0 ? <span className="chip chip-blush nav-label" style={{ marginLeft: 'auto', fontSize: 11 }}>{cnt}</span> : null;})() : null}
          </button>
        )}
        <div className="nav-spacer"></div>
        <div className="nav-foot">ระบบ OPD วังน้อยสัตวแพทย์<br />ข้อมูลบันทึกในเครื่องนี้</div>
      </nav>

      <div className="main-col">
        <header className="top-bar no-print">
          <button className={'hamburger-btn' + (navOpen ? ' open' : '')}
          onClick={() => setNavOpen((v) => !v)} aria-label="เมนู">
            <span></span><span></span><span></span>
          </button>
          <span className="page-title" style={{ fontSize: "21px" }}>{titles[page]}</span>
          <span className="date-chip" style={{ fontSize: "15px" }}>{todayTH()}</span>
          <div style={{ flex: 1 }}></div>
          <span className="chip chip-mint nav-label">
            <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--mint-deep)', display: 'inline-block' }}></span>
            พร้อมใช้งาน
          </span>
        </header>

        <main className="main-body" data-screen-label={titles[page]}>
          {page === 'dashboard' ?
          <Dashboard pets={pets} queue={queue} appointments={appointments} admitted={admitted}
          onOpenCase={openCase} onOpenPet={openPet}
          onMove={moveQ} onPay={setPayFor} onWalkIn={walkIn}
          onUpdateAppointment={updateAppointment} onDischargeAdmitted={dischargeAdmitted} onUpdateAdmitted={updateAdmitted} onOpenAdmittedCase={openAdmittedCase} onCancelQueue={cancelQueue} /> :
          null}
          {page === 'case' && casePet ?
          <CaseView pet={casePet} queueItem={caseQItem}
          vets={vets} services={services} stock={stock} allPets={pets}
          onBack={() => {setPage('dashboard');setCaseCtx(null);}}
          onFinish={finishCase} onAddVet={addVet}
          onAddAppointment={addAppointment}
          onUpdateAdmitted={updateAdmitted} onDischargeAdmitted={dischargeAdmitted}
          onAddAdmitted={addAdmitted} pushToast={pushToast}
          onUpdatePet={updatePet} onAddService={addService} onDeleteService={deleteService} onUpdateService={updateService} onSaveDraft={saveDraft} previewReceiptNo={nextReceiptNo().no} /> :
          null}
          {page === 'appointments' ? <AppointmentsView appointments={appointments} pets={pets} onAdd={addAppointment} onUpdate={updateAppointment} /> : null}
          {page === 'shop' ? <PetShop stock={stock} onCheckout={shopCheckout} previewReceiptNo={nextReceiptNo().no} onDeleteItem={deleteStockItem} onAddItem={addStockItem} onImportStock={importStockItems} /> : null}
          {page === 'stock' ? <StockView stock={stock} onAdjust={adjustStock} onAddItem={addStockItem} onImportStock={importStockItems} onDeleteItem={deleteStockItem} onClearAll={clearStock} onUpdateItem={updateStockItem} /> : null}
          {page === 'reports' ? <ReportsView pets={pets} queue={queue} stock={stock} receipts={receipts} /> : null}
          {page === 'history' ? <HistoryView pets={pets} /> : null}
          {page === 'tax' ? <TaxView pets={pets} receipts={receipts} /> : null}
        </main>
      </div>

      {payFor ?
      <ReceiptModal
        defaultVatMode="included"
        items={(payFor.charges || [['ค่าบริการ', 1, 0]]).map((it) => Array.isArray(it) ? { name: it[0], qty: it[1], price: it[2] } : it)}
        petName={payFor.petName}
        ownerName={(pets.find((p) => p.hn === payFor.hn) || { owner: {} }).owner?.name}
        ownerPhone={(pets.find((p) => p.hn === payFor.hn) || { owner: {} }).owner?.phone}
        receiptNo={nextReceiptNo().no}
        onClose={() => setPayFor(null)}
        onConfirm={payFromBoard}
        confirmLabel="รับชำระเงิน" /> :

      null}

      {toastRack}
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);