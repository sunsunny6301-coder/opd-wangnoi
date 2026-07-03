// ──────────────────────────────────────────────────────────────────────────────
// ดึงเครดิต SMS คงเหลือ/ใช้ไป จาก SMS2PRO (Profile API) — โชว์ป้ายมุมเว็บ
//   GET https://portal.sms2pro.com/sms-api/profile/get-balance
//   Header: Authorization: Bearer {SMS2PRO_API_KEY}, Accept: application/json
//   คืน "total remaining sms unit + used sms unit" (ชื่อ field จริงยังไม่ชัด → ดึงแบบยืดหยุ่น + คืน raw)
// ──────────────────────────────────────────────────────────────────────────────

'use strict';

// ค้นหาค่าตัวเลขจาก key ที่ชื่อตรงกับ keyNames (ค้นลึกทุกชั้นของ object)
function deepFindNumber(obj, keyNames) {
  const targets = keyNames.map((k) => k.toLowerCase());
  const queue = [obj];
  while (queue.length) {
    const cur = queue.shift();
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur)) {
        const isNum = typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
        if (targets.includes(k.toLowerCase()) && isNum) return Number(v);
        if (v && typeof v === 'object') queue.push(v);
      }
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  const origin = (req.headers.origin || '').replace(/^https?:\/\//, '');
  if (origin && !/(^|\.)vercel\.app$/.test(origin) && origin !== 'localhost') {
    return res.status(403).json({ error: 'origin ไม่ได้รับอนุญาต' });
  }
  const SMS_KEY = process.env.SMS2PRO_API_KEY;
  if (!SMS_KEY) return res.status(500).json({ error: 'ยังไม่ได้ตั้ง SMS2PRO_API_KEY' });

  try {
    const r = await fetch('https://portal.sms2pro.com/sms-api/profile/get-balance', {
      method: 'GET',
      headers: { Authorization: `Bearer ${SMS_KEY}`, Accept: 'application/json' },
    });
    const rawText = await r.text();
    let data; try { data = JSON.parse(rawText); } catch (e) { data = rawText; }

    // ดึงเครดิตแบบยืดหยุ่น (เผื่อชื่อ field ต่างกัน)
    const remaining = deepFindNumber(data, [
      'remaining', 'remaining_sms', 'remaining_unit', 'remaining_sms_unit', 'remaining_credit',
      'sms_unit', 'unit', 'credit', 'credit_remaining', 'balance', 'remain', 'sms_remaining',
    ]);
    const used = deepFindNumber(data, [
      'used', 'used_sms', 'used_unit', 'used_sms_unit', 'used_credit', 'sms_used',
    ]);

    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok, httpStatus: r.status, remaining, used, raw: data,
    });
  } catch (e) {
    return res.status(500).json({ error: 'เชื่อมต่อ SMS2PRO ไม่ได้: ' + e.message });
  }
};
