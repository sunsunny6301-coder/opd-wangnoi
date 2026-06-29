// ──────────────────────────────────────────────────────────────────────────────
// Vercel Cron — ส่ง SMS เตือนนัดอัตโนมัติทุกวัน 08:00 น. (เวลาไทย = 01:00 UTC)
//
// ตั้งค่า Env Vars ใน Vercel Dashboard → Project → Settings → Environment Variables:
//
//   SUPABASE_URL           https://lvybmnzuzsefsizgszaf.supabase.co
//   SUPABASE_SERVICE_KEY   <Service Role key: Supabase → Settings → API → service_role>
//   SMS2PRO_API_KEY        <API Key จาก SMS2PRO Dashboard>
//   SMS2PRO_SENDER         <Sender name ≤11 chars เช่น WangNoiVet — ต้องสมัครกับ SMS2PRO>
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

// ส่ง SMS ผ่าน SMS2PRO HTTP API
async function sendViaSms2Pro(phone, message, apiKey, sender) {
  const resp = await fetch('https://www.sms2pro.com/member/send_sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ api_key: apiKey, msisdn: phone, message, sender }),
  });
  const body = await resp.text();
  return { ok: resp.ok, httpStatus: resp.status, body };
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

    const msg = `แจ้งเตือนนัด ${appt.petName} (${appt.type}) ${targetDisplay}`
      + (appt.time ? ` ${appt.time} น.` : '')
      + (appt.note ? ` ${appt.note}` : '')
      + ` วังน้อยสัตวแพทย์ โทร 0822813207`;

    try {
      const r = await sendViaSms2Pro(phone, msg, SMS_KEY, SMS_SENDER);
      results.push({ id: appt.id, petName: appt.petName, phone, msg, ...r });
      if (r.ok) sentIds.add(appt.id);
    } catch (e) {
      results.push({ id: appt.id, petName: appt.petName, phone, ok: false, error: e.message });
    }
  }

  // ── บันทึก reminderSent กลับ Supabase ──────────────────────────────────────
  if (sentIds.size > 0) {
    const updatedAppointments = appointments.map(a =>
      sentIds.has(a.id)
        ? { ...a, reminderSent: true, reminderSentAt: targetIso }
        : a
    );

    try {
      await fetch(`${SB_URL}/rest/v1/app_state?id=eq.main`, {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          data: { ...appState, appointments: updatedAppointments },
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // SMS ส่งแล้วแต่ mark ไม่ได้ — log ไว้ได้ แต่ไม่ fail ทั้ง request
      console.error('[send-reminders] Supabase patch failed:', e.message);
    }
  }

  return res.status(200).json({
    targetDate: targetIso,
    total: toRemind.length,
    sent: sentIds.size,
    failed: toRemind.length - sentIds.size,
    results,
  });
};
