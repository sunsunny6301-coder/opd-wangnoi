// ── Daily History Calendar ────────────────────────────────────
var { useState, useMemo } = React;

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function classifyVisit(items) {
  const cats = { วัคซีน: 0, ผ่าตัด: 0, แล็บ: 0, OPD: 0 };
  (items || []).forEach(([name]) => {
    const n = name.toLowerCase();
    if (n.includes('วัคซีน') || n.includes('vaccine')) cats['วัคซีน']++;
    else if (n.includes('ผ่าตัด') || n.includes('ทำหมัน') || n.includes('surgery')) cats['ผ่าตัด']++;
    else if (n.includes('เลือด') || n.includes('x-ray') || n.includes('แล็บ') || n.includes('cbc')) cats['แล็บ']++;
    else cats['OPD']++;
  });
  return cats;
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

function HistoryView({ pets }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selDate, setSelDate] = useState(today.toISOString().slice(0, 10));

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

  // Day stats
  const daySummary = (entries) => {
    const cats = { วัคซีน: 0, ผ่าตัด: 0, แล็บ: 0, OPD: 0 };
    entries.forEach(({ visit }) => {
      const c = classifyVisit(visit.items);
      Object.keys(cats).forEach((k) => cats[k] += c[k]);
    });
    return cats;
  };

  const selStats = daySummary(selVisits);
  const selTotal = selVisits.reduce((s, { visit }) =>
    s + (visit.items || []).reduce((ss, c) => ss + (c[1] || 1) * (c[2] || 0), 0), 0);

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
            const isToday = dateStr === today.toISOString().slice(0, 10);
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
              {Object.entries(selStats).filter(([, v]) => v > 0).map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 12, opacity: .8 }}>{k}</div>
                </div>
              ))}
              {selTotal > 0 && (
                <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtB(selTotal)}</div>
                  <div style={{ fontSize: 12, opacity: .8 }}>รายรับรวม</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-faint)' }}>ไม่มีเคสในวันนี้</div>
          )}
        </div>

        {/* Case list */}
        {selVisits.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-head">
              <span style={{ fontWeight: 700, fontSize: 14 }}>รายการเคส</span>
              <span className="chip">{selVisits.length} เคส</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selVisits.map(({ pet, visit }, i) => {
                const cats = classifyVisit(visit.items);
                const total = (visit.items || []).reduce((s, c) => s + (c[1] || 1) * (c[2] || 0), 0);
                const cat = Object.entries(cats).find(([, v]) => v > 0)?.[0] || 'OPD';
                const catColors = { วัคซีน: '#3A8F6A', ผ่าตัด: '#8C3028', แล็บ: '#3A3F8F', OPD: '#5E8A93' };
                return (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: i < selVisits.length - 1 ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{SPECIES_EMOJI[pet.species] || '🐾'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{pet.name}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>HN {pet.hn} · {pet.species}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: catColors[cat], background: catColors[cat] + '18', borderRadius: 6, padding: '1px 7px' }}>{cat}</span>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
