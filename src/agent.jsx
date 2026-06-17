// ── ผู้ช่วย AI ในเว็บ (Claude + tool use) ──────────────────────────────
// สั่งงานเป็นภาษาไทย → Claude เลือก "เครื่องมือ" (อ่านข้อมูล/ทำงาน) → เว็บทำให้จริง
//   • เครื่องมืออ่าน (search/summary/queue/...) → ทำอัตโนมัติ
//   • เครื่องมือที่แก้ข้อมูล (เปิดคิว/เพิ่มนัด/ยกเลิกใบเสร็จ) → ต้องกด "ยืนยัน" ก่อนเสมอ
// API key อยู่ฝั่งเซิร์ฟเวอร์ (api/agent.js) เบราว์เซอร์ไม่เห็น key

// เครื่องมือที่ต้องขอยืนยันก่อนทำ (เปลี่ยนแปลงข้อมูลจริง)
const AGENT_WRITE_TOOLS = new Set(['add_walkin', 'add_appointment', 'cancel_receipt']);
const AGENT_MAX_STEPS = 6; // กันวนไม่จบ

const AGENT_TOOLS = [
  // ── อ่านข้อมูล (ทำอัตโนมัติ) ──
  { name: 'search_pets', description: 'ค้นหาสัตว์เลี้ยงในระบบจากชื่อสัตว์ / HN / ชื่อเจ้าของ / เบอร์โทร', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'คำค้น' } }, required: ['query'] } },
  { name: 'get_pet_detail', description: 'ดูรายละเอียดสัตว์เลี้ยง + ประวัติการรักษาล่าสุดจาก HN', input_schema: { type: 'object', properties: { hn: { type: 'string' } }, required: ['hn'] } },
  { name: 'get_queue', description: 'ดูคิวทั้งหมดในระบบตอนนี้ (รอตรวจ/กำลังตรวจ/รอชำระ/เสร็จ)', input_schema: { type: 'object', properties: {} } },
  { name: 'get_today_summary', description: 'สรุปภาพรวมวันนี้: รายรับ OPD, จำนวนใบเสร็จ, จำนวนคิวแต่ละสถานะ', input_schema: { type: 'object', properties: {} } },
  { name: 'get_revenue', description: 'สรุปรายรับตามช่วงเวลา (วันนี้ / 7 วัน / 30 วัน) แยก OPD กับเพ็ทช้อป', input_schema: { type: 'object', properties: { range: { type: 'string', enum: ['today', '7d', '30d'] } }, required: ['range'] } },
  { name: 'list_appointments', description: 'ดูนัดหมาย (ไม่ใส่ date = นัดที่กำลังจะถึง, ใส่ date = นัดของวันนั้น)', input_schema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD (ไม่บังคับ)' } } } },
  { name: 'find_low_stock', description: 'หาสินค้าที่ใกล้หมด/ถึงจุดสั่งซื้อ (qty <= min) ทั้งคลินิกและเพ็ทช้อป', input_schema: { type: 'object', properties: {} } },
  { name: 'open_case', description: 'เปิดหน้าเคส (OPD) ของสัตว์เลี้ยงจาก HN เพื่อดู/แก้ประวัติ', input_schema: { type: 'object', properties: { hn: { type: 'string' } }, required: ['hn'] } },

  // ── ทำงาน (ต้องยืนยันก่อน) ──
  { name: 'add_walkin', description: 'เปิดคิวใหม่ (รับเคส/walk-in). สัตว์เก่าใช้ petType="existing"+hn, สัตว์ใหม่ใช้ petType="new"+newPet', input_schema: { type: 'object', properties: { petType: { type: 'string', enum: ['existing', 'new'] }, hn: { type: 'string', description: 'สำหรับสัตว์เก่า' }, newPet: { type: 'object', properties: { name: { type: 'string' }, species: { type: 'string', description: 'สุนัข/แมว/...' }, owner: { type: 'string' }, phone: { type: 'string' }, sex: { type: 'string' } } }, visitType: { type: 'string', description: 'ตรวจรักษา/วัคซีน/อาบน้ำตัดขน/ผ่าตัด' }, cc: { type: 'string', description: 'อาการสำคัญ' } }, required: ['petType'] } },
  { name: 'add_appointment', description: 'เพิ่มนัดหมายให้สัตว์เลี้ยงที่มีในระบบแล้ว (ต้องมี HN)', input_schema: { type: 'object', properties: { hn: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM' }, type: { type: 'string' }, note: { type: 'string' } }, required: ['hn', 'date'] } },
  { name: 'cancel_receipt', description: 'ยกเลิกใบเสร็จตามเลขที่ (เช่น RCP-2026-00123) — ลบออกจากยอดสรุป', input_schema: { type: 'object', properties: { no: { type: 'string' } }, required: ['no'] } },
];

function AgentChat({ pets = [], queue = [], receipts = [], appointments = [], stock = [], shopStock = [], services = [], vets = [], onWalkIn, onAddAppointment, onCancelReceipt, onOpenPet, pushToast }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState([]); // [{who:'user'|'ai'|'sys', text}]
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null); // {title, detail, danger}
  const convoRef = useRef([]);            // raw API messages (สะสมข้ามรอบ)
  const confirmResolveRef = useRef(null); // resolve() ของ Promise ยืนยัน
  const scrollRef = useRef(null);
  const ctxRef = useRef({});
  ctxRef.current = { pets, queue, receipts, appointments, stock, shopStock, services, vets };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [view, pendingConfirm, busy]);

  const addView = (who, text) => setView((v) => [...v, { who, text }]);

  // ── ระบบความรู้/บริบทให้ Claude ──
  const buildSystem = () => {
    const today = (typeof todayISO !== 'undefined') ? todayISO() : new Date().toISOString().slice(0, 10);
    const d = ctxRef.current;
    const waiting = (d.queue || []).filter((x) => x.status === 'wait' || x.status === 'exam' || x.status === 'cashier').length;
    return [
      'คุณคือผู้ช่วย AI ในระบบ OPD ของ "วังน้อยสัตวแพทย์" ช่วยพนักงานคลินิกอ่านข้อมูลและทำงานในเว็บผ่านเครื่องมือ (tools)',
      `วันนี้คือ ${today} · มีคิวค้างอยู่ ${waiting} คิว · สัตว์ในระบบ ${(d.pets || []).length} ตัว`,
      'กฎ:',
      '- ตอบเป็นภาษาไทย สั้น กระชับ ตรงประเด็น (ตอบเฉพาะคำตอบ ไม่ต้องอธิบายขั้นตอนคิดของตัวเอง)',
      '- ใช้ tools เพื่อดึงข้อมูลจริงเสมอ ห้ามเดา/แต่งข้อมูลเอง ถ้าไม่รู้ HN ให้ค้นด้วย search_pets ก่อน',
      '- งานที่แก้ข้อมูล (เปิดคิว/เพิ่มนัด/ยกเลิกใบเสร็จ) ระบบจะให้ผู้ใช้กดยืนยันเองก่อนทำ คุณแค่เรียก tool ตามที่ผู้ใช้สั่ง',
      '- ห้ามวินิจฉัยโรค/สั่งยาแทนสัตวแพทย์ ถ้าเป็นเคสฉุกเฉินให้แนะนำติดต่อสัตวแพทย์ทันที',
      '- ถ้าข้อมูลไม่พอ/กำกวม ให้ถามกลับสั้นๆ ก่อนทำงานที่แก้ข้อมูล',
    ].join('\n');
  };

  // ── เครื่องมืออ่าน (ทำได้เลย) ──
  const runReadTool = (name, input) => {
    const d = ctxRef.current;
    const today = (typeof todayISO !== 'undefined') ? todayISO() : new Date().toISOString().slice(0, 10);
    const itemTotal = (items) => (items || []).reduce((s, it) => { const a = Array.isArray(it) ? it : [it.name, it.qty, it.price]; return s + (Number(a[1]) || 1) * (Number(a[2]) || 0); }, 0);
    if (name === 'search_pets') {
      const q = String(input.query || '').trim().toLowerCase();
      const res = (d.pets || []).filter((p) => !q
        || String(p.name || '').toLowerCase().includes(q)
        || String(p.hn || '').toLowerCase().includes(q)
        || String(p.owner && p.owner.name || '').toLowerCase().includes(q)
        || String(p.owner && p.owner.phone || '').includes(q)
      ).slice(0, 10).map((p) => ({ hn: p.hn, name: p.name, species: p.species, owner: p.owner && p.owner.name, phone: p.owner && p.owner.phone, visits: (p.visits || []).length, lastVisit: (p.visits || [])[0] && (p.visits || [])[0].date || null }));
      return JSON.stringify({ count: res.length, pets: res });
    }
    if (name === 'get_pet_detail') {
      const p = (d.pets || []).find((x) => x.hn === String(input.hn));
      if (!p) return JSON.stringify({ error: 'ไม่พบ HN ' + input.hn });
      const recent = (p.visits || []).slice(0, 5).map((v) => ({ date: v.date, cc: v.cc, dx: v.dx, total: itemTotal(v.items), items: (v.items || []).map((it) => Array.isArray(it) ? it[0] : (it && it.name)) }));
      return JSON.stringify({ hn: p.hn, name: p.name, species: p.species, breed: p.breed, sex: p.sex, owner: p.owner && p.owner.name, phone: p.owner && p.owner.phone, visitCount: (p.visits || []).length, recentVisits: recent });
    }
    if (name === 'get_queue') {
      return JSON.stringify((d.queue || []).map((x) => ({ q: x.q, hn: x.hn, petName: x.petName, type: x.type, status: x.status, cc: x.cc, paid: x.paid })));
    }
    if (name === 'get_today_summary') {
      const rcps = (d.receipts || []).filter((r) => (r.type || 'opd') === 'opd' && r.date === today);
      const revenue = rcps.reduce((s, r) => s + (r.total || 0), 0);
      const q = d.queue || [];
      const cnt = (st) => q.filter((x) => x.status === st).length;
      return JSON.stringify({ date: today, opdRevenue: revenue, receiptsToday: rcps.length, queue: { wait: cnt('wait'), exam: cnt('exam'), cashier: cnt('cashier'), done: cnt('done') } });
    }
    if (name === 'get_revenue') {
      const range = input.range || 'today';
      const end = today;
      let start = end;
      if (range === '7d' || range === '30d') {
        const n = range === '7d' ? 6 : 29;
        const [y, m, dd] = end.split('-').map(Number);
        const dt = new Date(y, m - 1, dd - n);
        start = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
      const rcps = (d.receipts || []).filter((r) => r.date >= start && r.date <= end);
      const opd = rcps.filter((r) => (r.type || 'opd') === 'opd').reduce((s, r) => s + (r.total || 0), 0);
      const shop = rcps.filter((r) => r.type === 'shop').reduce((s, r) => s + (r.total || 0), 0);
      return JSON.stringify({ start, end, opdRevenue: opd, shopRevenue: shop, total: opd + shop, receipts: rcps.length });
    }
    if (name === 'list_appointments') {
      let appts = (d.appointments || []).filter((a) => a.status !== 'cancelled');
      if (input.date) appts = appts.filter((a) => a.date === input.date);
      else appts = appts.filter((a) => a.date >= today);
      appts = appts.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 15)
        .map((a) => ({ date: a.date, time: a.time, petName: a.petName, hn: a.hn, type: a.type, note: a.note, owner: a.ownerName }));
      return JSON.stringify({ count: appts.length, appointments: appts });
    }
    if (name === 'find_low_stock') {
      const low = [...(d.stock || []), ...(d.shopStock || [])].filter((s) => s && Number(s.qty) <= Number(s.min || 0))
        .slice(0, 30).map((s) => ({ name: s.name, qty: s.qty, min: s.min, cat: s.cat }));
      return JSON.stringify({ count: low.length, items: low });
    }
    if (name === 'open_case') {
      const p = (d.pets || []).find((x) => x.hn === String(input.hn));
      if (!p) return JSON.stringify({ error: 'ไม่พบ HN ' + input.hn });
      onOpenPet && onOpenPet(String(input.hn));
      setOpen(false);
      return JSON.stringify({ ok: true, message: 'เปิดหน้าเคสของ ' + (p.name || input.hn) + ' แล้ว' });
    }
    return JSON.stringify({ error: 'ไม่รู้จักเครื่องมือ ' + name });
  };

  // ── เครื่องมือที่แก้ข้อมูล (เรียกหลังผู้ใช้กดยืนยันแล้วเท่านั้น) ──
  const runWriteTool = (name, input) => {
    const d = ctxRef.current;
    if (name === 'add_walkin') {
      let payload;
      if (input.petType === 'existing') {
        const p = (d.pets || []).find((x) => x.hn === String(input.hn));
        if (!p) return 'ไม่พบ HN ' + input.hn;
        payload = { existingHn: String(input.hn), type: input.visitType || 'ตรวจรักษา', cc: input.cc || '' };
      } else {
        const np = input.newPet || {};
        if (!np.name) return 'ต้องระบุชื่อสัตว์เลี้ยงสำหรับเคสใหม่';
        payload = { newPet: { pet: np.name, species: np.species || 'สุนัข', owner: np.owner || '-', phone: np.phone || '-', sex: np.sex || '-', ageY: 0, ageM: 0, weight: null }, type: input.visitType || 'ตรวจรักษา', cc: input.cc || '' };
      }
      onWalkIn && onWalkIn(payload);
      return 'เปิดคิวเรียบร้อยแล้ว';
    }
    if (name === 'add_appointment') {
      const p = (d.pets || []).find((x) => x.hn === String(input.hn));
      if (!p) return 'ไม่พบ HN ' + input.hn + ' (ต้องเป็นสัตว์ที่มีในระบบแล้ว)';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) return 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD';
      const appt = { id: 'appt' + Date.now(), hn: String(input.hn), petName: p.name, species: p.species, ownerName: p.owner && p.owner.name || '', phone: p.owner && p.owner.phone || '', date: input.date, time: input.time || '09:00', type: input.type || 'ติดตามอาการ', note: input.note || '', status: 'scheduled' };
      onAddAppointment && onAddAppointment(appt);
      return 'เพิ่มนัดให้ ' + p.name + ' วันที่ ' + input.date + ' ' + (input.time || '09:00') + ' เรียบร้อย';
    }
    if (name === 'cancel_receipt') {
      const r = (d.receipts || []).find((x) => x.no === input.no);
      if (!r) return 'ไม่พบใบเสร็จเลขที่ ' + input.no;
      onCancelReceipt && onCancelReceipt(input.no);
      return 'ยกเลิกใบเสร็จ ' + input.no + ' แล้ว';
    }
    return 'ไม่รู้จักเครื่องมือ ' + name;
  };

  // ── คำอธิบายบนการ์ดยืนยัน ──
  const describeAction = (name, input) => {
    const d = ctxRef.current;
    if (name === 'add_walkin') {
      const who = input.petType === 'existing'
        ? ('HN ' + input.hn + ((d.pets || []).find((x) => x.hn === String(input.hn)) ? (' · ' + (d.pets || []).find((x) => x.hn === String(input.hn)).name) : ''))
        : ((input.newPet && input.newPet.name) || 'สัตว์ใหม่') + ' (ลูกค้าใหม่)';
      return { title: '🆕 เปิดคิวใหม่', detail: who + ' · ' + (input.visitType || 'ตรวจรักษา') + (input.cc ? (' · อาการ: ' + input.cc) : '') };
    }
    if (name === 'add_appointment') {
      const p = (d.pets || []).find((x) => x.hn === String(input.hn));
      return { title: '📅 เพิ่มนัดหมาย', detail: (p ? p.name : ('HN ' + input.hn)) + ' · ' + input.date + ' ' + (input.time || '09:00') + ' · ' + (input.type || 'ติดตามอาการ') };
    }
    if (name === 'cancel_receipt') return { title: '🗑 ยกเลิกใบเสร็จ', detail: 'เลขที่ ' + input.no, danger: true };
    return { title: name, detail: JSON.stringify(input) };
  };

  const askConfirm = (desc) => new Promise((resolve) => { setPendingConfirm(desc); confirmResolveRef.current = resolve; });
  const resolveConfirm = (ok) => { setPendingConfirm(null); const r = confirmResolveRef.current; confirmResolveRef.current = null; if (r) r(ok); };

  const callAgent = async (messages) => {
    const r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: buildSystem(), tools: AGENT_TOOLS, messages }) });
    let data;
    try { data = await r.json(); } catch (e) { return { error: 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง' }; }
    if (!r.ok) return { error: (data && data.error) || ('HTTP ' + r.status) };
    return data;
  };

  // ── วน agentic loop ──
  const runLoop = async () => {
    setBusy(true);
    try {
      for (let step = 0; step < AGENT_MAX_STEPS; step++) {
        const resp = await callAgent(convoRef.current);
        if (resp.error) { addView('sys', '⚠️ ' + resp.error); return; }
        const textOut = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (textOut) addView('ai', textOut);
        convoRef.current = [...convoRef.current, { role: 'assistant', content: resp.content }];
        if (resp.stop_reason !== 'tool_use') return;

        const toolUses = (resp.content || []).filter((b) => b.type === 'tool_use');
        const results = [];
        for (const tu of toolUses) {
          if (AGENT_WRITE_TOOLS.has(tu.name)) {
            const ok = await askConfirm(describeAction(tu.name, tu.input || {}));
            let out;
            if (ok) { try { out = runWriteTool(tu.name, tu.input || {}); } catch (e) { out = 'เกิดข้อผิดพลาด: ' + (e.message || e); } }
            else out = 'ผู้ใช้กดยกเลิก ไม่ได้ดำเนินการ';
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: String(out) });
          } else {
            let out; try { out = runReadTool(tu.name, tu.input || {}); } catch (e) { out = JSON.stringify({ error: e.message || String(e) }); }
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: String(out) });
          }
        }
        convoRef.current = [...convoRef.current, { role: 'user', content: results }];
      }
      addView('sys', '(หยุด — ทำงานหลายขั้นเกินกำหนด ลองสั่งใหม่แบบเจาะจงขึ้น)');
    } catch (e) {
      addView('sys', '⚠️ เชื่อมต่อผู้ช่วย AI ไม่ได้: ' + (e.message || e) + ' (ต้อง deploy บน Vercel + ตั้งค่า ANTHROPIC_API_KEY)');
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy || pendingConfirm) return;
    setInput('');
    addView('user', text);
    convoRef.current = [...convoRef.current, { role: 'user', content: text }];
    runLoop();
  };

  const reset = () => { convoRef.current = []; setView([]); setPendingConfirm(null); confirmResolveRef.current = null; };

  const SUGGESTIONS = ['สรุปรายรับวันนี้', 'มีคิวอะไรค้างอยู่บ้าง', 'ค้นหาสัตว์ชื่อ...', 'ของในสต็อกใกล้หมดอะไรบ้าง'];

  return (
    <div className="no-print">
      {/* ปุ่มลอย */}
      {!open && (
        <button onClick={() => setOpen(true)} title="ผู้ช่วย AI"
          style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 900, width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--navy), var(--mint-deep))', color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,.25)', fontSize: 26 }}>
          🤖
        </button>
      )}

      {/* แผงแชต */}
      {open && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 900, width: 'min(400px, calc(100vw - 28px))', height: 'min(620px, calc(100vh - 36px))', background: '#fff', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--line)' }}>
          {/* header */}
          <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg, var(--navy), var(--mint-deep))', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>ผู้ช่วย AI วังน้อยสัตวแพทย์</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>สั่งงาน · ค้นหา · สรุปข้อมูล</div>
            </div>
            <button onClick={reset} title="ล้างบทสนทนา" style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>ล้าง</button>
            <button onClick={() => setOpen(false)} title="ปิด" style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          {/* messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--paper)' }}>
            {view.length === 0 && (
              <div style={{ color: 'var(--ink-faint)', fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ marginBottom: 8 }}>สวัสดีค่ะ 🐾 พิมพ์สั่งงานได้เลย เช่น</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)} style={{ textAlign: 'left', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 11px', fontSize: 12.5, cursor: 'pointer', color: 'var(--ink-soft)' }}>{s}</button>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-faint)' }}>* งานที่แก้ข้อมูล (เปิดคิว/เพิ่มนัด/ยกเลิกใบเสร็จ) จะให้กดยืนยันก่อนเสมอ</div>
              </div>
            )}
            {view.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.who === 'user' ? 'var(--navy)' : (m.who === 'sys' ? '#FDECEA' : '#fff'),
                  color: m.who === 'user' ? '#fff' : (m.who === 'sys' ? '#8C3028' : 'var(--ink)'),
                  border: m.who === 'ai' ? '1px solid var(--line)' : 'none',
                }}>{m.text}</div>
              </div>
            ))}
            {busy && !pendingConfirm && (
              <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--ink-faint)', padding: '4px 6px' }}>กำลังคิด…</div>
            )}
            {/* การ์ดยืนยันก่อนแก้ข้อมูล */}
            {pendingConfirm && (
              <div style={{ alignSelf: 'stretch', background: '#fff', border: '2px solid ' + (pendingConfirm.danger ? 'var(--blush-deep)' : 'var(--mint-deep)'), borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{pendingConfirm.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>{pendingConfirm.detail}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 10 }}>AI ขออนุญาตทำรายการนี้ ยืนยันหรือไม่?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => resolveConfirm(true)} className="btn btn-primary btn-sm" style={{ flex: 1 }}>ยืนยัน</button>
                  <button onClick={() => resolveConfirm(false)} className="btn btn-sm" style={{ flex: 1 }}>ยกเลิก</button>
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <div style={{ padding: 10, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: '#fff' }}>
            <input className="input" value={input} disabled={busy || !!pendingConfirm}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={pendingConfirm ? 'รอการยืนยันด้านบน…' : 'พิมพ์คำสั่ง เช่น สรุปรายรับวันนี้'}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={send} disabled={busy || !!pendingConfirm || !input.trim()}>ส่ง</button>
          </div>
        </div>
      )}
    </div>
  );
}
