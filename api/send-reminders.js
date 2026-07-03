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
// ใช้ข้อความ "ตามที่เลือก/พิมพ์" ตรงๆ (ไม่ย่ออัตโนมัติ) · นัดวัคซีนเอาเฉพาะส่วนวัคซีน ตัด "+ ..." ทิ้ง
function noteForSms(note, vaxOnly) {
  if (!note) return '';
  const segs = String(note).split(' และ ').map((s) => s.trim()).filter(Boolean);
  if (!vaxOnly) return segs.join(' และ ');
  const kept = [];
  for (let seg of segs) {
    const plus = seg.indexOf(' + ');
    if (plus >= 0) seg = seg.slice(0, plus).trim();
    if (seg.indexOf('วัคซีน') === 0) kept.push(seg);
  }
  return kept.join(' และ ');
}
// วันที่แบบ SMS: "1 กค 70" หรือ "1/7/70" — ปี พ.ศ. 2 หลัก
function smsDate(iso, numeric) {
  const p = String(iso || '').split('-').map(Number);
  if (!p[1] || !p[2]) return iso || '';
  const be2 = String((p[0] + 543) % 100).padStart(2, '0');
  return numeric ? `${p[2]}/${p[1]}/${be2}` : `${p[2]} ${MONTHS_TH[p[1] - 1].replace(/\./g, '')} ${be2}`;
}
// ย่อชื่อวัคซีน rule-based (ใช้เมื่อชื่อเต็มเกิน 70) — ตัด species qualifier + ยุบคำท้ายเดียวกัน
const SHORTEN_BASE = [
  ['วัคซีนรวมไข้หัดหวัดแมว', 'วัคซีนรวม'],
  ['วัคซีนรวม 5 โรคสุนัข', 'วัคซีนรวม'],
  ['วัคซีนพิษสุนัขบ้า', 'พิษสุนัขบ้า'],
];
function splitSuffix(seg) {
  if (seg.endsWith('ประจำปี')) return [seg.slice(0, -('ประจำปี'.length)).trim(), 'ประจำปี'];
  if (seg.endsWith('เข็มกระตุ้น')) return [seg.slice(0, -('เข็มกระตุ้น'.length)).trim(), '2/2'];
  const i = seg.indexOf('เข็ม');
  if (i >= 0) return [seg.slice(0, i).trim(), seg.slice(i + 'เข็ม'.length).trim()];
  return [seg, ''];
}
function shortenDetail(detail, tight) {
  if (!detail) return detail;
  const parsed = detail.split(' และ ').map((s) => {
    let x = s.trim();
    for (const [a, b] of SHORTEN_BASE) if (x.indexOf(a) === 0) { x = (b + x.slice(a.length)).trim(); break; }
    return splitSuffix(x);
  });
  const dsuf = [...new Set(parsed.map((p) => p[1]))];
  const sep = tight ? '' : ' ';
  if (parsed.length > 1 && dsuf.length === 1 && dsuf[0]) {
    const bases = parsed.map((p) => p[0]);
    return bases.join('และ') + (dsuf[0] === 'ประจำปี' ? '' : sep) + dsuf[0];
  }
  return parsed.map((p) => p[1] ? `${p[0]}${sep}${p[1]}` : p[0]).join('และ');
}
// สร้าง 1 ข้อความ — ชื่อเต็ม → ย่อ(เว้นวรรค) → ย่อ(ติดกัน) · แต่ละชั้นลอง วันไทย→ตัวเลข→ตัดท้าย
function buildOneMsg(name, isVax, effType, detailFull, date) {
  const detailSpaced = isVax ? shortenDetail(detailFull, false) : detailFull;
  const detailTight = isVax ? shortenDetail(detailFull, true) : detailFull;
  const bodyOf = (detail) => isVax
    ? 'ฉีด' + (detail || 'วัคซีน')
    : (effType && effType !== 'อื่นๆ') ? effType + (detail ? ' ' + detail : '') : (detail || '');
  const mk = (detail, numericDate, withTail) => {
    let s = `น้อง${name} ถึงนัด${bodyOf(detail)} ${smsDate(date, numericDate)}`;
    if (withTail) s += ' นี้นะครับ';
    return s.replace(/\s+/g, ' ').trim();
  };
  const attempts = [
    mk(detailFull, false, true), mk(detailFull, true, true), mk(detailFull, true, false),
    mk(detailSpaced, false, true), mk(detailSpaced, true, true), mk(detailSpaced, true, false),
    mk(detailTight, true, true), mk(detailTight, true, false),
  ];
  for (const m of attempts) if (m.length <= 70) return m;
  return attempts[attempts.length - 1];
}

// คืนอาเรย์ข้อความ 1–2 ข้อความ — คนละหมวด (ฉีดวัคซีน ↔ ยา/อื่นๆ) = คนละข้อความ · วัคซีนหลายตัวรวมข้อความเดียว
function buildReminderMsgs(appt) {
  const name = appt.petName || '';
  const isVaxType = appt.type === 'วัคซีน';
  const segs = String(appt.note || '').split(' และ ').map((s) => s.trim()).filter(Boolean);
  const vaxSegs = [], otherSegs = [];
  for (const seg of segs) {
    const plus = seg.indexOf(' + ');
    const core = plus >= 0 ? seg.slice(0, plus).trim() : seg;
    if (core.indexOf('วัคซีน') === 0) vaxSegs.push(core);
    else otherSegs.push(seg);
  }
  const msgs = [];
  if (vaxSegs.length) msgs.push(buildOneMsg(name, true, 'วัคซีน', vaxSegs.join(' และ '), appt.date));
  if (otherSegs.length) msgs.push(buildOneMsg(name, false, isVaxType ? 'อื่นๆ' : appt.type, otherSegs.join(' และ '), appt.date));
  if (!msgs.length) msgs.push(buildOneMsg(name, isVaxType, appt.type, '', appt.date));
  return msgs;
}

// ส่ง SMS ผ่าน SMS2PRO REST API (Send outbound SMS)
// endpoint: POST https://portal.sms2pro.com/sms-api/message-sms/send
// auth = Bearer API Key · body JSON: { recipient, sender_name, message }
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

    // นัดที่มีหลายหมวด (ฉีดวัคซีน + ยา/อื่นๆ) → ส่งแยกหลายข้อความ
    const msgList = buildReminderMsgs(appt);

    try {
      const perMsg = [];
      let allOk = true;
      for (const msg of msgList) {
        const r = await sendViaSms2Pro(phone, msg, SMS_KEY, SMS_SENDER);
        perMsg.push({ msg, ...r });
        if (!r.ok) allOk = false;
      }
      results.push({ id: appt.id, petName: appt.petName, phone, count: msgList.length, ok: allOk, messages: perMsg });
      if (allOk) sentIds.add(appt.id); // มาร์คส่งแล้วเฉพาะเมื่อทุกข้อความสำเร็จ (กันส่งซ้ำ)
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
          ? { ...a, reminderSent: true, reminderSentAt: targetIso, reminderVia: 'auto' }
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
