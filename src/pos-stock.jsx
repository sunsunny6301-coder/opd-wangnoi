// ── Pet shop POS + Stock management ─────────────────────────
var { useState, useEffect, useRef, useMemo } = React;

const STOCK_CATS = ['ยา', 'เวชภัณฑ์', 'อาหาร', 'ของใช้'];
const CAT_EMOJIS = { 'ยา': '💊', 'เวชภัณฑ์': '🩹', 'อาหาร': '🥫', 'ของใช้': '🧸' };
const FIELD_ALIASES = {
  name:  ['ชื่อสินค้า','ชื่อ','สินค้า','name','product','รายการ'],
  cat:   ['หมวด','ประเภท','category','cat','กลุ่ม'],
  unit:  ['หน่วย','unit'],
  qty:   ['จำนวน','คงเหลือ','จำนวนคงเหลือ','qty','stock'],
  min:   ['ขั้นต่ำ','ขั้นต่ำแจ้งเตือน','min','minimum','แจ้งเตือน'],
  price: ['ราคา','ราคาขาย','price'],
  cost:  ['ต้นทุน','cost','ราคาต้นทุน'],
  dose:  ['วิธีใช้','dose','คำแนะนำ','คำสั่งยา'],
};

function autoMapCols(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const lower = String(h).toLowerCase().trim();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!map[field] && aliases.some((a) => lower.includes(a.toLowerCase()))) map[field] = i;
    }
  });
  return map;
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const header = ['ชื่อสินค้า','หมวด','หน่วย','จำนวน','ขั้นต่ำ','ราคา','ต้นทุน','วิธีใช้'];
  const example = ['Amoxicillin 250mg','ยา','เม็ด',100,30,12,5,'ครั้งละ 1 เม็ด วันละ 2 ครั้ง'];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  XLSX.utils.book_append_sheet(wb, ws, 'สต็อก');
  XLSX.writeFile(wb, 'template_stock_import.xlsx');
}

function ExcelImportModal({ onImport, onClose }) {
  const [headers, setHeaders] = useState(null);
  const [rows, setRows] = useState(null);
  const [colMap, setColMap] = useState({});
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!json || json.length < 2) { setError('ไฟล์ไม่มีข้อมูล หรือไม่มีแถว header'); return; }
        const hdrs = json[0].map(String);
        const dataRows = json.slice(1).filter((r) => r.some((v) => v !== '' && v !== null));
        if (dataRows.length === 0) { setError('ไม่พบข้อมูลในไฟล์'); return; }
        setHeaders(hdrs);
        setRows(dataRows);
        setColMap(autoMapCols(hdrs));
        setSelected(dataRows.map((_, i) => i));
      } catch (ex) { setError('อ่านไฟล์ไม่ได้: ' + ex.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const getVal = (row, field) => colMap[field] !== undefined ? row[colMap[field]] : '';

  const buildItems = () => selected.map((i) => {
    const r = rows[i];
    const cat = String(getVal(r, 'cat') || 'ยา').trim() || 'ยา';
    return {
      name: String(getVal(r, 'name') || '').trim(),
      cat,
      unit: String(getVal(r, 'unit') || 'ชิ้น').trim(),
      qty: parseInt(getVal(r, 'qty')) || 0,
      min: parseInt(getVal(r, 'min')) || 0,
      price: parseFloat(getVal(r, 'price')) || 0,
      cost: parseFloat(getVal(r, 'cost')) || 0,
      dose: String(getVal(r, 'dose') || '').trim(),
      emoji: CAT_EMOJIS[cat] || '📦',
    };
  }).filter((item) => item.name);

  const toggleAll = () => setSelected(selected.length === rows.length ? [] : rows.map((_, i) => i));
  const toggleRow = (i) => setSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);

  return (
    <Modal title="📥 Import สินค้าจาก Excel" onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)' }} onClick={downloadTemplate}>
          ⬇ ดาวน์โหลดเทมเพลต
        </button>
        {rows && selected.length > 0 && (
          <button className="btn btn-primary" onClick={() => { onImport(buildItems()); onClose(); }}>
            <Icon name="check" size={16} /> นำเข้า {selected.length} รายการ
          </button>
        )}
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Upload zone */}
        <div style={{ border: '2px dashed var(--line)', borderRadius: 'var(--radius)', padding: 28, textAlign: 'center', cursor: 'pointer', background: 'var(--paper)' }}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          <div style={{ fontSize: 32, marginBottom: 6 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</div>
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 4 }}>รองรับ .xlsx / .xls / .csv · แถวแรกต้องเป็น header</div>
        </div>

        {error && <div style={{ background: 'var(--blush-soft)', color: 'var(--blush-deep)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>{error}</div>}

        {/* Column mapping */}
        {headers && (
          <div style={{ background: 'var(--powder-soft)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🗂 จับคู่คอลัมน์ (ระบบตรวจจับอัตโนมัติ)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[['name','ชื่อสินค้า *'],['cat','หมวด'],['unit','หน่วย'],['qty','จำนวน'],['min','ขั้นต่ำ'],['price','ราคาขาย'],['cost','ต้นทุน'],['dose','วิธีใช้']].map(([f, label]) => (
                <div key={f}>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 2 }}>{label}</div>
                  <select className="select" style={{ fontSize: 12, padding: '4px 6px' }}
                    value={colMap[f] !== undefined ? colMap[f] : ''}
                    onChange={(e) => setColMap({ ...colMap, [f]: e.target.value === '' ? undefined : parseInt(e.target.value) })}>
                    <option value="">— ไม่ใช้ —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `คอลัมน์ ${i+1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview table */}
        {rows && (
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={selected.length === rows.length} onChange={toggleAll} /></th>
                  <th>ชื่อสินค้า</th><th>หมวด</th><th>หน่วย</th>
                  <th className="num">จำนวน</th><th className="num">ราคา</th><th className="num">ต้นทุน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = String(getVal(r, 'name') || '').trim();
                  const ok = !!name;
                  return (
                    <tr key={i} style={{ background: !ok ? 'var(--blush-soft)' : selected.includes(i) ? 'transparent' : 'var(--paper)', opacity: selected.includes(i) ? 1 : 0.45 }}>
                      <td><input type="checkbox" checked={selected.includes(i)} onChange={() => toggleRow(i)} disabled={!ok} /></td>
                      <td><b>{name || <span style={{ color: 'var(--blush-deep)' }}>ไม่มีชื่อ</span>}</b></td>
                      <td><span className="chip" style={{ fontSize: 11 }}>{String(getVal(r, 'cat') || '—')}</span></td>
                      <td style={{ fontSize: 12 }}>{String(getVal(r, 'unit') || '—')}</td>
                      <td className="num">{getVal(r, 'qty') || '—'}</td>
                      <td className="num">{getVal(r, 'price') ? fmtB(parseFloat(getVal(r, 'price'))) : '—'}</td>
                      <td className="num">{getVal(r, 'cost') ? fmtB(parseFloat(getVal(r, 'cost'))) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows && (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            พบ {rows.length} แถว · เลือก {selected.length} รายการ · {rows.length - selected.length > 0 ? `ข้าม ${rows.length - selected.length} รายการ` : 'ทั้งหมด'}
          </div>
        )}
      </div>
    </Modal>
  );
}
function PetShop({ stock, onCheckout, previewReceiptNo, onDeleteItem, onAddItem, onImportStock, onUpdateItem }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');
  const [cart, setCart] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [ef, setEf] = useState({});
  const [nf, setNf] = useState({ name: '', cat: 'ของใช้', unit: 'ชิ้น', qty: '', min: '', price: '', cost: '' });
  const cats = ['ทั้งหมด', 'อาหาร', 'ของใช้', 'เวชภัณฑ์', 'ยา'];

  const openEdit = (p) => { setEditItem(p); setEf({ qty: String(p.qty ?? ''), price: String(p.price ?? ''), name: p.name, cost: String(p.cost ?? '') }); };
  const saveEdit = () => {
    if (!editItem) return;
    onUpdateItem && onUpdateItem(editItem.id, { ...editItem, qty: parseInt(ef.qty) || 0, price: parseFloat(ef.price) || 0, cost: parseFloat(ef.cost) || 0 });
    setEditItem(null);
  };

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
          <div style={{ flex: 1 }} />
          {onImportStock && <button className="btn" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)', whiteSpace: 'nowrap' }} onClick={() => setShowImport(true)}>📥 Import Excel</button>}
          {onAddItem && <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowAdd(true)}><Icon name="plus" size={16} /> เพิ่มสินค้า</button>}
        </div>
        <div className="prod-grid">
          {items.map((p) => {
            const out = p.qty <= 0;
            const low = !out && p.qty <= p.min;
            return (
              <div key={p.id} className="prod-card" style={{ position: 'relative', ...(out ? { opacity: .45, cursor: 'not-allowed' } : null) }}
                onClick={() => !out && confirmDeleteId !== p.id && editItem?.id !== p.id && add(p)}>
                {/* ✏️ edit button top-left */}
                {onUpdateItem && (
                  <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm" style={{ fontSize: 12, padding: '2px 6px', opacity: 0.6, background: 'rgba(255,255,255,0.85)' }}
                      onClick={() => openEdit(p)}>✏️</button>
                  </div>
                )}
                {/* 🗑 delete button top-right */}
                {onDeleteItem && (
                  <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
                    {confirmDeleteId === p.id ? (
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px', background: 'var(--blush-soft)', color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)', fontWeight: 700 }}
                          onClick={() => { onDeleteItem(p.id); setConfirmDeleteId(null); }}>ลบ</button>
                        <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setConfirmDeleteId(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: 12, padding: '2px 6px', opacity: 0.6, background: 'rgba(255,255,255,0.85)' }}
                        onClick={() => setConfirmDeleteId(p.id)}>🗑</button>
                    )}
                  </div>
                )}
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
          noVat={true} receiptNo={previewReceiptNo}
          onClose={() => setShowPay(false)}
          onConfirm={(method, t) => { setShowPay(false); setCart([]); onCheckout(cart, method, t); }}
          confirmLabel="รับชำระเงิน"
        />
      ) : null}

      {showImport ? (
        <ExcelImportModal
          onImport={(items) => { onImportStock && onImportStock(items); }}
          onClose={() => setShowImport(false)}
        />
      ) : null}

      {editItem ? (
        <Modal title={`✏️ แก้ไข — ${editItem.name}`} onClose={() => setEditItem(null)}
          footer={<>
            <button className="btn" onClick={() => setEditItem(null)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={saveEdit}><Icon name="check" size={16} /> บันทึก</button>
          </>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 13 }}>
            <Field label="จำนวนคงเหลือ">
              <input className="input" type="number" value={ef.qty} onChange={(e) => setEf({ ...ef, qty: e.target.value })} autoFocus />
            </Field>
            <Field label="ราคาขาย (฿)">
              <input className="input" type="number" value={ef.price} onChange={(e) => setEf({ ...ef, price: e.target.value })} />
            </Field>
            <Field label="ต้นทุน (฿)">
              <input className="input" type="number" value={ef.cost} onChange={(e) => setEf({ ...ef, cost: e.target.value })} />
            </Field>
          </div>
        </Modal>
      ) : null}

      {showAdd ? (
        <Modal title="เพิ่มสินค้าใหม่" onClose={() => setShowAdd(false)}
          footer={<>
            <button className="btn" onClick={() => setShowAdd(false)}>ยกเลิก</button>
            <button className="btn btn-primary" disabled={!nf.name.trim()} onClick={() => {
              onAddItem({ ...nf, qty: parseInt(nf.qty) || 0, min: parseInt(nf.min) || 0, price: parseFloat(nf.price) || 0, cost: parseFloat(nf.cost) || 0 });
              setShowAdd(false);
              setNf({ name: '', cat: 'ของใช้', unit: 'ชิ้น', qty: '', min: '', price: '', cost: '' });
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
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 13 }}>
              <Field label="จำนวน"><input className="input" type="number" value={nf.qty} onChange={(e) => setNf({ ...nf, qty: e.target.value })} /></Field>
              <Field label="ต้นทุน (฿)"><input className="input" type="number" value={nf.cost} onChange={(e) => setNf({ ...nf, cost: e.target.value })} /></Field>
              <Field label="ราคาขาย (฿)"><input className="input" type="number" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} /></Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function StockView({ stock, onAdjust, onAddItem, onImportStock, onDeleteItem, onClearAll, onUpdateItem }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState(null); // edit form state
  const [nf, setNf] = useState({ name: '', cat: 'ยา', unit: 'เม็ด', qty: '', min: '', price: '', cost: '', dose: '' });

  // Dynamic cats from actual data
  const cats = useMemo(() => {
    const set = new Set(stock.map((s) => s.cat).filter(Boolean));
    return ['ทั้งหมด', ...Array.from(set).sort()];
  }, [stock]);

  const lowCount = stock.filter((s) => s.qty <= s.min).length;

  const items = stock.filter((s) =>
    (cat === 'ทั้งหมด' || s.cat === cat) &&
    (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())));

  const startEdit = (s) => {
    setEditId(s.id);
    setEf({ name: s.name, cat: s.cat || 'ยา', unit: s.unit || '', qty: String(s.qty ?? ''), min: String(s.min ?? ''), price: String(s.price ?? ''), cost: String(s.cost ?? ''), dose: s.dose || '' });
    setConfirmDeleteId(null);
  };
  const saveEdit = () => {
    if (!ef.name.trim()) return;
    onUpdateItem && onUpdateItem(editId, {
      name: ef.name.trim(), cat: ef.cat, unit: ef.unit.trim(),
      qty: parseInt(ef.qty) || 0, min: parseInt(ef.min) || 0,
      price: parseFloat(ef.price) || 0, cost: parseFloat(ef.cost) || 0, dose: ef.dose,
    });
    setEditId(null); setEf(null);
  };

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
        <button className="btn" style={{ color: 'var(--mint-deep)', borderColor: 'var(--mint-deep)' }} onClick={() => setShowImport(true)}>📥 Import Excel</button>
        {confirmClear ? (
          <>
            <button className="btn" style={{ background: 'var(--blush-soft)', color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)', fontWeight: 700 }}
              onClick={() => { onClearAll && onClearAll(); setConfirmClear(false); }}>ยืนยันลบทั้งหมด ({stock.length})</button>
            <button className="btn" onClick={() => setConfirmClear(false)}>ยกเลิก</button>
          </>
        ) : (
          <button className="btn" style={{ color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)' }}
            onClick={() => setConfirmClear(true)}>🗑 ล้างทั้งหมด</button>
        )}
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} /> เพิ่มสินค้า</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>สินค้า</th><th>หมวด</th><th className="num">ต้นทุน</th><th className="num">ราคาขาย</th><th className="num">กำไร</th><th className="num">คงเหลือ</th><th>สถานะ</th><th style={{ width: 130 }}>ปรับสต็อก</th><th style={{ width: 90 }}></th></tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const out = s.qty <= 0, low = !out && s.qty <= s.min;
              const margin = s.cost ? Math.round((s.price - s.cost) / s.price * 100) : null;
              if (editId === s.id && ef) {
                // ── Edit mode row ──
                return (
                  <tr key={s.id} style={{ background: 'var(--powder-soft, #eef2ff)' }}>
                    <td colSpan="9" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>ชื่อสินค้า</div>
                          <input className="input" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })}
                            style={{ fontSize: 13 }} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditId(null); setEf(null); } }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>หมวด</div>
                          <input className="input" list={`cats-${s.id}`} value={ef.cat} onChange={(e) => setEf({ ...ef, cat: e.target.value })} style={{ fontSize: 13 }} />
                          <datalist id={`cats-${s.id}`}>
                            {cats.filter(c => c !== 'ทั้งหมด').map(c => <option key={c} value={c} />)}
                          </datalist>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>หน่วย</div>
                          <input className="input" value={ef.unit} onChange={(e) => setEf({ ...ef, unit: e.target.value })} style={{ fontSize: 13 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>จำนวน</div>
                          <input className="input" type="number" value={ef.qty} onChange={(e) => setEf({ ...ef, qty: e.target.value })} style={{ fontSize: 13 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>ขั้นต่ำ</div>
                          <input className="input" type="number" value={ef.min} onChange={(e) => setEf({ ...ef, min: e.target.value })} style={{ fontSize: 13 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>ต้นทุน (฿)</div>
                          <input className="input" type="number" value={ef.cost} onChange={(e) => setEf({ ...ef, cost: e.target.value })} style={{ fontSize: 13 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>ราคาขาย (฿)</div>
                          <input className="input" type="number" value={ef.price} onChange={(e) => setEf({ ...ef, price: e.target.value })} style={{ fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, paddingTop: 18 }}>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={saveEdit} disabled={!ef.name.trim()}>บันทึก</button>
                          <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => { setEditId(null); setEf(null); }}>✕</button>
                        </div>
                      </div>
                      {s.cat === 'ยา' || ef.cat === 'ยา' ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 3 }}>วิธีใช้ (สำหรับฉลากยา)</div>
                          <input className="input" value={ef.dose} onChange={(e) => setEf({ ...ef, dose: e.target.value })} style={{ fontSize: 13, width: '100%' }} placeholder="เช่น ครั้งละ 1 เม็ด วันละ 2 ครั้ง" />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              }
              // ── Normal row ──
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
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                      <button className="btn btn-sm" style={{ fontSize: 13, padding: '3px 7px' }} title="แก้ไข"
                        onClick={() => startEdit(s)}>✏️</button>
                      {confirmDeleteId === s.id ? (
                        <>
                          <button className="btn btn-sm" style={{ fontSize: 11, background: 'var(--blush-soft)', color: 'var(--blush-deep)', borderColor: 'var(--blush-deep)', fontWeight: 700 }}
                            onClick={() => { onDeleteItem && onDeleteItem(s.id); setConfirmDeleteId(null); }}>ลบ</button>
                          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmDeleteId(null)}>✕</button>
                        </>
                      ) : (
                        <button className="btn btn-sm" style={{ fontSize: 13, padding: '3px 7px', color: 'var(--blush-deep)' }} title="ลบ"
                          onClick={() => setConfirmDeleteId(s.id)}>🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 26 }}>ไม่พบสินค้า</td></tr> : null}
          </tbody>
        </table>
      </div>

      {showImport ? (
        <ExcelImportModal
          onImport={(items) => { onImportStock ? onImportStock(items) : items.forEach((item) => onAddItem(item)); }}
          onClose={() => setShowImport(false)}
        />
      ) : null}

      {showAdd ? (
        <Modal title="เพิ่มสินค้าใหม่" onClose={() => setShowAdd(false)}
          footer={<>
            <button className="btn" onClick={() => setShowAdd(false)}>ยกเลิก</button>
            <button className="btn btn-primary" disabled={!nf.name.trim()} onClick={() => {
              onAddItem({ ...nf, qty: parseInt(nf.qty) || 0, min: parseInt(nf.min) || 0, price: parseFloat(nf.price) || 0, cost: parseFloat(nf.cost) || 0 });
              setShowAdd(false);
              setNf({ name: '', cat: 'ยา', unit: 'เม็ด', qty: '', min: '', price: '', cost: '', dose: '' });
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
