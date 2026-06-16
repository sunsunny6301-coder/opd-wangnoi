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
    receiptVoids: {},
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
  const receiptVoids = state.receiptVoids || {};
  // คลังเพ็ทช้อปแยกจากคลังคลินิก (stock) — ครั้งแรกถ้ายังไม่มีให้ก๊อปจาก stock มาตั้งต้น แล้วต่อไปไม่ลิ้งกัน
  const shopStock = state.shopStock || stock;
  useEffect(() => {
    if (state.shopStock === undefined) {
      setState((s) => s.shopStock === undefined ? { ...s, shopStock: JSON.parse(JSON.stringify(s.stock || [])) } : s);
    }
  }, [state.shopStock]);

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
  const cancelAdmit = (admId) => {
    const adm = admitted.find((a) => a.id === admId);
    if (!adm) return;
    setState((s) => ({
      ...s,
      admitted: (s.admitted || []).filter((a) => a.id !== admId),
      queue: adm.q ? (s.queue || []).map((x) => x.q === adm.q ? { ...x, status: 'wait' } : x) : (s.queue || []),
    }));
    pushToast(`ยกเลิกแอดมิด ${adm.petName} — กลับเข้ารอตรวจ`);
  };
  // จำหน่าย: บันทึกทุกวันที่แอดมิดลงประวัติสัตว์ + ออกใบเสร็จรวม + ปิดคิว
  const dischargeAdmitted = (admId, method, extraRec, paidTotal) => {
    const adm = admitted.find((a) => a.id === admId);
    if (!adm) return;
    const records = [...(adm.dailyRecords || []), ...(extraRec ? [extraRec] : [])];
    const newVisits = records.map((r) => ({
      date: r.date, vet: r.vet || vets[0], cc: r.cc || r.note || `แอดมิด (${adm.type})`,
      pe: r.pe, dx: r.dx, plan: r.plan, weight: parseFloat(r.weight) || undefined,
      media: r.media || [], items: (r.charges || []).map((c) => [c[0], Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null, c[4] || null]),
    })).reverse(); // ล่าสุดอยู่หน้าสุด
    const allItems = records.flatMap((r) => (r.charges || []).map((c) => [`${c[0]} (${r.date})`, Number(c[1]) || 1, Number(c[2]) || 0]));
    // ยอดจริงที่เก็บเงิน (รวม VAT แล้วถ้าเลือกบวก VAT) — ไม่ส่งมาก็ใช้ยอดรวมรายการตามเดิม
    const total = (paidTotal != null) ? paidTotal : allItems.reduce((s, c) => s + c[1] * c[2], 0);
    const noVatAmt = records.flatMap((r) => (r.charges || [])).filter((c) => c[4] === 'shop').reduce((s, c) => s + (Number(c[1]) || 1) * (Number(c[2]) || 0), 0);
    const receipt = total > 0 ? nextReceiptNo() : null;
    setState((s) => {
      const con = consumeReceipt(receipt, s);
      return {
        ...s,
        pets: s.pets.map((p) => p.hn === adm.hn ? { ...p, visits: [...newVisits, ...p.visits] } : p),
        admitted: (s.admitted || []).filter((a) => a.id !== admId),
        queue: adm.q ? (s.queue || []).map((x) => x.q === adm.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x) : (s.queue || []),
        receipts: receipt ? [...(s.receipts || []), { no: receipt.no, date: todayISO(), type: 'opd', petName: adm.petName, ownerName: adm.owner?.name || '-', hn: adm.hn, q: adm.q || '', items: allItems, method: method || 'เงินสด', total, noVat: noVatAmt }] : (s.receipts || []),
        receiptSeq: con.receiptSeq,
        receiptVoids: con.receiptVoids,
      };
    });
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

  // กันเขียนทับข้อมูลคลาวด์: ห้าม save ขึ้น Supabase จนกว่าจะโหลดข้อมูลจากคลาวด์เสร็จก่อน
  const hydrated = useRef(false);
  // เครื่องนี้เคยมีข้อมูลจริงในเครื่องไหม (ไม่ใช่ข้อมูลตัวอย่าง seed)
  const hadLocal = useRef(!!localStorage.getItem(LS_KEY));
  // เวลาอัปเดตล่าสุดที่เครื่องนี้รับรู้/เขียนเอง — ใช้เทียบว่ามีเครื่องอื่นแก้มาใหม่ไหม
  const lastSyncedAt = useRef(null);

  // sync Supabase → local on first load
  useEffect(() => {
    if (!supa) { console.warn('[SB] supabase client not available'); hydrated.current = true; return; }
    console.log('[SB] loading from Supabase...');
    supa.from('app_state').select('data, updated_at').eq('id', 'main').maybeSingle().then(({ data, error }) => {
      if (error) {
        console.warn('[SB] load error:', error.message);
        // โหลดไม่ได้: ถ้าเครื่องนี้มีข้อมูลจริงอยู่แล้ว → save ได้ (กันงานค้าง)
        // แต่ถ้าเป็นเครื่องใหม่ (มีแต่ seed) → ห้าม save เพื่อไม่ให้ทับข้อมูลจริงบนคลาวด์
        if (hadLocal.current) hydrated.current = true;
        return;
      }
      if (data?.data?.pets && data?.data?.queue) {
        console.log('[SB] loaded state from Supabase ✓');
        setState(data.data);
        try { localStorage.setItem(LS_KEY, JSON.stringify(data.data)); } catch (e) {}
        lastSyncedAt.current = data.updated_at || null;
      } else {
        console.log('[SB] no data in Supabase yet, using localStorage');
      }
      hydrated.current = true; // โหลดเสร็จแล้ว (มี/ไม่มีข้อมูลก็ตาม) → เริ่ม save ขึ้นคลาวด์ได้
    });
  }, []);

  // save to localStorage + Supabase on every state change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    if (supa && hydrated.current) {
      clearTimeout(sbSaveTimer);
      sbSaveTimer = setTimeout(() => {
        const ts = new Date().toISOString();
        supa.from('app_state').upsert({ id: 'main', data: state, updated_at: ts })
          .then(({ error }) => {
            if (error) console.error('[SB] save error:', error.message);
            else { lastSyncedAt.current = ts; console.log('[SB] saved to Supabase ✓'); }
          });
      }, 2000);
    }
  }, [state]);

  // live-sync หลายเครื่อง: ดึงข้อมูลจากเครื่องอื่นมาแสดงทุก 12 วิ (เฉพาะเมื่อมีการแก้ใหม่จริง)
  useEffect(() => {
    if (!supa) return;
    const iv = setInterval(() => {
      if (!hydrated.current) return;
      supa.from('app_state').select('updated_at').eq('id', 'main').maybeSingle().then(({ data, error }) => {
        if (error || !data || !data.updated_at) return;
        // ยังไม่เคยมีฐานเวลา → จดไว้เฉยๆ ไม่ดึง
        if (!lastSyncedAt.current) { lastSyncedAt.current = data.updated_at; return; }
        // ไม่ใหม่กว่าที่เรารู้ (รวมถึงงานที่เราเพิ่งเขียนเอง) → ข้าม
        if (data.updated_at <= lastSyncedAt.current) return;
        // มีเครื่องอื่นแก้มาใหม่ → ดึงข้อมูลเต็มมาลง
        supa.from('app_state').select('data, updated_at').eq('id', 'main').maybeSingle().then(({ data: full }) => {
          if (!full?.data?.pets || !full?.data?.queue) return;
          lastSyncedAt.current = full.updated_at || lastSyncedAt.current;
          setState((cur) => {
            try { if (JSON.stringify(cur) === JSON.stringify(full.data)) return cur; } catch (e) {}
            try { localStorage.setItem(LS_KEY, JSON.stringify(full.data)); } catch (e) {}
            console.log('[SB] synced changes from another device ✓');
            return full.data;
          });
        });
      });
    }, 12000);
    return () => clearInterval(iv);
  }, []);

  // Close nav on ESC
  useEffect(() => {
    const fn = (e) => {if (e.key === 'Escape') setNavOpen(false);};
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  // เลขคิวถัดไป = เลขมากสุดที่มีอยู่ + 1 (กันเลขซ้ำหลังยกเลิกคิว — เดิมใช้ length+1 ทำให้ชนกัน)
  const nextQ = () => {
    const nums = (queue || []).map((x) => parseInt(String(x.q || '').replace(/\D/g, ''), 10) || 0);
    return 'Q' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  };

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
  // หยิบเลขที่ถูกยกเลิก (pool) มาใช้ซ้ำก่อน เลขเล็กสุดก่อน — ถ้าไม่มีค่อยรันเลขถัดไป
  const nextReceiptNo = () => {
    const year = new Date().getFullYear();
    const pool = (receiptVoids[year] || []);
    if (pool.length) {
      const seq = Math.min(...pool);
      return { no: `RCP-${year}-${String(seq).padStart(5, '0')}`, year, seq, fromPool: true };
    }
    const next = (receiptSeq[year] || 0) + 1;
    return { no: `RCP-${year}-${String(next).padStart(5, '0')}`, year, seq: next, fromPool: false };
  };
  // คำนวณ receiptSeq/receiptVoids ใหม่หลังใช้เลขใบเสร็จ 1 ใบ (เรียกภายใน setState ด้วย state ล่าสุด s)
  const consumeReceipt = (r, s) => {
    if (r && r.fromPool) {
      const cur = (s.receiptVoids || {})[r.year] || [];
      return { receiptSeq: s.receiptSeq || {}, receiptVoids: { ...(s.receiptVoids || {}), [r.year]: cur.filter((n) => n !== r.seq) } };
    }
    if (r) return { receiptSeq: { ...(s.receiptSeq || {}), [r.year]: r.seq }, receiptVoids: s.receiptVoids || {} };
    return { receiptSeq: s.receiptSeq || {}, receiptVoids: s.receiptVoids || {} };
  };
  // ยกเลิกใบเสร็จ: ลบออกจากรายการ (จึงไม่ถูกนับใน PDF/Excel) + คืนเลขเข้า pool เพื่อใช้ซ้ำ
  const cancelReceipt = (no) => {
    const rcp = (receipts || []).find((r) => r.no === no);
    if (!rcp) return;
    const parts = String(no).split('-');
    const year = parseInt(parts[1], 10) || new Date().getFullYear();
    const seq = parseInt(parts[2], 10) || 0;
    setState((s) => ({
      ...s,
      receipts: (s.receipts || []).filter((r) => r.no !== no),
      receiptVoids: { ...(s.receiptVoids || {}), [year]: [...new Set([...(((s.receiptVoids || {})[year]) || []), seq])] },
    }));
    pushToast(`ยกเลิกใบเสร็จ ${no} แล้ว — เลขนี้จะถูกนำกลับมาใช้ครั้งถัดไป`);
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
        weight: parseFloat(f.weight) || null, sterilized: null,
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
  const deleteVet = (name) => {
    setState((s) => ({ ...s, vets: (s.vets || VetData.vets).filter((v) => v !== name) }));
    pushToast(`ลบสัตวแพทย์ "${name}" แล้ว`);
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

  const finishCase = (updatedPet, queueItem, status, payMethod, paidTotal) => {
    // บันทึกใหม่ถูกใส่ไว้หน้าสุดของ visits (ล่าสุดบนสุด)
    const visit = updatedPet.visits[0];
    if (!visit) return;

    // เคสที่ชำระและปิดแล้ว: กันกดซ้ำจนเกิดประวัติ/ใบเสร็จ/ตัดสต็อกซ้ำ
    if (queueItem && queueItem.status === 'done') {
      setPage('dashboard'); setCaseCtx(null);
      pushToast('เคสนี้ชำระและปิดแล้ว — หากต้องการแก้ไข กรุณายกเลิกใบเสร็จเดิมก่อน');
      return;
    }
    // charge = [ชื่อ, จำนวน, ราคา, stockId?, origin?] — stockId ตัดสต็อก, origin='shop' = สินค้าเพ็ทช้อป (ตัดคลังเพ็ทช้อป)
    const charges = (visit.items || []).map((c) =>
      Array.isArray(c) ? [c[0] || '', Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null, c[4] || null]
        : [String(c.name || ''), Number(c.qty) || 1, Number(c.price) || 0, c.stockId || null, c.origin || null]
    );
    const receiptItems = charges.map((c) => [c[0], c[1], c[2]]);
    // ยอดสินค้าเพ็ทช้อปในบิลนี้ (ไม่คิด VAT) — เก็บไว้ให้หน้าภาษีหักออกจากฐาน VAT
    const noVatAmt = charges.filter((c) => c[4] === 'shop').reduce((s, c) => s + (Number(c[1]) || 1) * (Number(c[2]) || 0), 0);
    const computedTotal = charges.reduce((s, c) => s + (Number(c[1]) || 1) * (Number(c[2]) || 0), 0);
    // ยอดจริงที่เก็บเงิน (รวม VAT แล้วถ้าเลือกบวก VAT) — ถ้าไม่ได้ส่งมาใช้ยอดรวมรายการตามเดิม
    const total = (paidTotal != null) ? paidTotal : computedTotal;
    // ผูกบันทึกกับเลขคิว (q): ถ้าคิวนี้เคยบันทึกประวัติไปแล้ว (เช่น เคยส่งแคชเชียร์/กดย้อนกลับ)
    // ให้แทนที่บันทึกเดิม ไม่เพิ่มซ้ำ
    const encId = queueItem?.q;
    const mergedVisits = encId
      ? [updatedPet.visits[0], ...updatedPet.visits.slice(1).filter((v) => v.q !== encId)]
      : updatedPet.visits;
    let newPets = pets.map((p) => p.hn === updatedPet.hn ? { ...updatedPet, visits: mergedVisits } : p);
    let newQueue = queue;
    let newReceipts = receipts;
    let newSeq = receiptSeq;
    let newVoids = receiptVoids;
    let newStock = stock;
    let newShopStock = shopStock;
    let deducted = 0;

    if (status === 'paid') {
      const receipt = nextReceiptNo();
      if (receipt.fromPool) {
        newVoids = { ...receiptVoids, [receipt.year]: (receiptVoids[receipt.year] || []).filter((n) => n !== receipt.seq) };
      } else {
        newSeq = { ...receiptSeq, [receipt.year]: receipt.seq };
      }
      newReceipts = [...receipts, { no: receipt.no, date: todayISO(), type: 'opd', petName: updatedPet.name, ownerName: updatedPet.owner.name, hn: updatedPet.hn, q: queueItem?.q || '', items: receiptItems, method: payMethod || 'เงินสด', total, noVat: noVatAmt }];
      newQueue = queueItem?.q ? queue.map((x) => x.q === queueItem.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x) : queue;
      // ตัดสต็อก: รายการเพ็ทช้อป (origin='shop') ตัดจากคลังเพ็ทช้อป, ที่เหลือตัดจากคลังคลินิก
      let dC = 0, dS = 0;
      [newStock, dC] = deductStock(stock, charges.filter((c) => c[3] && c[4] !== 'shop').map((c) => ({ stockId: c[3], qty: c[1] })));
      [newShopStock, dS] = deductStock(shopStock, charges.filter((c) => c[3] && c[4] === 'shop').map((c) => ({ stockId: c[3], qty: c[1] })));
      deducted = dC + dS;
    } else if (status === 'cashier') {
      newQueue = queueItem?.q ? queue.map((x) => x.q === queueItem.q ? { ...x, status: 'cashier', charges } : x) : queue;
    }

    setState((s) => ({ ...s, pets: newPets, queue: newQueue, receipts: newReceipts, receiptSeq: newSeq, receiptVoids: newVoids, stock: newStock, shopStock: newShopStock }));
    setPage('dashboard');
    setCaseCtx(null);
    pushToast(status === 'paid'
      ? `รับชำระ ${fmtB(total)} แล้ว` + (deducted > 0 ? ` · ตัดสต็อก ${deducted} รายการ` : '')
      : `บันทึกเรียบร้อย`);
  };

  const payFromBoard = (method, total) => {
    const receipt = nextReceiptNo();
    const { no } = receipt;
    const petObj = pets.find((p) => p.hn === payFor.hn) || { owner: {} };
    const charges = (payFor.charges || []).map((c) =>
      Array.isArray(c) ? [c[0] || '', Number(c[1]) || 1, Number(c[2]) || 0, c[3] || null, c[4] || null]
        : [String(c.name || ''), Number(c.qty) || 1, Number(c.price) || 0, c.stockId || null, c.origin || null]
    );
    const [newStock, dC] = deductStock(stock, charges.filter((c) => c[3] && c[4] !== 'shop').map((c) => ({ stockId: c[3], qty: c[1] })));
    const [newShopStock, dS] = deductStock(shopStock, charges.filter((c) => c[3] && c[4] === 'shop').map((c) => ({ stockId: c[3], qty: c[1] })));
    const deducted = dC + dS;
    setState((s) => {
      const con = consumeReceipt(receipt, s);
      return {
        ...s,
        stock: newStock,
        shopStock: newShopStock,
        queue: s.queue.map((x) => x.q === payFor.q ? { ...x, status: 'done', paid: total, doneDate: todayISO() } : x),
        receipts: [...(s.receipts || []), {
          no, date: todayISO(), type: 'opd',
          petName: payFor.petName, ownerName: petObj.owner?.name || '-',
          hn: payFor.hn, q: payFor.q,
          items: charges.map((c) => [c[0], c[1], c[2]]),
          method, total,
          noVat: charges.filter((c) => c[4] === 'shop').reduce((s, c) => s + (Number(c[1]) || 1) * (Number(c[2]) || 0), 0)
        }],
        receiptSeq: con.receiptSeq,
        receiptVoids: con.receiptVoids,
      };
    });
    pushToast(`รับชำระ ${fmtB(total)} (${method}) — ${payFor.petName}` + (deducted > 0 ? ` · ตัดสต็อก ${deducted} รายการ` : ''));
    setPayFor(null);
  };

  const shopCheckout = (cart, method, total) => {
    const charges = cart.map((c) => ({ stockId: c.id, qty: c.qty }));
    const [newShopStock, deducted] = deductStock(shopStock, charges);
    const receipt = nextReceiptNo();
    const { no } = receipt;
    setState((s) => {
      const con = consumeReceipt(receipt, s);
      return {
        ...s, shopStock: newShopStock,
        receipts: [...(s.receipts || []), {
          no, date: new Date().toISOString().slice(0, 10), type: 'shop',
          petName: '-', ownerName: '-', items: cart.map((c) => [c.name, c.qty, c.price]),
          method, total
        }],
        receiptSeq: con.receiptSeq,
        receiptVoids: con.receiptVoids,
      };
    });
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
  // รวมไฟล์ import เข้าคลังเดิม: ชื่อซ้ำ → จำนวนบวกเพิ่ม, ต้นทุนเอาสูงสุด, ราคาขายคงเดิม · ชื่อใหม่ → เพิ่มรายการ
  const mergeImport = (existing, incoming, idPrefix) => {
    const EMO = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
    const result = (existing || []).map((x) => ({ ...x }));
    const byName = new Map();
    result.forEach((x) => byName.set(String(x.name || '').trim(), x));
    let added = 0, merged = 0;
    (incoming || []).forEach((inc) => {
      const key = String(inc.name || '').trim();
      const cur = key && byName.get(key);
      if (cur) {
        cur.qty = (Number(cur.qty) || 0) + (Number(inc.qty) || 0);          // บวกจำนวน
        cur.cost = Math.max(Number(cur.cost) || 0, Number(inc.cost) || 0);  // ต้นทุนสูงสุด
        if ((cur.min == null || cur.min === '') && inc.min != null) cur.min = inc.min;
        // ราคาขาย (price) คงเดิม — ไม่แตะ
        merged++;
      } else {
        const ni = { ...inc, id: idPrefix + Date.now() + Math.random().toString(36).slice(2), emoji: inc.emoji || EMO[inc.cat] || '📦' };
        result.push(ni); if (key) byName.set(key, ni); added++;
      }
    });
    return { result, added, merged };
  };
  const importStockItems = (items) => {
    let res;
    setState((s) => { res = mergeImport(s.stock, items, 'st'); return { ...s, stock: res.result }; });
    pushToast(`นำเข้าสต็อกคลินิก — เพิ่มใหม่ ${res.added}` + (res.merged ? ` · รวมของเดิม ${res.merged} (บวกจำนวน/ต้นทุนสูงสุด)` : '') + ' รายการ');
  };
  /* ── เพ็ทช้อป: คลังแยกของตัวเอง (shopStock) ── */
  const addShopItem = (item) => {
    const EMO = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
    setState((s) => ({ ...s, shopStock: [...(s.shopStock || s.stock || []), { ...item, id: 'sh' + Date.now(), emoji: EMO[item.cat] || '📦' }] }));
    pushToast(`เพิ่ม "${item.name}" เข้าเพ็ทช้อปแล้ว`);
  };
  const updateShopItem = (id, patch) => {
    const EMO = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
    setState((s) => ({ ...s, shopStock: (s.shopStock || s.stock || []).map((x) => x.id === id ? { ...x, ...patch, emoji: EMO[patch.cat] || x.emoji || '📦' } : x) }));
    pushToast(`อัปเดต "${patch.name}" แล้ว`);
  };
  const deleteShopItem = (id) => {
    const name = (shopStock.find((x) => x.id === id) || {}).name || '';
    setState((s) => ({ ...s, shopStock: (s.shopStock || s.stock || []).filter((x) => x.id !== id) }));
    pushToast(`ลบ "${name}" ออกจากเพ็ทช้อปแล้ว`);
  };
  const adjustShop = (id, d) =>
  setState((s) => ({ ...s, shopStock: (s.shopStock || s.stock || []).map((x) => x.id === id ? { ...x, qty: Math.max(0, x.qty + d) } : x) }));
  const clearShop = () => { setState((s) => ({ ...s, shopStock: [] })); pushToast('ล้างสินค้าเพ็ทช้อปทั้งหมดแล้ว'); };
  const importShopItems = (items) => {
    let res;
    setState((s) => { res = mergeImport(s.shopStock || s.stock || [], items, 'sh'); return { ...s, shopStock: res.result }; });
    pushToast(`นำเข้าเพ็ทช้อป — เพิ่มใหม่ ${res.added}` + (res.merged ? ` · รวมของเดิม ${res.merged} (บวกจำนวน/ต้นทุนสูงสุด)` : '') + ' รายการ');
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
          <Dashboard pets={pets} queue={queue} appointments={appointments} admitted={admitted} receipts={receipts}
          onOpenCase={openCase} onOpenPet={openPet}
          onMove={moveQ} onPay={setPayFor} onWalkIn={walkIn}
          onUpdateAppointment={updateAppointment} onDischargeAdmitted={dischargeAdmitted} onUpdateAdmitted={updateAdmitted} onOpenAdmittedCase={openAdmittedCase} onCancelQueue={cancelQueue} onCancelAdmit={cancelAdmit} /> :
          null}
          {page === 'case' && casePet ?
          <CaseView pet={casePet} queueItem={caseQItem}
          vets={vets} services={services} stock={stock} shopStock={shopStock} allPets={pets} appointments={appointments}
          onBack={() => {setPage('dashboard');setCaseCtx(null);}}
          onFinish={finishCase} onAddVet={addVet} onDeleteVet={deleteVet}
          onAddAppointment={addAppointment}
          onUpdateAdmitted={updateAdmitted} onDischargeAdmitted={dischargeAdmitted}
          onAddAdmitted={addAdmitted} pushToast={pushToast}
          onUpdatePet={updatePet} onAddService={addService} onDeleteService={deleteService} onUpdateService={updateService} onSaveDraft={saveDraft} previewReceiptNo={nextReceiptNo().no} /> :
          null}
          {page === 'appointments' ? <AppointmentsView appointments={appointments} pets={pets} onAdd={addAppointment} onUpdate={updateAppointment} /> : null}
          {page === 'shop' ? <PetShop stock={shopStock} onCheckout={shopCheckout} previewReceiptNo={nextReceiptNo().no} onDeleteItem={deleteShopItem} onAddItem={addShopItem} onImportStock={importShopItems} onUpdateItem={updateShopItem} /> : null}
          {page === 'stock' ? <StockView stock={stock} onAdjust={adjustStock} onAddItem={addStockItem} onImportStock={importStockItems} onDeleteItem={deleteStockItem} onClearAll={clearStock} onUpdateItem={updateStockItem} /> : null}
          {page === 'reports' ? <ReportsView pets={pets} queue={queue} stock={stock} receipts={receipts} onCancelReceipt={cancelReceipt} /> : null}
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