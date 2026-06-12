// ── Pet shop POS + Stock management ─────────────────────────
var { useState, useEffect, useRef, useMemo } = React;
function PetShop({ stock, onCheckout }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');
  const [cart, setCart] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const cats = ['ทั้งหมด', 'อาหาร', 'ของใช้', 'เวชภัณฑ์', 'ยา'];

  const items = stock.filter((s) =>
    (cat === 'ทั้งหมด' || s.cat === cat) &&
    (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())));

  const inCart = (id) => cart.find((c) => c.id === id);
  const add = (p) => {
    const ex = inCart(p.id);
    const have = stock.find((s) => s.id === p.id);
    if (ex) {
      if (ex.qty >= have.qty) return;
      setCart(cart.map((c) => c.id === p.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      if (have.qty <= 0) return;
      setCart([...cart, { id: p.id, name: p.name, price: p.price, unit: p.unit, qty: 1 }]);
    }
  };
  const step = (id, d) => setCart(cart
    .map((c) => c.id === id ? { ...c, qty: c.qty + d } : c)
    .filter((c) => c.qty > 0));
  const total = cart.reduce((s, c) => s + c.qty * c.price, 0);

  return (
    <div className="pos-grid">
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-wrap" style={{ maxWidth: 320 }}>
            <Icon name="search" size={16} />
            <input className="search-input" placeholder="ค้นหาสินค้า..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            {cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        </div>
        <div className="prod-grid">
          {items.map((p) => {
            const out = p.qty <= 0;
            const low = !out && p.qty <= p.min;
            return (
              <div key={p.id} className="prod-card" style={out ? { opacity: .45, cursor: 'not-allowed' } : null}
                onClick={() => !out && add(p)}>
                <div className="prod-emoji" style={{ background: 'var(--powder-soft)' }}>{p.emoji || '📦'}</div>
                <div className="p-name">{p.name}</div>
                <div className="p-stock">
                  {out ? <span className="chip chip-alert" style={{ fontSize: 11 }}>หมดสต็อก</span>
                    : low ? <span className="chip chip-butter" style={{ fontSize: 11 }}>ใกล้หมด · เหลือ {p.qty}</span>
                      : `คงเหลือ ${p.qty} ${p.unit}`}
                </div>
                <div className="p-price">{fmtB(p.price)}</div>
              </div>
            );
          })}
          {items.length === 0 ? <div className="queue-empty" style={{ gridColumn: '1/-1' }}>ไม่พบสินค้า</div> : null}
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 76 }}>
        <div className="card-head"><span><Icon name="cart" size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />ตะกร้า</span>
          <span className="chip chip-navy">{cart.reduce((s, c) => s + c.qty, 0)} ชิ้น</span>
        </div>
        <div className="card-pad">
          {cart.length === 0 ? <div className="queue-empty">ตะกร้าว่าง — แตะสินค้าเพื่อเพิ่ม</div> : (
            <div>
              {cart.map((c) => (
                <div className="cart-line" key={c.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.3 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{fmtB(c.price)} / {c.unit}</div>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => step(c.id, -1)}>−</button>
                    <span className="qv">{c.qty}</span>
                    <button onClick={() => step(c.id, 1)}>+</button>
                  </div>
                  <div style={{ width: 64, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{(c.qty * c.price).toLocaleString()}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <span style={{ color: 'var(--ink-soft)' }}>ยอดรวม</span>
                <span style={{ fontWeight: 800, fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>{fmtB(total)}</span>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowPay(true)}>
                <Icon name="cash" size={18} /> ชำระเงิน
              </button>
            </div>
          )}
        </div>
      </div>

      {showPay ? (
        <ReceiptModal
          title="ชำระเงิน — เพ็ทช้อป" items={cart}
          noVat={true}
          onClose={() => setShowPay(false)}
          onConfirm={(method, t) => { setShowPay(false); setCart([]); onCheckout(cart, method, t); }}
          confirmLabel="รับชำระเงิน"
        />
      ) : null}
    </div>
  );
}

function StockView({ stock, onAdjust, onAddItem }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');
  const [showAdd, setShowAdd] = useState(false);
  const [nf, setNf] = useState({ name: '', cat: 'ยา', unit: 'เม็ด', qty: '', min: '', price: '', cost: '', dose: '' });
  const cats = ['ทั้งหมด', 'ยา', 'เวชภัณฑ์', 'อาหาร', 'ของใช้'];
  const lowCount = stock.filter((s) => s.qty <= s.min).length;

  const items = stock.filter((s) =>
    (cat === 'ทั้งหมด' || s.cat === cat) &&
    (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ maxWidth: 320 }}>
          <Icon name="search" size={16} />
          <input className="search-input" placeholder="ค้นหาในสต็อก..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {lowCount > 0 ? <span className="chip chip-butter"><Icon name="alert" size={13} /> ใกล้หมด {lowCount} รายการ</span> : null}
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} /> เพิ่มสินค้า</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>สินค้า</th><th>หมวด</th><th className="num">ต้นทุน</th><th className="num">ราคาขาย</th><th className="num">กำไร</th><th className="num">คงเหลือ</th><th>สถานะ</th><th style={{ width: 130 }}>ปรับสต็อก</th></tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const out = s.qty <= 0, low = !out && s.qty <= s.min;
              const margin = s.cost ? Math.round((s.price - s.cost) / s.price * 100) : null;
              return (
                <tr key={s.id} style={low || out ? { background: 'var(--butter-soft)' } : null}>
                  <td><span style={{ marginRight: 8 }}>{s.emoji || '📦'}</span><b>{s.name}</b></td>
                  <td><span className="chip">{s.cat}</span></td>
                  <td className="num">{s.cost ? fmtB(s.cost) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                  <td className="num">{fmtB(s.price)}</td>
                  <td className="num">{margin !== null
                    ? <span style={{ color: margin >= 30 ? 'var(--mint-deep)' : margin >= 15 ? 'var(--butter-deep)' : 'var(--blush-deep)', fontWeight: 600 }}>{margin}%</span>
                    : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{s.qty} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>{s.unit}</span></td>
                  <td>
                    {out ? <span className="chip chip-alert">หมด</span>
                      : low ? <span className="chip chip-butter">ใกล้หมด (ขั้นต่ำ {s.min})</span>
                        : <span className="chip chip-mint">ปกติ</span>}
                  </td>
                  <td>
                    <div className="qty-stepper">
                      <button onClick={() => onAdjust(s.id, -1)}>−</button>
                      <span className="qv">{s.qty}</span>
                      <button onClick={() => onAdjust(s.id, +1)}>+</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 26 }}>ไม่พบสินค้า</td></tr> : null}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <Modal title="เพิ่มสินค้าใหม่" onClose={() => setShowAdd(false)}
          footer={<>
            <button className="btn" onClick={() => setShowAdd(false)}>ยกเลิก</button>
            <button className="btn btn-primary" disabled={!nf.name.trim()} onClick={() => {
              onAddItem({ ...nf, qty: parseInt(nf.qty) || 0, min: parseInt(nf.min) || 0, price: parseFloat(nf.price) || 0 });
              setShowAdd(false);
              setNf({ name: '', cat: 'ยา', unit: 'เม็ด', qty: '', min: '', price: '', dose: '' });
            }}><Icon name="check" size={16} /> บันทึก</button>
          </>}>
          <div className="form-grid">
            <Field label="ชื่อสินค้า *"><input className="input" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} autoFocus /></Field>
            <div className="form-grid" style={{ gap: 13 }}>
              <Field label="หมวด">
                <select className="select" value={nf.cat} onChange={(e) => setNf({ ...nf, cat: e.target.value })}>
                  {['ยา', 'เวชภัณฑ์', 'อาหาร', 'ของใช้'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="หน่วย"><input className="input" value={nf.unit} onChange={(e) => setNf({ ...nf, unit: e.target.value })} /></Field>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 13 }} >
              <Field label="จำนวนเริ่มต้น"><input className="input" type="number" value={nf.qty} onChange={(e) => setNf({ ...nf, qty: e.target.value })} /></Field>
              <Field label="ขั้นต่ำแจ้งเตือน"><input className="input" type="number" value={nf.min} onChange={(e) => setNf({ ...nf, min: e.target.value })} /></Field>
              <Field label="ต้นทุน (฿)"><input className="input" type="number" value={nf.cost} onChange={(e) => setNf({ ...nf, cost: e.target.value })} placeholder="0" /></Field>
            </div>
            <Field label="ราคาขาย (฿)"><input className="input" type="number" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} />
              {nf.cost && nf.price && parseFloat(nf.price) > 0 ? (
                <span style={{ fontSize: 12, color: 'var(--mint-deep)', marginTop: 4, display: 'block' }}>
                  กำไร: {Math.round((parseFloat(nf.price) - parseFloat(nf.cost)) / parseFloat(nf.price) * 100)}%
                </span>
              ) : null}
            </Field>
            {nf.cat === 'ยา' ? <Field label="วิธีใช้เริ่มต้น (สำหรับฉลากยา)"><input className="input" value={nf.dose} onChange={(e) => setNf({ ...nf, dose: e.target.value })} placeholder="เช่น ครั้งละ 1 เม็ด วันละ 2 ครั้ง" /></Field> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

Object.assign(window, { PetShop, StockView });
