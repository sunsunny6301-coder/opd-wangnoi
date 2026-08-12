// ── Daily History Calendar ────────────────────────────────────
var { useState, useMemo } = React;

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

// จัดประเภท "รายเคส" (1 เคส = 1 ประเภท) ให้ตรงกับหน้าสรุปรายรับ — ยึด type ของคิวก่อน ไม่งั้นเดาจากรายการแรก
const CAT_COLORS = { วัคซีน: '#3A8F6A', ผ่าตัด: '#8C3028', อาบน้ำตัดขน: '#A87B2F', ซื้อสินค้า: '#5E8A93', ตรวจรักษา: '#2D4B72' };
function caseCategory(visit, queueByQ) {
  const q = visit.q && queueByQ[visit.q];
  if (q && q.type) return q.type;
  const first = (visit.items || [])[0];
  const n = first ? String(Array.isArray(first) ? first[0] : (first.name || '')).toLowerCase() : '';
  if (n.includes('วัคซีน') || n.includes('vaccine')) return 'วัคซีน';
  if (n.includes('ผ่าตัด') || n.includes('ทำหมัน') || n.includes('surgery')) return 'ผ่าตัด';
  if (n.includes('อาบน้ำ') || n.includes('ตัดขน') || n.includes('groom')) return 'อาบน้ำตัดขน';
  return 'ตรวจรักษา';
}
function itemTotal(items) {
  return (items || []).reduce((s, c) => s + (Number(Array.isArray(c) ? c[1] : c.qty) || 1) * (Number(Array.isArray(c) ? c[2] : c.price) || 0), 0);
}

function heatColor(count) {
  if (count === 0) return 'transparent';
  if (count === 1) return '#D4F0E0';
  if (count <= 3) return '#7EC8A0';
  if (count <= 6) return '#3E9E6A';
  return '#1A6E45';
}
function heatText(count) {
  if (count === 0) return 'var(--ink-faint)';
  if (count <= 3) return '#1A6E45';
  return '#fff';
}

function HistoryView({ pets, receipts = [], queue = [], onOpenPet }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selDate, setSelDate] = useState(todayISO());

  // คิวสำหรับดูประเภทเคส (type)
  const queueByQ = useMemo(() => { const m = {}; (queue || []).forEach((q) => { if (q && q.q) m[q.q] = q; }); return m; }, [queue]);
  // ใบเสร็จ OPD ที่ยังไม่ถูกยกเลิก: key = HN|คิว|วันที่ (แหล่งความจริงเดียวกับหน้าคิว/สรุปรายรับ)
  const rcptKeys = useMemo(() => {
    const s = new Set();
    (receipts || []).forEach((r) => { if ((r.type || 'opd') === 'opd') s.add(`${r.hn}|${r.q || ''}|${r.date}`); });
    return s;
  }, [receipts]);
  // วันที่ที่ถูกครอบด้วย "ใบเสร็จรวมตอนจำหน่าย" ของเคสแอดมิด — ดูจากชื่อรายการที่มี " (YYYY-MM-DD)" ต่อท้าย
  // (ตอนจำหน่ายระบบรวมทุกวันเป็นใบเดียวลงวันกลับบ้าน visit รายวันจึงไม่มีใบเสร็จตรงวัน — ไม่ใช่ความผิดพลาด)
  const admitCovered = useMemo(() => {
    const s = new Set();
    (receipts || []).forEach((r) => {
      if ((r.type || 'opd') !== 'opd') return;
      (r.items || []).forEach((it) => {
        const nm = String(Array.isArray(it) ? it[0] : (it && it.name) || '');
        const m = nm.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
        if (m) s.add(`${r.hn}|${m[1]}`);
      });
    });
    return s;
  }, [receipts]);
  // รายรับ "ตามใบเสร็จ" รายวัน (ตรงกับหน้าแดชบอร์ด/สรุปรายรับ)
  const receiptRevByDate = useMemo(() => {
    const m = {};
    (receipts || []).forEach((r) => { if ((r.type || 'opd') === 'opd') m[r.date] = (m[r.date] || 0) + (Number(r.total) || 0); });
    return m;
  }, [receipts]);

  // Build date → visits map from all pets
  const visitsByDate = useMemo(() => {
    const map = {};
    (pets || []).forEach((pet) => {
      (pet.visits || []).forEach((v) => {
        if (!v.date) return;
        if (!map[v.date]) map[v.date] = [];
        map[v.date].push({ pet, visit: v });
      });
    });
    return map;
  }, [pets]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const selVisits = visitsByDate[selDate] || [];

  // ── สถิติรายวัน (นับ "รายเคส" 1 เคส 1 ประเภท ให้ตรงกับหน้าสรุปรายรับ) ──
  // เคสมีใบเสร็จแล้ว = เจอ exact key หรือถูกครอบด้วยใบเสร็จจำหน่ายแอดมิด (วันนั้นอยู่ในบิลรวม)
  const isAdmitDay = (pet, visit) => admitCovered.has(`${pet.hn}|${visit.date}`);
  const hasReceipt = (pet, visit) => rcptKeys.has(`${pet.hn}|${visit.q || ''}|${visit.date}`) || isAdmitDay(pet, visit);
  const selStats = useMemo(() => {
    const cats = {};
    selVisits.forEach(({ visit }) => { const c = caseCategory(visit, queueByQ); cats[c] = (cats[c] || 0) + 1; });
    return cats;
  }, [selVisits, queueByQ]);
  // รายรับตามใบเสร็จ = แหล่งความจริง (ตรงกับแดชบอร์ด/สรุปรายรับ)
  const receiptTotal = receiptRevByDate[selDate] || 0;
  // เคสที่ทำ+คิดเงินแล้วแต่ "ยังไม่มีใบเสร็จ" (ต้นเหตุยอดไม่ตรงกับอีก 2 หน้า)
  const noReceiptVisits = selVisits.filter(({ pet, visit }) => itemTotal(visit.items) > 0 && !hasReceipt(pet, visit));
  const noReceiptSum = noReceiptVisits.reduce((s, { visit }) => s + itemTotal(visit.items), 0);

  const fmt = (d) => {
    const [y, m2, day] = d.split('-');
    return `${parseInt(day)} ${THAI_MONTHS[parseInt(m2) - 1]} ${parseInt(y) + 543}`;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── Calendar ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head" style={{ background: 'var(--navy)', color: '#fff', justifyContent: 'space-between' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 6px' }}>‹</button>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{THAI_MONTHS[month]} {year + 543}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 6px' }}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--paper)' }}>
          {DAYS_SHORT.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', padding: '7px 0', fontSize: 12, fontWeight: 700, color: i === 0 ? '#C05050' : 'var(--ink-soft)' }}>{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: 6, background: 'var(--surface)' }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const count = (visitsByDate[dateStr] || []).length;
            const isToday = dateStr === todayISO();
            const isSel = dateStr === selDate;
            return (
              <button key={i} onClick={() => setSelDate(dateStr)}
                style={{
                  border: isSel ? '2px solid var(--navy)' : isToday ? '2px solid var(--mint-deep)' : '1.5px solid transparent',
                  borderRadius: 8, padding: '5px 2px', cursor: 'pointer',
                  background: isSel ? 'var(--navy-soft)' : heatColor(count),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  minHeight: 46, transition: 'all .1s',
                }}>
                <span style={{ fontSize: 13, fontWeight: isSel || isToday ? 800 : 500, color: count >= 4 && !isSel ? '#fff' : 'var(--ink)' }}>{d}</span>
                {count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: isSel ? 'var(--navy)' : 'rgba(0,0,0,.12)', color: isSel ? '#fff' : heatText(count), borderRadius: 99, minWidth: 18, textAlign: 'center', padding: '1px 4px' }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 11.5, color: 'var(--ink-faint)', borderTop: '1px solid var(--line)' }}>
          <span>เคส/วัน:</span>
          {[['#D4F0E0','1'],['#7EC8A0','2–3'],['#3E9E6A','4–6'],['#1A6E45','7+']].map(([bg, label]) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: bg, display: 'inline-block', border: '1px solid rgba(0,0,0,.1)' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Day Detail ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Date header */}
        <div className="card card-pad" style={{ background: selVisits.length > 0 ? 'var(--navy)' : 'var(--surface)', color: selVisits.length > 0 ? '#fff' : 'var(--ink)' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{fmt(selDate)}</div>
          {selVisits.length > 0 ? (
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{selVisits.length}</div>
                <div style={{ fontSize: 12, opacity: .8 }}>เคสทั้งหมด</div>
              </div>
              {Object.entries(selStats).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 12, opacity: .8 }}>{k}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtB(receiptTotal)}</div>
                <div style={{ fontSize: 12, opacity: .8 }}>รายรับ (ตามใบเสร็จ)</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-faint)' }}>ไม่มีเคสในวันนี้</div>
          )}
        </div>

        {/* เตือนเมื่อมีเคสที่คิดเงินแล้วแต่ยังไม่ออกใบเสร็จ — ต้นเหตุยอดไม่ตรงกับแดชบอร์ด/สรุปรายรับ */}
        {noReceiptVisits.length > 0 ? (
          <div className="card card-pad" style={{ background: 'var(--butter-soft)', border: '1px solid var(--butter)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#A05A00' }}>
              ⚠️ {noReceiptVisits.length} เคสยังไม่ออกใบเสร็จ — {fmtB(noReceiptSum)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              เคสเหล่านี้บันทึกประวัติ+คิดเงินแล้ว แต่ยังไม่มีใบเสร็จ จึง<b>ไม่ถูกนับเป็นรายรับ</b>ในหน้าแดชบอร์ด/สรุปรายรับ
              (ยอดตามใบเสร็จ {fmtB(receiptTotal)} · ถ้ารวมส่วนนี้ = {fmtB(receiptTotal + noReceiptSum)}).
              แก้โดยเปิดเคส → กด “ชำระเงิน + ใบเสร็จ” เพื่อออกใบย้อนหลัง
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {noReceiptVisits.map(({ pet, visit }, i) => (
                <button key={i} onClick={() => onOpenPet && onOpenPet(pet.hn)}
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--butter)', background: 'var(--surface)', color: '#A05A00', borderRadius: 99, padding: '3px 10px' }}>
                  {pet.name} · {fmtB(itemTotal(visit.items))} ›
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Case list */}
        {selVisits.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-head">
              <span style={{ fontWeight: 700, fontSize: 14 }}>รายการเคส</span>
              <span className="chip">{selVisits.length} เคส</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selVisits.map(({ pet, visit }, i) => {
                const total = itemTotal(visit.items);
                const cat = caseCategory(visit, queueByQ);
                const catColors = CAT_COLORS;
                const admitDay = isAdmitDay(pet, visit);
                const missingReceipt = total > 0 && !hasReceipt(pet, visit);
                return (
                  <button key={i} onClick={() => onOpenPet && onOpenPet(pet.hn)}
                    style={{ padding: '12px 16px', borderBottom: i < selVisits.length - 1 ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start', width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: onOpenPet ? 'pointer' : 'default', transition: 'background .12s' }}
                    onMouseEnter={e => { if (onOpenPet) e.currentTarget.style.background = 'var(--paper)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{SPECIES_EMOJI[pet.species] || '🐾'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{pet.name}</span>
                        <DeceasedTag pet={pet} />
                        <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>HN {pet.hn} · {pet.species}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: catColors[cat] || '#5E8A93', background: (catColors[cat] || '#5E8A93') + '18', borderRadius: 6, padding: '1px 7px' }}>{cat}</span>
                        {admitDay ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--powder-deep)', background: 'var(--powder-soft)', borderRadius: 6, padding: '1px 7px' }}>🏥 แอดมิด · รวมบิลวันจำหน่าย</span>
                          : missingReceipt ? <span style={{ fontSize: 11, fontWeight: 800, color: '#A05A00', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 6, padding: '1px 7px' }}>⚠️ ยังไม่ออกใบเสร็จ</span> : null}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3 }}>
                        {visit.cc && <span><b>CC:</b> {visit.cc}</span>}
                        {visit.dx && <span style={{ marginLeft: 10 }}><b>Dx:</b> {visit.dx}</span>}
                      </div>
                      {(visit.items || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {visit.items.map((c, j) => (
                            <span key={j} className="chip" style={{ fontSize: 11.5 }}>{c[0]} {c[1] > 1 ? `×${c[1]}` : ''}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {visit.vet && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{visit.vet}</div>}
                      {total > 0 && <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginTop: 3 }}>{fmtB(total)}</div>}
                      {onOpenPet && <div style={{ fontSize: 11, color: 'var(--mint-deep)', marginTop: 4 }}>ดูรายละเอียด ›</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { HistoryView });
