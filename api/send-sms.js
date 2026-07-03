// ──────────────────────────────────────────────────────────────────────────────
// ส่ง SMS "เดี๋ยวนี้" ผ่าน SMS2PRO (WangNoiVet) — เรียกจากปุ่ม "ส่ง SMS" ในเว็บ
//
// ทำไมต้องมี endpoint นี้: API key ของ SMS2PRO ห้ามอยู่ในเว็บ (frontend) เพราะใครก็เห็นได้
// → เว็บ POST มาที่นี่ แล้ว server (ถือ key ใน env) ยิงให้ · ใช้ env เดียวกับ cron:
//   SMS2PRO_API_KEY, SMS2PRO_SENDER
//
// ⚠️ ความปลอดภัย: endpoint นี้เปิดให้เว็บเรียก (แอปไม่มีระบบล็อกอิน) — มีการกัน cross-site
//   ด้วย Origin + จำกัด ≤3 ข้อความ/ครั้ง แต่ถ้ามีคนรู้ URL ก็อาจยิงเปลืองเครดิตได้
//   → เก็บ URL เว็บไว้เป็นความลับ · ถ้าต้องการแน่นหนากว่านี้ค่อยเพิ่มระบบล็อกอินภายหลัง
// ──────────────────────────────────────────────────────────────────────────────

'use strict';

// ต้องตรงกับ sendViaSms2Pro ใน api/send-reminders.js
// POST https://portal.sms2pro.com/sms-api/message-sms/send · body JSON: { recipient, sender_name, message }
async function sendViaSms2Pro(phone, message, apiKey, sender) {
  const resp = await fetch('https://portal.sms2pro.com/sms-api/message-sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ recipient: phone, sender_name: sender, message }),
  });
  const raw = await resp.text();
  let body; try { body = JSON.parse(raw); } catch (e) { body = raw; }
  return { ...evalSms2ProResult(resp, body), body };
}

// ตรวจผลจาก SMS2PRO — ต้องตรงกับใน api/send-reminders.js (success=status "success", system_code 1000)
function evalSms2ProResult(resp, body) {
  let ok = resp.ok;
  let apiCode = null;
  if (body && typeof body === 'object') {
    apiCode = body.system_code != null ? body.system_code
            : body.code != null ? body.code
            : body.status != null ? body.status : null;
    const statusStr = typeof body.status === 'string' ? body.status.toLowerCase() : '';
    if (statusStr) ok = /success/.test(statusStr);
    else if (body.code != null) ok = Number(body.code) >= 0;
  }
  return { ok, httpStatus: resp.status, apiCode };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'ใช้ POST เท่านั้น' });
  }
  // กัน cross-site: อนุญาตเฉพาะที่มาจากโดเมนแอปเอง (curl ไม่มี Origin ยังผ่านไว้ทดสอบ)
  const origin = (req.headers.origin || '').replace(/^https?:\/\//, '');
  if (origin && !/(^|\.)vercel\.app$/.test(origin) && origin !== 'localhost') {
    return res.status(403).json({ error: 'origin ไม่ได้รับอนุญาต' });
  }

  const SMS_KEY = process.env.SMS2PRO_API_KEY;
  const SMS_SENDER = (process.env.SMS2PRO_SENDER || 'WangNoiVet').slice(0, 11);
  if (!SMS_KEY) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้ง SMS2PRO_API_KEY บน Vercel' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const phone = String(body.phone || '').replace(/[^0-9+]/g, '');
  let messages = Array.isArray(body.messages) ? body.messages : (body.message ? [body.message] : []);
  messages = messages.map((m) => String(m || '').trim()).filter(Boolean).slice(0, 3); // ≤3 ข้อความ/ครั้ง กันสแปม

  if (!phone) return res.status(400).json({ error: 'ไม่มีเบอร์โทร' });
  if (!messages.length) return res.status(400).json({ error: 'ไม่มีข้อความ' });

  const results = [];
  let allOk = true;
  for (const m of messages) {
    try {
      const r = await sendViaSms2Pro(phone, m.slice(0, 400), SMS_KEY, SMS_SENDER);
      results.push({ msg: m, ...r });
      if (!r.ok) allOk = false;
    } catch (e) {
      results.push({ msg: m, ok: false, error: e.message });
      allOk = false;
    }
  }

  return res.status(allOk ? 200 : 502).json({
    ok: allOk,
    sent: results.filter((r) => r.ok).length,
    total: messages.length,
    results,
  });
};
