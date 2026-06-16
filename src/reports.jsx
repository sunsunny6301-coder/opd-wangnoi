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

function calcMetrics(pets, queue, stock, visits) {
  const opdRevenue = visits.reduce((s, v) => s + (v.items || []).reduce((ss, [, q, p]) => ss + q * p, 0), 0);
  const profit = stock.reduce((s, stk) => {
    const sold = queue
      .filter((qi) => qi.charges)
      .flatMap((qi) => qi.charges)
      .filter(([name]) => name === stk.name)
      .reduce((ss, [, qty, price]) => ss + qty * (price - (stk.cost || price * 0.5)), 0);
    return s + sold;
  }, Math.round(opdRevenue * 0.4));
  const profitMargin = opdRevenue > 0 ? Math.round(profit / opdRevenue * 100) : 0;
  const cases = visits.length;
  const avgRevenuePerCase = cases > 0 ? Math.round(opdRevenue / cases) : 0;
  const treatmentCases = visits.filter((v) => v.cc || v.dx).length;
  const conversionRate = queue.length > 0 ? Math.round(queue.filter((q) => q.status === 'done').length / queue.length * 100) : 0;

  const productSales = {};
  queue.filter((q) => q.charges).forEach((q) =>
    q.charges.forEach(([name, qty, price]) => {
      if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
      productSales[name].qty += qty; productSales[name].revenue += qty * price;
    }));
  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5)
    .map(([name, { qty, revenue }]) => ({ name, qty, revenue }));

  const dailyRevenue = {};
  visits.forEach((v) => {
    if (!dailyRevenue[v.date]) dailyRevenue[v.date] = 0;
    dailyRevenue[v.date] += (v.items || []).reduce((s, [, q, p]) => s + q * p, 0);
  });
  const serviceBreakdown = {};
  visits.forEach((v) => {
    const types = [];
    (v.items || []).forEach(([name]) => {
      const n = (name || '').toLowerCase();
      if (n.includes('วัคซีน') || n.includes('vaccine')) types.push('วัคซีน');
      else if (n.includes('ผ่าตัด') || n.includes('ทำหมัน') || n.includes('surgery')) types.push('ผ่าตัด');
      else if (n.includes('เลือด') || n.includes('x-ray') || n.includes('cbc') || n.includes('แล็บ') || n.includes('เคมี')) types.push('แล็บ');
      else if (n.includes('อาบน้ำ') || n.includes('ตัดขน') || n.includes('groom')) types.push('อาบน้ำ/ตัดขน');
      else types.push('ตรวจรักษา');
    });
    const primary = types[0] || 'ตรวจรักษา';
    serviceBreakdown[primary] = (serviceBreakdown[primary] || 0) + 1;
  });
  if (visits.length > 0 && Object.keys(serviceBreakdown).length === 0) serviceBreakdown['ตรวจรักษา'] = visits.length;

  return { opdRevenue, profit, profitMargin, cases, avgRevenuePerCase, treatmentCases, conversionRate, topProducts, dailyRevenue, serviceBreakdown, productSales };
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
function BarChart({ data }) {
  const ref = useRef(null);
  const [w, setW] = useState(500);
  useEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const h = 180, pad = { l: 52, r: 16, t: 12, b: 36 };
  const chartW = w - pad.l - pad.r, chartH = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.v), 1);
  const barW = Math.max(4, chartW / data.length - 4);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div ref={ref} style={{ width: '100%' }}>
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
          const x = pad.l + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
          const y = pad.t + chartH - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh}
                rx={3} fill={d.today ? 'var(--mint-deep)' : 'var(--navy)'} opacity={d.v === 0 ? .15 : 1} />
              <text x={x + barW / 2} y={pad.t + chartH + 16} textAnchor="middle" fontSize={9.5} fill="var(--ink-faint)">{d.label}</text>
              {d.v > 0 && bh > 18 && (
                <text x={x + barW / 2} y={y + 13} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700}>{fmtB(d.v)}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={pad.l + chartW} y1={pad.t + chartH} y2={pad.t + chartH} stroke="var(--line)" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

// ── SVG Donut Chart ──
const DONUT_COLORS = ['#3A8F6A','#3A3F8F','#C9A227','#C0685C','#5E8A93','#9E8ABF','#7A5E00'];
function DonutChart({ data, size = 160 }) {
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />)}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={800} fill="var(--ink)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">เคสทั้งหมด</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <b>{s.v}</b>
            <span style={{ color: 'var(--ink-faint)', minWidth: 36 }}>({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
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
  const cell = (n) => (n ? n : '');  // ช่องว่างเมื่อเป็น 0 ให้อ่านง่าย
  const header = ['วันที่', 'HN', 'ชื่อสัตว์', 'ชนิด', 'เจ้าของ', 'เบอร์โทร', 'CC', 'Dx', 'รายการ', 'จำนวน', 'ราคารักษา', 'ราคาอาหารสัตว์', 'รวม'];
  let sumTreat = 0, sumFood = 0;
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
      let treat = 0, food = 0, qtyTotal = 0;
      const names = [];
      items.forEach(([name, qty, price, stockId]) => {
        const q = Number(qty) || 1, line = q * (Number(price) || 0);
        qtyTotal += q;
        if (name) names.push(name);
        if (isFood(name, stockId)) food += line; else treat += line;
      });
      sumTreat += treat; sumFood += food;
      return [
        r.date, r.hn || '', (r.petName && r.petName !== '-' ? r.petName : (v.petName || '')), v.petSpecies || '',
        (r.ownerName && r.ownerName !== '-' ? r.ownerName : (v.owner?.name || '')), v.owner?.phone || '', v.cc || '', v.dx || '',
        names.join(', '), qtyTotal, cell(treat), cell(food), treat + food,
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
      return [r.date, '', '', '', owner, '', '', '', names.join(', '), qtyTotal, '', food, food];
    });
  const rows = [header, ...visitRows, ...shopRows, [], ['สรุปรายรับทั้งสิ้น', '', '', '', '', '', '', '', '', '', sumTreat, sumFood, sumTreat + sumFood]];
  const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `รายรับ_${rangeLabel}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
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
    const newNoVat = Math.min(Number(receipt.noVat) || 0, newTotal); // กัน noVat เกินยอดรวมหลังแก้
    onSave({ petName: petName.trim() || '-', ownerName: ownerName.trim() || '-', method, date, items: cleanItems, total: newTotal, noVat: newNoVat });
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
          <Field label="ชื่อเจ้าของ"><input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="—" /></Field>
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
              method={method} vatMode="none" no={receipt.no} date={date}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ReportsView({ pets, queue, stock, shopStock = [], services = [], receipts = [], onCancelReceipt, onUpdateReceipt, onOpenPet }) {
  const [range, setRange] = useState('week');
  const [showExport, setShowExport] = useState(false);
  const [editReceipt, setEditReceipt] = useState(null);
  const [rcSearch, setRcSearch] = useState('');
  const dateRange = useMemo(() => getDateRange(range), [range]);
  // เฉพาะเคสที่ยังมีใบเสร็จจริง (ตัดเคสที่ใบเสร็จถูกยกเลิกออก ให้ยอด/กราฟตรงกับใบเสร็จและไฟล์ export)
  const visits = useMemo(() => {
    const keys = activeOpdReceiptKeys(receipts);
    return filterVisits(pets, dateRange).filter((v) => keys.has(visitReceiptKey(v.petHn, v)));
  }, [pets, dateRange, receipts]);
  const m = useMemo(() => calcMetrics(pets, queue, stock, visits), [pets, queue, stock, visits]);

  const kpiCards = [
    { label: 'รายรับ OPD', value: fmtB(m.opdRevenue), sub: null, cls: 'tint-navy' },
    { label: 'กำไร/เงินสุทธิ', value: fmtB(m.profit), sub: `(${m.profitMargin}%)`, cls: 'tint-mint' },
    { label: 'จำนวนเคส', value: m.cases, sub: null, cls: 'tint-powder' },
    { label: 'เฉลี่ยรายรับ/เคส', value: fmtB(m.avgRevenuePerCase), sub: null, cls: 'tint-butter' },
    { label: 'เคสตรวจรักษา', value: m.treatmentCases, sub: null, cls: 'tint-powder' },
    { label: 'Conversion Rate', value: m.conversionRate + '%', sub: 'รอตรวจ→เสร็จ', cls: 'tint-mint' },
    { label: 'ใบเสร็จทั้งหมด', value: receipts.length, sub: null, cls: 'tint-blush' },
    { label: 'กำไร Margin', value: m.profitMargin + '%', sub: null, cls: 'tint-navy' },
  ];

  const topRevDays = Object.entries(m.dailyRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRev = topRevDays[0]?.[1] || 1;
  const topProds = m.topProducts.slice(0, 5);
  const maxProd = topProds[0]?.revenue || 1;

  // bar chart — all days in range chronologically
  const barData = useMemo(() => {
    const [s, e] = dateRange;
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);   // สร้างวันแบบ local — ไม่ผ่าน UTC
    const end = new Date(ey, em - 1, ed);
    const today = fmtLocalDate(new Date());
    const days = [];
    while (cur <= end) {
      const d = fmtLocalDate(cur);
      days.push({ label: d.slice(5), v: m.dailyRevenue[d] || 0, today: d === today });
      cur.setDate(cur.getDate() + 1);
    }
    return days.slice(-30); // max 30 days
  }, [dateRange, m.dailyRevenue]);

  // donut data
  const donutData = useMemo(() =>
    Object.entries(m.serviceBreakdown).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v)
  , [m.serviceBreakdown]);

  const rangeLabel = TIME_RANGES.find((r) => r.id === range)?.label || range;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>ข้อมูลตั้งแต่</span>
        <div className="seg">
          {TIME_RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
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

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        {kpiCards.map((c, i) => (
          <div key={i} className={'stat-tile ' + c.cls}>
            <div className="v">{c.value}</div>
            <div className="l">{c.label}</div>
            {c.sub ? <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>{c.sub}</div> : null}
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-head">
            <span style={{ fontWeight: 800 }}>รายรับรายวัน</span>
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
            <DonutChart data={donutData} size={150} />
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
