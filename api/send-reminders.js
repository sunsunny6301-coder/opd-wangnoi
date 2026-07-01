// ──────────────────────────────────────────────────────────────────────────────
// Vercel Cron — ส่ง SMS เตือนนัดอัตโนมัติทุกวัน 08:00 น. (เวลาไทย = 01:00 UTC)
//
// ตั้งค่า Env Vars ใน Vercel Dashboard → Project → Settings → Environment Variables:
//
//   SUPABASE_URL           https://lvybmnzuzsefsizgszaf.supabase.co
//   SUPABASE_SERVICE_KEY   <Service Role key: Supabase → Settings → API → service_role>
//   SMS2PRO_API_KEY        <API Key จาก SMS2PRO → SMS API → ปุ่ม Update API Key>
//   SMS2PRO_SENDER         <ชื่อผู้ส่งที่ "อนุมัติแล้ว" — ก่อน approve ใช้ชื่อ default
//                           ที่ใช้ได้จากหน้า "ชื่อผู้ส่ง"; หลัง approve เปลี่ยนเป็น WangNoiVet
//                           (แก้ค่านี้อย่างเดียว ไม่ต้องแก้โค้ด)>
//   CRON_SECRET            <สตริงสุ่มอะไรก็ได้ เช่น opd2026secret — ปกป้อง endpoint>
//
// ทดสอบมือด้วย:
//   curl -H "Authorization: Bearer <CRON_SECRET>" \
//        "https://your-site.vercel.app/api/send-reminders?date=2026-07-15"
// ──────────────────────────────────────────────────────────────────────────────

'use strict';

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// คืนค่า { iso: 'YYYY-MM-DD', display: '15 ก.ค. 2569' } ของพรุ่งนี้ (UTC+7)
function tomorrowThai() {
  const thaiMs = Date.now() + 7 * 3_600_000;
  const d = new Date(thaiMs + 86_400_000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  return {
    iso: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    display: `${day} ${MONTHS_TH[m]} ${y + 543}`,
  };
}

// แปลง YYYY-MM-DD เป็น display ไทย (ใช้ตอน ?date=... override)
function isoToDisplay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}
// ── ต้องตรงกับ buildReminderMsg ใน src/appointments.jsx เป๊ะ ──
// ชื่อวัคซีน: [ชื่อเต็ม, ชื่อย่อ, คำท้าย] — ลองเต็มก่อน เกินค่อยย่อ · คำท้ายเหมือนกัน→ยุบครั้งเดียว
const VAX_SHORT = {
  'วัคซีนรวมไข้หัดหวัดแมว เข็มกระตุ้น': ['วัคซีนรวมไข้หัดหวัดแมว', 'วัคซีนรวม', 'เข็มกระตุ้น'],
  'วัคซีนรวมไข้หัดหวัดแมวประจำปี':     ['วัคซีนรวมไข้หัดหวัดแมว', 'วัคซีนรวม', 'ประจำปี'],
  'วัคซีนรวม 5 โรคสุนัข เข็มกระตุ้น':   ['วัคซีนรวม 5 โรคสุนัข', 'วัคซีนรวม', 'เข็มกระตุ้น'],
  'วัคซีนรวม 5 โรคสุนัขประจำปี':        ['วัคซีนรวม 5 โรคสุนัข', 'วัคซีนรวม', 'ประจำปี'],
  'วัคซีนพิษสุนัขบ้า เข็มกระตุ้น':      ['พิษสุนัขบ้า', 'พิษสุนัขบ้า', 'เข็มกระตุ้น'],
  'วัคซีนพิษสุนัขบ้า ประจำปี':          ['พิษสุนัขบ้า', 'พิษสุนัขบ้า', 'ประจำปี'],
};
const SUFFIX_SHORT = { 'เข็มกระตุ้น': 'เข็ม 2' };
function shortenNote(note, useShort, tight, shortSfx) {
  if (!note) return '';
  const sep = tight ? '' : ' ';
  const sf = (s) => shortSfx ? (SUFFIX_SHORT[s] || s) : s;
  const segs = String(note).split(' และ ').map((s) => s.trim()).filter(Boolean);
  const parsed = segs.map((s) => { const v = VAX_SHORT[s]; return v ? [useShort ? v[1] : v[0], v[2]] : [s, '']; });
  const sfx = [...new Set(parsed.map((p) => p[1]))];
  if (parsed.length > 1 && sfx.length === 1 && sfx[0]) return parsed.map((p) => p[0]).join('และ') + sf(sfx[0]);
  return parsed.map((p) => p[1] ? `${p[0]}${sep}${sf(p[1])}` : p[0]).join(' และ ');
}
// วันที่แบบ SMS: "1 กค 70" หรือ "1/7/70" — ปี พ.ศ. 2 หลัก
function smsDate(iso, numeric) {
  const p = String(iso || '').split('-').map(Number);
  if (!p[1] || !p[2]) return iso || '';
  const be2 = String((p[0] + 543) % 100).padStart(2, '0');
  return numeric ? `${p[2]}/${p[1]}/${be2}` : `${p[2]} ${MONTHS_TH[p[1] - 1].replace(/\./g, '')} ${be2}`;
}
// สร้างข้อความเตือน — ลำดับ: ชื่อเต็ม → บีบเว้นวรรค → ชื่อย่อ → วันตัวเลข → ตัด "นี้นะครับ"
function buildReminderMsg(appt) {
  const name = appt.petName || '';
  const isVax = appt.type === 'วัคซีน';
  const mk = (useShort, numericDate, withTail, tight, shortSfx) => {
    const detail = shortenNote(appt.note, useShort, tight, shortSfx) || appt.type || '';
    const body = (isVax ? 'ฉีด' : '') + detail;
    let s = `น้อง${name} ถึงนัด${body} ${smsDate(appt.date, numericDate)}`;
    if (withTail) s += tight ? 'นี้นะครับ' : ' นี้นะครับ';
    return s.replace(/\s+/g, ' ').trim();
  };
  const attempts = [
    mk(false, false, true, false, false), // ชื่อเต็ม + วันไทย + ปิดท้าย + เว้นวรรคปกติ
    mk(false, false, true, true, false),  // ชื่อเต็ม + บีบเว้นวรรค
    mk(true, false, true, false, false),  // ชื่อย่อ — ยังใช้วันไทย
    mk(true, false, true, true, false),   // ชื่อย่อ + บีบเว้นวรรค — ยังใช้วันไทย
    mk(true, false, true, true, true),    // + ย่อ "เข็มกระตุ้น" → "เข็ม 2" (คงวันไทยไว้ก่อน)
    mk(true, true, true, true, true),     // ยังเกิน → ค่อยเปลี่ยนวันเป็นตัวเลข
    mk(true, true, false, true, true),    // ยังเกิน → ตัด "นี้นะครับ"
  ];
  for (const m of attempts) if (m.length <= 70) return m;
  return attempts[attempts.length - 1];
}

// ส่ง SMS ผ่าน SMS2PRO REST API
// endpoint จากพอร์ทัล (SMS API tab): POST https://portal.sms2pro.com/sms-api
// auth = Bearer API Key, body = JSON
// ⚠️ ถ้าทดสอบแล้วได้ error เรื่อง field ให้เทียบชื่อคีย์ใน body กับแท็บ "SMS API"
//    ของพอร์ทัล แล้วแก้ที่ object ด้านล่างจุดเดียว (เช่น msisdn↔recipient↔phone)
async function sendViaSms2Pro(phone, message, apiKey, sender) {
  const resp = await fetch('https://portal.sms2pro.com/sms-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ sender, msisdn: phone, message }),
  });
  const raw = await resp.text();
  let body; try { body = JSON.parse(raw); } catch (e) { body = raw; }
  // SMS2PRO อาจตอบ HTTP 200 แต่มี code ติดลบใน body เมื่อ error (ดูตาราง Status Gateway)
  let apiCode = null;
  if (body && typeof body === 'object') {
    apiCode = body.code != null ? body.code
            : body.status != null ? body.status
            : body.error_code != null ? body.error_code : null;
  }
  const ok = resp.ok && (apiCode == null || Number(apiCode) >= 0);
  return { ok, httpStatus: resp.status, apiCode, body };
}

module.exports = async function handler(req, res) {
  // ── ตรวจสิทธิ์ด้วย CRON_SECRET ─────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = (req.headers['authorization'] || '').trim();
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized — ใส่ Authorization: Bearer <CRON_SECRET>' });
    }
  }

  // ── ตรวจ env vars ──────────────────────────────────────────────────────────
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SMS_KEY = process.env.SMS2PRO_API_KEY;
  const SMS_SENDER = (process.env.SMS2PRO_SENDER || 'WangNoiVet').slice(0, 11);

  if (!SB_URL || !SB_KEY || !SMS_KEY) {
    const missing = { SUPABASE_URL: !SB_URL, SUPABASE_SERVICE_KEY: !SB_KEY, SMS2PRO_API_KEY: !SMS_KEY };
    return res.status(500).json({ error: 'ขาด env vars', missing });
  }

  // ── โหลด app state จาก Supabase ───────────────────────────────────────────
  let appState;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.main&select=data`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return res.status(502).json({ error: `Supabase read HTTP ${r.status}` });
    const rows = await r.json();
    if (!rows.length || !rows[0].data) {
      return res.status(200).json({ sent: 0, message: 'ไม่พบ app state ใน Supabase' });
    }
    appState = rows[0].data;
  } catch (e) {
    return res.status(502).json({ error: 'Supabase fetch error', detail: e.message });
  }

  const appointments = Array.isArray(appState.appointments) ? appState.appointments : [];

  // ── หาวันที่เป้าหมาย ────────────────────────────────────────────────────────
  // ?date=YYYY-MM-DD ใช้ทดสอบ — ถ้าไม่ส่งมาใช้พรุ่งนี้จริง
  let targetIso, targetDisplay;
  const queryDate = (req.query || {}).date;
  if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
    targetIso = queryDate;
    targetDisplay = isoToDisplay(queryDate);
  } else {
    ({ iso: targetIso, display: targetDisplay } = tomorrowThai());
  }

  // ── กรอง appointments ที่ต้องส่ง ───────────────────────────────────────────
  const toRemind = appointments.filter(a =>
    a.date === targetIso &&
    a.smsAuto !== false &&
    !a.reminderSent &&
    a.status !== 'cancelled' &&
    a.phone
  );

  if (toRemind.length === 0) {
    return res.status(200).json({ sent: 0, targetDate: targetIso, message: 'ไม่มีนัดที่ต้องส่ง SMS' });
  }

  // ── ส่ง SMS ทีละนัด ─────────────────────────────────────────────────────────
  const results = [];
  const sentIds = new Set();

  for (const appt of toRemind) {
    const phone = String(appt.phone || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      results.push({ id: appt.id, petName: appt.petName, ok: false, error: 'ไม่มีเบอร์โทร' });
      continue;
    }

    const msg = buildReminderMsg(appt);

    try {
      const r = await sendViaSms2Pro(phone, msg, SMS_KEY, SMS_SENDER);
      results.push({ id: appt.id, petName: appt.petName, phone, msg, ...r });
      if (r.ok) sentIds.add(appt.id);
    } catch (e) {
      results.push({ id: appt.id, petName: appt.petName, phone, ok: false, error: e.message });
    }
  }

  // ── บันทึก reminderSent กลับ Supabase ──────────────────────────────────────
  // ⚠️ สำคัญ: cron รัน 08:00 = ช่วงคลินิกเปิด อาจมีการบันทึกข้อมูลจากแอปพร้อมกัน
  // ถ้าเขียนทับด้วย appState ที่อ่านไว้ตอนต้น (เก่าหลายวินาทีจากการส่ง SMS) ข้อมูลที่
  // คลินิกแก้ระหว่างนั้นจะหาย → ต้อง "อ่าน state ล่าสุดใหม่" แล้ว merge เฉพาะ
  // reminderSent ตาม appointment id เท่านั้น (เหมือน setState((s)=>...) ในแอป)
  let patchError = null;
  if (sentIds.size > 0) {
    try {
      const fresh = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.main&select=data`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
      const freshRows = fresh.ok ? await fresh.json() : [];
      const latest = (freshRows[0] && freshRows[0].data) ? freshRows[0].data : appState;
      const latestAppts = Array.isArray(latest.appointments) ? latest.appointments : [];

      const mergedAppts = latestAppts.map(a =>
        sentIds.has(a.id) && !a.reminderSent
          ? { ...a, reminderSent: true, reminderSentAt: targetIso }
          : a
      );

      const r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.main`, {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          data: { ...latest, appointments: mergedAppts },
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) patchError = `PATCH HTTP ${r.status}`;
    } catch (e) {
      // SMS ส่งแล้วแต่ mark ไม่ได้ — รายงานกลับไปด้วย แต่ไม่ fail ทั้ง request
      patchError = e.message;
      console.error('[send-reminders] Supabase patch failed:', e.message);
    }
  }

  return res.status(200).json({
    targetDate: targetIso,
    total: toRemind.length,
    sent: sentIds.size,
    failed: toRemind.length - sentIds.size,
    markedSent: sentIds.size > 0 && !patchError,
    patchError,
    results,
  });
};
