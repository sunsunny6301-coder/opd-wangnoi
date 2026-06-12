// ── เอกสารภาษี ─────────────────────────────────────────────
var { useState, useMemo, useEffect, useRef } = React;

// ── บริษัท ──
const CO = {
  name: 'บริษัท วังน้อยสัตวแพทย์ จำกัด',
  taxId: '0145568006473',
  address: '1 หมู่ที่ 7 ถนน พหลโยธินฝั่งขวา ลำไทร วังน้อย พระนครศรีอยุธยา 13170',
  branch: 'สำนักงานใหญ่',
};

const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const INCOME_TYPES = [
  { label: 'ค่าจ้างทำของ / ค่าบริการ', rate: 3 },
  { label: 'ค่าวิชาชีพอิสระ (ทันตแพทย์ เภสัชกร)', rate: 3 },
  { label: 'ค่าเช่าอสังหาริมทรัพย์', rate: 5 },
  { label: 'ค่าเช่าทรัพย์สินอื่น', rate: 5 },
  { label: 'ค่าโฆษณา', rate: 2 },
  { label: 'ค่าขนส่ง', rate: 1 },
  { label: 'เงินรางวัล / ค่านายหน้า', rate: 3 },
  { label: 'อื่นๆ', rate: 3 },
];
const SALARY_TYPES = [
  { label: 'เงินเดือน / ค่าจ้าง', rate: 0 },
  { label: 'โบนัส / เงินพิเศษ', rate: 0 },
  { label: 'ค่าล่วงเวลา', rate: 0 },
];

const SEED_WHT = [
  { id:'wht1', date:'2026-06-15', form:'ภ.ง.ด.3', payeeName:'พิชชาภา กุลฉิม', taxId:'150997015630', address:'198 หมู่ที่ 2 ต.ขี้เหล็ก อ.แม่แตง จ.เชียงใหม่', incomeType:'ค่าจ้างทำของ / ค่าบริการ', detail:'ค่าทำหมัน', amount:6380, rate:3, taxWithheld:191.40 },
  { id:'wht2', date:'2026-06-15', form:'ภ.ง.ด.3', payeeName:'นิธิศ มากมี', taxId:'199600256672', address:'กรุงเทพมหานคร', incomeType:'ค่าจ้างทำของ / ค่าบริการ', detail:'ค่าทำหมัน', amount:9010, rate:3, taxWithheld:270.30 },
];

const LS_TAX = 'wnvet_tax';

function loadTax() {
  try { const r = localStorage.getItem(LS_TAX); if (r) return JSON.parse(r); } catch(e) {}
  return { purchaseTax: [], whtRecords: SEED_WHT };
}
function saveTax(data) { try { localStorage.setItem(LS_TAX, JSON.stringify(data)); } catch(e) {} }

function n2(n) { return Math.round(Number(n) * 100) / 100; }
function fmtN(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dateTH(d) { if (!d) return ''; const [y,m,day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${parseInt(y)+543}`; }

function dlFile(name, content, mime) {
  const b = new Blob(['\ufeff'+content], { type: mime||'text/plain;charset=utf-8' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href=u; a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
}

function getTotal(items) {
  return (items||[]).reduce((s,c) => Array.isArray(c) ? s+(Number(c[1])||1)*(Number(c[2])||0) : s+(Number(c.qty)||1)*(Number(c.price)||0), 0);
}

function buildSalesTx(pets, receipts) {
  const txs = []; let seq = 0;
  const sorted = [...(pets||[])].flatMap(p=>(p.visits||[]).map(v=>({v,p}))).sort((a,b)=>a.v.date.localeCompare(b.v.date));
  sorted.forEach(({v,p})=>{
    const total = n2(getTotal(v.items)); if (total <= 0) return; seq++;
    const y = v.date.slice(0,4);
    txs.push({ id:'opd_'+seq, invNo:`INV-${y}-${String(seq).padStart(6,'0')}`, date:v.date, buyerName:p.owner.name, buyerTaxId:'-', vatScope:'ทั้งหมด', total, beforeVat:n2(total/1.07), vat:n2(total-total/1.07), hasVat:true });
  });
  (receipts||[]).filter(r=>r.type==='shop').forEach(r=>{
    seq++;
    txs.push({ id:'shop_'+seq, invNo:r.no, date:r.date, buyerName:'-', buyerTaxId:'-', vatScope:'-', total:n2(r.total), beforeVat:n2(r.total), vat:0, hasVat:false });
  });
  return txs.sort((a,b)=>b.date.localeCompare(a.date));
}

// ── Copy Button ──
function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(()=>setOk(false), 1500); };
  return <button className="btn btn-sm" style={{ padding:'2px 8px', fontSize:11 }} onClick={copy}>{ok?'✓':'คัดลอก'}</button>;
}

// ── Purchase Tax Form Modal ──
function PurchaseFormModal({ onClose, onSave, edit }) {
  const [f, setF] = useState(edit || { date: new Date().toISOString().slice(0,10), invNo:'', sellerName:'', taxId:'', detail:'', total:'', rate:7 });
  const setV = k => e => setF({...f,[k]:e.target.value});
  const beforeVat = f.total ? n2(Number(f.total)/1.07) : 0;
  const vat = f.total ? n2(Number(f.total)-beforeVat) : 0;
  return (
    <Modal title={edit?'แก้ไขรายการภาษีซื้อ':'เพิ่มรายการภาษีซื้อ'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={()=>{if(!f.sellerName||!f.total)return; onSave({...f,id:edit?.id||'pt_'+Date.now(),beforeVat,vat,total:Number(f.total)});onClose();}} disabled={!f.sellerName||!f.total}>บันทึก</button></>}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="วันที่ *"><input className="input" type="date" value={f.date} onChange={setV('date')} /></Field>
        <Field label="เลขที่ใบกำกับภาษี"><input className="input" value={f.invNo} onChange={setV('invNo')} placeholder="TAX-XXXX" /></Field>
        <Field label="ชื่อผู้ขาย *"><input className="input" value={f.sellerName} onChange={setV('sellerName')} placeholder="บริษัท / ชื่อ" /></Field>
        <Field label="เลข Tax ID"><input className="input" value={f.taxId} onChange={setV('taxId')} placeholder="0000000000000" /></Field>
        <Field label="รายละเอียด" style={{gridColumn:'1/-1'}}><input className="input" value={f.detail} onChange={setV('detail')} placeholder="รายการซื้อ" /></Field>
        <Field label="ยอดรวม (รวม VAT) *"><input className="input" type="number" value={f.total} onChange={setV('total')} placeholder="0.00" /></Field>
        <Field label="มูลค่าก่อน VAT / VAT 7%"><div style={{display:'flex',gap:8,alignItems:'center',height:40}}><span style={{fontWeight:700,fontSize:13.5}}>{fmtN(beforeVat)}</span><span style={{color:'var(--ink-faint)'}}>/ </span><span style={{fontWeight:700,color:'var(--blush-deep)',fontSize:13.5}}>{fmtN(vat)}</span></div></Field>
      </div>
    </Modal>
  );
}

// ── WHT Certificate Print Modal ──
function WHTCertModal({ record, onClose }) {
  const { payeeName, taxId, address, incomeType, detail, amount, rate, taxWithheld, date, form } = record;
  const [yr, mo, day] = date.split('-');
  const dateTHStr = `${parseInt(day)} ${['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][parseInt(mo)-1]} ${parseInt(yr)+543}`;
  const isOnce = true;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', width:700, maxHeight:'90vh', overflowY:'auto', borderRadius:8, boxShadow:'0 8px 40px rgba(0,0,0,.3)', display:'flex', flexDirection:'column' }}>
        {/* toolbar (no-print) */}
        <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid #ddd', background:'#F9F9F9' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>🖨 หนังสือรับรองการหักภาษี ณ ที่จ่าย — {form}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={()=>window.print()}>🖨 พิมพ์ / บันทึก PDF</button>
            <button className="btn btn-sm" onClick={onClose}>ปิด</button>
          </div>
        </div>
        {/* certificate */}
        <div id="wht-cert" style={{ padding:'28px 40px', fontFamily:"'Sarabun', 'Noto Sans Thai', sans-serif", fontSize:13, color:'#000', lineHeight:1.7 }}>
          {/* header */}
          <div style={{ textAlign:'center', marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:800, textDecoration:'underline' }}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
            <div style={{ fontSize:12, marginTop:3 }}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
          </div>
          {/* payer section */}
          <div style={{ border:'1px solid #999', padding:'10px 14px', marginBottom:10, borderRadius:4 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:6, borderBottom:'1px solid #ddd', paddingBottom:4 }}>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)</div>
            <div style={{ display:'grid', gridTemplateColumns:'90px 1fr', gap:'4px 8px' }}>
              <span style={{ color:'#555' }}>ชื่อ</span>
              <span style={{ fontWeight:600 }}>{CO.name}</span>
              <span style={{ color:'#555' }}>เลขประจำตัว</span>
              <span style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:2 }}>{CO.taxId.split('').map((c,i)=>[0,1,4,5,7,10].includes(i)?c+'  ':c).join('')}</span>
              <span style={{ color:'#555' }}>ที่อยู่</span>
              <span>{CO.address}</span>
              <span style={{ color:'#555' }}>สาขา</span>
              <span>{CO.branch}</span>
            </div>
          </div>
          {/* payee section */}
          <div style={{ border:'1px solid #999', padding:'10px 14px', marginBottom:10, borderRadius:4 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:6, borderBottom:'1px solid #ddd', paddingBottom:4 }}>ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)</div>
            <div style={{ display:'grid', gridTemplateColumns:'90px 1fr', gap:'4px 8px' }}>
              <span style={{ color:'#555' }}>ชื่อ</span>
              <span style={{ fontWeight:600 }}>{payeeName}</span>
              <span style={{ color:'#555' }}>เลขประจำตัว</span>
              <span style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:2 }}>{taxId || '—'}</span>
              <span style={{ color:'#555' }}>ที่อยู่</span>
              <span>{address || '—'}</span>
            </div>
          </div>
          {/* income table */}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, marginBottom:10 }}>
            <thead>
              <tr style={{ background:'#F0F0F0' }}>
                <th style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'left' }}>ประเภทเงินได้ที่จ่าย</th>
                <th style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'center', width:110 }}>วัน เดือน ปี ที่จ่าย</th>
                <th style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', width:110 }}>จำนวนเงินที่จ่าย</th>
                <th style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'center', width:80 }}>อัตรา (%)</th>
                <th style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', width:110 }}>ภาษีที่หัก</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border:'1px solid #999', padding:'6px 10px' }}>{incomeType}{detail ? ` — ${detail}` : ''}</td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'center' }}>{dateTHStr}</td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fmtN(amount)}</td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'center' }}>{rate}</td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#8B0000' }}>{fmtN(taxWithheld)}</td>
              </tr>
              {[...Array(3)].map((_,i)=>(
                <tr key={i}><td style={{ border:'1px solid #999', padding:'6px 10px', height:28 }}>&nbsp;</td><td style={{ border:'1px solid #999' }}></td><td style={{ border:'1px solid #999' }}></td><td style={{ border:'1px solid #999' }}></td><td style={{ border:'1px solid #999' }}></td></tr>
              ))}
              <tr style={{ background:'#F8F8F8' }}>
                <td colSpan={2} style={{ border:'1px solid #999', padding:'6px 10px', fontWeight:700, textAlign:'right' }}>ยอดรวม</td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', fontWeight:800 }}>{fmtN(amount)}</td>
                <td style={{ border:'1px solid #999' }}></td>
                <td style={{ border:'1px solid #999', padding:'6px 10px', textAlign:'right', fontWeight:800, color:'#8B0000' }}>{fmtN(taxWithheld)}</td>
              </tr>
            </tbody>
          </table>
          {/* footer checkboxes */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:600, fontSize:12.5, marginBottom:6 }}>ออกให้ในกรณี</div>
            <div style={{ display:'flex', gap:24 }}>
              <label style={{ display:'flex', gap:7, alignItems:'center', cursor:'pointer' }}>
                <input type="checkbox" defaultChecked={isOnce} style={{ width:14, height:14 }} />
                <span>(1) ออกให้ครั้งเดียว — หัก ณ ที่จ่ายครั้งเดียวไม่เสมอไป</span>
              </label>
              <label style={{ display:'flex', gap:7, alignItems:'center', cursor:'pointer' }}>
                <input type="checkbox" style={{ width:14, height:14 }} />
                <span>(2) ออกให้ครั้งอื่น ๆ — หัก ฃ ที่จ่ายทุกครั้ง</span>
              </label>
            </div>
          </div>
          {/* signature */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:30, marginTop:24 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ borderTop:'1px solid #999', paddingTop:6, marginTop:40 }}>
                <div>(ลงชื่อส่วนผู้มีหน้าที่หักภาษี)</div>
                <div style={{ marginTop:4, fontWeight:600 }}>{CO.name}</div>
                <div style={{ marginTop:4, color:'#555' }}>วันที่ {dateTHStr}</div>
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ borderTop:'1px solid #999', paddingTop:6, marginTop:40 }}>
                <div>(ลงชื่อส่วนผู้ถูกหักภาษี)</div>
                <div style={{ marginTop:4, fontWeight:600 }}>{payeeName}</div>
                <div style={{ marginTop:4, color:'#555' }}>วันที่ ............................................</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop:14, fontSize:11.5, color:'#666', borderTop:'1px dashed #ccc', paddingTop:8 }}>
            หมายเหตุ: เอกสารฉบับนี้ออกให้ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร • {CO.name} • เลขประจำตัวผู้เสียภาษี {CO.taxId}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WHT Form Modal ──
function WHTFormModal({ onClose, onSave, edit }) {
  const [f, setF] = useState(edit || { date:new Date().toISOString().slice(0,10), form:'ภ.ง.ด.3', payeeName:'', taxId:'', address:'', incomeType:INCOME_TYPES[0].label, detail:'', amount:'', rate:3, taxWithheld:0 });
  const setV = k => e => {
    const v = e.target.value;
    if (k==='incomeType') {
      const found = INCOME_TYPES.find(t=>t.label===v) || SALARY_TYPES.find(t=>t.label===v);
      const newRate = found ? found.rate : Number(f.rate)||3;
      const tax = n2(Number(f.amount||0)*newRate/100);
      setF({...f, incomeType:v, rate:newRate, taxWithheld:tax});
    } else if (k==='amount' || k==='rate') {
      const amt = k==='amount' ? Number(v)||0 : Number(f.amount)||0;
      const rt = k==='rate' ? Number(v)||0 : Number(f.rate)||0;
      setF({...f,[k]:v, taxWithheld:n2(amt*rt/100)});
    } else setF({...f,[k]:v});
  };
  const incomeOptions = f.form==='ภ.ง.ด.1' ? SALARY_TYPES : INCOME_TYPES;
  return (
    <Modal title={edit?'แก้ไขรายการหัก ณ ที่จ่าย':'เพิ่มรายการหัก ณ ที่จ่าย'} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={()=>{if(!f.payeeName||!f.amount)return;onSave({...f,id:edit?.id||'wht_'+Date.now(),amount:Number(f.amount),rate:Number(f.rate)});onClose();}} disabled={!f.payeeName||!f.amount}>✓ บันทึก</button></>}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="วันที่ *"><input className="input" type="date" value={f.date} onChange={setV('date')} /></Field>
        <Field label="แบบยื่น"><select className="input" value={f.form} onChange={setV('form')}>{['ภ.ง.ด.1','ภ.ง.ด.3','ภ.ง.ด.53'].map(fm=><option key={fm}>{fm}</option>)}</select></Field>
        <Field label="ชื่อผู้รับเงิน *"><input className="input" value={f.payeeName} onChange={setV('payeeName')} placeholder="ชื่อ-นามสกุล / ชื่อบริษัท" /></Field>
        <Field label="เลข Tax ID"><input className="input" value={f.taxId} onChange={setV('taxId')} placeholder="0000000000000" /></Field>
        <Field label="ที่อยู่ผู้รับเงิน" style={{gridColumn:'1/-1'}}><input className="input" value={f.address} onChange={setV('address')} placeholder="ที่อยู่" /></Field>
        <Field label="ประเภทเงินได้"><select className="input" value={f.incomeType} onChange={setV('incomeType')}>{incomeOptions.map(t=><option key={t.label}>{t.label}</option>)}</select></Field>
        <Field label="รายละเอียด"><input className="input" value={f.detail} onChange={setV('detail')} placeholder="เช่น ค่าทำหมัน" /></Field>
        <Field label="จำนวนเงิน *"><input className="input" type="number" value={f.amount} onChange={setV('amount')} placeholder="0.00" /></Field>
        <Field label="อัตรา %"><input className="input" type="number" value={f.rate} onChange={setV('rate')} step={0.5} /></Field>
        <Field label="ภาษีที่หัก (คำนวณอัตโนมัติ)"><div style={{padding:'8px 12px',background:'var(--butter-soft)',borderRadius:'var(--radius-sm)',fontWeight:800,fontSize:17,color:'var(--butter-deep)'}}>{fmtN(f.taxWithheld)} บาท</div></Field>
      </div>
    </Modal>
  );
}

// ── Tab: ภาพรวม ──
function TabOverview({ selYM, salesTx, purchaseTax, whtRecords }) {
  const sales = salesTx.filter(t=>t.date.startsWith(selYM));
  const purch = purchaseTax.filter(t=>t.date.startsWith(selYM));
  const wht = whtRecords.filter(r=>r.date.startsWith(selYM));
  const outputVat = n2(sales.reduce((s,t)=>s+t.vat,0));
  const inputVat  = n2(purch.reduce((s,p)=>s+p.vat,0));
  const vatPayable = n2(outputVat-inputVat);
  const totalWHT  = n2(wht.reduce((s,r)=>s+r.taxWithheld,0));
  const totalIncome = n2(sales.reduce((s,t)=>s+t.total,0));
  const vatItems = sales.filter(t=>t.hasVat);
  const baseVat  = n2(vatItems.reduce((s,t)=>s+t.beforeVat,0));
  const deadlines = [
    {label:'ภ.พ.30 (VAT)', due:'15/7', online:'23/7', days: 34},
    {label:'ภ.ง.ด.1 (หัก ณ ที่จ่าย เงินเดือน)', due:'7/7', online:'15/7', days:26},
    {label:'ภ.ง.ด.3 (หัก ณ ที่จ่าย บุคคล)', due:'7/7', online:'15/7', days:26},
    {label:'ภ.ง.ด.53 (หัก ณ ที่จ่าย นิติบุคคล)', due:'7/7', online:'15/7', days:26},
    {label:'ประกันสังคม', due:'15/7', online:'15/7', days:34},
  ];
  const kpis = [
    {label:'ภาษีขาย (Output VAT)', value:fmtN(outputVat), sub:vatItems.length+' รายการ', bg:'#2D4B72', color:'#fff'},
    {label:'ภาษีซื้อ (Input VAT)', value:fmtN(inputVat), sub:purch.length+' รายการ', bg:'#D4550A', color:'#fff'},
    {label:'VAT ต้องชำระ', value:fmtN(vatPayable), sub:'ภาษีขาย − ภาษีซื้อ', bg:'#B0251A', color:'#fff'},
    {label:'หัก ณ ที่จ่าย', value:fmtN(totalWHT), sub:wht.length+' รายการ', bg:'#5E2D8F', color:'#fff'},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{padding:'18px 20px',borderRadius:'var(--radius)',background:k.bg,color:k.color,display:'flex',flexDirection:'column',gap:4}}>
            <div style={{fontSize:12.5,opacity:.85}}>{k.label}</div>
            <div style={{fontSize:26,fontWeight:900,fontVariantNumeric:'tabular-nums',letterSpacing:'-.01em'}}>฿{k.value}</div>
            <div style={{fontSize:12,opacity:.75}}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="card">
          <div className="card-head"><span style={{fontWeight:800}}>📋 สรุปรายได้ประจำเดือน</span></div>
          <div className="card-pad" style={{display:'flex',flexDirection:'column',gap:6}}>
            {[['รายได้รวม (รวม VAT)',fmtN(totalIncome),'var(--ink)'],['จำนวนรายการที่ชำระแล้ว',sales.length+' รายการ','var(--ink)'],['รายการที่มี VAT',vatItems.length+' รายการ','#2D4B72'],['มูลฐาน VAT (ก่อนภาษี)',fmtN(baseVat),'var(--ink)'],['ภาษีมูลค่าเพิ่ม 7%',fmtN(outputVat),'#B0251A']].map(([l,v,c],i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line-soft)',fontSize:14}}>
                <span>{l}</span><span style={{fontWeight:700,color:c}}>{typeof v==='number'?'฿'+fmtN(v):v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span style={{fontWeight:800}}>📅 ปฏิทินยื่นภาษี</span></div>
          <div className="card-pad" style={{display:'flex',flexDirection:'column',gap:8}}>
            {deadlines.map((d,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--line-soft)'}}>
                <div><div style={{fontSize:13.5,fontWeight:600}}>{d.label}</div><div style={{fontSize:11.5,color:'var(--ink-faint)'}}>กระดาษ: {d.due} | ออนไลน์: {d.online}</div></div>
                <span style={{fontSize:12,fontWeight:700,color:'#3E7D5C',background:'#ECF4EE',padding:'3px 10px',borderRadius:99}}>เหลือ {d.days} วัน</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span style={{fontWeight:800}}>⚖️ ข้อกฎหมายภาษีสำหรับสถานพยาบาลสัตว์</span></div>
        <div className="card-pad" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,fontSize:13.5}}>
          <div><div style={{fontWeight:700,color:'#2D4B72',marginBottom:6}}>ภาษีมูลค่าเพิ่ม (VAT)</div>
            <ul style={{margin:0,paddingLeft:18,display:'flex',flexDirection:'column',gap:4,color:'var(--ink-soft)'}}>
              <li>สถานพยาบาลสัตว์ไม่ได้รับยกเว้น VAT (ม.81 ยกเว้นเฉพาะการรักษาคน)</li>
              <li>บริการรักษาและยา: คิด VAT 7% (รวมในราคา)</li>
              <li>สินค้าในร้านค้า: ขึ้นอยู่กับประเภทสินค้า</li>
              <li>ต้องจดทะเบียน VAT เมื่อรายได้ &gt; 1.8 ล้านบาท/ปี</li>
            </ul>
          </div>
          <div><div style={{fontWeight:700,color:'#5E2D8F',marginBottom:6}}>หัก ณ ที่จ่าย</div>
            <ul style={{margin:0,paddingLeft:18,display:'flex',flexDirection:'column',gap:4,color:'var(--ink-soft)'}}>
              <li>พนักงาน → ภ.ง.ด.1 (หักจากเงินเดือน)</li>
              <li>จ้างบุคคลธรรมดา → ภ.ง.ด.3 (หัก 3%)</li>
              <li>จ้างนิติบุคคล → ภ.ง.ด.53 (หัก 3%)</li>
              <li>กำหนดยื่น: วันที่ 7 ของเดือนถัดไป (ออนไลน์: 15)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: รายงานภาษีขาย ──
function TabSalesVat({ selYM, salesTx, monthLabel }) {
  const rows = salesTx.filter(t=>t.date.startsWith(selYM));
  const totBefore = n2(rows.reduce((s,r)=>s+r.beforeVat,0));
  const totVat = n2(rows.reduce((s,r)=>s+r.vat,0));
  const totTotal = n2(rows.reduce((s,r)=>s+r.total,0));
  function exportExcel() {
    const hdr = ['ลำดับ','วันที่','เลขที่ใบกำกับภาษี','ชื่อผู้ซื้อ','เลข Tax ID','ขอบเขต VAT','มูลค่าก่อน VAT','VAT 7%','ยอดรวม'];
    const csvRows = [hdr,...rows.map((r,i)=>[i+1,dateTH(r.date),r.invNo,r.buyerName,r.buyerTaxId,r.vatScope,r.beforeVat,r.vat,r.total])];
    dlFile(`ภาษีขาย_${selYM}.csv`, csvRows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }
  return (
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-head">
        <span style={{fontWeight:800}}>📄 รายงานภาษีขาย — {monthLabel}</span>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-sm btn-mint" onClick={exportExcel}>📊 Excel</button>
          <button className="btn btn-sm btn-blush" onClick={()=>window.print()}>📕 PDF</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr><th>ลำดับ</th><th>วันที่</th><th>เลขที่ใบกำกับภาษี</th><th>ชื่อผู้ซื้อ</th><th>เลข Tax ID</th><th>ขอบเขต VAT</th><th className="num">มูลค่าก่อน VAT</th><th className="num" style={{color:'var(--blush-deep)'}}>VAT 7%</th><th className="num">ยอดรวม</th></tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={9} className="search-empty">ยังไม่มีรายการภาษีขายในเดือนนี้</td></tr>}
            {rows.map((r,i)=>(
              <tr key={r.id}>
                <td style={{color:'var(--ink-faint)',fontSize:12}}>{i+1}</td>
                <td>{dateTH(r.date)}</td>
                <td style={{fontFamily:'monospace',fontSize:12.5}}>{r.invNo}</td>
                <td style={{fontWeight:600}}>{r.buyerName}</td>
                <td style={{color:'var(--ink-faint)',fontSize:12.5}}>{r.buyerTaxId}</td>
                <td><span className="chip" style={{fontSize:11}}>{r.vatScope}</span></td>
                <td className="num">{fmtN(r.beforeVat)}</td>
                <td className="num" style={{fontWeight:700,color:'var(--blush-deep)'}}>{fmtN(r.vat)}</td>
                <td className="num" style={{fontWeight:700}}>{fmtN(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{background:'var(--navy)',color:'#fff'}}>
            <td colSpan={6} style={{padding:'10px 16px',fontWeight:700}}>รวมทั้งสิ้น ({rows.length} รายการ)</td>
            <td className="num" style={{fontWeight:800}}>{fmtN(totBefore)}</td>
            <td className="num" style={{fontWeight:800,color:'#FBBF24'}}>{fmtN(totVat)}</td>
            <td className="num" style={{fontWeight:800}}>{fmtN(totTotal)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Tab: รายงานภาษีซื้อ ──
function TabPurchaseVat({ selYM, purchaseTax, setPurchaseTax, monthLabel }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const rows = purchaseTax.filter(t=>t.date.startsWith(selYM));
  const totBefore=n2(rows.reduce((s,r)=>s+r.beforeVat,0));
  const totVat=n2(rows.reduce((s,r)=>s+r.vat,0));
  const totTotal=n2(rows.reduce((s,r)=>s+r.total,0));
  const saveItem = item => setPurchaseTax(prev=>{
    if (editItem) return prev.map(p=>p.id===item.id?item:p);
    return [...prev, item];
  });
  const del = id => setPurchaseTax(prev=>prev.filter(p=>p.id!==id));
  function exportExcel(){
    const hdr=['ลำดับ','วันที่','เลขที่ใบกำกับภาษี','ชื่อผู้ขาย','เลข Tax ID','รายละเอียด','มูลค่าก่อน VAT','VAT 7%','ยอดรวม'];
    const csvRows=[hdr,...rows.map((r,i)=>[i+1,dateTH(r.date),r.invNo||'-',r.sellerName,r.taxId||'-',r.detail||'-',r.beforeVat,r.vat,r.total])];
    dlFile(`ภาษีซื้อ_${selYM}.csv`,csvRows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'),'text/csv;charset=utf-8');
  }
  return (
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-head">
        <span style={{fontWeight:800}}>🟠 รายงานภาษีซื้อ — {monthLabel}</span>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-sm btn-primary" onClick={()=>{setEditItem(null);setShowForm(true);}}>+ เพิ่มรายการ</button>
          <button className="btn btn-sm btn-mint" onClick={exportExcel}>📊 Excel</button>
          <button className="btn btn-sm btn-blush" onClick={()=>window.print()}>📕 PDF</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr><th>ลำดับ</th><th>วันที่</th><th>เลขที่ใบกำกับภาษี</th><th>ผู้ขาย</th><th>เลข Tax ID</th><th>รายละเอียด</th><th className="num">มูลค่าก่อน VAT</th><th className="num" style={{color:'var(--blush-deep)'}}>VAT 7%</th><th className="num">ยอดรวม</th><th></th></tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={10} className="search-empty">ยังไม่มีรายการภาษีซื้อ — กดปุ่ม "เพิ่มรายการ" เพื่อเพิ่ม</td></tr>}
            {rows.map((r,i)=>(
              <tr key={r.id}>
                <td style={{color:'var(--ink-faint)',fontSize:12}}>{i+1}</td>
                <td>{dateTH(r.date)}</td>
                <td style={{fontFamily:'monospace',fontSize:12.5}}>{r.invNo||'-'}</td>
                <td style={{fontWeight:600}}>{r.sellerName}</td>
                <td style={{color:'var(--ink-faint)',fontSize:12.5}}>{r.taxId||'-'}</td>
                <td style={{fontSize:13}}>{r.detail||'-'}</td>
                <td className="num">{fmtN(r.beforeVat)}</td>
                <td className="num" style={{fontWeight:700,color:'var(--blush-deep)'}}>{fmtN(r.vat)}</td>
                <td className="num" style={{fontWeight:700}}>{fmtN(r.total)}</td>
                <td><div style={{display:'flex',gap:4}}><button className="btn btn-sm" style={{padding:'2px 8px'}} onClick={()=>{setEditItem(r);setShowForm(true);}}>✏️</button><button className="btn btn-sm btn-blush" style={{padding:'2px 8px'}} onClick={()=>del(r.id)}>🗑</button></div></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{background:'#222',color:'#fff'}}>
            <td colSpan={6} style={{padding:'10px 16px',fontWeight:700}}>รวมทั้งสิ้น ({rows.length} รายการ)</td>
            <td className="num" style={{fontWeight:800}}>{fmtN(totBefore)}</td>
            <td className="num" style={{fontWeight:800,color:'#FBBF24'}}>{fmtN(totVat)}</td>
            <td className="num" style={{fontWeight:800}}>{fmtN(totTotal)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      {showForm ? <PurchaseFormModal onClose={()=>setShowForm(false)} onSave={saveItem} edit={editItem} /> : null}
    </div>
  );
}

// ── Tab: ภ.พ.30 ──
function TabPP30({ selYM, monthLabel, salesTx, purchaseTax }) {
  const sales = salesTx.filter(t=>t.date.startsWith(selYM)&&t.hasVat);
  const purch = purchaseTax.filter(t=>t.date.startsWith(selYM));
  const baseVat = n2(sales.reduce((s,t)=>s+t.beforeVat,0));
  const outputVat = n2(sales.reduce((s,t)=>s+t.vat,0));
  const inputVat  = n2(purch.reduce((s,t)=>s+t.vat,0));
  const payable   = n2(outputVat - inputVat);
  const [yr, mo] = selYM.split('-');
  const moTH = `${MONTHS_FULL[parseInt(mo)-1]} พ.ศ. ${parseInt(yr)+543}`;
  function dl(type) {
    const sRows = sales.map((r,i)=>`${i+1}|${r.date}|${r.invNo}|${r.buyerName}|${r.buyerTaxId}|${r.beforeVat}|${r.vat}|${r.total}`).join('\n');
    dlFile(`${type==='sell'?'ภ.พ.30_ภาษีขาย':'ภ.พ.30_ภาษีซื้อ'}_${selYM}.txt`, sRows);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div className="card card-pad">
        <div style={{textAlign:'center',marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:18}}>แบบ ภ.พ.30</div>
          <div style={{fontSize:13,color:'var(--ink-soft)'}}>แบบแสดงรายการภาษีมูลค่าเพิ่ม ตามประมวลรัษฎากร</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:18,fontSize:13.5}}>
          <div><div style={{color:'var(--ink-faint)',fontSize:12,marginBottom:2}}>ชื่อผู้ประกอบการ</div><div style={{fontWeight:600,display:'flex',gap:8,alignItems:'center'}}>{CO.name}<CopyBtn text={CO.name}/></div></div>
          <div><div style={{color:'var(--ink-faint)',fontSize:12,marginBottom:2}}>เลขประจำตัวผู้เสียภาษี (13 หลัก)</div><div style={{fontWeight:700,fontFamily:'monospace',fontSize:15,display:'flex',gap:8,alignItems:'center'}}>{CO.taxId}<CopyBtn text={CO.taxId}/></div></div>
          <div><div style={{color:'var(--ink-faint)',fontSize:12,marginBottom:2}}>สาขา</div><div style={{fontWeight:600}}>{CO.branch}</div></div>
          <div><div style={{color:'var(--ink-faint)',fontSize:12,marginBottom:2}}>เดือนภาษี / ปีภาษี</div><div style={{fontWeight:700,display:'flex',gap:8,alignItems:'center'}}>{moTH}<CopyBtn text={moTH}/></div></div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{background:'var(--paper)'}}><th style={{padding:'10px 14px',textAlign:'left',border:'1px solid var(--line)'}}>รายการ</th><th style={{padding:'10px 14px',textAlign:'right',border:'1px solid var(--line)',width:180}}>มูลค่า (บาท)</th><th style={{padding:'10px 14px',textAlign:'right',border:'1px solid var(--line)',width:150}}>ภาษี (บาท)</th><th style={{width:40,border:'1px solid var(--line)'}}></th></tr></thead>
          <tbody>
            <tr><td style={{padding:'12px 14px',border:'1px solid var(--line)'}}><span style={{color:'#2D4B72',fontWeight:700}}>ภาษีขาย (Output Tax)</span><div style={{fontSize:12,color:'var(--ink-faint)',marginTop:2}}>จำนวนใบกำกับภาษี: {sales.length} ฉบับ</div></td><td style={{padding:'12px 14px',textAlign:'right',border:'1px solid var(--line)',color:'#2D4B72',fontWeight:700}}>{fmtN(baseVat)}</td><td style={{padding:'12px 14px',textAlign:'right',border:'1px solid var(--line)',color:'#B0251A',fontWeight:700}}>{fmtN(outputVat)}</td><td style={{border:'1px solid var(--line)',textAlign:'center'}}><button className="btn btn-sm" style={{fontSize:11,padding:'2px 6px'}} onClick={()=>dl('sell')}>📋</button></td></tr>
            <tr><td style={{padding:'12px 14px',border:'1px solid var(--line)'}}><span style={{color:'#D4550A',fontWeight:700}}>ภาษีซื้อ (Input Tax)</span><div style={{fontSize:12,color:'var(--ink-faint)',marginTop:2}}>จำนวนใบกำกับภาษีซื้อ: {purch.length} ฉบับ</div></td><td style={{padding:'12px 14px',textAlign:'right',border:'1px solid var(--line)'}}>{fmtN(purch.reduce((s,t)=>s+t.beforeVat,0))}</td><td style={{padding:'12px 14px',textAlign:'right',border:'1px solid var(--line)',color:'#D4550A',fontWeight:700}}>{fmtN(inputVat)}</td><td style={{border:'1px solid var(--line)',textAlign:'center'}}><button className="btn btn-sm" style={{fontSize:11,padding:'2px 6px'}} onClick={()=>dl('buy')}>📋</button></td></tr>
          </tbody>
          <tfoot><tr style={{background:'#1A1A2E',color:'#fff'}}><td style={{padding:'14px',fontWeight:800,fontSize:15}}>ภาษีที่ต้องชำระ (Tax Payable)</td><td></td><td style={{padding:'14px',textAlign:'right',fontWeight:900,fontSize:18,color:'#FBBF24'}}>{fmtN(payable)}</td><td style={{padding:'14px',textAlign:'center'}}><CopyBtn text={String(payable)}/></td></tr></tfoot>
        </table>
        <div style={{marginTop:16,padding:'12px 16px',background:'var(--paper)',borderRadius:'var(--radius-sm)',fontSize:12.5,color:'var(--ink-soft)'}}>
          <b>หมายเหตุ:</b> กำหนดยื่น ภ.พ.30: ภายในวันที่ 15 ของเดือนถัดไป (ออนไลน์ยื่นถึงวันที่ 23) · ต้องยื่นทุกเดือนแม้ไม่มีรายได้ (ยื่นเป็นศูนย์) · ชำระภาษีได้: สำนักงานสรรพากรพื้นที่ หรือ ผ่านระบบ e-Filing ของกรมสรรพากร
        </div>
        <div style={{display:'flex',gap:10,marginTop:16,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={()=>dl('sell')}>⬇ ไฟล์แนบรายงานภาษีขาย (.txt)</button>
          <button className="btn" style={{color:'#D4550A',borderColor:'#D4550A'}} onClick={()=>dl('buy')}>⬇ ไฟล์แนบรายงานภาษีซื้อ (.txt)</button>
          <button className="btn btn-blush" onClick={()=>window.print()}>📕 PDF ภ.พ.30</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: หัก ณ ที่จ่าย ──
function TabWHT({ selYM, monthLabel, whtRecords, setWhtRecords }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [certRecord, setCertRecord] = useState(null);
  const rows = whtRecords.filter(r=>r.date.startsWith(selYM));
  const byForm = fm => rows.filter(r=>r.form===fm);
  const cards = [
    {form:'ภ.ง.ด.1',label:'(เงินเดือน)',bg:'#3E7D5C',color:'#fff'},
    {form:'ภ.ง.ด.3',label:'(บุคคลธรรมดา)',bg:'#4A3F8F',color:'#fff'},
    {form:'ภ.ง.ด.53',label:'(นิติบุคคล)',bg:'#8C1A5E',color:'#fff'},
  ];
  const save = item => setWhtRecords(prev=>editItem ? prev.map(p=>p.id===item.id?item:p) : [...prev,item]);
  const del = id => setWhtRecords(prev=>prev.filter(p=>p.id!==id));
  function exportWHT(fm) {
    const r = byForm(fm);
    const hdr = ['ลำดับ','วันที่จ่าย','ชื่อ-นามสกุลผู้รับ','เลขประจำตัวผู้เสียภาษี','ที่อยู่','ประเภทเงินได้','รายละเอียด','จำนวนเงินที่จ่าย','อัตราภาษี(%)','ภาษีที่หัก'];
    const csvRows=[hdr,...r.map((x,i)=>[i+1,dateTH(x.date),x.payeeName,x.taxId,x.address,x.incomeType,x.detail,x.amount,x.rate,x.taxWithheld])];
    dlFile(`${fm}_${selYM}.csv`,csvRows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'),'text/csv;charset=utf-8');
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {cards.map(c=>{const r=byForm(c.form);const tot=n2(r.reduce((s,x)=>s+x.taxWithheld,0));return(
          <div key={c.form} style={{padding:'16px 20px',borderRadius:'var(--radius)',background:c.bg,color:c.color}}>
            <div style={{fontSize:12.5,opacity:.85}}>{c.form} {c.label}</div>
            <div style={{fontSize:26,fontWeight:900,margin:'4px 0'}}>฿{fmtN(tot)}</div>
            <div style={{fontSize:12,opacity:.75}}>{r.length} รายการ | กำหนดส่ง: 7/7</div>
          </div>
        );})}
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-head">
          <span style={{fontWeight:800}}>👤 รายการหัก ณ ที่จ่าย — {monthLabel}</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-sm btn-primary" onClick={()=>{setEditItem(null);setShowForm(true);}}>+ เพิ่มรายการ</button>
            <button className="btn btn-sm btn-mint" onClick={()=>exportWHT('ภ.ง.ด.3')}>📊 Excel</button>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>ลำดับ</th><th>วันที่</th><th>แบบ</th><th>ผู้รับเงิน</th><th>Tax ID</th><th>ประเภทเงินได้</th><th className="num">จำนวนเงิน</th><th className="num">อัตรา</th><th className="num" style={{color:'#5E2D8F'}}>ภาษีที่หัก</th><th></th></tr></thead>
            <tbody>
              {rows.length===0 && <tr><td colSpan={10} className="search-empty">ยังไม่มีรายการหัก ณ ที่จ่ายในเดือนนี้</td></tr>}
              {rows.map((r,i)=>(
                <tr key={r.id}>
                  <td style={{color:'var(--ink-faint)',fontSize:12}}>{i+1}</td>
                  <td>{dateTH(r.date)}</td>
                  <td><span className="chip chip-navy" style={{fontSize:11}}>{r.form}</span></td>
                  <td style={{fontWeight:600}}>{r.payeeName}</td>
                  <td style={{fontFamily:'monospace',fontSize:12}}>{r.taxId}</td>
                  <td style={{fontSize:12.5,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.incomeType}</td>
                  <td className="num">{fmtN(r.amount)}</td>
                  <td className="num">{r.rate}%</td>
                  <td className="num" style={{fontWeight:800,color:'#5E2D8F'}}>{fmtN(r.taxWithheld)}</td>
                  <td><div style={{display:'flex',gap:4}}><button className="btn btn-sm" style={{padding:'2px 8px'}} title="ปริ้นใบรับรอง" onClick={()=>setCertRecord(r)}>🖨 ใบรับรอง</button><button className="btn btn-sm" style={{padding:'2px 8px'}} onClick={()=>{setEditItem(r);setShowForm(true);}}>✏️</button><button className="btn btn-sm btn-blush" style={{padding:'2px 8px'}} onClick={()=>del(r.id)}>🗑</button></div></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{background:'#1A1A2E',color:'#fff'}}>
              <td colSpan={6} style={{padding:'10px 16px',fontWeight:700}}>รวมทั้งสิ้น ({rows.length} รายการ)</td>
              <td className="num" style={{fontWeight:800}}>{fmtN(rows.reduce((s,r)=>s+r.amount,0))}</td>
              <td></td>
              <td className="num" style={{fontWeight:800,color:'#C4B5FD'}}>{fmtN(rows.reduce((s,r)=>s+r.taxWithheld,0))}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      </div>
      {showForm ? <WHTFormModal onClose={()=>setShowForm(false)} onSave={save} edit={editItem}/> : null}
      {certRecord ? <WHTCertModal record={certRecord} onClose={()=>setCertRecord(null)}/> : null}
    </div>
  );
}

// ── Tab: สรุปรายปี ──
function TabAnnual({ selYear, salesTx, purchaseTax, whtRecords }) {
  const months = Array.from({length:12},(_,i)=>i+1);
  const rows = months.map(m=>{
    const ym=`${selYear}-${String(m).padStart(2,'0')}`;
    const sal=salesTx.filter(t=>t.date.startsWith(ym));
    const pur=purchaseTax.filter(t=>t.date.startsWith(ym));
    const wht=whtRecords.filter(r=>r.date.startsWith(ym));
    const income=n2(sal.reduce((s,t)=>s+t.total,0));
    const outVat=n2(sal.reduce((s,t)=>s+t.vat,0));
    const inVat=n2(pur.reduce((s,t)=>s+t.vat,0));
    const vatNet=n2(outVat-inVat);
    const whtTotal=n2(wht.reduce((s,r)=>s+r.taxWithheld,0));
    return {m,ym,income,outVat,inVat,vatNet,whtTotal,taxTotal:n2(vatNet+whtTotal)};
  });
  const tot={income:n2(rows.reduce((s,r)=>s+r.income,0)),outVat:n2(rows.reduce((s,r)=>s+r.outVat,0)),inVat:n2(rows.reduce((s,r)=>s+r.inVat,0)),vatNet:n2(rows.reduce((s,r)=>s+r.vatNet,0)),whtTotal:n2(rows.reduce((s,r)=>s+r.whtTotal,0)),taxTotal:n2(rows.reduce((s,r)=>s+r.taxTotal,0))};
  const maxIncome = Math.max(...rows.map(r=>r.income), 1);
  function exportExcel() {
    const hdr=['เดือน','รายได้','ภาษีขาย','ภาษีซื้อ','VAT สุทธิ','หัก ณ ที่จ่าย','ภาษีรวม'];
    const csvRows=[hdr,...rows.map(r=>[MONTHS_SHORT[r.m-1],r.income,r.outVat,r.inVat,r.vatNet,r.whtTotal,r.taxTotal])];
    dlFile(`สรุปภาษีรายปี_${selYear}.csv`,csvRows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'),'text/csv;charset=utf-8');
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-head">
          <span style={{fontWeight:800}}>📊 สรุปภาษีรายปี — พ.ศ. {parseInt(selYear)+543} ({selYear})</span>
          <button className="btn btn-sm btn-mint" onClick={exportExcel}>📊 Export Excel</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>เดือน</th><th className="num">รายได้</th><th className="num" style={{color:'#2D4B72'}}>ภาษีขาย</th><th className="num" style={{color:'#D4550A'}}>ภาษีซื้อ</th><th className="num" style={{color:'#B0251A'}}>VAT สุทธิ</th><th className="num" style={{color:'#5E2D8F'}}>หัก ณ ที่จ่าย</th><th className="num">ภาษีรวม</th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.m} style={{opacity:r.income===0?0.4:1}}>
                  <td style={{fontWeight:600}}>{MONTHS_SHORT[r.m-1]}</td>
                  <td className="num">
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      <span style={{fontWeight:700}}>{fmtN(r.income)}</span>
                      <div style={{height:4,borderRadius:99,background:'var(--line)',overflow:'hidden'}}><div style={{height:'100%',borderRadius:99,background:'var(--navy)',width:(r.income/maxIncome*100)+'%',transition:'width .4s'}}/></div>
                    </div>
                  </td>
                  <td className="num" style={{color:'#2D4B72',fontWeight:700}}>{r.outVat>0?fmtN(r.outVat):'0.00'}</td>
                  <td className="num" style={{color:'#D4550A'}}>{r.inVat>0?fmtN(r.inVat):'0.00'}</td>
                  <td className="num" style={{color:'#B0251A',fontWeight:700}}>{fmtN(r.vatNet)}</td>
                  <td className="num" style={{color:'#5E2D8F'}}>{r.whtTotal>0?fmtN(r.whtTotal):'0.00'}</td>
                  <td className="num" style={{fontWeight:800}}>{fmtN(r.taxTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{background:'#1A1A2E',color:'#fff'}}>
              <td style={{padding:'12px 16px',fontWeight:800}}>รวมทั้งปี</td>
              <td className="num" style={{fontWeight:800}}>{fmtN(tot.income)}</td>
              <td className="num" style={{fontWeight:800,color:'#93C5FD'}}>{fmtN(tot.outVat)}</td>
              <td className="num" style={{color:'#FCA5A5'}}>{fmtN(tot.inVat)}</td>
              <td className="num" style={{color:'#FCA5A5',fontWeight:800}}>{fmtN(tot.vatNet)}</td>
              <td className="num" style={{color:'#C4B5FD'}}>{fmtN(tot.whtTotal)}</td>
              <td className="num" style={{fontWeight:900,color:'#FBBF24',fontSize:15}}>{fmtN(tot.taxTotal)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: ยื่นออนไลน์ ──
function TabEFiling({ selYM, monthLabel, salesTx, purchaseTax, whtRecords }) {
  const [yr, mo] = selYM.split('-');
  const moTH = `${MONTHS_FULL[parseInt(mo)-1]} พ.ศ. ${parseInt(yr)+543}`;
  const sales = salesTx.filter(t=>t.date.startsWith(selYM)&&t.hasVat);
  const purch = purchaseTax.filter(t=>t.date.startsWith(selYM));
  const wht3 = whtRecords.filter(r=>r.date.startsWith(selYM)&&r.form==='ภ.ง.ด.3');
  const wht53 = whtRecords.filter(r=>r.date.startsWith(selYM)&&r.form==='ภ.ง.ด.53');
  const wht1 = whtRecords.filter(r=>r.date.startsWith(selYM)&&r.form==='ภ.ง.ด.1');
  const baseVat=n2(sales.reduce((s,t)=>s+t.beforeVat,0));
  const outVat=n2(sales.reduce((s,t)=>s+t.vat,0));
  const inVat=n2(purch.reduce((s,t)=>s+t.vat,0));
  const payable=n2(outVat-inVat);
  const checks=[
    {ok:true,label:'มีเลขประจำตัวผู้เสียภาษี',sub:CO.taxId},
    {ok:true,label:'ชื่อสถานประกอบการ',sub:CO.name},
    {ok:sales.length>0,label:'ข้อมูลภาษีซื้อ-ขาย',sub:`ขาย ${sales.length} รายการ | ซื้อ ${purch.length} รายการ`},
    {ok:true,label:'ข้อมูลหัก ณ ที่จ่าย',sub:`ภ.ง.ด.1: ${wht1.length} | ภ.ง.ด.3: ${wht3.length} | ภ.ง.ด.53: ${wht53.length}`},
  ];
  function dlTxt(form,rows) {
    const lines = rows.map((r,i)=>[i+1,r.payeeName,r.taxId,r.address,r.incomeType,r.detail,r.amount,r.rate,r.taxWithheld].join('|'));
    dlFile(`${form}_${selYM}.txt`,lines.join('\n'));
  }
  function exportWHTExcel(fm, rows) {
    const hdr=['ลำดับ','วันที่จ่าย','ชื่อ-นามสกุลผู้รับ','เลขประจำตัวผู้เสียภาษี','ที่อยู่','ประเภทเงินได้','รายละเอียด','จำนวนเงินที่จ่าย','อัตราภาษี(%)','ภาษีที่หัก'];
    const csvRows=[hdr,...rows.map((r,i)=>[i+1,dateTH(r.date),r.payeeName,r.taxId,r.address,r.incomeType,r.detail,r.amount,r.rate,r.taxWithheld])];
    dlFile(`${fm}_${selYM}.csv`,csvRows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'),'text/csv;charset=utf-8');
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{borderRadius:'var(--radius)',background:'linear-gradient(135deg,#1A6E45,#2D4B72)',color:'#fff',padding:'20px 24px'}}>
        <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>☁ เตรียมยื่นภาษีออนไลน์ (e-Filing)</div>
        <div style={{opacity:.85,fontSize:13.5}}>ข้อมูลพร้อมสำหรับยื่นผ่านระบบ e-Filing กรมสรรพากร — {monthLabel}</div>
        <div style={{marginTop:10,fontSize:12.5,opacity:.75}}>กำหนดออนไลน์: ภ.พ.30 ภายใน 23/7 | ภ.ง.ด.1/3/53 ภายใน 15/7</div>
      </div>
      <div className="card card-pad">
        <div style={{fontWeight:800,fontSize:15,marginBottom:12}}>✅ เช็คลิสต์ก่อนยื่น</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {checks.map((c,i)=>(
            <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 14px',background:c.ok?'var(--mint-soft)':'var(--blush-soft)',borderRadius:'var(--radius-sm)',border:`1.5px solid ${c.ok?'var(--mint)':'var(--blush)'}`}}>
              <span style={{fontSize:18}}>{c.ok?'✅':'⚠️'}</span>
              <div><div style={{fontWeight:700,fontSize:13.5}}>{c.label}</div><div style={{fontSize:12,color:'var(--ink-soft)'}}>{c.sub}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <div style={{fontWeight:800,fontSize:14,marginBottom:12,color:'var(--ink)'}}>📋 ภ.พ.30 — แบบแสดงรายการภาษีมูลค่าเพิ่ม</div>
        <div style={{fontSize:13,color:'var(--ink-faint)',marginBottom:10}}>ค่าด้านล่างพร้อมกรอกลงในแบบฟอร์ม e-Filing — กดปุ่ม 📋 เพื่อคัดลอก</div>
        {[['ยอดขาย / ยอดให้บริการ',fmtN(baseVat)],['ภาษีมูลค่าเพิ่ม (ขาย)',fmtN(outVat)],['ยอดซื้อ / ค่าใช้จ่าย',fmtN(purch.reduce((s,t)=>s+t.beforeVat,0))],['ภาษีมูลค่าเพิ่ม (ซื้อ)',fmtN(inVat)],['ภาษีที่ต้องชำระ',fmtN(payable)]].map(([l,v],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--line-soft)',fontSize:14}}>
            <span>{l}</span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontWeight:700,color:i===4?'#B0251A':'var(--ink)',fontSize:i===4?16:14}}>{v}</span>
              <CopyBtn text={v.replace(/,/g,'')}/>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:14}}>
          <button className="btn btn-primary" onClick={()=>dlFile(`ภ.พ.30_ภาษีขาย_${selYM}.txt`,sales.map((r,i)=>[i+1,r.date,r.invNo,r.buyerName,r.buyerTaxId,r.beforeVat,r.vat,r.total].join('|')).join('\n'))}>⬇ ไฟล์แนบรายงานภาษีขาย (.txt)</button>
          <button className="btn" onClick={()=>dlFile(`ภ.พ.30_ภาษีซื้อ_${selYM}.txt`,purch.map((r,i)=>[i+1,r.date,r.invNo||'-',r.sellerName,r.taxId||'-',r.beforeVat,r.vat,r.total].join('|')).join('\n'))}>⬇ ไฟล์แนบรายงานภาษีซื้อ (.txt)</button>
        </div>
      </div>
      {[{form:'ภ.ง.ด.1',rows:wht1,label:'หัก ณ ที่จ่าย เงินเดือนพนักงาน',color:'#3E7D5C'},{form:'ภ.ง.ด.3',rows:wht3,label:'หัก ณ ที่จ่าย บุคคลธรรมดา',color:'#4A3F8F'},{form:'ภ.ง.ด.53',rows:wht53,label:'หัก ณ ที่จ่าย นิติบุคคล',color:'#8C1A5E'}].map(sec=>(
        <div key={sec.form} className="card card-pad" style={{borderLeft:`4px solid ${sec.color}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div><span style={{fontWeight:800,fontSize:14,color:sec.color}}>{sec.form} — {sec.label}</span><span style={{marginLeft:10,color:'var(--ink-faint)',fontSize:13}}>{sec.rows.length} รายการ | ภาษีรวม ฿{fmtN(sec.rows.reduce((s,r)=>s+r.taxWithheld,0))}</span></div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-sm" style={{color:sec.color,borderColor:sec.color}} onClick={()=>dlTxt(sec.form,sec.rows)}>⬇ ไฟล์แนบ {sec.form} (.txt)</button>
              <button className="btn btn-sm btn-mint" onClick={()=>exportWHTExcel(sec.form,sec.rows)}>📊 Excel</button>
            </div>
          </div>
          {sec.rows.length===0 ? <div style={{color:'var(--ink-faint)',fontSize:13,textAlign:'center',padding:'12px 0'}}>ไม่มีรายการ {sec.form} ในเดือนนี้</div> :
          <table className="tbl" style={{fontSize:12.5}}>
            <thead><tr><th>#</th><th>ผู้รับเงิน</th><th>เลขผู้เสียภาษี</th><th>ประเภทเงินได้</th><th className="num">จำนวนเงิน</th><th className="num">อัตรา %</th><th className="num">ภาษีที่หัก</th></tr></thead>
            <tbody>{sec.rows.map((r,i)=><tr key={r.id}><td style={{color:'var(--ink-faint)'}}>{i+1}</td><td style={{fontWeight:600}}>{r.payeeName}</td><td style={{fontFamily:'monospace'}}>{r.taxId}</td><td>{r.incomeType}</td><td className="num">{fmtN(r.amount)}</td><td className="num">{r.rate}%</td><td className="num" style={{fontWeight:800,color:sec.color}}>{fmtN(r.taxWithheld)}</td></tr>)}</tbody>
          </table>}
        </div>
      ))}
      <div className="card card-pad" style={{background:'#0F1B2D',color:'#fff'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
          <div><div style={{fontWeight:800,fontSize:15,marginBottom:12,color:'#93C5FD'}}>ภ.พ.30 (VAT Return)</div>
            {['เข้าเว็บไซต์ e-Filing กรมสรรพากร','เลือก "แบบ" → "ภ.พ.30"','กรอก เดือน/ปีภาษี: '+moTH,'กรอกยอดขาย: '+fmtN(baseVat),'กรอกภาษีขาย: '+fmtN(outVat),'กรอกยอดซื้อ: '+fmtN(purch.reduce((s,t)=>s+t.beforeVat,0)),'กรอกภาษีซื้อ: '+fmtN(inVat),'แนบไฟล์รายงานภาษีขาย-ซื้อ (ดาวน์โหลดจากปุ่มด้านบน)','ตรวจสอบและยื่นยันการยื่นแบบ'].map((s,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:7,fontSize:13.5,alignItems:'flex-start'}}>
                <span style={{background:'#2D4B72',color:'#fff',borderRadius:'50%',width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                <span style={{color:'#CBD5E1'}}>{s}</span>
              </div>
            ))}
          </div>
          <div><div style={{fontWeight:800,fontSize:15,marginBottom:12,color:'#C4B5FD'}}>ภ.ง.ด.1/3/53 (หัก ณ ที่จ่าย)</div>
            {['เข้าเว็บไซต์ e-Filing กรมสรรพากร','เลือก "แบบ" → เลือกแบบตามประเภท','กรอกข้อมูลหัวแบบ (เดือน/ปี/ผู้จ่าย)','เลือก "นำเข้าข้อมูลจากไฟล์" → อัพโหลดไฟล์ .txt','ระบบจะดึงข้อมูลลงในแบบอัตโนมัติ','ตรวจสอบข้อมูลให้ถูกต้อง','ยื่นยันแบบ + ชำระเงิน (ถ้ามี)'].map((s,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:7,fontSize:13.5,alignItems:'flex-start'}}>
                <span style={{background:'#5E2D8F',color:'#fff',borderRadius:'50%',width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                <span style={{color:'#CBD5E1'}}>{s}</span>
              </div>
            ))}
            <div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,.05)',borderRadius:'var(--radius-sm)',fontSize:12.5,color:'#94A3B8'}}>
              <b style={{color:'#FCD34D'}}>⚠️ หมายเหตุ:</b>
              <ul style={{margin:'6px 0 0',paddingLeft:18,display:'flex',flexDirection:'column',gap:3}}>
                <li>ไฟล์ .txt ใช้ตัวคั่น "|" (pipe) ตามรูปแบบของกรมสรรพากร</li>
                <li>กรุณาตรวจสอบข้อมูลลูกค้าก่อนยื่น</li>
                <li>ยื่นออนไลน์ได้เพิ่มจากวันที่ 7 → 15 ของเดือนถัดไป</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main TaxView ──
const TAX_TABS = ['ภาพรวม','รายงานภาษีขาย','รายงานภาษีซื้อ','ภ.พ.30','หัก ณ ที่จ่าย','สรุปรายปี','☁ ยื่นออนไลน์'];

function TaxView({ pets, receipts }) {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth()+1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [tab, setTab] = useState(0);
  const [taxState, setTaxStateRaw] = useState(loadTax);
  const setTaxState = data => { setTaxStateRaw(data); saveTax(data); };
  const setPurchaseTax = fn => setTaxState({...taxState, purchaseTax: typeof fn==='function' ? fn(taxState.purchaseTax) : fn});
  const setWhtRecords  = fn => setTaxState({...taxState, whtRecords:  typeof fn==='function' ? fn(taxState.whtRecords)  : fn});

  const selYM = `${selYear}-${String(selMonth).padStart(2,'0')}`;
  const monthLabel = `${MONTHS_FULL[selMonth-1]} พ.ศ. ${selYear+543}`;

  const salesTx = useMemo(()=>buildSalesTx(pets,receipts), [pets,receipts]);

  const yearOpts = useMemo(()=>{
    const ys = new Set([...salesTx.map(t=>parseInt(t.date.slice(0,4))), now.getFullYear()]);
    return [...ys].sort((a,b)=>b-a);
  },[salesTx]);

  const tabColors = ['var(--ink)','#2D4B72','#D4550A','#5A2DA8','#5E2D8F','#1A6E45','#1A6E45'];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {/* header */}
      <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontWeight:800,fontSize:20}}>เอกสารภาษี</div>
          <div style={{fontSize:13,color:'var(--ink-soft)'}}>สร้างเอกสารส่งภาษี คิดภาษี ตามกฎหมายไทย</div>
        </div>
        <div style={{flex:1}}></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div><div style={{fontSize:11.5,color:'var(--ink-faint)',marginBottom:3}}>เดือนภาษี</div>
            <select className="input" style={{width:130}} value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}>
              {MONTHS_FULL.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:11.5,color:'var(--ink-faint)',marginBottom:3}}>ปี</div>
            <select className="input" style={{width:130}} value={selYear} onChange={e=>setSelYear(Number(e.target.value))}>
              {yearOpts.map(y=><option key={y} value={y}>พ.ศ. {y+543} ({y})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{display:'flex',gap:0,flexWrap:'wrap',borderBottom:'2px solid var(--line)'}}>
        {TAX_TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)}
            style={{padding:'10px 18px',border:'none',cursor:'pointer',fontSize:13.5,fontWeight:tab===i?800:500,
              borderBottom:tab===i?`3px solid ${tabColors[i]}`:'3px solid transparent',
              background:tab===i?'var(--surface)':'transparent',
              color:tab===i?tabColors[i]:'var(--ink-soft)',
              marginBottom:-2,transition:'all .15s',borderRadius:'8px 8px 0 0'}}>
            {t}
          </button>
        ))}
      </div>

      {/* content */}
      {tab===0 && <TabOverview selYM={selYM} salesTx={salesTx} purchaseTax={taxState.purchaseTax} whtRecords={taxState.whtRecords} />}
      {tab===1 && <TabSalesVat selYM={selYM} salesTx={salesTx} monthLabel={monthLabel} />}
      {tab===2 && <TabPurchaseVat selYM={selYM} purchaseTax={taxState.purchaseTax} setPurchaseTax={setPurchaseTax} monthLabel={monthLabel} />}
      {tab===3 && <TabPP30 selYM={selYM} monthLabel={monthLabel} salesTx={salesTx} purchaseTax={taxState.purchaseTax} />}
      {tab===4 && <TabWHT selYM={selYM} monthLabel={monthLabel} whtRecords={taxState.whtRecords} setWhtRecords={setWhtRecords} />}
      {tab===5 && <TabAnnual selYear={selYear} salesTx={salesTx} purchaseTax={taxState.purchaseTax} whtRecords={taxState.whtRecords} />}
      {tab===6 && <TabEFiling selYM={selYM} monthLabel={monthLabel} salesTx={salesTx} purchaseTax={taxState.purchaseTax} whtRecords={taxState.whtRecords} />}
    </div>
  );
}

Object.assign(window, { TaxView });
