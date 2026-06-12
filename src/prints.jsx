// ── Tax Invoice / Receipt — ใบเสร็จรับเงิน / ใบกำกับภาษี ──
var { useState, useEffect, useRef, useMemo } = React;

const CLINIC = {
  nameTH: 'บริษัท วังน้อยสัตวแพทย์ จำกัด',
  nameEN: 'WANGNOIVETERINARY CO.,LTD.',
  addr: '1 หมู่ที่ 7 ถนน พหลโยธินฝั่งขวา ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170',
  phone: '0822813207',
  taxId: '0145568006473',
  branch: 'สำนักงานใหญ่',
};

function calcVat(subtotal, vatMode) {
  if (vatMode === 'included') {
    const beforeVat = Math.round(subtotal / 1.07 * 100) / 100;
    const vatAmt = Math.round((subtotal - beforeVat) * 100) / 100;
    return { beforeVat, vatAmt, grandTotal: subtotal };
  }
  if (vatMode === 'added') {
    const vatAmt = Math.round(subtotal * 0.07 * 100) / 100;
    return { beforeVat: subtotal, vatAmt, grandTotal: Math.round((subtotal + vatAmt) * 100) / 100 };
  }
  return { beforeVat: null, vatAmt: 0, grandTotal: subtotal };
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TaxInvoice({ items, petName, ownerName, ownerPhone, ownerAddr, ownerTaxId, method, vatMode, no }) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const { beforeVat, vatAmt, grandTotal } = calcVat(subtotal, vatMode);
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const now = new Date();
  const dateTH = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const timeTH = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const S = {
    page: { fontFamily: "'Anuphan', sans-serif", color: '#1a1a2e', fontSize: 14, lineHeight: 1.5, background: '#fff', width: '100%', maxWidth: 720, margin: '0 auto' },
    center: { textAlign: 'center' },
    hr: { border: 'none', borderTop: '2.5px solid #2a2a5a', margin: '8px 0' },
    hrDash: { border: 'none', borderTop: '1.5px dashed #aaa', margin: '6px 0' },
    titleBox: { background: '#EEEEF8', border: '1.5px solid #C0BEE8', borderRadius: 6, padding: '10px 0', textAlign: 'center', margin: '10px 0' },
    titleMain: { fontSize: 20, fontWeight: 800, color: '#1a1a2e' },
    titleSub: { fontSize: 12.5, color: '#5a5a88', marginTop: 2 },
    docRow: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 },
    label: { color: '#5a5a88', fontStyle: 'italic', marginRight: 2 },
    buyerTitle: { color: '#4040A0', fontWeight: 700, fontSize: 13.5, marginBottom: 4 },
    buyerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', fontSize: 13 },
    tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, marginTop: 12 },
    th: { background: '#f4f4fa', border: '1px solid #C8C8E0', padding: '7px 10px', fontWeight: 700, fontSize: 13 },
    td: { border: '1px solid #C8C8E0', padding: '7px 10px', verticalAlign: 'top' },
    tdNum: { border: '1px solid #C8C8E0', padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', gap: 40, padding: '3px 0', fontSize: 14 },
    summaryTotal: { display: 'flex', justifyContent: 'space-between', gap: 40, padding: '6px 0', borderTop: '1.5px solid #1a1a2e', marginTop: 4, fontSize: 16, fontWeight: 800 },
    sigLine: { borderTop: '1px solid #666', paddingTop: 6, textAlign: 'center', fontSize: 12.5, color: '#555', flex: 1 },
  };

  return (
    <div style={S.page} className="print-sheet">
      {/* ── clinic header ── */}
      <div style={S.center}>
        <img src={window.LOGO_SRC} alt="logo" style={{ width: 72, height: 72, borderRadius: '50%' }} />
        <div style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>{CLINIC.nameTH}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#444' }}>{CLINIC.nameEN}</div>
        <div style={{ fontSize: 12.5, color: '#555' }}>{CLINIC.addr}</div>
        <div style={{ fontSize: 13 }}>โทร. {CLINIC.phone}</div>
        <div style={{ fontSize: 13 }}>เลขประจำตัวผู้เสียภาษี: <b>{CLINIC.taxId}</b></div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{CLINIC.branch}</div>
      </div>

      <hr style={S.hr} />

      {/* ── title box ── */}
      <div style={S.titleBox}>
        <div style={S.titleMain}>ใบเสร็จรับเงิน / ใบกำกับภาษี</div>
        <div style={S.titleSub}>TAX INVOICE / RECEIPT</div>
      </div>

      {/* ── doc info ── */}
      <div style={S.docRow}>
        <div>
          <div><span style={S.label}>เลขที่:</span> <b>{no}</b></div>
          <div><span style={S.label}>วันที่:</span> {dateTH}</div>
          <div><span style={S.label}>เวลา:</span> {timeTH}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {ownerName ? <div><span style={S.label}>ลูกค้า:</span> <b>{ownerName}</b></div> : null}
          {petName ? <div><span style={S.label}>สัตว์เลี้ยง:</span> {petName}</div> : null}
        </div>
      </div>

      <hr style={S.hrDash} />

      {/* ── buyer info ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={S.buyerTitle}>ข้อมูลผู้ซื้อ / Buyer Information</div>
        <div style={S.buyerGrid}>
          <div>
            <div><b>ชื่อผู้ซื้อ:</b> {ownerName || '—'}</div>
            {ownerAddr ? <div style={{ fontSize: 12.5 }}><b>ที่อยู่:</b> {ownerAddr}</div> : null}
            {ownerTaxId ? <div style={{ fontSize: 12.5 }}><b>เลขผู้เสียภาษี (ลูกค้า):</b> {ownerTaxId}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><b>โทร:</b> {ownerPhone || '—'}</div>
            <div><b>สาขา:</b> {CLINIC.branch}</div>
          </div>
        </div>
      </div>

      <hr style={S.hrDash} />

      {/* ── items table ── */}
      <table style={S.tbl}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 40, textAlign: 'center' }}>#</th>
            <th style={{ ...S.th, textAlign: 'left' }}>รายการ</th>
            <th style={{ ...S.th, textAlign: 'right', width: 110 }}>ราคา/หน่วย</th>
            <th style={{ ...S.th, textAlign: 'right', width: 80 }}>จำนวน</th>
            <th style={{ ...S.th, textAlign: 'right', width: 100 }}>รวม</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={{ ...S.td, textAlign: 'center' }}>{i + 1}</td>
              <td style={S.td}>{it.name}</td>
              <td style={S.tdNum}>{fmtNum(it.price)}</td>
              <td style={S.tdNum}>{it.qty}</td>
              <td style={S.tdNum}>{fmtNum(it.qty * it.price)}</td>
            </tr>
          ))}
          <tr style={{ background: '#f4f4fa' }}>
            <td colSpan={2} style={{ ...S.td, fontWeight: 700 }}>รวม ({items.length} รายการ)</td>
            <td style={S.td}></td>
            <td style={{ ...S.tdNum, fontWeight: 700 }}>{totalQty}</td>
            <td style={{ ...S.tdNum, fontWeight: 700 }}>{fmtNum(subtotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── summary ── */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ width: 360 }}>
          <div style={S.summaryRow}>
            <span>รวมเป็นเงิน</span>
            <span>{fmtNum(subtotal)} บาท</span>
          </div>
          {vatMode !== 'none' ? <>
            <div style={S.summaryRow}>
              <span>มูลค่าสินค้า/บริการก่อนภาษี</span>
              <span>{fmtNum(beforeVat)} บาท</span>
            </div>
            <div style={S.summaryRow}>
              <span>ภาษีมูลค่าเพิ่ม (VAT 7%){vatMode === 'included' ? ' (รวมแล้ว)' : ''}</span>
              <span>{fmtNum(vatAmt)} บาท</span>
            </div>
          </> : null}
          <div style={S.summaryTotal}>
            <span>จำนวนเงินรวมทั้งสิ้น</span>
            <span>{fmtNum(grandTotal)} บาท</span>
          </div>
        </div>
      </div>

      {/* ── payment ── */}
      <div style={{ marginTop: 12, fontSize: 13.5 }}>
        <b>การชำระเงิน:</b> {method || 'เงินสด'}
      </div>

      {/* ── signatures ── */}
      <div style={{ display: 'flex', gap: 40, marginTop: 42 }}>
        <div style={S.sigLine}>ผู้รับเงิน / ผู้ออกใบกำกับภาษี</div>
        <div style={S.sigLine}>ผู้ชำระเงิน / ผู้รับบริการ</div>
      </div>

      {/* ── footer ── */}
      <div style={{ textAlign: 'center', fontSize: 12.5, color: '#777', marginTop: 14, paddingTop: 8, borderTop: '1px solid #ddd' }}>
        ขอบคุณที่ใช้บริการ / Thank you
      </div>
    </div>
  );
}

function ReceiptModal({ title, items, petName, ownerName, ownerPhone, receiptNo, onClose, onConfirm, confirmLabel, paidAlready, noVat, defaultVatMode }) {
  const [method, setMethod] = useState('เงินสด');
  const [vatMode, setVatMode] = useState(noVat ? 'none' : (defaultVatMode || 'none'));
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const { grandTotal } = calcVat(subtotal, noVat ? 'none' : vatMode);

  // ── edit buyer / bill fields ──
  const [showEditBuyer, setShowEditBuyer] = useState(false);
  const [buyerName, setBuyerName] = useState(ownerName || '');
  const [buyerPhone, setBuyerPhone] = useState(ownerPhone || '');
  const [buyerAddr, setBuyerAddr] = useState('');
  const [buyerTaxId, setBuyerTaxId] = useState('');
  const [customNo, setCustomNo] = useState('');

  // เลขที่ใบเสร็จจริงมาจากระบบรันเลขรายปี (RCP-2026-00001) — fallback เฉพาะกรณีเปิดดูโดยไม่ได้ส่งเลขมา
  const no = useMemo(() => customNo.trim() || receiptNo || `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, [customNo, receiptNo]);

  const VAT_OPTIONS = [
    { id: 'none',     label: 'ไม่มี VAT',       desc: 'ราคาปกติ' },
    { id: 'included', label: 'ราคารวม VAT 7%',   desc: 'แยกบรรทัด VAT ที่รวมอยู่แล้ว' },
    { id: 'added',    label: 'บวก VAT 7% เพิ่ม', desc: 'คิด VAT เพิ่มจากราคา' },
  ];

  return (
    <Modal title={title || 'ใบเสร็จรับเงิน / ใบกำกับภาษี'} onClose={onClose} wide
      footer={<>
        <button className="btn no-print" onClick={() => window.print()}><Icon name="printer" size={16} /> พิมพ์ใบเสร็จ</button>
        {onConfirm ? (
          <button className="btn btn-primary no-print" onClick={() => onConfirm(method, grandTotal)}>
            <Icon name="check" size={16} /> {confirmLabel || 'รับชำระเงิน'} — {fmtB(grandTotal)}
          </button>
        ) : null}
      </>}
    >
      {/* controls row */}
      <div className="no-print" style={{ display: 'flex', gap: 20, marginBottom: showEditBuyer ? 10 : 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* VAT picker */}
        {!noVat ? (
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>ตั้งค่า VAT</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {VAT_OPTIONS.map((v) => (
                <button key={v.id} onClick={() => setVatMode(v.id)} style={{
                  padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                  border: vatMode === v.id ? '2px solid var(--navy)' : '1.5px solid var(--line)',
                  background: vatMode === v.id ? 'var(--navy-soft)' : '#fff',
                  fontWeight: vatMode === v.id ? 700 : 500,
                  fontSize: 13, color: vatMode === v.id ? 'var(--navy)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                }}>
                  {v.label}
                  <div style={{ fontSize: 11, color: vatMode === v.id ? 'var(--navy)' : 'var(--ink-faint)', fontWeight: 400 }}>{v.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '7px 12px', background: 'var(--mint-soft)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--mint-deep)' }}>
            สินค้าเพ็ทช้อป — ราคาไม่รวม VAT
          </div>
        )}

        {/* payment method */}
        {!paidAlready && onConfirm ? (
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>ช่องทางชำระเงิน</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['เงินสด', 'โอนเงิน', 'บัตรเครดิต'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                  border: method === m ? '2px solid var(--navy)' : '1.5px solid var(--line)',
                  background: method === m ? 'var(--navy-soft)' : '#fff',
                  fontWeight: method === m ? 700 : 500, fontSize: 13.5,
                  color: method === m ? 'var(--navy)' : 'var(--ink-soft)', cursor: 'pointer',
                }}>{m}</button>
              ))}
            </div>
          </div>
        ) : null}

        {/* edit buyer / bill button */}
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
          <button onClick={() => setShowEditBuyer((v) => !v)} style={{
            padding: '7px 13px', borderRadius: 'var(--radius-sm)', fontSize: 13,
            border: showEditBuyer ? '2px solid var(--powder-deep)' : '1.5px solid var(--line)',
            background: showEditBuyer ? 'var(--powder-soft)' : '#fff',
            color: showEditBuyer ? 'var(--powder-deep)' : 'var(--ink-soft)',
            cursor: 'pointer', fontWeight: showEditBuyer ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="edit" size={14} /> แก้ไขข้อมูลบิล
          </button>
        </div>
      </div>

      {/* ── edit buyer panel ── */}
      {showEditBuyer && (
        <div className="no-print" style={{ background: 'var(--powder-soft)', border: '1.5px solid var(--powder-deep)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--powder-deep)', marginBottom: 2 }}>✏️ แก้ไขข้อมูลบิล (เฉพาะการพิมพ์ครั้งนี้)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="ชื่อลูกค้า">
              <input className="input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </Field>
            <Field label="เบอร์โทร">
              <input className="input" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
            </Field>
            <Field label="ที่อยู่ลูกค้า" style={{ gridColumn: '1/-1' }}>
              <input className="input" value={buyerAddr} onChange={(e) => setBuyerAddr(e.target.value)} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
            </Field>
            <Field label="เลขประจำตัวผู้เสียภาษี (ลูกค้า)">
              <input className="input" value={buyerTaxId} onChange={(e) => setBuyerTaxId(e.target.value)} placeholder="13 หลัก" maxLength={13} />
            </Field>
            <Field label="เลขที่บิล (ถ้าต้องการเปลี่ยน)">
              <input className="input" value={customNo} onChange={(e) => setCustomNo(e.target.value)} placeholder={receiptNo || 'RCP-2026-XXXXX'} />
            </Field>
          </div>
        </div>
      )}

      {/* ── the actual printable invoice ── */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '24px 28px', maxHeight: '70vh', overflowY: 'auto' }}>
        <TaxInvoice
          items={items} petName={petName}
          ownerName={buyerName || ownerName} ownerPhone={buyerPhone || ownerPhone}
          ownerAddr={buyerAddr} ownerTaxId={buyerTaxId}
          method={paidAlready || method}
          vatMode={noVat ? 'none' : vatMode}
          no={no}
        />
      </div>
    </Modal>
  );
}

function LabelModal({ drug, pet, onClose }) {
  const [inst, setInst] = useState(drug.dose || '');
  const [note, setNote] = useState('');
  return (
    <Modal title="ฉลากยา" onClose={onClose}
      footer={<button className="btn btn-primary no-print" onClick={() => window.print()}><Icon name="printer" size={16} /> พิมพ์ฉลากยา</button>}
    >
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Field label="วิธีใช้">
          <textarea className="textarea" rows="2" value={inst} onChange={(e) => setInst(e.target.value)} placeholder="เช่น ครั้งละ 1 เม็ด วันละ 2 ครั้ง เช้า-เย็น" />
        </Field>
        <Field label="คำเตือน / หมายเหตุ (ถ้ามี)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น กินจนหมด, เก็บให้พ้นแสง" />
        </Field>
      </div>
      <div className="label-paper print-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #22303E', paddingBottom: 6, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>วังน้อยสัตวแพทย์</div>
            <div style={{ fontSize: 10.5, color: '#555' }}>โทร. {CLINIC.phone}</div>
          </div>
          <div style={{ fontSize: 11.5, textAlign: 'right', color: '#555' }}>
            {new Date().toLocaleDateString('th-TH')}<br />HN {pet ? pet.hn : '-'}
          </div>
        </div>
        <div style={{ fontSize: 13 }}>สำหรับ: <b>{pet ? `${pet.name} (${pet.species})` : '-'}</b>{pet && pet.weight ? <span style={{ color: '#555' }}> · {pet.weight} kg</span> : null}</div>
        <div style={{ fontWeight: 700, fontSize: 16, margin: '6px 0 2px' }}>{drug.name} {drug.qty ? `× ${drug.qty} ${drug.unit || ''}` : ''}</div>
        <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{inst || '—'}</div>
        {note ? <div style={{ fontSize: 12, marginTop: 6, padding: '4px 8px', background: '#FAF3E2', borderRadius: 6 }}>⚠ {note}</div> : null}
        {pet && pet.allergies && pet.allergies.length ? (
          <div style={{ fontSize: 12, marginTop: 6, padding: '4px 8px', background: '#FBE3E3', borderRadius: 6, color: '#B23B36' }}>
            แพ้ยา: {pet.allergies.join(', ')}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

Object.assign(window, { ReceiptModal, LabelModal, CLINIC });
