// ── Reports & Analytics ──────────────────────────────────
var { useState, useEffect, useRef, useMemo } = React;

const TIME_RANGES = [
  { id: 'today', label: 'วันนี้', days: 0 },
  { id: 'week', label: '7 วัน', days: 7 },
  { id: 'month', label: '30 วัน', days: 30 },
  { id: 'year', label: '1 ปี', days: 365 },
];

// format วันที่แบบ local (ห้ามใช้ toISOString — UTC+7 ทำให้วันเพี้ยนถอยหลัง 1 วัน)
function fmtLocalDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function getDateRange(rangeId) {
  const end = new Date();
  const start = new Date(end);
  const range = TIME_RANGES.find((r) => r.id === rangeId);
  if (range.days > 0) start.setDate(start.getDate() - range.days);
  return [fmtLocalDate(start), fmtLocalDate(end)];
}

function filterVisits(pets, [s, e]) {
  const out = [];
  (pets || []).forEach((p) => (p.visits || []).filter((v) => v.date >= s && v.date <= e).forEach((v) =>
    out.push({ ...v, petHn: p.hn, petName: p.name, petSpecies: p.species, owner: p.owner })));
  return out;
}

// ตัด "(YYYY-MM-DD)" ท้ายชื่อรายการของเคสแอดมิด (ถูกเติมตอนรวมบิลจำหน่าย) เพื่อจับกลุ่มชื่อสินค้าให้ตรงกัน
function cleanItemName(n) { return String(n || '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim(); }
function receiptItemTuple(it) {
  return Array.isArray(it)
    ? [cleanItemName(it[0]), Number(it[1]) || 1, Number(it[2]) || 0]
    : [cleanItemName(it.name), Number(it.qty) || 1, Number(it.price) || 0];
}

// รายรับ/ยอดขาย/แยกประเภท คิดจาก "ใบเสร็จจริง" (opdReceipts = ใบเสร็จ OPD ในช่วง ยกเลิกแล้วถูกลบทิ้งไปก่อน)
// → เป็นแหล่งความจริงเดียวกับหน้า OPD · เคสแอดมิดคิดที่วันจำหน่าย (วันบนใบเสร็จ) · รวม VAT/แก้บิลตามยอด total
// visits ใช้เฉพาะนับ "เคสตรวจรักษา" (ต้องมีอาการ/วินิจฉัย ซึ่งเป็นข้อมูลคลินิกไม่มีในใบเสร็จ)
function calcMetrics(pets, queue, stock, visits, opdReceipts, extra) {
  extra = extra || {};
  const dateRange = extra.dateRange || null;
  const appointments = extra.appointments || [];
  const prevRevenue = extra.prevRevenue;
  opdReceipts = opdReceipts || [];
  const [rs, re] = dateRange || ['', '￿'];

  const opdRevenue = opdReceipts.reduce((s, r) => s + (Number(r.total) || 0), 0);
  // กำไรขั้นต้น = รายรับ − ต้นทุนสินค้าจริง (COGS) ของรายการที่มี stockId+cost
  // ค่าบริการ/ตรวจ (ไม่มี stockId) = กำไรเต็ม (ไม่มีต้นทุนสินค้า · ยังไม่หักค่าแรง/ค่าโสหุ้ย)
  // ดึงต้นทุนจากทั้งคลังคลินิก (stock) และคลังเพ็ทช้อป (extra.shopStock)
  const costById = {};
  [stock || [], extra.shopStock || []].forEach((arr) => arr.forEach((st) => {
    if (st && st.id != null && costById[st.id] == null && Number(st.cost) > 0) costById[st.id] = Number(st.cost);
  }));
  let cogs = 0;
  opdReceipts.forEach((r) => (r.items || []).forEach((it) => {
    const stockId = Array.isArray(it) ? it[3] : it.stockId;
    const qty = Number(Array.isArray(it) ? it[1] : it.qty) || 1;
    const unitPrice = Number(Array.isArray(it) ? it[2] : it.price) || 0;
    const c = stockId != null ? costById[stockId] : null;
    if (c == null) return;
    // กันทุนผิดหน่วย: บางตัวใส่ทุน "ต่อแพ็ค/ต่อขวด" แต่ขาย "ต่อเม็ด/ต่อโดส" (เช่น Onsior ทุน 535/กล่อง 30 เม็ด ขาย 40/เม็ด)
    // ถ้าทุนต่อหน่วยสูงกว่าราคาขายในบิล = ทุนเชื่อถือไม่ได้ → ข้าม (ไปแก้ทุนต่อหน่วยในหน้าสต็อกแล้วจะถูกนับอัตโนมัติ)
    if (c > unitPrice) return;
    cogs += qty * c;
  }));
  cogs = Math.round(cogs);
  const profit = opdRevenue - cogs;                 // กำไรขั้นต้น
  const profitMargin = opdRevenue > 0 ? Math.round(profit / opdRevenue * 100) : 0;
  const cases = opdReceipts.length;               // จำนวนเคส = จำนวนใบเสร็จ (เคสที่คิดเงินแล้ว)
  const avgRevenuePerCase = cases > 0 ? Math.round(opdRevenue / cases) : 0;
  const treatmentCases = visits.filter((v) => v.cc || v.dx).length;

  // จำนวนวันในช่วง → เฉลี่ยเคส/วัน (แทน Conversion Rate เดิม)
  let days = 1;
  if (rs && re && re !== '￿') { const dd = Math.round((new Date(re) - new Date(rs)) / 86400000) + 1; if (dd > 0) days = dd; }
  const casesPerDay = Math.round(cases / days * 10) / 10;
  // เทียบช่วงก่อนหน้า (%)
  const revenueChangePct = (prevRevenue != null && prevRevenue > 0) ? Math.round((opdRevenue - prevRevenue) / prevRevenue * 100) : null;

  // ── บริการของใบเสร็จ (แยกเคส/รายรับตามบริการ) ──
  // ใช้ svcType ที่บันทึกไว้ตอนออกใบเสร็จ → ถ้าไม่มี (บิลเก่า) ย้อนไปดูบริการที่เลือกใน queue ตามเลข q (backfill)
  //   → ถ้ายังไม่มี (บิลเก่ามากไม่มี q) เดาจากชื่อรายการแรกในบิลเป็นทางสุดท้าย
  const queueByQ = {}; (queue || []).forEach((q) => { if (q && q.q) queueByQ[q.q] = q; });
  const svcOfReceipt = (r) => {
    let t = r.svcType || (r.q && queueByQ[r.q] && queueByQ[r.q].type) || null;
    if (t) return t;
    const first = (r.items || [])[0];
    const n = first ? cleanItemName(Array.isArray(first) ? first[0] : first.name).toLowerCase() : '';
    if (n.includes('วัคซีน') || n.includes('vaccine')) return 'วัคซีน';
    if (n.includes('ผ่าตัด') || n.includes('ทำหมัน') || n.includes('surgery')) return 'ผ่าตัด';
    if (n.includes('อาบน้ำ') || n.includes('ตัดขน') || n.includes('groom')) return 'อาบน้ำตัดขน';
    return 'ตรวจรักษา';
  };
  // บริการ → หมวดรายรับ (รวมบริการที่ใกล้เคียงเข้าหมวดเดียว)
  const SVC_TO_CAT = { 'ตรวจรักษา': 'รักษา', 'ติดตามอาการ': 'รักษา', 'อื่นๆ': 'รักษา', 'ผ่าตัด': 'ผ่าตัด', 'วัคซีน': 'วัคซีน', 'อาบน้ำตัดขน': 'อาบน้ำ', 'ซื้อสินค้า': 'ซื้อสินค้า' };
  const svcCat = (svc) => SVC_TO_CAT[svc] || 'รักษา';

  const revenueByCategory = {};
  const byMethod = {};
  const petByHn = {}; (pets || []).forEach((p) => { petByHn[p.hn] = p; });
  const speciesBreakdown = {};
  const custSpend = {};
  const productSales = {};
  opdReceipts.forEach((r) => {
    // หมวดรายรับ = บริการที่เลือก · ยกเว้นรายการที่คีย์จากเพ็ทช้อป (POS, origin='shop') ดึงออกเป็นหมวด "เพ็ทช้อป"
    const cat = svcCat(svcOfReceipt(r));
    (r.items || []).forEach((it) => {
      const name = cleanItemName(Array.isArray(it) ? it[0] : it.name);
      const qty = Number(Array.isArray(it) ? it[1] : it.qty) || 1;
      const price = Number(Array.isArray(it) ? it[2] : it.price) || 0;
      const origin = Array.isArray(it) ? it[4] : it.origin;
      if (!name) return;
      const line = qty * price;
      const bucket = origin === 'shop' ? 'เพ็ทช้อป' : cat;
      revenueByCategory[bucket] = (revenueByCategory[bucket] || 0) + line;
      if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
      productSales[name].qty += qty; productSales[name].revenue += line;
    });
    const m = r.method || 'อื่นๆ';
    if (!byMethod[m]) byMethod[m] = { count: 0, revenue: 0 };
    byMethod[m].count++; byMethod[m].revenue += Number(r.total) || 0;
    const sp = (petByHn[r.hn] && petByHn[r.hn].species) || 'อื่นๆ';
    speciesBreakdown[sp] = (speciesBreakdown[sp] || 0) + 1;
    const hn = r.hn || '?';
    if (!custSpend[hn]) custSpend[hn] = { hn, name: r.petName || (petByHn[hn] && petByHn[hn].name) || '-', owner: (petByHn[hn] && petByHn[hn].owner && petByHn[hn].owner.name) || r.ownerName || '', spend: 0, count: 0 };
    custSpend[hn].spend += Number(r.total) || 0; custSpend[hn].count++;
  });
  const topProducts = Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }));
  const topCustomers = Object.values(custSpend).sort((a, b) => b.spend - a.spend).slice(0, 5);

  // ลูกค้าใหม่ vs เก่า — นับจาก "วันแรกที่เคยมี visit" ของสัตว์ (อยู่ในช่วง = ใหม่)
  const firstSeen = {}; (pets || []).forEach((p) => { const ds = (p.visits || []).map((v) => v.date).filter(Boolean).sort(); if (ds.length) firstSeen[p.hn] = ds[0]; });
  let newCust = 0, returningCust = 0;
  new Set(opdReceipts.map((r) => r.hn).filter(Boolean)).forEach((hn) => { const f = firstSeen[hn]; if (f && f >= rs && f <= re) newCust++; else returningCust++; });

  // ช่วงเวลาที่คนเยอะ — จากคิว (doneDate ในช่วง, จัดกลุ่มตามชั่วโมงเช็คอิน)
  const busyHours = {};
  (queue || []).forEach((q) => {
    if (!q.time) return;
    if (dateRange && (!q.doneDate || q.doneDate < rs || q.doneDate > re)) return;
    const h = parseInt(String(q.time).split(':')[0]);
    if (!isNaN(h)) busyHours[h] = (busyHours[h] || 0) + 1;
  });

  // อัตรามาตามนัด — นัดในช่วง: มาแล้ว vs ไม่มา (เลยวันแล้วไม่ได้มาร์คมา) · ไม่นับที่ยกเลิก/ยังไม่ถึงวัน
  const today = todayISO();
  let apptArrived = 0, apptNoShow = 0;
  (appointments || []).forEach((a) => {
    if (dateRange && (a.date < rs || a.date > re)) return;
    if (a.status === 'cancelled') return;
    if (a.status === 'arrived') apptArrived++;
    else if (a.date < today) apptNoShow++;
  });
  const showRate = (apptArrived + apptNoShow) > 0 ? Math.round(apptArrived / (apptArrived + apptNoShow) * 100) : null;

  const dailyRevenue = {};
  opdReceipts.forEach((r) => { dailyRevenue[r.date] = (dailyRevenue[r.date] || 0) + (Number(r.total) || 0); });

  // เคสแยกตามประเภท: ใช้ "บริการ" ที่เลือกตอนรับเคส (svcOfReceipt: svcType → queue → เดาชื่อ) — 1 เคส 1 บริการชัดเจน
  // casesByService: เก็บรายชื่อเคสในแต่ละบริการด้วย (ไว้กดดูรายละเอียด/เปิด OPD จากโดนัท)
  const serviceBreakdown = {};
  const casesByService = {};
  opdReceipts.forEach((r) => {
    const primary = svcOfReceipt(r);
    serviceBreakdown[primary] = (serviceBreakdown[primary] || 0) + 1;
    (casesByService[primary] = casesByService[primary] || []).push({
      no: r.no, hn: r.hn, petName: r.petName, ownerName: r.ownerName,
      species: (petByHn[r.hn] && petByHn[r.hn].species) || '', date: r.date, total: Number(r.total) || 0,
    });
  });
  if (cases > 0 && Object.keys(serviceBreakdown).length === 0) serviceBreakdown['ตรวจรักษา'] = cases;
  Object.values(casesByService).forEach((list) => list.sort((a, b) => (a.date < b.date ? 1 : -1)));

  return {
    opdRevenue, profit, profitMargin, cogs, cases, avgRevenuePerCase, treatmentCases,
    casesPerDay, revenueChangePct, prevRevenue: prevRevenue || 0,
    topProducts, dailyRevenue, serviceBreakdown, casesByService, productSales,
    revenueByCategory, byMethod, speciesBreakdown, newCust, returningCust,
    busyHours, topCustomers, showRate, apptArrived, apptNoShow,
  };
}

// ── Receipt Export ──
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function getMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS_TH[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}

function ReceiptExportModal({ receipts, onClose }) {
  const now = new Date();
  const hasData = new Set(receipts.map((r) => r.date.slice(0, 7)));

  // get all years that have receipts + current year
  const years = useMemo(() => {
    const ys = new Set([...hasData].map((m) => parseInt(m.slice(0, 4))));
    ys.add(now.getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [receipts]);

  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selYear, setSelYear] = useState(years[0] || now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1); // 1-12
  const ym = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const filtered = receipts.filter((r) => r.date.startsWith(ym));
  const total = filtered.reduce((s, r) => s + (r.total || 0), 0);

  return (
    <Modal title="🧾 Export ใบเสร็จรับเงิน" onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>ปิด</button>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={filtered.length === 0}>
          <Icon name="printer" size={16} /> พิมพ์ PDF — {filtered.length} ใบ ({fmtB(total)})
        </button>
      </>}
    >
      {/* ── year + month picker ── */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
        {/* year row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 40 }}>ปี:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {years.map((y) => (
              <button key={y}
                className={'btn btn-sm' + (selYear === y ? ' btn-primary' : '')}
                onClick={() => setSelYear(y)}>
                พ.ศ. {y + 543}
              </button>
            ))}
          </div>
        </div>
        {/* month grid */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 40, paddingTop: 8 }}>เดือน:</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, flex: 1 }}>
            {MONTHS_TH.map((label, i) => {
              const mStr = `${selYear}-${String(i + 1).padStart(2, '0')}`;
              const count = receipts.filter((r) => r.date.startsWith(mStr)).length;
              const isActive = selMonth === i + 1;
              return (
                <button key={i} onClick={() => setSelMonth(i + 1)}
                  style={{
                    padding: '8px 6px', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 800 : 500,
                    border: isActive ? '2px solid var(--navy)' : '1.5px solid var(--line)',
                    background: isActive ? 'var(--navy)' : count > 0 ? 'var(--mint-soft)' : 'var(--surface)',
                    color: isActive ? '#fff' : count > 0 ? 'var(--mint-deep)' : 'var(--ink-faint)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                  {label}
                  {count > 0 && <span style={{ fontSize: 10, opacity: .85 }}>{count} ใบ</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{MONTHS_TH[selMonth - 1]} พ.ศ. {selYear + 543}:</span>
          {filtered.length > 0
            ? <span>{filtered.length} ใบ · ยอดรวม <b>{fmtB(total)}</b></span>
            : <span style={{ color: 'var(--ink-faint)' }}>ไม่มีใบเสร็จในเดือนนี้</span>}
          {/* ปุ่มพิมพ์ด้านบน — ไม่ต้องเลื่อนลงไปท้ายสุดเวลาใบเสร็จเยอะ */}
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => window.print()} disabled={filtered.length === 0}>
            <Icon name="printer" size={15} /> พิมพ์ PDF — {filtered.length} ใบ
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="queue-empty">ไม่มีใบเสร็จในเดือนนี้</div>
      ) : (
        <div>
          {/* summary list (screen only) */}
          <div className="no-print card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <table className="tbl">
              <thead><tr><th>เลขที่</th><th>วันที่</th><th>สัตว์เลี้ยง</th><th>เจ้าของ</th><th>ชำระโดย</th><th className="num">ยอด</th></tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{r.no}</td>
                    <td style={{ fontSize: 13 }}>{r.date}</td>
                    <td>{r.petName !== '-' ? r.petName : <span style={{ color: 'var(--ink-faint)' }}>เพ็ทช้อป</span>}</td>
                    <td style={{ fontSize: 13 }}>{r.ownerName !== '-' ? r.ownerName : '—'}</td>
                    <td><span className="chip">{r.method}</span></td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmtB(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* printable invoices — ครอบด้วย .print-batch เพื่อพิมพ์หลายใบ ใบละหน้า (ดู @media print ใน styles.css) */}
          <div className="print-batch">
            {filtered.map((r, i) => (
              <div key={i} className="print-receipt" style={{ marginBottom: 32 }}>
                <TaxInvoice
                  items={(r.items || []).map((it) => Array.isArray(it) ? { name: it[0], qty: it[1], price: it[2] } : it)}
                  petName={r.petName !== '-' ? r.petName : ''}
                  ownerName={r.ownerName !== '-' ? r.ownerName : ''}
                  ownerPhone={r.ownerPhone || ''} ownerAddr={r.ownerAddr || ''} ownerTaxId={r.ownerTaxId || ''}
                  method={r.method} vatMode="none" no={r.no} date={r.date}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── SVG Bar Chart ──
// แต่ละแท่งมี d.full = ป้ายเต็ม (เช่น "มิ.ย. 2568") สำหรับ tooltip เวลาเอาเมาส์ชี้/กด
function BarChart({ data }) {
  const ref = useRef(null);
  const [w, setW] = useState(500);
  const [tip, setTip] = useState(null); // { i, cx, label, value }
  useEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const h = 180, pad = { l: 52, r: 16, t: 12, b: 36 };
  const chartW = w - pad.l - pad.r, chartH = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.v), 1);
  const slot = chartW / data.length;
  const barW = Math.max(4, slot - 4);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  // ป้ายแกน X เยอะเกินจะทับกัน — โชว์เว้นช่วงเมื่อมีแท่งเยอะ (แต่แท่งสุดท้ายโชว์เสมอ)
  const labelEvery = Math.max(1, Math.ceil(data.length / 16));
  const tipLeft = tip ? Math.min(Math.max(tip.cx, 46), w - 46) : 0;
  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg width={w} height={h} style={{ overflow: 'visible', fontFamily: 'inherit' }}>
        {/* grid */}
        {gridLines.map((g, i) => {
          const y = pad.t + chartH * (1 - g);
          return (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + chartW} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--ink-faint)">{g > 0 ? fmtB(Math.round(max * g)) : ''}</text>
            </g>
          );
        })}
        {/* bars */}
        {data.map((d, i) => {
          const bh = chartH * (d.v / max);
          const x = pad.l + i * slot + (slot - barW) / 2;
          const y = pad.t + chartH - bh;
          const active = tip && tip.i === i;
          const showLabel = i % labelEvery === 0 || i === data.length - 1;
          const setT = () => setTip({ i, cx: pad.l + i * slot + slot / 2, label: d.full || d.label, value: d.v });
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh}
                rx={3} fill={d.today ? 'var(--mint-deep)' : 'var(--navy)'} opacity={d.v === 0 ? .15 : active ? .8 : 1} />
              {showLabel && (
                <text x={x + barW / 2} y={pad.t + chartH + 16} textAnchor="middle" fontSize={9.5} fill="var(--ink-faint)">{d.label}</text>
              )}
              {d.v > 0 && bh > 18 && barW >= 22 && (
                <text x={x + barW / 2} y={y + 13} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700}>{fmtB(d.v)}</text>
              )}
              {/* พื้นที่รับการชี้/กด เต็มความสูงคอลัมน์ (แท่งบางก็ยังกดง่าย) */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={chartH} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={setT} onMouseMove={setT} onMouseLeave={() => setTip(null)}
                onClick={() => setTip(active ? null : { i, cx: pad.l + i * slot + slot / 2, label: d.full || d.label, value: d.v })} />
            </g>
          );
        })}
        <line x1={pad.l} x2={pad.l + chartW} y1={pad.t + chartH} y2={pad.t + chartH} stroke="var(--line)" strokeWidth={1.5} />
      </svg>
      {tip && (
        <div style={{ position: 'absolute', left: tipLeft, top: 2, transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 3px 10px rgba(0,0,0,.22)', zIndex: 5, textAlign: 'center', lineHeight: 1.4 }}>
          <div style={{ opacity: .85, fontSize: 11 }}>{tip.label}</div>
          <div style={{ fontWeight: 800, fontSize: 13.5 }}>{fmtB(tip.value)}</div>
        </div>
      )}
    </div>
  );
}

// ── SVG Donut Chart ──
const DONUT_COLORS = ['#3A8F6A','#3A3F8F','#C9A227','#C0685C','#5E8A93','#9E8ABF','#7A5E00'];
function DonutChart({ data, size = 160, onSelect, selected }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  if (total === 0) return <div style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: 20 }}>ยังไม่มีข้อมูล</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.42, ir = size * 0.26;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const a = (d.v / total) * 2 * Math.PI;
    const sa = angle, ea = angle + a;
    angle = ea;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const ix1 = cx + ir * Math.cos(ea), iy1 = cy + ir * Math.sin(ea);
    const ix2 = cx + ir * Math.cos(sa), iy2 = cy + ir * Math.sin(sa);
    const la = a > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${r},${r} 0 ${la} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${la} 0 ${ix2},${iy2}Z`;
    return { path, color: DONUT_COLORS[i % DONUT_COLORS.length], label: d.label, v: d.v, pct: Math.round(d.v / total * 100) };
  });
  const click = onSelect ? (label) => onSelect(label) : null;
  const dim = (label) => selected && selected !== label ? 0.28 : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2}
            opacity={dim(s.label)} style={{ cursor: click ? 'pointer' : 'default', transition: 'opacity .15s' }}
            onClick={click ? () => click(s.label) : undefined}>
            <title>{s.label} · {s.v} เคส ({s.pct}%)</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={800} fill="var(--ink)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">เคสทั้งหมด</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} onClick={click ? () => click(s.label) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, opacity: dim(s.label),
              cursor: click ? 'pointer' : 'default', padding: '1px 4px', borderRadius: 5,
              background: selected === s.label ? 'var(--line-soft)' : 'transparent' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <b>{s.v}</b>
            <span style={{ color: 'var(--ink-faint)', minWidth: 36 }}>({s.pct}%)</span>
          </div>
        ))}
      </div>
      {click ? <div style={{ width: '100%', fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 2 }}>👆 กดที่ประเภทเพื่อดูรายชื่อเคส</div> : null}
    </div>
  );
}

// ── ป๊อปอัพ: กดโดนัท → ซ้ายวงกลม · ขวารายชื่อเคสในบริการนั้น (กดเปิด OPD ได้) ──
function ServiceCasesModal({ donutData, cases, selected, onSelectCat, onOpenPet, onClose, heading = 'เคสแยกตามประเภท' }) {
  const list = cases[selected] || [];
  const SP_EMOJI = { 'สุนัข': '🐶', 'แมว': '🐱', 'กระต่าย': '🐰', 'นก': '🐦' };
  return (
    <Modal title={`🩺 ${heading} — ${selected}`} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, alignItems: 'start' }}>
        {/* ซ้าย: โดนัท (กดสลับบริการได้) */}
        <div>
          <DonutChart data={donutData} size={170} onSelect={onSelectCat} selected={selected} />
        </div>
        {/* ขวา: รายชื่อเคสในบริการที่เลือก */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{selected}</span>
            <span className="chip chip-navy">{list.length} เคส</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)' }}>
            {list.length === 0 ? <div className="queue-empty">ยังไม่มีเคส</div>
              : list.map((c, i) => (
                <div key={(c.no || '') + '_' + i}
                  onClick={() => onOpenPet && c.hn && c.hn !== '?' && (onClose(), onOpenPet(c.hn))}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5,
                    cursor: onOpenPet && c.hn && c.hn !== '?' ? 'pointer' : 'default' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="anim-wiggle">{SP_EMOJI[c.species] || '🐾'}</span> {c.petName || '-'}
                      {c.hn ? <span style={{ color: 'var(--ink-faint)', fontSize: 11.5, fontWeight: 500 }}> · HN {c.hn}</span> : null}
                    </div>
                    <div style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>{c.ownerName || ''} · {dateTH(c.date)} · {c.no || ''}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--mint-deep)', flexShrink: 0 }}>{fmtB(c.total)}</span>
                </div>
              ))}
          </div>
          {onOpenPet ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>👆 กดที่เคสเพื่อเปิดประวัติ/OPD</div> : null}
        </div>
      </div>
    </Modal>
  );
}

// ── Excel Export ──
// 1 แถว = 1 ใบเสร็จ/เคส แยกราคารักษา (รวม VAT แล้ว) กับราคาอาหารสัตว์ (ไม่คิด VAT) ออกจากกัน
// เคส OPD = แยกอาหาร/รักษาตามหมวดสินค้า · ใบเสร็จเพ็ทช้อป = ลงช่องอาหารทั้งใบ (ไม่มีค่ารักษา)
function exportToExcel(visits, receipts, rangeLabel, stock = [], dateRange = null, shopStock = []) {
  const stockById = {};
  (stock || []).forEach((st) => { if (st && st.id != null) stockById[st.id] = st; });
  // หมวดที่ถือเป็น "อาหารสัตว์" — จับทุกหมวดที่มีคำว่า "อาหาร" · ดูทั้งคลังคลินิกและคลังเพ็ทช้อป (ใบเสร็จเก็บแค่ชื่อ ไม่มี stockId)
  const allStock = [...(stock || []), ...(shopStock || [])];
  const isFood = (name, stockId) => {
    const st = (stockId != null && stockById[stockId]) || allStock.find((x) => x && x.name === name);
    return !!(st && /อาหาร/.test(st.cat || ''));
  };
  // อาบน้ำ/ตัดขน — จับจากชื่อรายการที่มีคำว่า "อาบน้ำ" (หรือหมวด "อาบน้ำ")
  const isGroom = (name, stockId) => {
    if (/อาบน้ำ/.test(String(name || ''))) return true;
    const st = (stockId != null && stockById[stockId]) || allStock.find((x) => x && x.name === name);
    return !!(st && /อาบน้ำ/.test(st.cat || ''));
  };
  const cell = (n) => (n ? n : '');  // ช่องว่างเมื่อเป็น 0 ให้อ่านง่าย
  const header = ['วันที่', 'HN', 'ชื่อสัตว์', 'ชนิด', 'เจ้าของ', 'เบอร์โทร', 'CC', 'Dx', 'รายการ', 'เลขที่ใบเสร็จ', 'วิธีการชำระเงิน', 'จำนวน', 'ราคารักษา', 'ราคาอาหารสัตว์', 'ราคาอาบน้ำตัดขน', 'รวม'];
  let sumTreat = 0, sumFood = 0, sumGroom = 0;
  const [rs, re] = dateRange || ['', '￿'];
  // ข้อมูลคลินิก (CC/Dx/ชนิด/เบอร์) จาก visits ไว้เติมให้แถว — จับคู่ด้วย HN|คิว|วันที่ และ fallback ด้วย HN
  const visitByKey = {}, petInfoByHn = {};
  (visits || []).forEach((v) => {
    visitByKey[visitReceiptKey(v.petHn, v)] = v;
    if (!petInfoByHn[v.petHn]) petInfoByHn[v.petHn] = v;
  });
  // ── แถว OPD: อ้างอิงจาก "ใบเสร็จจริง" (type opd) เพื่อให้ตรงกับ PDF + สะท้อนการแก้ไขใบเสร็จเสมอ ──
  const opdRows = (receipts || [])
    .filter((r) => (r.type || 'opd') === 'opd' && r.date >= rs && r.date <= re)
    .map((r) => {
      const v = visitByKey[`${r.hn}|${r.q || ''}|${r.date}`] || petInfoByHn[r.hn] || {};
      const items = (r.items || []).map((it) => Array.isArray(it) ? it : [it.name, it.qty, it.price]);
      let treat = 0, food = 0, groom = 0, qtyTotal = 0;
      const names = [];
      items.forEach(([name, qty, price, stockId]) => {
        const q = Number(qty) || 1, line = q * (Number(price) || 0);
        qtyTotal += q;
        if (name) names.push(name);
        if (isGroom(name, stockId)) groom += line;       // อาบน้ำตัดขน
        else if (isFood(name, stockId)) food += line;    // อาหารสัตว์
        else treat += line;                              // รักษา
      });
      sumTreat += treat; sumFood += food; sumGroom += groom;
      return [
        r.date, r.hn || '', (r.petName && r.petName !== '-' ? r.petName : (v.petName || '')), v.petSpecies || '',
        (r.ownerName && r.ownerName !== '-' ? r.ownerName : (v.owner?.name || '')), v.owner?.phone || '', v.cc || '', v.dx || '',
        names.join(', '), r.no || '', r.method || '', qtyTotal, cell(treat), cell(food), cell(groom), treat + food + groom,
      ];
    });
  const visitRows = opdRows;
  // แถวจากใบเสร็จเพ็ทช้อป (ขายอาหาร/สินค้า) — ลงช่องราคาอาหารสัตว์ทั้งใบ ไม่คิด VAT
  const shopRows = (receipts || [])
    .filter((r) => r.type === 'shop' && r.date >= rs && r.date <= re)
    .map((r) => {
      const items = (r.items || []).map((it) => Array.isArray(it) ? it : [it.name, it.qty, it.price]);
      let food = 0, qtyTotal = 0;
      const names = [];
      items.forEach(([name, qty, price]) => {
        const q = Number(qty) || 1;
        qtyTotal += q;
        if (name) names.push(name);
        food += q * (Number(price) || 0);
      });
      food = food || Number(r.total) || 0;
      sumFood += food;
      const owner = r.ownerName && r.ownerName !== '-' ? r.ownerName : '';
      return [r.date, '', '', '', owner, '', '', '', names.join(', '), r.no || '', r.method || '', qtyTotal, '', food, '', food];
    });
  const rows = [header, ...visitRows, ...shopRows, [], ['สรุปรายรับทั้งสิ้น', '', '', '', '', '', '', '', '', '', '', '', sumTreat, sumFood, sumGroom, sumTreat + sumFood + sumGroom]];
  const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `รายรับ_${rangeLabel}_${todayISO()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── รายงานผลงาน/ค่าคอมรายคน (หมอ + ผู้ช่วย ในการกดครั้งเดียว · พิมพ์แยกคนละหน้า) ──
// ประเภทบริการที่พบจริงในชุดข้อมูล — ใช้เป็นคอลัมน์ของตารางหมอ
function svcColumnsOf(people) {
  const order = ['ตรวจรักษา', 'วัคซีน', 'ผ่าตัด', 'อาบน้ำตัดขน'];
  const found = new Set();
  people.forEach((p) => Object.keys(p.byService || {}).forEach((k) => found.add(k)));
  return [...order.filter((k) => found.has(k)), ...[...found].filter((k) => !order.includes(k)).sort()];
}
function exportStaffCSV(vetPeople, asstPeople, pct, rangeLabel) {
  const cols = svcColumnsOf(vetPeople);
  const rows = [];
  rows.push([`รายงานผลงานรายคน — ${rangeLabel}`]);
  rows.push([]);
  rows.push(['🩺 สัตวแพทย์']);
  rows.push(['ลำดับ', 'ชื่อ', 'จำนวนเคส', ...cols.map((c) => `${c} (บาท)`), 'ยอดรวม (บาท)']);
  vetPeople.forEach((p, i) => rows.push([i + 1, p.name, p.cases,
    ...cols.map((c) => (p.byService[c] ? Math.round(p.byService[c].revenue) : 0)), Math.round(p.revenue)]));
  rows.push(['', 'รวมทั้งหมด', vetPeople.reduce((a, p) => a + p.cases, 0),
    ...cols.map((c) => Math.round(vetPeople.reduce((a, p) => a + (p.byService[c] ? p.byService[c].revenue : 0), 0))),
    Math.round(vetPeople.reduce((a, p) => a + p.revenue, 0))]);
  rows.push([]); rows.push([]);
  rows.push(['🛁 ผู้ช่วย (ค่าคอมอาบน้ำ)']);
  rows.push(['ลำดับ', 'ชื่อ', 'จำนวนเคส', 'ยอดอาบน้ำ (บาท)', `ค่าคอม ${pct}% (บาท)`]);
  asstPeople.forEach((p, i) => rows.push([i + 1, p.name, p.cases, Math.round(p.groom), Math.round(p.groom * pct) / 100]));
  const groomSum = asstPeople.reduce((a, p) => a + p.groom, 0);
  rows.push(['', 'รวมทั้งหมด', asstPeople.reduce((a, p) => a + p.cases, 0), Math.round(groomSum), Math.round(groomSum * pct) / 100]);
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `ผลงานรายคน_${rangeLabel}_${todayISO()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function PayrollSheet({ heading, sub, children }) {
  return (
    <div className="print-receipt" style={{ background: '#fff', color: '#000', padding: '26px 28px', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 18 }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>{CLINIC.nameTH}</div>
        <div style={{ fontSize: 11.5, color: '#555' }}>{CLINIC.addr}</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>{heading}</div>
        <div style={{ fontSize: 12.5, color: '#444' }}>{sub}</div>
      </div>
      {children}
      <div style={{ display: 'flex', gap: 30, marginTop: 34, fontSize: 12, color: '#333' }}>
        {['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'].map((t) => (
          <div key={t} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ borderBottom: '1px dotted #666', height: 30 }} />
            <div style={{ marginTop: 5 }}>({t})</div>
            <div style={{ color: '#777', marginTop: 2 }}>วันที่ ......../......../........</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function StaffPayrollModal({ vetPeople, asstPeople, pct, rangeLabel, onClose }) {
  const cols = svcColumnsOf(vetPeople);
  const cell = { padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: 12.5 };
  const th = { ...cell, background: '#f3f1ec', fontWeight: 800, borderBottom: '1.5px solid #bbb' };
  const numc = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const foot = { ...numc, fontWeight: 800, background: '#faf8f4', borderTop: '1.5px solid #bbb' };
  const money = (n) => (n ? Math.round(n).toLocaleString('th-TH') : '—');
  const vetTotal = vetPeople.reduce((a, p) => a + p.revenue, 0);
  const groomTotal = asstPeople.reduce((a, p) => a + p.groom, 0);
  const commTotal = Math.round(groomTotal * pct) / 100;
  return (
    <Modal title="🧑‍⚕️ รายงานผลงาน / ค่าคอมรายคน" onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>ปิด</button>
        <button className="btn btn-soft" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)' }}
          onClick={() => exportStaffCSV(vetPeople, asstPeople, pct, rangeLabel)}>📅 Excel (.csv)</button>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={16} /> พิมพ์ PDF (2 หน้า)</button>
      </>}>
      <div className="no-print" style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12, padding: '8px 12px', background: 'var(--mint-soft)', border: '1px solid var(--mint)', borderRadius: 'var(--radius-sm)' }}>
        💡 กดพิมพ์ครั้งเดียวได้ทั้ง <b>หมอ (หน้า 1)</b> และ <b>ผู้ช่วย (หน้า 2)</b> · ยอดตามช่วงเวลาที่เลือกในหน้าสรุปรายรับ
      </div>
      <div className="print-batch">
        {/* ── หน้า 1: สัตวแพทย์ ── */}
        <PayrollSheet heading="รายงานผลงานรายคน — สัตวแพทย์" sub={`ช่วง ${rangeLabel} · พิมพ์เมื่อ ${dateTH(todayISO())}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 34, textAlign: 'center' }}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>ชื่อ</th>
                <th style={{ ...th, textAlign: 'right', width: 62 }}>เคส</th>
                {cols.map((c) => <th key={c} style={{ ...th, textAlign: 'right' }}>{c}</th>)}
                <th style={{ ...th, textAlign: 'right', width: 92 }}>ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {vetPeople.length === 0 ? (
                <tr><td style={cell} colSpan={4 + cols.length}>ไม่มีข้อมูลในช่วงนี้</td></tr>
              ) : vetPeople.map((p, i) => (
                <tr key={p.name}>
                  <td style={{ ...cell, textAlign: 'center', color: '#777' }}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{p.name}</td>
                  <td style={numc}>{p.cases || '—'}</td>
                  {cols.map((c) => <td key={c} style={numc}>{money(p.byService[c] ? p.byService[c].revenue : 0)}</td>)}
                  <td style={{ ...numc, fontWeight: 800 }}>{money(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...foot, textAlign: 'center' }}></td>
                <td style={{ ...foot, textAlign: 'left' }}>รวมทั้งหมด</td>
                <td style={foot}>{vetPeople.reduce((a, p) => a + p.cases, 0)}</td>
                {cols.map((c) => <td key={c} style={foot}>{money(vetPeople.reduce((a, p) => a + (p.byService[c] ? p.byService[c].revenue : 0), 0))}</td>)}
                <td style={foot}>{money(vetTotal)}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>* ยอดคิดจากใบเสร็จจริงในช่วง โดยนับเข้าชื่อที่เลือกในช่อง “สัตวแพทย์ผู้ตรวจ” ของแต่ละเคส</div>
        </PayrollSheet>

        {/* ── หน้า 2: ผู้ช่วย + ค่าคอม ── */}
        <PayrollSheet heading="รายงานค่าคอมมิชชั่น — ผู้ช่วย (อาบน้ำ/ตัดขน)" sub={`ช่วง ${rangeLabel} · อัตราค่าคอม ${pct}% ของยอดอาบน้ำ · พิมพ์เมื่อ ${dateTH(todayISO())}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 34, textAlign: 'center' }}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>ชื่อ</th>
                <th style={{ ...th, textAlign: 'right', width: 70 }}>เคส</th>
                <th style={{ ...th, textAlign: 'right', width: 120 }}>ยอดอาบน้ำ</th>
                <th style={{ ...th, textAlign: 'right', width: 120 }}>ค่าคอม {pct}%</th>
              </tr>
            </thead>
            <tbody>
              {asstPeople.length === 0 ? (
                <tr><td style={cell} colSpan={5}>ยังไม่มีรายชื่อผู้ช่วย</td></tr>
              ) : asstPeople.map((p, i) => (
                <tr key={p.name}>
                  <td style={{ ...cell, textAlign: 'center', color: '#777' }}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{p.name}</td>
                  <td style={numc}>{p.cases || '—'}</td>
                  <td style={numc}>{money(p.groom)}</td>
                  <td style={{ ...numc, fontWeight: 800 }}>{money(p.groom * pct / 100)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...foot, textAlign: 'center' }}></td>
                <td style={{ ...foot, textAlign: 'left' }}>รวมต้องจ่ายทั้งหมด</td>
                <td style={foot}>{asstPeople.reduce((a, p) => a + p.cases, 0)}</td>
                <td style={foot}>{money(groomTotal)}</td>
                <td style={{ ...foot, fontSize: 14 }}>{money(commTotal)}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>* ยอดอาบน้ำ = เฉพาะรายการที่มีคำว่า “อาบน้ำ” หรืออยู่ในหมวดอาบน้ำ — ค่ายา/สินค้าอื่นในบิลเดียวกันไม่ถูกนับ</div>
        </PayrollSheet>
      </div>
    </Modal>
  );
}

function SimpleBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 110, fontSize: 12.5, color: 'var(--ink-soft)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color || 'var(--navy)', borderRadius: 99, transition: 'width .4s' }} />
      </div>
      <div style={{ width: 70, textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtB(value)}</div>
    </div>
  );
}

// ── แก้ไขใบเสร็จถาวร (ชื่อ/รายการ/ยอด/วันที่) — บันทึกแล้วสะท้อนใน export ทันที ──
function ReceiptEditModal({ receipt, onClose, onSave, onOpenPet, services = [], stock = [], shopStock = [] }) {
  const [petName, setPetName] = useState(receipt.petName || '');
  const [ownerName, setOwnerName] = useState(receipt.ownerName || '');
  // ข้อมูลผู้ซื้อสำหรับใบกำกับภาษี — แก้ได้เหมือนตอนรับชำระในหน้า OPD
  const [ownerPhone, setOwnerPhone] = useState(receipt.ownerPhone || '');
  const [ownerAddr, setOwnerAddr] = useState(receipt.ownerAddr || '');
  const [ownerTaxId, setOwnerTaxId] = useState(receipt.ownerTaxId || '');
  const [method, setMethod] = useState(receipt.method || 'เงินสด');
  const [date, setDate] = useState(receipt.date || '');
  const [items, setItems] = useState(
    (receipt.items || []).map((it) => Array.isArray(it)
      ? { name: it[0] || '', qty: Number(it[1]) || 1, price: Number(it[2]) || 0, stockId: it[3] || null, origin: it[4] || null }
      : { name: it.name || '', qty: Number(it.qty) || 1, price: Number(it.price) || 0, stockId: it.stockId || null, origin: it.origin || null })
  );
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const setItem = (i, k, v) => setItems((prev) => prev.map((x, ix) => ix === i ? { ...x, [k]: v } : x));
  const addItem = () => setItems((prev) => [...prev, { name: '', qty: 1, price: 0, stockId: null, origin: null }]);
  const delItem = (i) => setItems((prev) => prev.filter((_, ix) => ix !== i));
  // เพิ่มรายการจากการค้นหาในคลัง/บริการ — เติมชื่อ+ราคา+stockId/origin (ให้ตัดสต็อกตอนบันทึก)
  const addFromCatalog = (x) => setItems((prev) => [...prev, { name: x.name, qty: 1, price: Number(x.price) || 0, stockId: x.kind === 'svc' ? null : (x.id || null), origin: x.kind === 'shop' ? 'shop' : null }]);
  const save = () => {
    const cleanItems = items.filter((it) => String(it.name).trim())
      .map((it) => [String(it.name).trim(), Number(it.qty) || 1, Number(it.price) || 0, it.stockId || null, it.origin || null]);
    const newTotal = cleanItems.reduce((s, c) => s + c[1] * c[2], 0);
    // noVat = ยอดรายการเพ็ทช้อป (origin='shop') คำนวณใหม่จากรายการจริง (app.jsx จะ recompute ซ้ำอีกชั้น)
    const newNoVat = cleanItems.filter((c) => c[4] === 'shop').reduce((s, c) => s + c[1] * c[2], 0);
    onSave({ petName: petName.trim() || '-', ownerName: ownerName.trim() || '-',
      ownerPhone: ownerPhone.trim(), ownerAddr: ownerAddr.trim(), ownerTaxId: ownerTaxId.trim(),
      method, date, items: cleanItems, total: newTotal, noVat: newNoVat });
  };
  const [showPreview, setShowPreview] = useState(false);
  const previewItems = items.map((it) => ({ name: String(it.name || ''), qty: Number(it.qty) || 0, price: Number(it.price) || 0 }));
  const cellInput = { padding: '5px 8px', fontSize: 13 };
  return (
    <Modal title={`✏️ แก้ไขใบเสร็จ ${receipt.no}`} onClose={onClose} wide footer={<>
      <button className="btn no-print" onClick={onClose}>ยกเลิก (ไม่บันทึก)</button>
      <button className="btn no-print" onClick={() => setShowPreview((p) => !p)}><Icon name="printer" size={15} /> {showPreview ? 'ซ่อนใบเสร็จ' : 'ดูใบเสร็จ'}</button>
      {showPreview ? <button className="btn no-print" onClick={() => window.print()}>🖨 พิมพ์</button> : null}
      <button className="btn btn-primary no-print" onClick={save}><Icon name="check" size={16} /> บันทึกลงระบบ — {fmtB(total)}</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {receipt.hn && onOpenPet ? (
          <div style={{ background: 'var(--mint-soft)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12.5, color: 'var(--mint-deep)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>HN {receipt.hn} — ถ้าต้องการแก้รายการรักษาพร้อมตัดสต็อก แนะนำให้เข้าเคสนี้</span>
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onOpenPet(receipt.hn)}><Icon name="arrowR" size={13} /> เข้าเคสนี้</button>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="วันที่"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="ช่องทางชำระ">
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['เงินสด', 'โอนเงิน', 'บัตรเครดิต'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="ชื่อสัตว์เลี้ยง"><input className="input" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="—" /></Field>
          <Field label="ชื่อเจ้าของ / ชื่อผู้ซื้อ"><input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="—" /></Field>
        </div>
        {/* ข้อมูลผู้ซื้อ (ใบกำกับภาษี) — เว้นว่างได้ ถ้าไม่ต้องออกให้บริษัท */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>ข้อมูลผู้ซื้อ (สำหรับใบกำกับภาษี)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="เบอร์โทร"><input className="input" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="08x-xxx-xxxx" /></Field>
            <Field label="เลขประจำตัวผู้เสียภาษี (ลูกค้า)"><input className="input" value={ownerTaxId} onChange={(e) => setOwnerTaxId(e.target.value)} placeholder="13 หลัก" /></Field>
          </div>
          <Field label="ที่อยู่ลูกค้า"><input className="input" value={ownerAddr} onChange={(e) => setOwnerAddr(e.target.value)} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" /></Field>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>รายการในใบเสร็จ</div>
          {/* ค้นหายา/บริการ/สินค้า เพื่อเพิ่มรายการเข้าใบเสร็จได้เลย (เหมือนหน้าบันทึกการตรวจ) */}
          <div className="no-print" style={{ marginBottom: 10 }}>
            <ChargePicker services={services || []} stock={stock || []} shopStock={shopStock || []} onAdd={addFromCatalog} />
          </div>
          <table className="tbl">
            <thead><tr><th>รายการ</th><th className="num" style={{ width: 90 }}>จำนวน</th><th className="num" style={{ width: 110 }}>ราคา/หน่วย</th><th className="num" style={{ width: 110 }}>รวม</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td><input className="input" style={cellInput} value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="ชื่อรายการ" /></td>
                  <td><input className="input" style={{ ...cellInput, textAlign: 'right' }} type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                  <td><input className="input" style={{ ...cellInput, textAlign: 'right' }} type="number" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} /></td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtB((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                  <td style={{ textAlign: 'center' }}><button className="btn btn-sm" style={{ color: 'var(--blush-deep)', padding: '2px 7px' }} onClick={() => delItem(i)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ background: 'var(--paper)' }}><td colSpan={3} style={{ fontWeight: 700, textAlign: 'right', padding: '8px 12px' }}>ยอดรวมทั้งสิ้น</td><td className="num" style={{ fontWeight: 800 }}>{fmtB(total)}</td><td></td></tr></tfoot>
          </table>
          <button className="btn btn-sm no-print" style={{ marginTop: 8 }} onClick={addItem}><Icon name="plus" size={13} /> เพิ่มรายการ</button>
        </div>
        {/* ตัวอย่างใบเสร็จจริง (สะท้อนรายการที่กำลังแก้) — กด "พิมพ์" เพื่อสั่งพิมพ์ใบนี้ */}
        {showPreview ? (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
            <TaxInvoice
              items={previewItems}
              petName={petName !== '-' ? petName : ''}
              ownerName={ownerName !== '-' ? ownerName : ''}
              ownerPhone={ownerPhone} ownerAddr={ownerAddr} ownerTaxId={ownerTaxId}
              method={method} vatMode="none" no={receipt.no} date={date}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ReportsView({ pets, queue, stock, shopStock = [], services = [], receipts = [], appointments = [], vets = [], assistants = [], commissionPct = 10, onSaveCommissionPct, onCancelReceipt, onUpdateReceipt, onOpenPet }) {
  const now = new Date();
  const [range, setRange] = useState('week');
  const [pickYear, setPickYear] = useState(now.getFullYear());
  const [pickMonth, setPickMonth] = useState(now.getMonth() + 1); // 1-12
  const [customStart, setCustomStart] = useState(fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(fmtLocalDate(now));
  const [showExport, setShowExport] = useState(false);
  const [editReceipt, setEditReceipt] = useState(null);
  const [rcSearch, setRcSearch] = useState('');
  const [donutSel, setDonutSel] = useState(null); // บริการที่กดในโดนัท → เปิดป๊อปอัพรายชื่อเคส
  const [staffTab, setStaffTab] = useState('vet');  // ผลงานรายคน: 'vet' หมอ | 'asst' ผู้ช่วย
  const [staffSel, setStaffSel] = useState(null);   // ชื่อคนที่กดดูรายละเอียด
  const [staffModalCat, setStaffModalCat] = useState(null); // ประเภทที่กดในโดนัทรายคน → เปิดป๊อปอัพรายชื่อเคส
  const [showPayroll, setShowPayroll] = useState(false);    // รายงานผลงาน/ค่าคอม (หมอ+ผู้ช่วย กดปุ่มเดียว)
  const [pctInput, setPctInput] = useState(String(commissionPct));   // % ค่าคอมอาบน้ำ (พิมพ์ได้ · จำค่าไว้ในระบบ)
  const pct = Math.max(0, Math.min(100, parseFloat(pctInput) || 0));
  const commOf = (groom) => Math.round(groom * pct) / 100;
  // ปีที่เลือกได้ = ปีที่มีใบเสร็จ + ปีนี้
  const years = useMemo(() => {
    const ys = new Set((receipts || []).map((r) => parseInt((r.date || '').slice(0, 4))).filter(Boolean));
    ys.add(now.getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [receipts]);
  const dateRange = useMemo(() => {
    if (range === 'pickmonth') {
      return [fmtLocalDate(new Date(pickYear, pickMonth - 1, 1)), fmtLocalDate(new Date(pickYear, pickMonth, 0))];
    }
    if (range === 'custom') {
      return customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    }
    return getDateRange(range);
  }, [range, pickYear, pickMonth, customStart, customEnd]);
  // เฉพาะเคสที่ยังมีใบเสร็จจริง (ตัดเคสที่ใบเสร็จถูกยกเลิกออก ให้ยอด/กราฟตรงกับใบเสร็จและไฟล์ export)
  const visits = useMemo(() => {
    const keys = activeOpdReceiptKeys(receipts);
    return filterVisits(pets, dateRange).filter((v) => keys.has(visitReceiptKey(v.petHn, v)));
  }, [pets, dateRange, receipts]);
  // ใบเสร็จ OPD ในช่วง (แหล่งความจริงของยอดเงิน — ตรงกับหน้า OPD · ยกเลิกแล้วถูกลบทิ้งจาก receipts ไปก่อน)
  const opdReceipts = useMemo(() => {
    const [s, e] = dateRange;
    return (receipts || []).filter((r) => (r.type || 'opd') === 'opd' && r.date >= s && r.date <= e);
  }, [receipts, dateRange]);
  // ใบเสร็จทั้งหมดในช่วง (OPD + เพ็ทช้อป) — ให้ตัวนับสอดคล้องกับช่วงที่เลือก ไม่ใช่ทั้งระบบ
  const receiptsInRange = useMemo(() => {
    const [s, e] = dateRange;
    return (receipts || []).filter((r) => r.date >= s && r.date <= e).length;
  }, [receipts, dateRange]);
  // ช่วงก่อนหน้า (ยาวเท่ากัน วางก่อนช่วงปัจจุบัน) — ไว้เทียบ % รายรับ
  const prevRevenue = useMemo(() => {
    const [s, e] = dateRange;
    const start = new Date(s + 'T00:00:00'), end = new Date(e + 'T00:00:00');
    const lenDays = Math.round((end - start) / 86400000) + 1;
    const pe = new Date(start.getTime() - 86400000);
    const ps = new Date(pe.getTime() - (lenDays - 1) * 86400000);
    const [pss, pee] = [fmtLocalDate(ps), fmtLocalDate(pe)];
    return (receipts || []).filter((r) => (r.type || 'opd') === 'opd' && r.date >= pss && r.date <= pee).reduce((a, r) => a + (Number(r.total) || 0), 0);
  }, [receipts, dateRange]);
  const m = useMemo(() => calcMetrics(pets, queue, stock, visits, opdReceipts, { dateRange, appointments, prevRevenue, shopStock }),
    [pets, queue, stock, visits, opdReceipts, dateRange, appointments, prevRevenue, shopStock]);

  // ── ผลงานรายคน (หมอ/ผู้ช่วย): สรุปจากบันทึกตรวจที่มีใบเสร็จจริงในช่วง — คนที่เลือกในช่อง "สัตวแพทย์ผู้ตรวจ/ผู้ช่วย" ──
  const staffPerf = useMemo(() => {
    const qByQ = {}; (queue || []).forEach((x) => { if (x && x.q) qByQ[x.q] = x; });
    const petByHn = {}; (pets || []).forEach((p) => { petByHn[p.hn] = p; });
    const noByKey = {}; (receipts || []).forEach((r) => { if ((r.type || 'opd') === 'opd') noByKey[`${r.hn}|${r.q || ''}|${r.date}`] = r.no; });
    const stockAll = {}; [stock || [], shopStock || []].forEach((arr) => arr.forEach((st) => { if (st && st.id != null && !stockAll[st.id]) stockAll[st.id] = st; }));
    // ยอดอาบน้ำใช้กติกาเดียวกับช่อง "ราคาอาบน้ำตัดขน" ใน Excel: ชื่อมีคำว่า "อาบน้ำ" หรือหมวดสต็อกมี "อาบน้ำ"
    const isGroomItem = (name, stockId) => /อาบน้ำ/.test(String(name || '')) || !!(stockId != null && stockAll[stockId] && /อาบน้ำ/.test(stockAll[stockId].cat || ''));
    const svcOfVisit = (v) => {
      const t = v.q && qByQ[v.q] && qByQ[v.q].type; if (t) return t;
      const first = (v.items || [])[0];
      const n = first ? cleanItemName(Array.isArray(first) ? first[0] : first.name).toLowerCase() : '';
      if (n.includes('วัคซีน') || n.includes('vaccine')) return 'วัคซีน';
      if (n.includes('ผ่าตัด') || n.includes('ทำหมัน') || n.includes('surgery')) return 'ผ่าตัด';
      if (n.includes('อาบน้ำ') || n.includes('ตัดขน') || n.includes('groom')) return 'อาบน้ำตัดขน';
      return 'ตรวจรักษา';
    };
    const per = {};
    const add = (name, svc, amount, groomAmt, v, extra) => {
      if (!per[name]) per[name] = { cases: 0, revenue: 0, groom: 0, byService: {}, byServiceCases: {}, list: [] };
      const p = per[name];
      p.cases++; p.revenue += amount; p.groom += groomAmt;
      if (!p.byService[svc]) p.byService[svc] = { count: 0, revenue: 0 };
      p.byService[svc].count++; p.byService[svc].revenue += amount;
      const pet = petByHn[v.petHn];
      const item = { date: v.date, petName: v.petName, petHn: v.petHn, hn: v.petHn,
        species: (pet && pet.species) || '', ownerName: (pet && pet.owner && pet.owner.name) || '',
        no: noByKey[`${v.petHn}|${v.q || ''}|${v.date}`] || '', svc, total: amount, groom: groomAmt, ...(extra || {}) };
      p.list.push(item);
      (p.byServiceCases[svc] = p.byServiceCases[svc] || []).push(item);
    };
    visits.forEach((v) => {
      const name = String(v.vet || '').trim() || '(ไม่ระบุ)';
      const svc = svcOfVisit(v);
      let total = 0, groom = 0;
      (v.items || []).forEach((it) => {
        const nm = cleanItemName(Array.isArray(it) ? it[0] : it.name);
        const qty = Number(Array.isArray(it) ? it[1] : it.qty) || 1;
        const price = Number(Array.isArray(it) ? it[2] : it.price) || 0;
        const stockId = Array.isArray(it) ? it[3] : it.stockId;
        const line = qty * price;
        total += line;
        if (isGroomItem(nm, stockId)) groom += line;
      });
      // เคสอาบน้ำที่ระบุหมอไว้ (มีตรวจ/จ่ายยาเพิ่ม) → แบ่งยอด: ค่าอาบน้ำเข้าผู้ช่วย · ที่เหลือเข้าหมอคนนั้น
      const medVet = String(v.medVet || '').trim();
      const medAmt = total - groom;
      if (svc === 'อาบน้ำตัดขน' && medVet && medAmt > 0) {
        add(name, svc, groom, groom, v, { billTotal: total });
        add(medVet, 'ตรวจรักษา', medAmt, 0, v, { billTotal: total, fromGroom: true });
        return;
      }
      add(name, svc, total, groom, v, { billTotal: total });
      // เคสอาบน้ำที่มีรายการแพทย์ปนแต่ยังไม่ได้เลือกหมอ → ยอดนี้ยังไม่มีเจ้าของ (เตือนให้ไปเลือกหมอ)
      if (svc === 'อาบน้ำตัดขน' && !medVet && medAmt > 0) per[name].unassignedMed = (per[name].unassignedMed || 0) + medAmt;
    });
    Object.values(per).forEach((p) => {
      p.list.sort((a, b) => (a.date < b.date ? 1 : -1));
      Object.values(p.byServiceCases).forEach((l) => l.sort((a, b) => (a.date < b.date ? 1 : -1)));
    });
    return per;
  }, [visits, queue, stock, shopStock, pets, receipts]);
  // รายชื่อคนตามแท็บ: หมอ = รายชื่อหมอ + ชื่อที่พบในบันทึก (ที่ไม่ใช่ผู้ช่วย) · ผู้ช่วย = รายชื่อผู้ช่วยเท่านั้น
  // คำนวณทั้งสองชุดเสมอ เพื่อให้ปุ่ม "ออกรายงาน" ดึงได้ทั้งหมอและผู้ช่วยในการกดครั้งเดียว
  const asstPeople = useMemo(() => {
    const empty = { cases: 0, revenue: 0, groom: 0, byService: {}, byServiceCases: {}, list: [] };
    return (assistants || []).map((n) => ({ name: n, ...(staffPerf[n] || empty) })).sort((a, b) => b.groom - a.groom);
  }, [staffPerf, assistants]);
  const vetPeople = useMemo(() => {
    const empty = { cases: 0, revenue: 0, groom: 0, byService: {}, byServiceCases: {}, list: [] };
    const asstSet = new Set((assistants || []).map((a) => String(a).trim()));
    const names = new Set((vets || []).map((v) => String(v).trim()).filter(Boolean));
    Object.keys(staffPerf).forEach((n) => { if (!asstSet.has(n)) names.add(n); });
    return [...names].map((n) => ({ name: n, ...(staffPerf[n] || empty) })).sort((a, b) => b.revenue - a.revenue);
  }, [staffPerf, vets, assistants]);
  const staffPeople = staffTab === 'asst' ? asstPeople : vetPeople;
  const selPerf = staffSel ? (staffPerf[staffSel] || { cases: 0, revenue: 0, groom: 0, byService: {}, byServiceCases: {}, list: [] }) : null;

  const chg = m.revenueChangePct;
  const money = (n) => fmtB(Math.round(n));
  const kpiCards = [
    { label: 'รายรับ OPD', num: m.opdRevenue, fmt: money,
      sub: chg == null ? 'เทียบช่วงก่อน —' : `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg)}% เทียบช่วงก่อน`,
      subColor: chg == null ? undefined : (chg >= 0 ? 'var(--mint-deep)' : 'var(--blush-deep)'), cls: 'tint-navy' },
    { label: 'กำไรขั้นต้น', num: m.profit, fmt: money, sub: `หักต้นทุนสินค้า ${fmtB(m.cogs)}`, cls: 'tint-mint' },
    { label: 'จำนวนเคส', num: m.cases, sub: null, cls: 'tint-powder' },
    { label: 'เฉลี่ยรายรับ/เคส', num: m.avgRevenuePerCase, fmt: money, sub: null, cls: 'tint-butter' },
    { label: 'เคสตรวจรักษา', num: m.treatmentCases, sub: null, cls: 'tint-powder' },
    { label: 'เฉลี่ยเคส/วัน', num: m.casesPerDay, fmt: (n) => n.toFixed(1), sub: 'ในช่วงที่เลือก', cls: 'tint-mint' },
    { label: 'ใบเสร็จในช่วง', num: receiptsInRange, sub: `ทั้งระบบ ${receipts.length} ใบ`, cls: 'tint-blush' },
    { label: 'กำไรขั้นต้น Margin', num: m.profitMargin, fmt: (n) => Math.round(n) + '%', sub: 'ยังไม่หักค่าแรง/โสหุ้ย', cls: 'tint-navy' },
  ];

  const topRevDays = Object.entries(m.dailyRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRev = topRevDays[0]?.[1] || 1;
  const topProds = m.topProducts.slice(0, 5);
  const maxProd = topProds[0]?.revenue || 1;
  // รายรับตามหมวด / วิธีชำระ / Top ลูกค้า / ช่วงเวลาคนเยอะ
  const catColors = { 'รักษา': 'var(--navy)', 'ผ่าตัด': 'var(--blush-deep)', 'วัคซีน': 'var(--mint-deep)', 'อาบน้ำ': 'var(--powder-deep)', 'ซื้อสินค้า': 'var(--butter-deep)', 'เพ็ทช้อป': 'var(--butter)' };
  const catEntries = Object.entries(m.revenueByCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries[0]?.[1] || 1;
  const methodEntries = Object.entries(m.byMethod).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxMethod = methodEntries[0]?.[1].revenue || 1;
  const topCust = m.topCustomers;
  const busyBar = [];
  for (let h = 7; h <= 20; h++) busyBar.push({ label: h, full: `${h}:00`, v: m.busyHours[h] || 0 });
  const maxBusy = Math.max(1, ...busyBar.map((b) => b.v));

  // bar chart — รายวันถ้าช่วงสั้น, รวมเป็นรายเดือนถ้าช่วงยาว (>62 วัน เช่น 1 ปี)
  const barData = useMemo(() => {
    const [s, e] = dateRange;
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);   // สร้างวันแบบ local — ไม่ผ่าน UTC
    const end = new Date(ey, em - 1, ed);
    const today = fmtLocalDate(new Date());
    const spanDays = Math.round((end - start) / 86400000) + 1;

    // ── ช่วงยาว → รวมรายรับเป็นรายเดือน (แท่งละ 1 เดือน) ──
    if (spanDays > 62) {
      const monthly = {};
      Object.entries(m.dailyRevenue).forEach(([d, v]) => {
        const ym = d.slice(0, 7);
        monthly[ym] = (monthly[ym] || 0) + v;
      });
      const curYM = today.slice(0, 7);
      const months = [];
      const cur = new Date(sy, sm - 1, 1);
      const lastM = new Date(ey, em - 1, 1);
      while (cur <= lastM) {
        const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        months.push({
          label: MONTHS_TH[cur.getMonth()],
          full: getMonthLabel(ym),                 // เช่น "มิ.ย. 2568"
          v: monthly[ym] || 0,
          today: ym === curYM,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
      return months;
    }

    // ── ช่วงสั้น → รายวัน ──
    const cur = new Date(sy, sm - 1, sd);
    const days = [];
    while (cur <= end) {
      const d = fmtLocalDate(cur);
      days.push({ label: d.slice(5), full: dateTH(d), v: m.dailyRevenue[d] || 0, today: d === today });
      cur.setDate(cur.getDate() + 1);
    }
    return days.slice(-62); // max 62 วัน (ถ้ายาวกว่านี้จะเป็นรายเดือนแล้ว)
  }, [dateRange, m.dailyRevenue]);

  // กราฟเป็นรายเดือนไหม (ช่วง > 62 วัน)
  const chartByMonth = useMemo(() => {
    const [s, e] = dateRange;
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    return Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1 > 62;
  }, [dateRange]);

  // donut data
  const donutData = useMemo(() =>
    Object.entries(m.serviceBreakdown).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v)
  , [m.serviceBreakdown]);

  const rangeLabel = range === 'pickmonth' ? getMonthLabel(`${pickYear}-${String(pickMonth).padStart(2, '0')}`)
    : range === 'custom' ? `${dateRange[0]} ถึง ${dateRange[1]}`
    : (TIME_RANGES.find((r) => r.id === range)?.label || range);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>ข้อมูลตั้งแต่</span>
        <div className="seg">
          {TIME_RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
          <button className={range === 'pickmonth' ? 'on' : ''} onClick={() => setRange('pickmonth')}>เลือกเดือน</button>
          <button className={range === 'custom' ? 'on' : ''} onClick={() => setRange('custom')}>ช่วงเวลา</button>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn" onClick={() => setShowExport(true)}>
          <Icon name="printer" size={16} /> Export ใบเสร็จ PDF
          {receipts.length > 0 ? <span className="chip chip-navy" style={{ marginLeft: 6, fontSize: 11 }}>{receipts.length}</span> : null}
        </button>
        <button className="btn btn-soft" onClick={() => exportToExcel(visits, receipts, rangeLabel, stock, dateRange, shopStock)} style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)' }}>
          📅 Export Excel (.csv)
        </button>
      </div>

      {/* ── panel เลือกเดือน ── */}
      {range === 'pickmonth' ? (
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-soft)' }}>เลือกเดือน:</span>
          <select className="select" style={{ width: 'auto', minWidth: 130 }} value={pickMonth} onChange={(e) => setPickMonth(Number(e.target.value))}>
            {MONTHS_TH.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 110 }} value={pickYear} onChange={(e) => setPickYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>พ.ศ. {y + 543}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--mint-deep)', fontWeight: 700, marginLeft: 4 }}>{rangeLabel}</span>
        </div>
      ) : null}

      {/* ── panel เลือกช่วงเวลา ── */}
      {range === 'custom' ? (
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-soft)' }}>ตั้งแต่:</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-soft)' }}>ถึง:</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
      ) : null}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        {kpiCards.map((c, i) => (
          <div key={i} className={'stat-tile anim-pop ' + c.cls} style={{ '--i': i }}>
            <div className="v">{c.num != null ? <CountUp value={c.num} format={c.fmt} /> : c.value}</div>
            <div className="l">{c.label}</div>
            {c.sub ? <div style={{ fontSize: 12, opacity: c.subColor ? 1 : .75, marginTop: 2, color: c.subColor || undefined, fontWeight: c.subColor ? 700 : 400 }}>{c.sub}</div> : null}
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-head">
            <span style={{ fontWeight: 800 }}>{chartByMonth ? 'รายรับรายเดือน' : 'รายรับรายวัน'}</span>
            <span className="chip">{rangeLabel}</span>
          </div>
          <div className="card-pad" style={{ paddingBottom: 10 }}>
            {barData.every((d) => d.v === 0)
              ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : <BarChart data={barData} />}
          </div>
        </div>
        {/* Donut chart */}
        <div className="card">
          <div className="card-head">
            <span style={{ fontWeight: 800 }}>เคสแยกตามประเภท</span>
            <span className="chip">{m.cases} เคส</span>
          </div>
          <div className="card-pad">
            <DonutChart data={donutData} size={150} onSelect={setDonutSel} />
          </div>
        </div>
      </div>

      {/* ── รายรับตามหมวด + วิธีชำระเงิน ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="card-head"><span style={{ fontWeight: 800 }}>💰 รายรับตามหมวด</span></div>
          <div className="card-pad">
            {catEntries.length === 0 ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : catEntries.map(([k, v]) => <SimpleBar key={k} label={k} value={v} max={maxCat} color={catColors[k] || 'var(--navy)'} />)}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span style={{ fontWeight: 800 }}>💳 วิธีชำระเงิน</span></div>
          <div className="card-pad">
            {methodEntries.length === 0 ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : methodEntries.map(([k, v]) => (
                <div key={k} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{k} <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>({v.count} ใบ)</span></span>
                    <span style={{ fontWeight: 700 }}>{fmtB(v.revenue)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.round(v.revenue / maxMethod * 100) + '%', background: k === 'เงินสด' ? 'var(--mint-deep)' : 'var(--navy)' }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── ตัวเลขลูกค้า / ชนิดสัตว์ / มาตามนัด ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="stat-tile tint-mint"><div className="v">{m.newCust}</div><div className="l">ลูกค้าใหม่</div></div>
        <div className="stat-tile tint-powder"><div className="v">{m.returningCust}</div><div className="l">ลูกค้าเก่า (กลับมา)</div></div>
        <div className="stat-tile tint-butter"><div className="v">🐱 {m.speciesBreakdown['แมว'] || 0}</div><div className="l">เคสแมว</div></div>
        <div className="stat-tile tint-powder"><div className="v">🐶 {m.speciesBreakdown['สุนัข'] || 0}</div><div className="l">เคสสุนัข</div></div>
        <div className="stat-tile tint-blush"><div className="v">{m.showRate == null ? '—' : m.showRate + '%'}</div><div className="l">มาตามนัด ({m.apptArrived}/{m.apptArrived + m.apptNoShow})</div></div>
      </div>

      {/* ── ช่วงเวลาคนเยอะ + Top ลูกค้า ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="card-head"><span style={{ fontWeight: 800 }}>⏰ ช่วงเวลาที่คนเยอะ</span><span className="chip">เวลาเช็คอิน</span></div>
          <div className="card-pad">
            {busyBar.every((b) => b.v === 0) ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130 }}>
                  {busyBar.map((b) => (
                    <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }} title={`${b.full} · ${b.v} เคส`}>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', height: 12 }}>{b.v || ''}</div>
                      <div style={{ width: '100%', height: Math.round((b.v / maxBusy) * 90) + 'px', minHeight: b.v ? 3 : 0, background: 'var(--powder-deep)', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{b.label}</div>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span style={{ fontWeight: 800 }}>👑 Top 5 ลูกค้า</span><span className="chip">จ่ายเยอะสุด</span></div>
          <div className="card-pad">
            {topCust.length === 0 ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : topCust.map((c, i) => (
                <div key={c.hn + '_' + i} onClick={() => onOpenPet && c.hn && c.hn !== '?' && onOpenPet(c.hn)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5, cursor: onOpenPet ? 'pointer' : 'default' }}>
                  <span><b>{i + 1}. {c.name}</b>{c.owner ? <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}> · {c.owner}</span> : null} <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>({c.count} ครั้ง)</span></span>
                  <span style={{ fontWeight: 700, color: 'var(--mint-deep)', flexShrink: 0 }}>{fmtB(c.spend)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── SimpleBar section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Daily revenue */}
        <div className="card">
          <div className="card-head"><span style={{ fontWeight: 800 }}>รายรับสูงสุด 5 วัน</span></div>
          <div className="card-pad">
            {topRevDays.length === 0
              ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : topRevDays.map(([date, rev]) => (
                <SimpleBar key={date} label={date} value={rev} max={maxRev} color="var(--navy)" />
              ))}
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <div className="card-head"><span>Top 5 สินค้า/บริการขายดี</span></div>
          <div className="card-pad">
            {topProds.length === 0
              ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : topProds.map((p) => (
                <SimpleBar key={p.name} label={p.name} value={p.revenue} max={maxProd} color="var(--powder-deep)" />
              ))}
          </div>
        </div>

        {/* Service breakdown */}
        <div className="card">
          <div className="card-head"><span>บริการแยกตามประเภท</span></div>
          <div className="card-pad">
            {Object.keys(m.serviceBreakdown).length === 0
              ? <div className="queue-empty">ยังไม่มีข้อมูล</div>
              : Object.entries(m.serviceBreakdown).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 14 }}>
                  <span>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v} เคส</span>
                </div>
              ))}
          </div>
        </div>

        {/* Receipts summary */}
        <div className="card">
          <div className="card-head"><span>สรุปใบเสร็จ</span><span className="chip chip-navy">{receipts.length} ใบ</span></div>
          {/* ช่องค้นหาเลขใบเสร็จ/ชื่อ */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
            <div className="search-wrap">
              <Icon name="search" size={15} />
              <input className="search-input" placeholder="ค้นหาเลขใบเสร็จ / ชื่อสัตว์ / เจ้าของ..." value={rcSearch} onChange={(e) => setRcSearch(e.target.value)} />
            </div>
          </div>
          <div className="card-pad" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {(() => {
              const q = rcSearch.trim().toLowerCase();
              const list = receipts.slice().reverse().filter((r) => !q
                || String(r.no || '').toLowerCase().includes(q)
                || String(r.petName || '').toLowerCase().includes(q)
                || String(r.ownerName || '').toLowerCase().includes(q));
              if (receipts.length === 0) return <div className="queue-empty">ยังไม่มีใบเสร็จ — ชำระเงินเคสแรกเพื่อเริ่ม</div>;
              if (list.length === 0) return <div className="queue-empty">ไม่พบใบเสร็จที่ค้นหา</div>;
              return list.map((r, i) => (
                <div key={r.no || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
                  <div style={{ minWidth: 0 }}>
                    <button onClick={() => onUpdateReceipt && setEditReceipt(r)} title="คลิกเพื่อดู/แก้ไขใบเสร็จ"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: onUpdateReceipt ? 'pointer' : 'default', fontWeight: 700, color: 'var(--navy)', textDecoration: onUpdateReceipt ? 'underline' : 'none', textUnderlineOffset: 2 }}>
                      {r.no}
                    </button>
                    <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>{r.petName !== '-' ? r.petName : 'เพ็ทช้อป'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span className="chip">{r.method}</span>
                    <span style={{ fontWeight: 700 }}>{fmtB(r.total)}</span>
                    {onCancelReceipt && (
                      <button title={`ยกเลิกใบเสร็จ ${r.no}`}
                        style={{ background: '#FDECEA', border: '1px solid #D98880', borderRadius: 6, color: '#8C3028', fontSize: 11, padding: '2px 8px', cursor: 'pointer', flexShrink: 0, lineHeight: 1.5 }}
                        onClick={() => { if (confirm(`คุณต้องการลบใบเสร็จเลขที่ ${r.no} ใช่ไหม?\n\nเลขนี้จะถูกนำกลับมาใช้ใหม่ในการคิดเงินครั้งถัดไป และจะไม่ถูกนับในสรุป PDF/Excel`)) onCancelReceipt(r.no); }}>
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ── ผลงานรายคน: หมอ / ผู้ช่วย (ตามช่วงเวลาที่เลือกด้านบน) ── */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <span style={{ fontWeight: 800 }}>🧑‍⚕️ ผลงานรายคน</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip">{rangeLabel}</span>
            {/* ปุ่มเดียว = ได้ทั้งหมอและผู้ช่วย (แยกคนละหน้าเวลาพิมพ์) */}
            <button className="btn btn-sm" onClick={() => setShowPayroll(true)} style={{ color: 'var(--navy)', borderColor: 'var(--navy)', fontWeight: 700 }}>
              📄 ออกรายงาน / ค่าคอม
            </button>
            <div className="seg">
              <button className={staffTab === 'vet' ? 'on' : ''} onClick={() => { setStaffTab('vet'); setStaffSel(null); setStaffModalCat(null); }}>🩺 หมอ</button>
              <button className={staffTab === 'asst' ? 'on' : ''} onClick={() => { setStaffTab('asst'); setStaffSel(null); setStaffModalCat(null); }}>🛁 ผู้ช่วย</button>
            </div>
          </div>
        </div>
        <div className="card-pad">
          {/* แถบตั้ง % ค่าคอม (เฉพาะแท็บผู้ช่วย) */}
          {staffTab === 'asst' && staffPeople.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '9px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--mint-soft)', border: '1px solid var(--mint)' }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>💰 ค่าคอม</span>
              <input className="input" type="number" min="0" max="100" step="0.5" value={pctInput}
                onChange={(e) => { setPctInput(e.target.value); onSaveCommissionPct && onSaveCommissionPct(e.target.value); }}
                style={{ width: 78, textAlign: 'right', fontWeight: 700 }} />
              <span style={{ fontSize: 13.5 }}>% ของยอดอาบน้ำ</span>
              <div style={{ flex: 1, minWidth: 8 }} />
              <span style={{ fontSize: 13.5 }}>รวมต้องจ่ายทั้งหมด</span>
              <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--mint-deep)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtB(commOf(staffPeople.reduce((a, p) => a + p.groom, 0)))}
              </span>
            </div>
          ) : null}
          {staffPeople.length === 0 ? (
            <div className="queue-empty">
              {staffTab === 'asst'
                ? 'ยังไม่มีรายชื่อผู้ช่วย — เพิ่มได้ในหน้า "บันทึกตรวจ" ของเคสอาบน้ำตัดขน (ช่องผู้ช่วยผู้ทำ → ปุ่ม + เพิ่มผู้ช่วย)'
                : 'ยังไม่มีข้อมูล'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {staffPeople.map((p) => (
                <button key={p.name} onClick={() => { setStaffSel(staffSel === p.name ? null : p.name); setStaffModalCat(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, font: 'inherit',
                    border: '1.5px solid ' + (staffSel === p.name ? 'var(--navy)' : 'var(--line)'), background: staffSel === p.name ? 'var(--navy-soft)' : 'var(--surface)' }}>
                  <span style={{ fontSize: 17 }}>{staffTab === 'asst' ? '🛁' : '🩺'}</span>
                  <span style={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span className="chip">{p.cases} เคส</span>
                  <span style={{ fontWeight: 800, color: staffTab === 'asst' ? 'var(--ink-soft)' : 'var(--mint-deep)', minWidth: 86, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtB(staffTab === 'asst' ? p.groom : p.revenue)}</span>
                  {staffTab === 'asst' ? (
                    <span style={{ minWidth: 96, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>คอม {pct}% </span>
                      <b style={{ color: 'var(--mint-deep)', fontSize: 14.5 }}>{fmtB(commOf(p.groom))}</b>
                    </span>
                  ) : null}
                  <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{staffSel === p.name ? '▲' : '▼'}</span>
                </button>
              ))}
            </div>
          )}
          {staffTab === 'asst' && staffPeople.length > 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
              💡 ยอดผู้ช่วย = เฉพาะรายการที่มีคำว่า “อาบน้ำ” (ตรงกับช่อง “ราคาอาบน้ำตัดขน” ใน Excel) — ค่ายา/สินค้าอื่นที่คีย์เพิ่มในบิลเดียวกันไม่ถูกนับ
            </div>
          ) : null}

          {staffSel && selPerf ? (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{staffTab === 'asst' ? '🛁' : '🩺'} {staffSel}</span>
                <span className="chip">{selPerf.cases} เคส</span>
                <span style={{ fontWeight: 800, color: staffTab === 'asst' ? 'var(--ink)' : 'var(--mint-deep)', fontSize: 15 }}>
                  {staffTab === 'asst' ? `ยอดอาบน้ำรวม ${fmtB(selPerf.groom)}` : `ยอดรวม ${fmtB(selPerf.revenue)}`}
                </span>
                {staffTab === 'asst' ? (
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--mint-deep)', background: 'var(--mint-soft)', border: '1px solid var(--mint)', borderRadius: 99, padding: '3px 12px' }}>
                    💰 ค่าคอม {pct}% = {fmtB(commOf(selPerf.groom))}
                  </span>
                ) : null}
                {staffTab === 'asst' && selPerf.unassignedMed ? (
                  <span className="chip chip-butter" style={{ fontSize: 11.5 }} title="ยอดยา/ตรวจในเคสอาบน้ำที่ยังไม่ได้เลือกหมอ — ไปเลือกในบันทึกตรวจเพื่อให้เข้าผลงานหมอ">
                    ⚠️ ยอดแพทย์ยังไม่ระบุหมอ {fmtB(selPerf.unassignedMed)}
                  </span>
                ) : null}
              </div>
              {staffTab === 'vet' && Object.keys(selPerf.byService).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                  <DonutChart data={Object.entries(selPerf.byService).map(([label, v]) => ({ label, v: v.count })).sort((a, b) => b.v - a.v)} size={140} onSelect={setStaffModalCat} />
                  <div>
                    {Object.entries(selPerf.byService).sort((a, b) => b[1].revenue - a[1].revenue).map(([k, v]) => (
                      <SimpleBar key={k} label={`${k} (${v.count})`} value={v.revenue}
                        max={Math.max(1, ...Object.values(selPerf.byService).map((x) => x.revenue))} color="var(--powder-deep)" />
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)' }}>
                {selPerf.list.length === 0 ? <div className="queue-empty">ยังไม่มีเคสในช่วงนี้</div>
                  : selPerf.list.map((c, i) => (
                    <div key={i} onClick={() => onOpenPet && c.petHn && onOpenPet(c.petHn)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', fontSize: 13, cursor: onOpenPet ? 'pointer' : 'default' }}>
                      <span style={{ color: 'var(--ink-faint)', width: 78, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dateTH(c.date)}</span>
                      <span style={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.petName || '-'} <span style={{ color: 'var(--ink-faint)', fontWeight: 500, fontSize: 11.5 }}>HN {c.petHn}</span>
                      </span>
                      <span className="chip" style={{ fontSize: 11 }}>{c.svc}</span>
                      {c.fromGroom ? <span className="chip chip-butter" style={{ fontSize: 10.5 }} title="ส่วนแพทย์ในเคสอาบน้ำ">ในเคสอาบน้ำ</span> : null}
                      {staffTab === 'asst'
                        ? <span style={{ fontWeight: 800, color: 'var(--mint-deep)', minWidth: 82, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtB(c.groom)}{c.billTotal && c.billTotal !== c.groom ? <span style={{ color: 'var(--ink-faint)', fontWeight: 500, fontSize: 10.5 }}> /บิล {fmtB(c.billTotal)}</span> : null}
                          </span>
                        : <span style={{ fontWeight: 800, minWidth: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtB(c.total)}</span>}
                    </div>
                  ))}
              </div>
              {onOpenPet ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>👆 กดที่เคสเพื่อเปิดประวัติ</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      {donutSel ? (
        <ServiceCasesModal
          donutData={donutData} cases={m.casesByService} selected={donutSel}
          onSelectCat={setDonutSel} onOpenPet={onOpenPet} onClose={() => setDonutSel(null)}
        />
      ) : null}

      {/* ป๊อปอัพเคสแยกประเภทของ "รายคน" (กดโดนัทในผลงานรายคน) */}
      {staffModalCat && staffSel && selPerf ? (
        <ServiceCasesModal
          heading={staffSel}
          donutData={Object.entries(selPerf.byService).map(([label, v]) => ({ label, v: v.count })).sort((a, b) => b.v - a.v)}
          cases={selPerf.byServiceCases} selected={staffModalCat}
          onSelectCat={setStaffModalCat} onOpenPet={onOpenPet} onClose={() => setStaffModalCat(null)}
        />
      ) : null}

      {showPayroll ? (
        <StaffPayrollModal vetPeople={vetPeople} asstPeople={asstPeople} pct={pct} rangeLabel={rangeLabel} onClose={() => setShowPayroll(false)} />
      ) : null}

      {showExport ? <ReceiptExportModal receipts={receipts} onClose={() => setShowExport(false)} /> : null}
      {editReceipt ? (
        <ReceiptEditModal
          receipt={editReceipt}
          services={services} stock={stock} shopStock={shopStock}
          onClose={() => setEditReceipt(null)}
          onOpenPet={onOpenPet}
          onSave={(patch) => { onUpdateReceipt && onUpdateReceipt(editReceipt.no, patch); setEditReceipt(null); }}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { ReportsView, calcMetrics, filterVisits });
